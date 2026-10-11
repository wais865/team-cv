import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import YAML from "yaml";
import type { TeamMember, TeamMemberInput } from "../shared/types";

interface TeamFile {
  members: TeamMember[];
}

/**
 * A tiny "database" backed by a single YAML file.
 * Every write goes through a queue so two requests can never
 * overwrite each other's changes.
 */
export class YamlStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<TeamFile> {
    try {
      const text = await fs.readFile(this.file, "utf8");
      const data = YAML.parse(text) as Partial<TeamFile> | null;
      return { members: Array.isArray(data?.members) ? data.members : [] };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { members: [] };
      throw err;
    }
  }

  private async write(data: TeamFile): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const header = "# Team CV data — managed by the app, but safe to edit by hand.\n";
    const body = YAML.stringify(data, { lineWidth: 0 });
    // Write to a temp file first, then rename: the data file is never half-written
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, header + body, "utf8");
    await fs.rename(tmp, this.file);
  }

  /** Run a read-modify-write step exclusively */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list(): Promise<TeamMember[]> {
    return (await this.read()).members;
  }

  async get(id: string): Promise<TeamMember | undefined> {
    return (await this.read()).members.find((m) => m.id === id);
  }

  create(input: TeamMemberInput, photo?: string): Promise<TeamMember> {
    return this.exclusive(async () => {
      const data = await this.read();
      const now = new Date().toISOString();
      const { removePhoto: _ignored, ...fields } = input;
      const member: TeamMember = { id: randomUUID(), ...fields, photo, createdAt: now, updatedAt: now };
      if (!member.photo) delete member.photo;
      data.members.push(member);
      await this.write(data);
      return member;
    });
  }

  /** Returns the updated member and the old photo path (if it was replaced or removed) */
  update(
    id: string,
    input: TeamMemberInput,
    newPhoto?: string,
  ): Promise<{ member: TeamMember; oldPhoto?: string } | undefined> {
    return this.exclusive(async () => {
      const data = await this.read();
      const index = data.members.findIndex((m) => m.id === id);
      if (index === -1) return undefined;

      const existing = data.members[index];
      const { removePhoto, ...fields } = input;
      let photo = existing.photo;
      let oldPhoto: string | undefined;
      if (newPhoto || removePhoto) {
        oldPhoto = existing.photo;
        photo = newPhoto;
      }

      const member: TeamMember = {
        id: existing.id,
        ...fields,
        photo,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      if (!member.photo) delete member.photo;
      data.members[index] = member;
      await this.write(data);
      return { member, oldPhoto };
    });
  }

  /** Returns the deleted member, or undefined if not found */
  remove(id: string): Promise<TeamMember | undefined> {
    return this.exclusive(async () => {
      const data = await this.read();
      const index = data.members.findIndex((m) => m.id === id);
      if (index === -1) return undefined;
      const [removed] = data.members.splice(index, 1);
      await this.write(data);
      return removed;
    });
  }
}
