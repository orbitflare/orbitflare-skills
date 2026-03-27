# OrbitFlare Skills

Agent skills for building on [OrbitFlare](https://orbitflare.com) — Solana RPC, gRPC streaming, Shredstream, dedicated nodes, and trading APIs.

## Skills

- [`orbitflare/`](./orbitflare) — main skill covering HTTP RPC, WebSockets, Jetstream, Yellowstone, Shredstream, Dedicated Nodes (Solana + BNB), `getTransactionsForAddress`, historical archive, Metis Swap, Jito Bundle Simulation, the Customer API, the OrbitFlare CLI, and the Rust SDK.

## Install

```bash
cd orbitflare
./install.sh                # Claude Code (personal): ~/.claude/skills/orbitflare
./install.sh --project      # Claude Code (project):  ./.claude/skills/orbitflare
./install.sh --cursor       # Cursor:                 ~/.cursor/skills-cursor/orbitflare
./install.sh --codex        # Codex:                  ~/.codex/skills/orbitflare
./install.sh --path /tmp    # Custom path:            /tmp/orbitflare
```

After install, restart your agent so it picks up the new skill, then try a prompt like *"Stream pump.fun trades using OrbitFlare Jetstream"* or *"Quote 1 SOL to USDC with Metis on OrbitFlare"*.

## Source of truth

Everything in these skills is derived from [docs.orbitflare.com](https://docs.orbitflare.com). The full docs index lives at [docs.orbitflare.com/llms.txt](https://docs.orbitflare.com/llms.txt).

## License

MIT — see [`orbitflare/LICENSE`](./orbitflare/LICENSE).
