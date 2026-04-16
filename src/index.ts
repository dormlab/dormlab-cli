#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { Command } from "commander";
import {
  CONFIG_PATH,
  ensureConfig,
  loadConfig,
  resolveHost,
  type HostConfig,
} from "./config.js";
import { sshCapture, sshInteractive, sshRun } from "./ssh.js";

const program = new Command();

program
  .name("dormlab")
  .description("TUI + CLI for managing the DormLab mac minis")
  .version("0.1.0");

program
  .command("init")
  .description("Create ~/dormlab/config.toml if missing and print its path")
  .action(() => {
    const p = ensureConfig();
    console.log(p);
  });

program
  .command("config")
  .description("Open ~/.dormlab/config.toml in $EDITOR (default: nano)")
  .option("-p, --path", "print the config path instead of opening an editor")
  .action(async (opts: { path?: boolean }) => {
    ensureConfig();
    if (opts.path) {
      console.log(CONFIG_PATH);
      return;
    }
    const editor = process.env.EDITOR || process.env.VISUAL || "nano";
    const code: number = await new Promise((resolve) => {
      const child = spawn(editor, [CONFIG_PATH], { stdio: "inherit" });
      child.on("exit", (c) => resolve(c ?? 0));
    });
    process.exit(code);
  });

program
  .command("ls")
  .alias("list")
  .description("List configured hosts")
  .action(() => {
    const cfg = loadConfig();
    const names = Object.keys(cfg.hosts);
    if (names.length === 0) {
      console.log("No hosts configured. Edit", CONFIG_PATH);
      return;
    }
    const pad = Math.max(...names.map((n) => n.length));
    for (const name of names) {
      const h = cfg.hosts[name]!;
      const key = h.identityFile ? ` key=${h.identityFile}` : "";
      const desc = h.description ? `  # ${h.description}` : "";
      console.log(
        `${name.padEnd(pad)}  ${h.user}@${h.host}:${h.port}${key}${desc}`,
      );
    }
  });

program
  .command("ping")
  .description("Check reachability of all hosts (runs `true` over SSH)")
  .action(async () => {
    const cfg = loadConfig();
    const entries = Object.values(cfg.hosts);
    const pad = Math.max(...entries.map((h) => h.name.length));
    await Promise.all(
      entries.map(async (h) => {
        const r = await sshCapture(h, "true", 6000);
        const ok = r.code === 0;
        const status = ok ? "ok" : `fail (${r.code})`;
        const line = `${h.name.padEnd(pad)}  ${h.host}  ${status}`;
        console.log(line);
      }),
    );
  });

// `dormlab ssh <host> [-- | -] <cmd...>`
// Accepts either `--` (commander convention) or a bare `-` as separator.
program
  .command("ssh <host> [cmd...]")
  .description(
    "Open SSH to <host>. Pass a command after `-` or `--` to run it non-interactively.",
  )
  .allowUnknownOption()
  .action(async (hostName: string, cmdParts: string[]) => {
    const cfg = loadConfig();
    let host: HostConfig;
    try {
      host = resolveHost(cfg, hostName);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(2);
    }

    // Strip a leading `-` separator if present: `dormlab ssh lexie - uptime`
    const parts = cmdParts.slice();
    if (parts[0] === "-") parts.shift();

    if (parts.length === 0) {
      const code = await sshInteractive(host);
      process.exit(code);
    } else {
      const remote = parts.join(" ");
      const code = await sshRun(host, remote);
      process.exit(code);
    }
  });

program
  .command("exec <cmd...>")
  .description("Run a command on ALL hosts, printing grouped output")
  .action(async (cmdParts: string[]) => {
    const cfg = loadConfig();
    const remote = cmdParts.join(" ");
    const hosts = Object.values(cfg.hosts);
    // Run sequentially so output stays readable.
    let anyFail = false;
    for (const h of hosts) {
      console.log(`\n━━━ ${h.name} (${h.host}) ━━━`);
      const r = await sshCapture(h, remote, 30_000);
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      if (r.code !== 0) {
        anyFail = true;
        console.log(`[exit ${r.code}]`);
      }
    }
    process.exit(anyFail ? 1 : 0);
  });

program
  .command("tui", { isDefault: true })
  .description("Launch the interactive TUI (default when no command is given)")
  .action(async () => {
    // Dynamic import so we only pull Ink/React when we actually need it.
    const { runTui } = await import("./tui.js");
    await runTui();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
