import { spawn, spawnSync } from "node:child_process";
import type { HostConfig } from "./config.js";

function buildSshArgs(host: HostConfig, extra: string[] = []): string[] {
  const args: string[] = [];
  // Reasonable defaults: no strict host prompt spam, connection timeout.
  args.push(
    "-o",
    "ConnectTimeout=6",
    "-o",
    "ServerAliveInterval=30",
    "-o",
    "ServerAliveCountMax=3",
    // Trust-on-first-use: learn the host key silently, but still detect MITM after that.
    "-o",
    "StrictHostKeyChecking=accept-new",
  );
  if (host.port && host.port !== 22) {
    args.push("-p", String(host.port));
  }
  if (host.identityFile) {
    args.push("-i", host.identityFile, "-o", "IdentitiesOnly=yes");
  }
  args.push(`${host.user}@${host.host}`);
  args.push(...extra);
  return args;
}

function wrapWithSshpass(
  host: HostConfig,
  bin: string,
  args: string[],
): { bin: string; args: string[] } {
  if (!host.password) return { bin, args };
  // Only wrap if sshpass is available; otherwise fall through and let ssh prompt.
  const have = spawnSync("which", ["sshpass"]);
  if (have.status !== 0) return { bin, args };
  return {
    bin: "sshpass",
    args: ["-p", host.password, bin, ...args],
  };
}

/** Opens an interactive SSH session (inherits stdio). Resolves with exit code. */
export function sshInteractive(host: HostConfig): Promise<number> {
  const rawArgs = buildSshArgs(host);
  const { bin, args } = wrapWithSshpass(host, "ssh", rawArgs);
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

/** Runs a remote command with inherited stdio (streams output live). */
export function sshRun(host: HostConfig, command: string): Promise<number> {
  const rawArgs = buildSshArgs(host, [command]);
  const { bin, args } = wrapWithSshpass(host, "ssh", rawArgs);
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

/** Runs a remote command and captures stdout/stderr. Used for status checks. */
export function sshCapture(
  host: HostConfig,
  command: string,
  timeoutMs = 8000,
): { code: number; stdout: string; stderr: string } {
  const rawArgs = buildSshArgs(host, [command]);
  const { bin, args } = wrapWithSshpass(host, "ssh", rawArgs);
  const res = spawnSync(bin, args, {
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return {
    code: res.status ?? -1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}
