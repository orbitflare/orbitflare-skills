---
name: orbitflare
description: Build Solana applications on OrbitFlare's Shredstream-optimized infrastructure. Covers HTTP RPC and WebSockets, Apex transaction landing, real-time streaming via Jetstream (v1 and v2) and Yellowstone gRPC, raw Shredstream, Dedicated Nodes (Solana + BNB Chain), getTransactionsForAddress, historical archive data, trading APIs (Metis Swap, Jito Bundle Simulation), Customer API v2, the OrbitFlare CLI, and the first-party SDKs (orbitflare-sdk for Rust, @orbitflare/sdk for TypeScript).
metadata:
  author: OrbitFlare
  version: "0.1.0"
  homepage: https://orbitflare.com
  docs: https://docs.orbitflare.com
---

# OrbitFlare — Build on Solana

You are an expert Solana developer building on OrbitFlare. OrbitFlare is a Shredstream-optimized Solana infrastructure provider with HTTP RPC, WebSockets, Apex transaction landing, two flavors of gRPC streaming (Jetstream and Yellowstone), raw UDP Shredstream, Dedicated Nodes for Solana and BNB Chain, an enriched `getTransactionsForAddress` method, full archive data from genesis, and trading APIs (Metis Swap, Jito Bundle Simulation). This skill teaches you how to use it correctly — whether you write raw HTTP, a first-party SDK (`orbitflare-sdk` for Rust or `@orbitflare/sdk` for TypeScript), the [OrbitFlare CLI](https://docs.orbitflare.com/cli), or the Customer API.

The source of truth for everything in this skill is [docs.orbitflare.com](https://docs.orbitflare.com) and the docs index at [docs.orbitflare.com/llms.txt](https://docs.orbitflare.com/llms.txt). When in doubt, fetch one of those before implementing.

## Prerequisites

### 1. Get an API key

Sign up at [orbitflare.com/dashboard](https://orbitflare.com/dashboard). The Free plan gives you 10 RPS / 1 TPS forever — enough to prototype before upgrading. There are no monthly credit caps on any plan; only per-second RPS/TPS.

OrbitFlare exposes **three distinct keys**, each with its own auth scheme. Do not confuse them:

| Key                     | Where it goes                                          | Used for                                                            |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| **RPC license key**     | `?api_key=` or `x-api-key` on RPC/WS; `x-token` on gRPC | HTTP RPC, WebSockets, gRPC (Jetstream, Yellowstone)                 |
| **Customer API key**    | `X-ORBIT-KEY: YOUR_API_KEY` HTTP header                | `orbitflare.com/api/customer/v2/...` (licenses, billing, top-up)    |
| **Apex API key**        | `x-api-key` header or `?api-key=` (QUIC: derived cert) | Apex transaction landing (`*.apex.orbitflare.com`)                  |

A license key looks like `ORBIT-XXXXXX-NNNNNN-NNNNNN`. Never commit any of these keys to source control or expose them in client-side code.

Each license runs in one of two **authentication modes**, set in the dashboard (Licenses > Authentication Mode) or with the Customer API's `toggle-auth-mode`:

| Mode             | RPC and WebSocket                          | Jetstream and Yellowstone (gRPC)            |
| ---------------- | ------------------------------------------ | ------------------------------------------- |
| **IP Whitelist** | License key, from a whitelisted IP         | A whitelisted IP. No key needed             |
| **API Key Only** | License key, from any IP                   | License key in the `x-token` header         |

Send the license key as `?api_key=` or an `x-api-key` header on RPC and WebSocket, and as `x-token` gRPC metadata on Jetstream and Yellowstone (gRPC has no query string; `x-api-key` is not accepted there). The SDKs do this from `ORBITFLARE_LICENSE_KEY` (Rust `orbitflare-sdk` ≥ 0.4.1, `@orbitflare/sdk` ≥ 0.5.1, Go ≥ v0.2.1). A license also covers specific regions: a region outside it returns `-32404 IP not whitelisted` on RPC, `PermissionDenied` on Yellowstone, and a dropped connection (`EOF`) on Jetstream, in either mode.

### 2. (Optional) Install the OrbitFlare CLI

The CLI is the closest thing OrbitFlare has to an "agent surface" — a single binary that wraps RPC queries, gRPC/Jetstream streaming with YAML configs, project scaffolding, account management, and an interactive TUI. Every command supports `--json` so the output is parseable.

```bash
cargo install orbitflare           # requires Rust 1.85+
orbitflare auth login --x-orbit-key YOUR_API_KEY
orbitflare config set rpc.url http://fra.rpc.orbitflare.com
orbitflare ping
```

See `references/cli-sdk.md` for the full command surface.

### 3. (Optional) Install an SDK

For programmatic use, prefer a first-party SDK over hand-rolled HTTP/gRPC.

**Rust** (`orbitflare-sdk`, features are opt-in):

```bash
cargo add orbitflare-sdk                          # RPC only
cargo add orbitflare-sdk --features ws            # + WebSocket
cargo add orbitflare-sdk --features grpc          # + Yellowstone gRPC
cargo add orbitflare-sdk --features jetstream     # + Jetstream (v1 and v2)
```

**TypeScript** (`@orbitflare/sdk`; `@grpc/grpc-js` is a peer dependency for gRPC/Jetstream):

```bash
npm install @orbitflare/sdk @grpc/grpc-js
```

**Apex** (transaction landing): `ApexClient` ships in `@orbitflare/sdk`; Rust uses `cargo add orbitflare-apex --features rpc`, Go uses `go get github.com/orbitflare/orbitflare-apex-go`. See `references/apex.md`.

The Rust SDK reads `ORBITFLARE_LICENSE_KEY`, `ORBITFLARE_RPC_URL`, `ORBITFLARE_WS_URL`, `ORBITFLARE_GRPC_URL`, `ORBITFLARE_JETSTREAM_URL` from the environment if you don't pass them explicitly. Sources: [orbitflare-sdk-rs](https://github.com/orbitflare/orbitflare-sdk-rs) · [orbitflare-sdk-ts](https://github.com/orbitflare/orbitflare-sdk-ts).

## Routing

Identify what the user is building, then read the relevant reference file **before** writing code. Always read references first.

### Quick disambiguation

| Intent                                                                    | Read                              |
| ------------------------------------------------------------------------- | --------------------------------- |
| Standard JSON-RPC reads / sends (getBalance, sendTransaction, etc.)       | `references/rpc.md`               |
| Land transactions fast (SWQoS + Jito + TPU), tips, bundles, QUIC sends    | `references/apex.md`              |
| Real-time push from a single connection (slot, account, logs, signature)  | `references/websockets.md`        |
| Lowest-latency transaction stream for trading bots                        | `references/jetstream.md`         |
| Full Geyser stream with inner instructions, slots, blocks, entries        | `references/yellowstone.md`       |
| Raw UDP shreds before they hit any RPC (HFT / MEV / sniping)              | `references/shredstream.md`       |
| Dedicated bare-metal Solana or BNB nodes; unlimited RPS/TPS               | `references/dedicated-nodes.md`   |
| Wallet history in one call, archive blocks, managed backfills             | `references/fetching-data.md`     |
| Token swaps via Jupiter Metis, or Jito bundle simulation                  | `references/trading-apis.md`      |
| Manage licenses, API keys, IP whitelists, top-ups, invoices via REST      | `references/customer-api.md`      |
| Use the `orbitflare` CLI or the `orbitflare-sdk` Rust crate               | `references/cli-sdk.md`           |
| Find a starter template, example client, or first-party repo              | `references/repos.md`             |
| Sign up, choose a plan, fund a balance, top up with USDC                  | `references/onboarding.md`        |

### Streaming chooser

If the user wants a real-time stream, pick the right product first. Getting this wrong is the most common OrbitFlare mistake.

```
                          ┌─────────────────────────────┐
                          │ Need raw shreds before any  │
                          │ block / RPC sees them?      │
                          └──────────────┬──────────────┘
                                  yes    │    no
                       ┌─────────────────┘
                       ▼
                 Shredstream
                 (UDP, 8 regions, $500-$1000/mo)
                                            │
                                            ▼
                          ┌─────────────────────────────┐
                          │ Need inner instructions,    │
                          │ slots, blocks, or entries?  │
                          └──────────────┬──────────────┘
                                  yes    │    no
                       ┌─────────────────┘
                       ▼
                 Yellowstone gRPC
                 (Geyser, full metadata)
                                            │
                                            ▼
                          ┌─────────────────────────────┐
                          │ Need lowest-latency         │
                          │ transaction stream?         │
                          └──────────────┬──────────────┘
                                  yes    │    no
                       ┌─────────────────┘
                       ▼
                 Jetstream gRPC
                 (decoded shreds, transaction filters only)
                                            │
                                            ▼
                 WebSockets
                 (slot/account/logs/signature, single conn)
```

### Endpoint cheat sheet

| Service          | URL pattern                                                          |
| ---------------- | -------------------------------------------------------------------- |
| HTTP RPC         | `http://{region}.rpc.orbitflare.com?api_key=KEY`                     |
| WebSocket        | `ws://{region}.rpc.orbitflare.com?api_key=KEY`                       |
| Devnet RPC       | `https://devnet.rpc.orbitflare.com?api_key=KEY`                      |
| Yellowstone gRPC | `http://{region}.rpc.orbitflare.com:10000` (token via client config) |
| Jetstream        | `http://{region}.jetstream.orbitflare.com`                           |
| BNB Chain        | `https://bnb-{region}.rpc.orbitflare.com?api_key=KEY`                |
| Apex (HTTP)      | `http://{code}.apex.orbitflare.com` (`x-api-key` header)             |
| Apex (QUIC)      | `{code}.apex.orbitflare.com:7001`                                    |
| Customer API v2  | `https://orbitflare.com/api/customer/v2/...`                         |

RPC region codes (9 total): `va`, `ny`, `la`, `slc` (US); `ams`, `fra`, `lon` (EU); `jp`, `sg` (APAC). See `references/rpc.md` for the full table. **Jetstream uses a different set**: `ny`, `slc`, `fra`, `ams`, `lon`, `dub`, `sqq` (Siauliai), `jp`, `sgp` (no Ashburn or LA). See `references/jetstream.md`. **Apex uses its own codes**: `global` (nearest), `fra`, `ams`, `dub`, `lon`, `nyc`, `slc`, `sgp`, `tyo`, `sqq`. See `references/apex.md`.

## Rules

Follow these in every implementation:

### Endpoints & auth

- Solana endpoints are region-pinned (`{region}.rpc.orbitflare.com`, `{region}.jetstream.orbitflare.com`). Pick the region closest to the client (e.g. `fra` for EU, `ny` for US East; for APAC, `jp` or `sg`).
- For Devnet, use `devnet.rpc.orbitflare.com` - never point Devnet traffic at a mainnet region.
- RPC, WebSockets and BNB nodes take the **license key** as `?api_key=` or an `x-api-key` header; Jetstream and Yellowstone take it as `x-token` metadata in API Key Only mode and need only a whitelisted IP in IP Whitelist mode. Shredstream is authorized by its registered IP and port. The Customer API uses the **API key** as the `X-ORBIT-KEY` header. Apex uses its own **Apex API key** (Dashboard > Apex) as the `x-api-key` header. They are different keys.
- Never embed any key in client-side or browser-side code. Use environment variables (`ORBITFLARE_LICENSE_KEY`, `ORBITFLARE_RPC_URL`, etc.) and a server-side proxy if the client is a browser.
- For fixed servers, prefer **IP Whitelist** mode so a leaked key is useless from elsewhere. Use **API Key Only** for serverless, CI, laptops or anything with changing IPs, and treat the key as a secret: anyone who has it can use the license.

### RPC

- Use commitment levels deliberately: `processed` for UI updates, `confirmed` for most reads, `finalized` for irreversible operations (custody moves, settlement).
- Use `getMultipleAccounts` (chunked at 100) instead of N parallel `getAccountInfo` calls. The OrbitFlare Rust SDK's `get_multiple_accounts` chunks for you automatically.
- Use JSON-RPC batch requests (`[req1, req2, ...]` body) when you need 5+ unrelated calls in flight.
- Always pass `maxSupportedTransactionVersion: 1` on `getTransaction`, `getBlock` and full `getTransactionsForAddress`. About half of mainnet transactions are now Transaction v1: with `0`, `getTransaction` and `getBlock` fail with `-32015`, and `getTransactionsForAddress` silently leaves v1 transactions out of the history.
- Never roll your own `getSignaturesForAddress` + `getTransaction` loop for wallet history. Use **`getTransactionsForAddress`** (OrbitFlare's enriched method) — it returns up to 100 full transactions or 1000 signatures in a single call, with bidirectional sort, time/slot/status filters, and token-account inclusion. See `references/fetching-data.md`.

### Streaming

- Cap is **50 concurrent connections per IP** across all gRPC and WebSocket endpoints (Jetstream and Yellowstone share this pool). Close streams cleanly before opening new ones. Hitting the cap returns gRPC `RESOURCE_EXHAUSTED` or WebSocket close code `1008`.
- **Send a ping every 30 seconds on gRPC.** Cloud load balancers terminate idle gRPC streams at ~10 minutes. WebSocket connections that sit idle are dropped after several minutes; send a WebSocket ping frame (not a JSON-RPC `ping`, which Solana does not have) every 20 to 30 seconds.
- Implement reconnection with exponential backoff: start at 1s, double up to 30s, infinite attempts. Re-subscribe after every reconnect. The Rust SDK does this for you (`RetryPolicy`); if you write your own client, copy the pattern.
- Do not pick Jetstream when you need inner instructions, transaction metadata, slots, blocks, or entries — those are Yellowstone-only. Jetstream is for raw, low-latency **transaction** streams; account filters and account updates appear in the v1 proto but are not currently implemented.

### Transactions

- Before submitting a transaction: call `simulateTransaction` to surface logs and any errors, then `getRecentPrioritizationFees` (or use the Metis API's built-in `prioritizationFeeLamports`) to pick a priority fee.
- Always set `ComputeBudgetProgram.setComputeUnitLimit` and `setComputeUnitPrice` explicitly. Don't rely on the network defaults.
- For high-stakes sends, set `skipPreflight: true` only after a successful local simulation; otherwise leave preflight on so the RPC catches obviously bad transactions.
- For trading workloads using Jupiter routing, use the **Metis Swap API** (`/swap/v1/quote` then `/swap/v1/swap`) with `dynamicComputeUnitLimit: true` and `prioritizationFeeLamports.priorityLevelWithMaxLamports.maxLamports` set as a safety cap. See `references/trading-apis.md`.
- For landing-critical sends, use **Apex** (`references/apex.md`): every transaction needs exactly one top-level SystemProgram transfer of at least 0.001 SOL (standard tier floor) to an `APeX…` account from `getTipAccounts`, kept in the static account keys. The tip is only paid if the transaction lands and also funds the Jito bid, so don't add a separate Jito tip. Apex runs no preflight; simulate on your RPC first, and confirm on your RPC after (accepted is not landed).
- For Jito bundles, **simulate first** with `simulateBundle` on a dedicated node before paying the tip. Bundles are limited to 5 transactions, and the last one must include a Jito tip of at least 1,000 lamports.

### Historical & archive

- All OrbitFlare RPC plans include the full archive from genesis (March 2020). `getBlock`, `getTransaction`, `getSignaturesForAddress` all work for any slot.
- Solana does not store **historical account state**. You can replay every transaction that touched an account, but you cannot ask "what was this account's balance at slot N". For point-in-time queries, you must compute it from transactions.
- For very large backfills (seeding an indexer, building an ML dataset, audit work), don't loop RPC calls — request **Managed Backfills** delivered as JSON / Parquet / SQL to S3, GCS, PostgreSQL, or ClickHouse. See `references/fetching-data.md`.

### Customer API

- Use the Customer API v2 (`https://orbitflare.com/api/customer/v2/...`) for everything programmatic — licenses, API key management, IP whitelist updates, USDC top-ups, invoice payments. v1 is deprecated.
- The USDC top-up flow is two steps: `POST /customer/v2/topup/prepare` returns a server-built unsigned transaction, you sign it locally, then `POST /customer/v2/topup/confirm` broadcasts it. Don't try to bypass `prepare` — the server embeds a memo and recent blockhash that `confirm` verifies on-chain.

### Code quality

- Keep keys in env vars (`ORBITFLARE_LICENSE_KEY`, `ORBITFLARE_RPC_URL`, `ORBITFLARE_WS_URL`, `ORBITFLARE_GRPC_URL`, `ORBITFLARE_JETSTREAM_URL`, `ORBITFLARE_APEX_API_KEY`) so the SDKs and CLI pick them up automatically.
- Handle `429 Too Many Requests` with exponential backoff. There are no monthly caps, only per-second RPS/TPS — so a brief retry usually clears the limit.
- For multi-region or HA setups, configure fallback URLs with the SDK's `.fallback_url(...)` (or pass them to the CLI's `--fallback-url`) so failover happens transparently.
- Prefer a **first-party OrbitFlare SDK** for any non-trivial app: `orbitflare-sdk` (Rust, crates.io) or `@orbitflare/sdk` (TypeScript, npm). Both cover RPC, WebSocket, Yellowstone gRPC, and Jetstream (v1 and v2) with built-in retry, failover, and reconnection. For Yellowstone specifically you can also use `@triton-one/yellowstone-grpc` in TypeScript, but the OrbitFlare SDK is the first-party path.

## Common pitfalls

- **Mixing the two auth schemes.** Sending the license key as `X-ORBIT-KEY`, or the API key as `?api_key=`, returns `401 Unauthorized`. Re-read the prerequisites table.
- **`RESOURCE_EXHAUSTED` on gRPC.** You opened more than 50 concurrent connections from one IP. Close idle streams; don't open a fresh stream per filter — one stream can carry many filters. If you legitimately need more than 50, you need a Dedicated gRPC Node.
- **Streams dying after exactly 10 minutes.** Cloudflare or your load balancer closed the idle stream. Send a `ping` every 30 s on gRPC, and a WebSocket ping frame every 20 to 30 s on WebSockets.
- **`processed` commitment rejected by `getTransactionsForAddress`.** Only `confirmed` and `finalized` are accepted. The error is `-32602 Invalid params`.
- **Choosing Jetstream when you need Yellowstone.** Jetstream has no `slots`, `blocks`, `blocksMeta`, `entry`, or `commitment` fields. If you need inner instructions or full transaction metadata, you need Yellowstone.
- **Hand-rolling `getSignaturesForAddress` + `getTransaction`.** That's the N+1 problem — 1,001 RPC calls for a 1,000-tx wallet. Use `getTransactionsForAddress` for one call.
- **Forgetting to set `tokenAccounts: "balanceChanged"` on `getTransactionsForAddress` for wallets.** Without it you miss every SPL transfer (because they touch the ATA, not the wallet itself).
- **Setting `maxAccounts` too low on Metis.** Some DEXes require up to 47 accounts; lowering this silently drops them from routing and can give you a worse price.
- **Treating Apex like the RPC.** Apex accepts sends only, uses its own API key (`x-api-key`, not `?api_key=`), its own region codes (`nyc`, `tyo`, `sqq`), and rejects transactions without exactly one valid tip.
- **Sending Jito bundles to a non-Jito RPC.** Jito tips only take effect when the bundle goes through Jito's block engine. On a Dedicated Node with the Jito client, you're already there; on standard endpoints you are not.

## Support

- Docs: [docs.orbitflare.com](https://docs.orbitflare.com) (full index at [llms.txt](https://docs.orbitflare.com/llms.txt))
- Discord: [discord.gg/orbitflare](https://discord.gg/orbitflare)
- GitHub: [github.com/orbitflare](https://github.com/orbitflare)
- Status: [status.orbitflare.com](https://status.orbitflare.com)
