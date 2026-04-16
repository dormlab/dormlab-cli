#!/usr/bin/env bash
# Installs the dormlab CLI + Claude Code skill.
#   - symlinks ./bin/dormlab into ~/.local/bin (must be on $PATH)
#   - symlinks ./skill as ~/.claude/skills/dormlab
#   - runs `bun install` if node_modules is missing
#   - creates ~/.dormlab/config.toml on first run

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required. Install: https://bun.sh" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "→ bun install"
  bun install
fi

BIN_DIR="${HOME}/.local/bin"
mkdir -p "$BIN_DIR"
ln -sf "$HERE/bin/dormlab" "$BIN_DIR/dormlab"
chmod +x "$HERE/bin/dormlab"
echo "→ linked $BIN_DIR/dormlab"

SKILLS_DIR="${HOME}/.claude/skills"
mkdir -p "$SKILLS_DIR"
# Remove any existing non-symlink directory so the link isn't nested inside it.
if [[ -e "$SKILLS_DIR/dormlab-cli" && ! -L "$SKILLS_DIR/dormlab-cli" ]]; then
  rm -rf "$SKILLS_DIR/dormlab-cli"
fi
# Clean up the old link location from the previous install layout.
if [[ -L "$SKILLS_DIR/dormlab" ]]; then
  rm -f "$SKILLS_DIR/dormlab"
fi
ln -sfn "$HERE/skill" "$SKILLS_DIR/dormlab-cli"
echo "→ linked $SKILLS_DIR/dormlab-cli → $HERE/skill"

"$BIN_DIR/dormlab" init >/dev/null
echo "→ config: ${HOME}/.dormlab/config.toml"

cat <<EOF

Installed. Verify with:
  dormlab --help
  dormlab ls
  dormlab ping

If 'dormlab: command not found', add \$HOME/.local/bin to your PATH.
EOF
