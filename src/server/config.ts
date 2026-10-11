import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

// Works from both src/server (tsx) and dist/server (compiled)
export const ROOT_DIR = path.resolve(__dirname, "..", "..");

export interface AppConfig {
  app: { title: string; subtitle: string };
  server: { port: number };
  storage: { dataFile: string; uploadDir: string; maxPhotoSizeMB: number };
}

const DEFAULTS: AppConfig = {
  app: { title: "Team CV", subtitle: "" },
  server: { port: 3000 },
  storage: { dataFile: "data/team.yaml", uploadDir: "uploads", maxPhotoSizeMB: 5 },
};

function loadConfig(): AppConfig {
  const file = path.join(ROOT_DIR, "config.yaml");
  if (!fs.existsSync(file)) return DEFAULTS;

  const raw = (YAML.parse(fs.readFileSync(file, "utf8")) ?? {}) as Partial<AppConfig>;
  return {
    app: { ...DEFAULTS.app, ...raw.app },
    server: { ...DEFAULTS.server, ...raw.server },
    storage: { ...DEFAULTS.storage, ...raw.storage },
  };
}

export const config = loadConfig();

// PORT environment variable wins over config.yaml
export const PORT = Number(process.env.PORT) || config.server.port;
export const DATA_FILE = path.resolve(ROOT_DIR, config.storage.dataFile);
export const UPLOAD_DIR = path.resolve(ROOT_DIR, config.storage.uploadDir);
