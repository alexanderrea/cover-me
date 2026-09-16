/**
 * Turning whatever the user hands us — a URL, a PDF, a .docx, a .txt — into
 * plain text we can put in front of the model.
 */

export type Extracted = {
  text: string;
  /** Best guess at the job title, when the source told us one. */
  role?: string;
  /** Best guess at the hiring company. */
  company?: string;
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function tidy(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip a full HTML document down to the words a human would read. */
export function htmlToText(html: string) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");

  return tidy(decodeEntities(body));
}

/**
 * Most job boards publish a schema.org JobPosting blob. When they do it is far
 * cleaner than anything we'd scrape out of the rendered page.
 */
function readJobPostingLd(html: string): Extracted | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeEntities(block[1]));
    } catch {
      continue;
    }

    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const node = queue.shift() as Record<string, unknown> | null;
      if (!node || typeof node !== "object") continue;

      if (Array.isArray(node["@graph"])) queue.push(...(node["@graph"] as unknown[]));

      const type = node["@type"];
      const isJob = Array.isArray(type) ? type.includes("JobPosting") : type === "JobPosting";
      if (!isJob || typeof node.description !== "string") continue;

      const org = node.hiringOrganization as Record<string, unknown> | undefined;
      return {
        text: htmlToText(node.description),
        role: typeof node.title === "string" ? node.title : undefined,
        company: typeof org?.name === "string" ? org.name : undefined,
      };
    }
  }

  return null;
}

/**
 * Job boards put useful-but-noisy things in <title>: "Job Application for
 * Senior Designer at Acme | Careers". Pull a role and, when it's there, a
 * company out of it. Both are pre-filled into fields the user can edit, so a
 * wrong guess costs nothing.
 */
function splitPageTitle(raw: string): { role?: string; company?: string } {
  let title = tidy(decodeEntities(raw)).split(/\s+[|·•—]\s+/)[0];

  title = title
    .replace(/^job application for\s+/i, "")
    .replace(/^(careers?|jobs?|apply)\s*[:\-]\s*/i, "")
    .replace(/\s*[-–]\s*(careers?|jobs?|job board|hiring)\s*$/i, "")
    .trim();

  const at = title.match(/^(.{2,}?)\s+(?:at|@)\s+(.{2,})$/i);
  if (at) return { role: at[1].trim(), company: at[2].trim() };

  return title ? { role: title } : {};
}

/** Reject anything that isn't a public http(s) address. */
function assertFetchable(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links can be read.");
  }

  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "0.0.0.0" ||
    host === "[::1]";

  if (isPrivate) throw new Error("That address isn't reachable from the server.");

  return url;
}

/** Job boards that reliably refuse server-side reads. Say so up front. */
const WALLED = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "dice.com",
];

export async function extractFromUrl(raw: string): Promise<Extracted> {
  const url = assertFetchable(raw);

  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: {
      // Plenty of sites serve a stub to anything that doesn't look like a
      // browser. This is politeness, not evasion — we still honour a refusal.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
      "accept-language": "en-GB,en;q=0.9",
    },
  }).catch(() => null);

  const walled = WALLED.some((d) => url.hostname.endsWith(d));

  if (!res || !res.ok) {
    throw new Error(
      walled
        ? `${url.hostname} blocks automated reads. Paste the job description text instead.`
        : `Couldn't read that page (${res ? res.status : "no response"}). Paste the text instead.`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { text: await pdfToText(buf) };
  }

  const html = await res.text();
  const fromLd = readJobPostingLd(html);
  if (fromLd && fromLd.text.length > 200) return fromLd;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = htmlToText(html);

  if (text.length < 200) {
    throw new Error(
      walled
        ? `${url.hostname} blocks automated reads. Paste the job description text instead.`
        : "That page didn't contain readable text — it may need JavaScript. Paste the text instead.",
    );
  }

  return { text, ...(title ? splitPageTitle(title[1]) : {}) };
}

async function pdfToText(buf: Buffer) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: true });
  return tidy(Array.isArray(text) ? text.join("\n") : text);
}

async function docxToText(buf: Buffer) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return tidy(value);
}

export async function extractFromFile(file: File): Promise<Extracted> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return { text: await pdfToText(buf) };
  }

  if (name.endsWith(".docx")) {
    return { text: await docxToText(buf) };
  }

  if (name.endsWith(".doc")) {
    throw new Error("Old .doc files can't be read — save as .docx or PDF first.");
  }

  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return { text: tidy(buf.toString("utf8")) };
  }

  throw new Error("Unsupported file. Use PDF, DOCX, TXT or MD.");
}
