import type { Profile, Research } from "./types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 0 = buttoned up, 100 = says what it thinks. */
export function toneBand(value: number) {
  const v = clamp(value);
  if (v < 20)
    return {
      label: "FORMAL",
      instruction:
        "Formal and reserved. Traditional business register, complete sentences, no contractions, no exclamation marks. Respectful distance throughout.",
    };
  if (v < 40)
    return {
      label: "PROFESSIONAL",
      instruction:
        "Standard professional register. Clear and courteous, contractions sparingly, confident but never chatty.",
    };
  if (v < 60)
    return {
      label: "WARM",
      instruction:
        "Warm and professional. Natural sentence rhythm, contractions where they read better, a human voice inside a business letter.",
    };
  if (v < 80)
    return {
      label: "DIRECT",
      instruction:
        "Direct and conversational. Short sentences, active voice, plain words. Say the point first. A dry aside is welcome if it's earned.",
    };
  return {
    label: "BOLD",
    instruction:
      "Bold and distinctly human. Open with a real opinion or observation about the work, not a formality. Take a position. Stay employable — confident, not cocky, and never rude about the company.",
  };
}

/** 0 = ~130 words, 100 = ~450 words. */
export function lengthBand(value: number) {
  const v = clamp(value);
  const words = Math.round(130 + (v / 100) * 320);
  const paragraphs = v < 25 ? "2 short paragraphs" : v < 60 ? "3 paragraphs" : "4 paragraphs";
  const label = v < 25 ? "TERSE" : v < 50 ? "SHORT" : v < 75 ? "STANDARD" : "FULL";
  return {
    label,
    words,
    instruction: `Roughly ${words} words — aim within 15% either side. ${paragraphs}, excluding the greeting and sign-off.`,
  };
}

function profileBlock(p: Profile) {
  const lines: string[] = [];
  const add = (k: string, v: string | null | undefined) => {
    if (v && v.trim()) lines.push(`${k}: ${v.trim()}`);
  };

  add("Name", p.full_name);
  add("Email", p.email);
  add("Phone", p.phone);
  add("Location", p.location);
  add("Headline", p.headline);
  add("LinkedIn", p.linkedin_url);
  add("Portfolio", p.portfolio_url);

  let block = lines.join("\n") || "(no contact details on file)";

  if (p.resume_text?.trim()) {
    block += `\n\n<resume filename="${p.resume_name ?? "resume"}">\n${p.resume_text.trim()}\n</resume>`;
  }
  if (p.linkedin_text?.trim()) {
    block += `\n\n<linkedin_profile>\n${p.linkedin_text.trim()}\n</linkedin_profile>`;
  }
  if (p.notes?.trim()) {
    block += `\n\n<standing_instructions>\n${p.notes.trim()}\n</standing_instructions>`;
  }

  return block;
}

export const RESEARCH_SYSTEM = `You are the research step of a cover letter tool. You are given a job description. Search the web for what a well-prepared candidate would know before writing.

Find, where you can:
- What the company actually does, in plain terms, and who its customers are.
- Recent news: funding, launches, leadership changes, layoffs, acquisitions, press — anything from the last 18 months.
- The company's own language: how it describes its mission, values and product on its site.
- Any public signal about the team or function this role sits in.

Rules:
- Search efficiently. Five or six searches is plenty.
- Never invent a fact. If the company is small, obscure, or ambiguously named, say so plainly — an honest "little public information found" is far more useful than a guess.
- Do not editorialise about the candidate. You have not seen their resume.

Return a brief of at most 250 words as plain prose with no preamble and no markdown headings. End with a line beginning "ANGLES:" listing two or three specific, concrete hooks a cover letter could genuinely use.`;

export const WRITE_SYSTEM = `You write cover letters. One letter, nothing else.

What makes a letter work:
- It connects specific things the candidate has actually done to specific things this job needs. Every claim traces back to the resume or LinkedIn profile you were given.
- It shows real knowledge of the company, drawn from the research brief — a concrete detail, not "I admire your commitment to innovation".
- It sounds like a person wrote it in one sitting.

Hard rules:
- Never invent employers, titles, dates, metrics, degrees or skills. If the resume doesn't support a claim, leave it out. A thinner honest letter beats an impressive false one.
- If the research brief says little was found, write from the job description alone. Do not fill the gap with flattery.
- Ban list: "I am writing to express my interest", "I believe I would be a great fit", "passionate about", "proven track record", "dynamic team player", "wear many hats", "hit the ground running", "synergy", "leverage" as a verb, "delve", "tapestry", "in today's fast-paced world".
- No markdown, no bold, no bullet points, no headings, no placeholder brackets. Never write "[Company Name]" or "[Hiring Manager]" — use the real name or rephrase around it.
- Address a named person only if the job description names one; otherwise open with "Dear Hiring Team,".
- Close with "Sincerely," then the candidate's name on the next line. No contact block, no date, no address — the app adds those.

Output the letter as plain text and nothing else. No preamble, no commentary, no notes about your choices.`;

export function buildWritePrompt(args: {
  profile: Profile;
  jobText: string;
  company?: string | null;
  role?: string | null;
  jobUrl?: string | null;
  research: Research | null;
  tone: number;
  length: number;
  notes?: string | null;
}) {
  const tone = toneBand(args.tone);
  const len = lengthBand(args.length);

  const target = [
    args.role ? `Role: ${args.role}` : null,
    args.company ? `Company: ${args.company}` : null,
    args.jobUrl ? `Source: ${args.jobUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const research = args.research?.brief?.trim()
    ? `<research>\n${args.research.brief.trim()}\n</research>`
    : `<research>\nNo research was available for this company. Write from the job description alone and do not speculate about the company.\n</research>`;

  const extra = args.notes?.trim()
    ? `\n\n<this_letter_only>\n${args.notes.trim()}\n</this_letter_only>`
    : "";

  return `<candidate>
${profileBlock(args.profile)}
</candidate>

<job${target ? `>\n${target}\n` : ">\n"}
${args.jobText.trim()}
</job>

${research}

<voice>
Tone: ${tone.label}. ${tone.instruction}
Length: ${len.instruction}
</voice>${extra}

Write the cover letter now.`;
}
