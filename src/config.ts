import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse as parseToml } from "smol-toml";

export interface HostConfig {
  name: string;
  host: string;
  user: string;
  port: number;
  identityFile?: string;
  password?: string;
  description?: string;
}

export interface Defaults {
  user: string;
  port: number;
  identityFile?: string;
  password?: string;
}

export interface DormlabConfig {
  defaults: Defaults;
  hosts: Record<string, HostConfig>;
}

export const CONFIG_DIR = path.join(os.homedir(), ".dormlab");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.toml");

export const DEFAULT_CONFIG_TOML = `# DormLab CLI configuration
# Managed SSH for the three DormLab mac minis.

[defaults]
user = "lexie"
port = 22
identity_file = "~/.ssh/id_ed25519"
# password = ""  # optional fallback; requires \`sshpass\` on PATH

[hosts.amelia]
host = "100.80.103.93"
user = "amelia"
description = "Mac mini: amelia"

[hosts.derek]
host = "100.70.146.90"
user = "derek"
description = "Mac mini: derek"

[hosts.lexie]
host = "100.72.133.26"
user = "lexie"
description = "Mac mini: lexie"
`;

function expandHome(p: string | undefined): string | undefined {
  if (!p) return p;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

export function ensureConfig(): string {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, DEFAULT_CONFIG_TOML, { mode: 0o600 });
  }
  return CONFIG_PATH;
}

export function loadConfig(): DormlabConfig {
  ensureConfig();
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const parsed = parseToml(raw) as any;

  const defaultsRaw = parsed.defaults ?? {};
  const defaults: Defaults = {
    user: defaultsRaw.user ?? os.userInfo().username,
    port: defaultsRaw.port ?? 22,
    identityFile: expandHome(defaultsRaw.identity_file),
    password: defaultsRaw.password,
  };

  const hostsRaw = parsed.hosts ?? {};
  const hosts: Record<string, HostConfig> = {};
  for (const [name, valUnknown] of Object.entries(hostsRaw)) {
    const val = valUnknown as any;
    if (!val?.host) {
      throw new Error(`Host "${name}" is missing required field: host`);
    }
    hosts[name] = {
      name,
      host: val.host,
      user: val.user ?? defaults.user,
      port: val.port ?? defaults.port,
      identityFile: expandHome(val.identity_file) ?? defaults.identityFile,
      password: val.password ?? defaults.password,
      description: val.description,
    };
  }

  return { defaults, hosts };
}

export function resolveHost(cfg: DormlabConfig, name: string): HostConfig {
  const host = cfg.hosts[name];
  if (!host) {
    const available = Object.keys(cfg.hosts).join(", ") || "(none)";
    throw new Error(`Unknown host "${name}". Known hosts: ${available}`);
  }
  return host;
}
