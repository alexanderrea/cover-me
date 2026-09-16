import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { extractFromFile, extractFromUrl } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Turn a link or an uploaded file into plain text. Used for both the job
 * description on /new and the resume on /profile.
 */
export async function POST(req: Request) {
  if (!(await currentUser())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file received." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File is larger than 10MB." }, { status: 400 });
      }

      const extracted = await extractFromFile(file);
      if (extracted.text.length < 40) {
        return NextResponse.json(
          { error: "Almost no text came out of that file — it may be a scan." },
          { status: 422 },
        );
      }

      return NextResponse.json({ ...extracted, name: file.name });
    }

    const { url } = (await req.json()) as { url?: string };
    if (!url?.trim()) {
      return NextResponse.json({ error: "No URL received." }, { status: 400 });
    }

    return NextResponse.json(await extractFromUrl(url.trim()));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read that.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
