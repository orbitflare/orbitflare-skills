# OrbitFlare Skills

Agent skills for building on [OrbitFlare](https://orbitflare.com): Solana RPC, gRPC streaming, Shredstream, dedicated nodes, and trading APIs.

## Skills

- [`orbitflare/`](./orbitflare): main skill covering HTTP RPC, WebSockets, Jetstream, Yellowstone, Shredstream, Dedicated Nodes (Solana + BNB), `getTransactionsForAddress`, historical archive, Metis Swap, Jito Bundle Simulation, the Customer API, the OrbitFlare CLI, and the Rust SDK.

## Install

One line, no clone required:

```bash
npx @orbitflare/skills@latest                # Claude Code (personal): ~/.claude/skills/orbitflare
npx @orbitflare/skills@latest --project      # Claude Code (project):  ./.claude/skills/orbitflare
npx @orbitflare/skills@latest --cursor       # Cursor:                 ~/.cursor/skills-cursor/orbitflare
npx @orbitflare/skills@latest --codex        # Codex:                  ~/.codex/skills/orbitflare
npx @orbitflare/skills@latest --path /tmp    # Custom path:            /tmp/orbitflare
```

After install, restart your agent so it picks up the new skill, then try a prompt like *"Stream pump.fun trades using OrbitFlare Jetstream"* or *"Quote 1 SOL to USDC with Metis on OrbitFlare"*.

### From source

If you'd rather clone the repo (e.g. to modify the skill):

```bash
git clone https://github.com/orbitflare/orbitflare-skills
cd orbitflare-skills/orbitflare
./install.sh                # same flags as the npx version
```

## Source of truth

Everything in these skills is derived from [docs.orbitflare.com](https://docs.orbitflare.com). The full docs index lives at [docs.orbitflare.com/llms.txt](https://docs.orbitflare.com/llms.txt).

## License

MIT, see [`orbitflare/LICENSE`](./orbitflare/LICENSE).
