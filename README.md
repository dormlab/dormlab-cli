# dormlab-cli

Managed SSH + TUI for the three DormLab mac minis (amelia, derek, lexie).

## Install

```sh
./install.sh
```

Needs [bun](https://bun.sh). The script installs deps, symlinks `dormlab` into
`~/.local/bin`, registers the Claude Code skill at `~/.claude/skills/dormlab-cli`,
and writes a starter config to `~/.dormlab/config.toml`.

## Usage

```sh
dormlab                        # TUI
dormlab ls                     # list hosts
dormlab ping                   # reachability check
dormlab ssh lexie              # interactive shell
dormlab ssh lexie - uptime     # run one command
dormlab exec "df -h"           # run on all hosts
```

`-` and `--` both work as the command separator.

## Config

Edit `~/.dormlab/config.toml`:

```toml
[defaults]
user = "lexie"
identity_file = "~/.ssh/id_ed25519"

[hosts.amelia]  { host = "100.80.103.93", user = "amelia" }
[hosts.derek]   { host = "100.70.146.90", user = "derek"  }
[hosts.lexie]   { host = "100.72.133.26", user = "lexie"  }
```

Per-host keys/users override the defaults. Optional `password = "…"` works if
`sshpass` is on `$PATH`.

## Claude Code skill

`skill/SKILL.md` teaches Claude how to drive the CLI. After `./install.sh`, ask
Claude things like "is lexie up?" or "run `uptime` on amelia".
