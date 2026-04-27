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

`skills/SKILL.md` teaches Claude how to drive this CLI. Two ways to install it:

**Bundled (recommended if you cloned this repo):** `./install.sh` symlinks the
skill into `~/.claude/skills/dormlab-cli` for you.

**Standalone (no clone needed):**

```sh
npx skills add https://github.com/dormlab/dormlab-cli
```

After either, restart Claude Code (or reload skills) and ask things like
"is lexie up?", "run `uptime` on amelia", or "ssh me into lexie".

## Long-lasting ssh-add (macOS)

`dormlab` runs `ssh` with stdin closed, so a passphrase-protected key that
isn't already in `ssh-agent` will hang the connection until the 6-second
timeout — `dormlab ping` returns `fail` with no obvious reason. Loading the
key into the agent fixes it for the current session:

```sh
ssh-add ~/.ssh/id_ed25519
```

But that's lost on reboot. To make it persistent on macOS, store the
passphrase in Keychain and have ssh load it automatically on first use:

```sh
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

Then add this block to `~/.ssh/config` (or your existing `Host *` block):

```
Host *
  UseKeychain yes
  AddKeysToAgent yes
  IdentityFile ~/.ssh/id_ed25519
```

After that, `dormlab` works from a cold boot without you ever typing the
passphrase again.
