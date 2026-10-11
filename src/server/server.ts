import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import YAML from "yaml";
import { config, DATA_FILE, PORT, ROOT_DIR, UPLOAD_DIR } from "./config";
import { YamlStore } from "./store";
import { calculateAge, parseMemberInput, ValidationError } from "./validation";
import type { AppInfo, TeamMember, TeamMemberView } from "../shared/types";

const store = new YamlStore(DATA_FILE);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Photo uploads ----------
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, randomUUID() + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: config.storage.maxPhotoSizeMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) cb(null, true);
    else cb(new ValidationError(["Photo must be a JPG, PNG, WEBP or GIF image."]));
  },
});

const photoUrl = (file?: Express.Multer.File) => (file ? `/uploads/${file.filename}` : undefined);

function deletePhoto(photo?: string) {
  if (!photo?.startsWith("/uploads/")) return;
  const file = path.join(UPLOAD_DIR, path.basename(photo));
  fs.promises.unlink(file).catch(() => undefined);
}

/** The form is sent as multipart: a JSON "data" field plus an optional "photo" file */
function readBody(req: Request): unknown {
  const raw = req.body?.data;
  if (typeof raw !== "string") return req.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError(["Request data is not valid JSON."]);
  }
}

const toView = (m: TeamMember): TeamMemberView => ({ ...m, age: calculateAge(m.dateOfBirth) });

function matches(m: TeamMember, q: string): boolean {
  const haystack = [
    m.name, m.jobTitle, m.department, m.address.city, m.address.country,
    ...m.skills, ...m.hobbies, ...m.languages,
  ].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).every((word) => haystack.includes(word));
}

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT_DIR, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/info", (_req, res) => {
  const info: AppInfo = { title: config.app.title, subtitle: config.app.subtitle };
  res.json(info);
});

// READ — all members (optional ?q= search)
app.get("/api/members", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let members = await store.list();
  if (q) members = members.filter((m) => matches(m, q));
  members.sort((a, b) => a.name.localeCompare(b.name));
  res.json(members.map(toView));
});

// READ — one member
app.get("/api/members/:id", async (req, res) => {
  const member = await store.get(req.params.id);
  if (!member) return res.status(404).json({ errors: ["Team member not found."] });
  res.json(toView(member));
});

// EXPORT — one member as a YAML file
app.get("/api/members/:id/yaml", async (req, res) => {
  const member = await store.get(req.params.id);
  if (!member) return res.status(404).json({ errors: ["Team member not found."] });
  const slug = member.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
  res.type("application/yaml");
  res.attachment(`${slug}.yaml`);
  res.send(YAML.stringify(member, { lineWidth: 0 }));
});

// EXPORT — whole team as YAML
app.get("/api/export", async (_req, res) => {
  res.type("application/yaml");
  res.attachment("team.yaml");
  res.send(YAML.stringify({ members: await store.list() }, { lineWidth: 0 }));
});

// CREATE
app.post("/api/members", upload.single("photo"), async (req, res) => {
  try {
    const input = parseMemberInput(readBody(req));
    const member = await store.create(input, photoUrl(req.file));
    res.status(201).json(toView(member));
  } catch (err) {
    deletePhoto(photoUrl(req.file)); // don't keep orphaned uploads
    throw err;
  }
});

// UPDATE
app.put("/api/members/:id", upload.single("photo"), async (req, res) => {
  try {
    const input = parseMemberInput(readBody(req));
    const result = await store.update(req.params.id as string, input, photoUrl(req.file));
    if (!result) {
      deletePhoto(photoUrl(req.file));
      return res.status(404).json({ errors: ["Team member not found."] });
    }
    deletePhoto(result.oldPhoto);
    res.json(toView(result.member));
  } catch (err) {
    deletePhoto(photoUrl(req.file));
    throw err;
  }
});

// DELETE
app.delete("/api/members/:id", async (req, res) => {
  const removed = await store.remove(req.params.id);
  if (!removed) return res.status(404).json({ errors: ["Team member not found."] });
  deletePhoto(removed.photo);
  res.status(204).end();
});

app.use("/api", (_req, res) => {
  res.status(404).json({ errors: ["Unknown API route."] });
});

// Error handler (Express 5 forwards errors from async handlers here)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) return res.status(400).json({ errors: err.errors });
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `Photo is too large (max ${config.storage.maxPhotoSizeMB} MB).`
        : err.message;
    return res.status(400).json({ errors: [msg] });
  }
  console.error(err);
  res.status(500).json({ errors: ["Something went wrong on the server."] });
});

app.listen(PORT, () => {
  console.log(`\n  ${config.app.title} is running at http://localhost:${PORT}`);
  console.log(`  Data file: ${path.relative(ROOT_DIR, DATA_FILE)}\n`);
});
