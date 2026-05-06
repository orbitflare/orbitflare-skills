#!/usr/bin/env node
// Installer for the OrbitFlare skill.
// Runs as `npx @orbitflare/skills@latest [--project|--cursor|--codex|--path PATH]`.

import { mkdirSync, copyFileSync, statSync, readdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const SKILL_NAME = "orbitflare";
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_SRC = join(PKG_ROOT, "orbitflare");

const HOME = homedir();

const TARGETS = {
  claude: { base: join(HOME, ".claude", "skills"), label: "claude (personal)" },
  project: { base: join(".claude", "skills"), label: "claude (project)" },
  cursor: { base: join(HOME, ".cursor", "skills-cursor"), label: "cursor" },
  codex: { base: join(HOME, ".codex", "skills"), label: "codex" },
};

function usage() {
  console.log(`Usage: npx @orbitflare/skills@latest [OPTIONS]

Install the OrbitFlare skill into a Claude Code, Cursor, or Codex skills folder.

Options:
  --project        Install to ./.claude/skills/orbitflare (current project)
  --cursor         Install to ~/.cursor/skills-cursor/orbitflare
  --codex          Install to ~/.codex/skills/orbitflare
  --path PATH      Install to PATH/orbitflare
  --help, -h       Show this help and exit

Default (no flag): ~/.claude/skills/orbitflare

Examples:
  npx @orbitflare/skills@latest
  npx @orbitflare/skills@latest --project
  npx @orbitflare/skills@latest --cursor
  npx @orbitflare/skills@latest --codex
  npx @orbitflare/skills@latest --path /tmp/skills`);
}

function parseArgs(argv) {
  let target = TARGETS.claude;
  let customPath = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--project":
        target = TARGETS.project;
        break;
      case "--cursor":
        target = TARGETS.cursor;
        break;
      case "--codex":
        target = TARGETS.codex;
        break;
      case "--path":
        if (i + 1 >= argv.length) {
          console.error("Error: --path requires a directory argument");
          usage();
          process.exit(1);
        }
        customPath = argv[++i];
        target = { base: customPath, label: `custom (${customPath})` };
        break;
      case "--help":
      case "-h":
        usage();
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}`);
        usage();
        process.exit(1);
    }
  }

  return target;
}

function copyRecursive(src, dest) {
  const stats = statSync(src);
  if (stats.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(join(src, entry), join(dest, entry));
    }
  } else {
    copyFileSync(src, dest);
  }
}

function main() {
  if (!existsSync(join(SKILL_SRC, "SKILL.md"))) {
    console.error(`Error: SKILL.md not found in ${SKILL_SRC}`);
    console.error("This package appears corrupted. Try reinstalling: npx @orbitflare/skills@latest");
    process.exit(1);
  }

  const target = parseArgs(process.argv.slice(2));
  const dest = join(target.base, SKILL_NAME);

  mkdirSync(dest, { recursive: true });

  copyFileSync(join(SKILL_SRC, "SKILL.md"), join(dest, "SKILL.md"));

  const licenseSrc = join(SKILL_SRC, "LICENSE");
  if (existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, join(dest, "LICENSE"));
  }

  const refsSrc = join(SKILL_SRC, "references");
  if (existsSync(refsSrc)) {
    const refsDest = join(dest, "references");
    rmSync(refsDest, { recursive: true, force: true });
    copyRecursive(refsSrc, refsDest);
  }

  console.log(`
OrbitFlare skill installed to: ${dest}
Mode: ${target.label}

Next steps:

  1. Get an API key (free tier available):
       https://orbitflare.com/dashboard

  2. (Optional) Install the OrbitFlare CLI:
       cargo install orbitflare
       orbitflare auth login --x-orbit-key YOUR_API_KEY

  3. Set environment variables your code can pick up:
       export ORBITFLARE_LICENSE_KEY=ORBIT-XXXXXX-NNNNNN-NNNNNN
       export ORBITFLARE_RPC_URL=https://mainnet.rpc.orbitflare.com
       export ORBITFLARE_WS_URL=wss://mainnet.rpc.orbitflare.com
       export ORBITFLARE_GRPC_URL=http://fra.rpc.orbitflare.com:10000
       export ORBITFLARE_JETSTREAM_URL=http://fra.jetstream.orbitflare.com

  4. Try a prompt:
       "Stream pump.fun trades using OrbitFlare Jetstream and print each signature"
       "Build a wallet history view with getTransactionsForAddress"
       "Quote and execute a 1 SOL -> USDC swap with Metis"

Docs: https://docs.orbitflare.com
Discord: https://discord.gg/orbitflare`);
}

main();
