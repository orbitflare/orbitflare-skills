#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="orbitflare"
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

TARGET_BASE="$HOME/.claude/skills"
MODE="claude (personal)"

usage() {
  cat <<'EOF'
Usage: ./install.sh [OPTIONS]

Install the OrbitFlare skill into a Claude Code, Cursor, or Codex skills folder.

Options:
  --project        Install to ./.claude/skills/orbitflare (current project)
  --cursor         Install to ~/.cursor/skills-cursor/orbitflare
  --codex          Install to ~/.codex/skills/orbitflare
  --path PATH      Install to PATH/orbitflare
  --help           Show this help and exit

Default (no flag): ~/.claude/skills/orbitflare

Examples:
  ./install.sh                       # ~/.claude/skills/orbitflare
  ./install.sh --project             # ./.claude/skills/orbitflare
  ./install.sh --cursor              # ~/.cursor/skills-cursor/orbitflare
  ./install.sh --codex               # ~/.codex/skills/orbitflare
  ./install.sh --path /tmp/skills    # /tmp/skills/orbitflare
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      TARGET_BASE=".claude/skills"
      MODE="claude (project)"
      shift
      ;;
    --cursor)
      TARGET_BASE="$HOME/.cursor/skills-cursor"
      MODE="cursor"
      shift
      ;;
    --codex)
      TARGET_BASE="$HOME/.codex/skills"
      MODE="codex"
      shift
      ;;
    --path)
      if [[ $# -lt 2 ]]; then
        echo "Error: --path requires a directory argument" >&2
        usage
        exit 1
      fi
      TARGET_BASE="$2"
      MODE="custom ($2)"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

TARGET="$TARGET_BASE/$SKILL_NAME"

if [[ ! -f "$SKILL_DIR/SKILL.md" ]]; then
  echo "Error: SKILL.md not found in $SKILL_DIR" >&2
  echo "Run this script from inside the orbitflare skill directory." >&2
  exit 1
fi

mkdir -p "$TARGET"

cp "$SKILL_DIR/SKILL.md" "$TARGET/"
[[ -f "$SKILL_DIR/LICENSE" ]] && cp "$SKILL_DIR/LICENSE" "$TARGET/"

if [[ -d "$SKILL_DIR/references" ]]; then
  rm -rf "$TARGET/references"
  cp -R "$SKILL_DIR/references" "$TARGET/"
fi

cat <<EOF

OrbitFlare skill installed to: $TARGET
Mode: $MODE

Next steps:

  1. Get an API key (free tier available):
       https://orbitflare.com/dashboard

  2. (Optional) Install the OrbitFlare CLI:
       cargo install orbitflare
       orbitflare auth login --x-orbit-key YOUR_API_KEY

  3. Set environment variables your code can pick up:
       export ORBITFLARE_LICENSE_KEY=ORBIT-XXXXXX-NNNNNN-NNNNNN
       export ORBITFLARE_RPC_URL=http://mainnet.rpc.orbitflare.com
       export ORBITFLARE_WS_URL=ws://mainnet.rpc.orbitflare.com
       export ORBITFLARE_GRPC_URL=http://fra.rpc.orbitflare.com:10000
       export ORBITFLARE_JETSTREAM_URL=http://fra.jetstream.orbitflare.com

  4. Try a prompt:
       "Stream pump.fun trades using OrbitFlare Jetstream and print each signature"
       "Build a wallet history view with getTransactionsForAddress"
       "Quote and execute a 1 SOL -> USDC swap with Metis"

Docs: https://docs.orbitflare.com
Discord: https://discord.gg/orbitflare
EOF
