---
name: dormlab
description: Interact with the DormLab mac minis (amelia, derek, lexie) over managed SSH. Use whenever the user wants to check status, run a command on, or open a shell into a DormLab machine. Trigger phrases include "dormlab", "mac mini", "amelia/derek/lexie", "ssh into <host>", "run <cmd> on <host>".
---

# DormLab CLI

A single `dormlab` binary manages SSH to the three DormLab mac minis. Prefer it over raw `ssh` — it centralizes hosts, identity files, and timeouts in `~/dormlab/config.toml`.

## Hosts

| Name   | Address        |
|--------|----------------|
| amelia | 100.80.103.93  |
| derek  | 100.70.146.90  |
| lexie  | 100.72.133.26  |

Config lives at `~/dormlab/config.toml`. Run `dormlab init` to create it if missing.

## Commands to use

### Check reachability before acting
```
dormlab ping
```
Runs `true` over SSH against every host and prints ok/fail. Do this first if the user says "is X up" or before attempting any non-trivial remote work.

### List configured hosts
```
dormlab ls
```

### Run a one-shot command on a single host
Use the `-` separator (the user's preferred style):
```
dormlab ssh lexie - uptime
dormlab ssh amelia - "ls ~/Projects"
```
`--` also works (standard getopt convention):
```
dormlab ssh derek -- df -h
```
Quote the remote command if it contains shell metacharacters so the local shell doesn't eat them.

### Open an interactive shell
```
dormlab ssh lexie
```
Do NOT call this from inside an agent context — it expects a human at the terminal. Use command mode (`ssh lexie - <cmd>`) for anything scripted.

### Fan out to all hosts
```
dormlab exec uptime
dormlab exec "sw_vers -productVersion"
```
Sequential, grouped output per host. Good for "check X on all of them" asks.

### Print config path
```
dormlab config
```

### Launch the TUI
```
dormlab
```
(or `dormlab tui`) — interactive host picker. Only useful for a human user; avoid in agent flows.

## When to use this skill

- "Is lexie up?" → `dormlab ping`
- "Run `brew upgrade` on amelia" → `dormlab ssh amelia - "brew upgrade"`
- "What's on derek's disk?" → `dormlab ssh derek - df -h`
- "Restart the foo service on all of them" → `dormlab exec "launchctl kickstart -k gui/$(id -u)/foo"`
- "SSH me into lexie" → tell the user to run `dormlab ssh lexie` themselves (interactive — not for the agent to run)

## When NOT to use this skill

- If the user gives an SSH address that isn't one of the three DormLab hosts, use raw `ssh` with their provided details.
- Do not run destructive commands (`rm -rf`, `shutdown`, formatting, password changes) without explicit confirmation from the user, even if asked — confirm the exact command and host first.
- Never put passwords or secrets into remote commands via CLI args (they'd leak into shell history on the mac minis). Use keys.

## Troubleshooting

- `Permission denied (publickey)` → the default key in `~/dormlab/config.toml` isn't authorized on that mini. Ask the user to fix or override `identity_file` for that host in the config.
- `Connection timed out` → the Tailscale network probably isn't up on one end. `tailscale status` locally is the first check.
- `Unknown host "foo"` → user typoed the host name. Run `dormlab ls` and suggest the closest match.
