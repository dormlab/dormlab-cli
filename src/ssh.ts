import { spawn, spawnSync } from "node:child_process";
// spawnSync is kept for the one-shot `which sshpass` check below.
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
    // Use the configured key, but DON'T set IdentitiesOnly=yes — that would
    // block ssh-agent and break passphrase-protected keys whose decrypted
    // copy lives in the agent.
    args.push("-i", host.identityFile);
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

export interface CaptureResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs a remote command and captures stdout/stderr without blocking the event
 * loop. Ink/React rendering stays responsive while this is in flight.
 */
export function sshCapture(
  host: HostConfig,
  command: string,
  timeoutMs = 8000,
): Promise<CaptureResult> {
  const rawArgs = buildSshArgs(host, [command]);
  const { bin, args } = wrapWithSshpass(host, "ssh", rawArgs);
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const done = (code: number) => {
      if (settled) return;
      settled = true;
      resolve({ code, stdout, stderr });
    };

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", () => done(-1));
    child.on("exit", (code) => done(code ?? -1));

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
      done(-1);
    }, timeoutMs);
    // Don't keep the event loop alive on the timer alone.
    timer.unref?.();
  });
}
