/**
 * End-to-end check of the writing pipeline — research, then letter — using a
 * made-up candidate and job. No Supabase, no browser.
 *
 *   npm run smoke
 *
 * Costs a couple of cents in Claude API usage per run.
 */
import { anthropic, MODEL } from "../lib/anthropic";
import { buildWritePrompt, lengthBand, toneBand, WRITE_SYSTEM } from "../lib/prompt";
import { research } from "../lib/research";
import type { Profile } from "../lib/types";

process.loadEnvFile?.(".env.local");

const TONE = Number(process.env.SMOKE_TONE ?? 65);
const LENGTH = Number(process.env.SMOKE_LENGTH ?? 45);

const profile: Profile = {
  id: "smoke",
  full_name: "Jordan Ellis",
  email: "jordan@example.com",
  phone: "+44 7700 900123",
  location: "Bristol, UK",
  headline: "Product designer — 9 years, mostly civic and public-sector tools",
  linkedin_url: "https://linkedin.com/in/jordanellis",
  portfolio_url: null,
  linkedin_text: null,
  resume_name: "jordan-ellis.pdf",
  resume_text: `JORDAN ELLIS — Product Designer, Bristol

SENIOR PRODUCT DESIGNER, Civica Digital (2021–present)
Led design of a benefits-eligibility checker used by 11 local authorities.
Cut the median completion time from 24 minutes to 9. Ran fortnightly usability
sessions with claimants, including 30+ sessions with assistive-tech users.
Built and maintained the design system used by four product teams.

PRODUCT DESIGNER, Bether (2018–2021)
Redesigned the onboarding flow for a savings app; activation rose from 31% to 48%.
Owned the accessibility audit that took the app to WCAG 2.1 AA.

JUNIOR DESIGNER, Halo Studio (2016–2018)
Brand and marketing site work for charity clients.

SKILLS Figma, prototyping, service design, WCAG 2.1, research ops, HTML/CSS
EDUCATION BA Graphic Design, UWE Bristol, 2016`,
  notes: "British spelling.",
  anthropic_key_cipher: null,
  anthropic_key_hint: null,
  anthropic_key_set_at: null,
  updated_at: new Date().toISOString(),
};

const jobText = `Senior Product Designer — Accessibility
Nava PBC · Remote (UK)

Nava is a public benefit corporation that works with government agencies to
improve the systems millions of people rely on — healthcare enrolment, veterans'
benefits, tax filing.

You will:
- Own end-to-end design for a claims-processing service used by caseworkers.
- Lead accessibility practice across two product teams, including audits and
  remediation plans against WCAG 2.1 AA.
- Run research with people in difficult circumstances, and turn what you hear
  into service changes rather than screens.
- Work in the open — we publish our design decisions.

We're looking for 7+ years of product design experience, demonstrable
accessibility depth, and comfort in slow-moving, high-stakes environments.
Experience with government or regulated services is a strong plus.`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Put it in .env.local.");
    process.exit(1);
  }

  console.log(`\n── RESEARCH ${"─".repeat(50)}`);
  const started = Date.now();

  const client = anthropic();

  const brief = await research(
    client,
    { company: "Nava PBC", role: "Senior Product Designer — Accessibility", jobText },
    (message: string) => console.log(`   · ${message}`),
  );

  if (!brief) {
    console.log("   (no research came back — the letter will use the posting alone)");
  } else {
    console.log(`\n${brief.brief}\n`);
    console.log(`   ${brief.sources.length} sources:`);
    for (const s of brief.sources) console.log(`   · ${s.title} — ${s.url}`);
  }

  console.log(
    `\n── LETTER (${toneBand(TONE).label}, ≈${lengthBand(LENGTH).words} words) ${"─".repeat(24)}\n`,
  );

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16_000,
    system: WRITE_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildWritePrompt({
          profile,
          jobText,
          company: "Nava PBC",
          role: "Senior Product Designer — Accessibility",
          jobUrl: null,
          research: brief,
          tone: TONE,
          length: LENGTH,
        }),
      },
    ],
  });

  let body = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      body += event.delta.text;
      process.stdout.write(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  const words = body.trim().split(/\s+/).filter(Boolean).length;

  console.log(`\n\n── ${"─".repeat(60)}`);
  console.log(`   stop_reason: ${final.stop_reason}`);
  console.log(`   words: ${words} (asked for ≈${lengthBand(LENGTH).words})`);
  console.log(`   elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(
    `   tokens: ${final.usage.input_tokens} in / ${final.usage.output_tokens} out (letter call only)\n`,
  );
}

main().catch((err) => {
  console.error("\nSmoke test failed:", err);
  process.exit(1);
});
