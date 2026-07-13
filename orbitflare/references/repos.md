# OrbitFlare Repositories

First-party repos under [github.com/orbitflare](https://github.com/orbitflare). When you need a working example beyond what fits in a docs snippet, clone one of these.

## Tools

### orbitflare-sdk-rs

Official Rust SDK. RPC, WebSocket, Yellowstone gRPC, and Jetstream (v1 and v2) clients with retry, multi-endpoint failover, ping/pong liveness, and (for WS) auto re-subscribe.

- Repo: [github.com/orbitflare/orbitflare-sdk-rs](https://github.com/orbitflare/orbitflare-sdk-rs)
- Crate: [crates.io/crates/orbitflare-sdk](https://crates.io/crates/orbitflare-sdk)
- Reference: `cli-sdk.md`

### orbitflare-sdk-ts

Official TypeScript SDK (`@orbitflare/sdk`). Same surface as the Rust SDK: RPC, WebSocket, Yellowstone gRPC, and Jetstream (v1 and v2), with retry, failover, and reconnection. `@grpc/grpc-js` is a peer dependency for gRPC/Jetstream.

- Repo: [github.com/orbitflare/orbitflare-sdk-ts](https://github.com/orbitflare/orbitflare-sdk-ts)
- Package: [npmjs.com/package/@orbitflare/sdk](https://www.npmjs.com/package/@orbitflare/sdk)
- Reference: `cli-sdk.md`

### orbit-cli

Single-binary CLI that wraps RPC, gRPC/Jetstream streaming with YAML configs, project scaffolding, account management, payments, and a TUI dashboard. Every command supports `--json`.

- Repo: [github.com/orbitflare/orbit-cli](https://github.com/orbitflare/orbit-cli)
- Crate: [crates.io/crates/orbitflare](https://crates.io/crates/orbitflare) (the name `orbit-cli` is taken on crates.io)
- Reference: `cli-sdk.md`

### orbitflare-mcp

MCP server that exposes 51 OrbitFlare tools (RPC reads, transaction sends, gRPC config builders, Metis swap quotes, validator info, etc.) to any MCP-compatible host: Claude Desktop, Cursor, Windsurf, VS Code, Continue. Also serves the docs as MCP resources under `orbitflare://docs/*` so models can ground answers in official content.

- Repo: [github.com/orbitflare/orbitflare-mcp](https://github.com/orbitflare/orbitflare-mcp)
- Install: add `{"command": "npx", "args": ["orbitflare-mcp@latest"]}` to your MCP host config; auth via `ORBITFLARE_API_KEY` env var or `setApiKey` at runtime.
- Network: `ORBITFLARE_NETWORK=mainnet|devnet`, or pin a region (e.g. `fra`, `sgp`).
- Use when: the user wants OrbitFlare available as tool calls inside an MCP-aware IDE/agent rather than writing code against the SDK directly.

## Templates

### orbitflare/templates

Starter templates installable via the CLI:

```bash
cargo install orbitflare
orbitflare template --list
orbitflare template --install <name>
```

- Repo: [github.com/orbitflare/templates](https://github.com/orbitflare/templates)

| Template               | Stack                                | What it gives you                                                                                          |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `solana-blinks-axum`   | Rust, Axum, Next.js                  | Solana Actions (Blinks) server + frontend with transfer, donate, and swap examples.                        |
| `solana-copy-trader`   | Rust, Tokio, gRPC, Redis             | Real-time copy trading engine. Jetstream streaming, multi-DEX swap decoding, safety checks, Jito MEV.      |
| `orbit-grpc-indexer`   | Rust, Axum, SeaORM, Next.js          | Dual-stream Jetstream + Yellowstone indexer to Postgres with REST API, WebSocket feed, and explorer UI.    |

## Examples

### shredstream-decode-example

Decode raw Solana turbine shreds end-to-end: parse shred headers, collect FEC sets, run Reed-Solomon recovery, deserialize entries, and pull out instructions for Pump.fun, Jupiter v6, Raydium, and SPL Token. Implements the binary protocol from scratch (no `solana-ledger` dependency).

- Repo: [github.com/orbitflare/shredstream-decode-example](https://github.com/orbitflare/shredstream-decode-example)
- Use when: you want to consume Shredstream UDP packets directly. See `shredstream.md` for product context.

### solana-wallet-tracker

Production Jetstream consumer. PumpFun decoding, whale alerts, YAML-based filters. Closest thing to "what does a real bot look like."

- Repo: [github.com/orbitflare/solana-wallet-tracker](https://github.com/orbitflare/solana-wallet-tracker)
- Use when: building any service that streams Jetstream into business logic (alerts, ingestion, decoding pipelines).

### jetstream-client-example

Minimal Jetstream clients built on the first-party SDKs, in **Rust and TypeScript** (plus a raw-proto Go client). Each language ships a v1 and a v2 example that decode pump.fun instructions from one shared decoder, and the v2 example adds a Raydium filter to the live stream to show runtime filter management. Smaller than `solana-wallet-tracker`; good for "what's the bare minimum to subscribe."

- Repo: [github.com/orbitflare/jetstream-client-example](https://github.com/orbitflare/jetstream-client-example)
- Run: `cargo run --bin v1` / `--bin v2` (Rust) or `npm run v1` / `npm run v2` (TypeScript).
- Use when: you want a hello-world Jetstream starting point in Rust or TypeScript, including a v2 (runtime filters + enrichment) example.

### wallet-ticker

Live terminal dashboard for a Solana wallet's SOL + SPL balances, in under 150 LOC. Bootstraps state via RPC, then opens one `account_subscribe` per account over WebSocket and fans updates into a single channel rendered in place.

- Repo: [github.com/orbitflare/wallet-ticker](https://github.com/orbitflare/wallet-ticker)
- Use when: you want the smallest possible end-to-end example of mixing the SDK's `rpc` and `ws` features, or a starting point for any "watch this account live" tool.

## Picking the right starting point

| Goal                                                  | Start here                                |
| ----------------------------------------------------- | ----------------------------------------- |
| Use OrbitFlare from a Rust service                    | `orbitflare-sdk-rs`                       |
| Use OrbitFlare from a TypeScript/Node service         | `orbitflare-sdk-ts`                       |
| Quick CLI checks, ops scripting, ad-hoc streaming     | `orbit-cli`                               |
| Wire OrbitFlare into Claude Desktop / Cursor / etc.   | `orbitflare-mcp`                          |
| Bootstrap a Blinks app, copy trader, or indexer       | `orbitflare/templates`                    |
| Consume raw shreds                                    | `shredstream-decode-example`              |
| Build a Jetstream-driven bot or indexer               | `solana-wallet-tracker` (or template)     |
| Smallest possible Jetstream subscriber                | `jetstream-client-example`                |
| Smallest end-to-end SDK example (RPC + WS)            | `wallet-ticker`                           |
