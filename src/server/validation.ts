import type { Experience, TeamMemberInput } from "../shared/types";

export class ValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const strList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** Clean up and validate untrusted input from the client */
export function parseMemberInput(body: unknown): TeamMemberInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const addr = (b.address ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const input: TeamMemberInput = {
    name: str(b.name),
    jobTitle: str(b.jobTitle),
    department: str(b.department) || undefined,
    email: str(b.email) || undefined,
    phone: str(b.phone) || undefined,
    dateOfBirth: str(b.dateOfBirth),
    nationality: str(b.nationality) || undefined,
    address: {
      street: str(addr.street),
      postalCode: str(addr.postalCode),
      city: str(addr.city),
      country: str(addr.country),
    },
    bio: str(b.bio) || undefined,
    skills: strList(b.skills),
    languages: strList(b.languages),
    hobbies: strList(b.hobbies),
    experiences: [],
    removePhoto: b.removePhoto === true || b.removePhoto === "true",
  };

  if (!input.name) errors.push("Name is required.");
  if (!input.jobTitle) errors.push("Job title is required.");
  if (!isDate(input.dateOfBirth)) {
    errors.push("Date of birth must be a valid date (YYYY-MM-DD).");
  } else if (new Date(input.dateOfBirth) > new Date()) {
    errors.push("Date of birth cannot be in the future.");
  }
  if (input.email && !isEmail(input.email)) errors.push("Email address is not valid.");

  const rawExperiences = Array.isArray(b.experiences) ? b.experiences : [];
  rawExperiences.forEach((raw, i) => {
    const e = (raw ?? {}) as Record<string, unknown>;
    const exp: Experience = {
      company: str(e.company),
      position: str(e.position),
      startDate: str(e.startDate),
      endDate: str(e.endDate) || undefined,
      description: str(e.description) || undefined,
    };
    // Skip completely empty rows
    if (!exp.company && !exp.position && !exp.startDate) return;
    const n = i + 1;
    if (!exp.company) errors.push(`Experience ${n}: company is required.`);
    if (!exp.position) errors.push(`Experience ${n}: position is required.`);
    if (!isMonth(exp.startDate)) errors.push(`Experience ${n}: start must be a month (YYYY-MM).`);
    if (exp.endDate && !isMonth(exp.endDate)) errors.push(`Experience ${n}: end must be a month (YYYY-MM).`);
    if (exp.endDate && exp.endDate < exp.startDate) errors.push(`Experience ${n}: end is before start.`);
    input.experiences.push(exp);
  });

  if (errors.length) throw new ValidationError(errors);
  return input;
}

/** Age in full years, calculated from date of birth */
export function calculateAge(dateOfBirth: string, today = new Date()): number {
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age--;
  return age;
}
