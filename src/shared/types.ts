// Types shared by the server and the browser client.

export interface Address {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface Experience {
  company: string;
  position: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM, empty = current job
  description?: string;
}

/** A team member as stored in data/team.yaml */
export interface TeamMember {
  id: string;
  name: string;
  jobTitle: string;
  department?: string;
  email?: string;
  phone?: string;
  dateOfBirth: string; // YYYY-MM-DD
  nationality?: string;
  address: Address;
  bio?: string;
  photo?: string; // URL path, e.g. /uploads/abc.jpg
  skills: string[];
  languages: string[];
  hobbies: string[];
  experiences: Experience[];
  createdAt: string;
  updatedAt: string;
}

/** What the API returns: the stored member plus computed fields */
export interface TeamMemberView extends TeamMember {
  age: number;
}

/** What the client sends when creating or updating a member */
export type TeamMemberInput = Omit<TeamMember, "id" | "createdAt" | "updatedAt" | "photo"> & {
  removePhoto?: boolean;
};

export interface AppInfo {
  title: string;
  subtitle: string;
}
