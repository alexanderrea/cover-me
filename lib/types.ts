export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  linkedin_text: string | null;
  resume_text: string | null;
  resume_name: string | null;
  notes: string | null;
  updated_at: string;
};

export type Source = { title: string; url: string };

export type Research = { brief: string; sources: Source[] };

export type Letter = {
  id: string;
  user_id: string;
  company: string | null;
  role: string | null;
  job_url: string | null;
  job_text: string;
  tone: number;
  length: number;
  research: Research | null;
  body: string;
  created_at: string;
};

/** Everything the profile form can write. `id` is taken from the session. */
export type ProfilePatch = Partial<Omit<Profile, "id" | "updated_at">>;
