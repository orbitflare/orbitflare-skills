# OrbitFlare CLI & Rust SDK

Two first-party tools for building on OrbitFlare:

- **OrbitFlare CLI** (`orbitflare`) — single binary that wraps RPC queries, gRPC/Jetstream streaming with YAML configs, project scaffolding, account management, payments, and an interactive TUI dashboard. JSON output on every command (`--json`) makes it scriptable.
- **orbitflare-sdk-rs** — official Rust SDK with typed clients for RPC, WebSocket, Yellowstone gRPC, and Jetstream. Built-in retry, failover, and reconnection.

Source: [docs.orbitflare.com/cli](https://docs.orbitflare.com/cli) · [docs.orbitflare.com/sdk/overview](https://docs.orbitflare.com/sdk/overview) · [github.com/orbitflare/orbitflare-sdk-rs](https://github.com/orbitflare/orbitflare-sdk-rs)

---

## OrbitFlare CLI

### Install

```bash
cargo install orbitflare           # requires Rust 1.85+
orbitflare --version
```

Or from source:

```bash
git clone https://github.com/orbitflare/orbit-cli.git
cd orbit-cli
cargo install --path .
```

### Existing-user quick start

```bash
orbitflare auth login --x-orbit-key YOUR_API_KEY
orbitflare config set rpc.url https://mainnet.rpc.orbitflare.com
orbitflare ping
orbitflare rpc slot
```

### Auth methods

```bash
orbitflare auth login --x-orbit-key YOUR_API_KEY              # API key
orbitflare auth login --wallet ~/.config/solana/id.json       # Wallet signature
orbitflare auth login                                         # Device flow (browser)
```

Credentials are stored in your **OS keychain**, not on disk. The CLI supports multiple named profiles:

```bash
orbitflare auth status
orbitflare auth switch --profile work
orbitflare auth set-license-key YOUR_LICENSE_KEY
orbitflare auth logout
```

Key resolution order (highest priority first):

1. `--x-orbit-key` flag on the command.
2. `--profile` flag.
3. Default profile in `~/.orbitflare/config.yml`.

### Endpoint URL formats

| Protocol | Format                                              | Example                                       |
| -------- | --------------------------------------------------- | --------------------------------------------- |
| RPC      | `http://{region}.rpc.orbitflare.com`                | `http://ams.rpc.orbitflare.com`               |
| WS       | `ws://{region}.rpc.orbitflare.com`                  | `ws://ams.rpc.orbitflare.com`                 |
| gRPC (Yellowstone) | `http://{region}.rpc.orbitflare.com:10000` | `http://ams.rpc.orbitflare.com:10000`         |
| Jetstream | `http://{region}.jetstream.orbitflare.com`         | `http://ams.jetstream.orbitflare.com`         |

```bash
orbitflare config set rpc.url        http://fra.rpc.orbitflare.com
orbitflare config set grpc.url       http://fra.rpc.orbitflare.com:10000
orbitflare config set jetstream.url  http://fra.jetstream.orbitflare.com
orbitflare ping
orbitflare ping --service rpc        # ping a specific service
```

Devnet endpoints are pre-configured by default.

### RPC commands

```bash
orbitflare rpc slot
orbitflare rpc balance YOUR_WALLET
orbitflare rpc account YOUR_PUBKEY
orbitflare rpc tokens YOUR_WALLET
orbitflare rpc tx YOUR_SIGNATURE
orbitflare rpc history YOUR_WALLET --limit 20
orbitflare rpc program-accounts PROGRAM_ID --limit 10
orbitflare rpc epoch
orbitflare rpc blockhash
orbitflare rpc stats
orbitflare rpc priority-fees --account ADDRESS
orbitflare rpc raw '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}'
```

### Streaming commands

YAML-config-driven gRPC and Jetstream subscriptions with automatic reconnection and endpoint failover. YAML supports `${ENV_VAR}` expansion.

```bash
orbitflare jet  --config jetstream.yml      # Jetstream
orbitflare grpc --config grpc.yml           # Yellowstone
```

Example Yellowstone config:

```yaml
transactions:
  jupiter:
    account_include: ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"]
    vote: false
    failed: false
slots:
  all:
    filter_by_commitment: true
commitment: confirmed
reconnect:
  initial_delay_ms: 100
  max_delay_ms: 30000
  multiplier: 2.0
  max_retries: 0
```

### Templates

Scaffold projects from production-ready starter templates (cached locally for offline use):

```bash
orbitflare template --list
orbitflare template --list --filter rust
orbitflare template --view solana-copy-trader
orbitflare template --install solana-copy-trader --dir ./my-bot
orbitflare config set templates.repo https://github.com/your-org/templates
```

### Plans, payments, orders, invoices

```bash
orbitflare plan list
orbitflare plan view growth
orbitflare plan compare --all
orbitflare plan compare dev growth

orbitflare pay check-balance
orbitflare pay topup 100 --wallet ~/.config/solana/id.json
orbitflare pay history
orbitflare pay purchase growth monthly --coupon WELCOME

orbitflare pay order --history
orbitflare pay order REF
orbitflare pay invoice --list
orbitflare pay invoice REF
orbitflare pay renew INV_REF
```

`topup` defaults to `~/.config/solana/id.json` for the wallet keypair. Periods: `monthly`, `quarterly`, `semi-annual`, `annual`.

### TUI dashboard

```bash
orbitflare dashboard
```

Full keyboard-driven UI for profile, services, API keys, invoices. Themes via `t` / `T`.

### JSON output

Every command supports `--json` for clean machine output:

```bash
orbitflare rpc slot --json
orbitflare rpc balance Gh9... --json
orbitflare auth status --json
```

### Global flags

| Flag                       | Effect                                             |
| -------------------------- | -------------------------------------------------- |
| `--json`                   | Raw JSON output                                    |
| `--raw`                    | Minimal output, no formatting                      |
| `--network <net>`          | `mainnet` / `devnet` / `testnet`                   |
| `--commitment <level>`     | `processed` / `confirmed` / `finalized`            |
| `--rpc-url <url>`          | Override RPC endpoint                              |
| `--grpc-url <url>`         | Override gRPC endpoint                             |
| `--fallback-url <url>`     | Add fallback URL (repeatable)                      |
| `--profile <name>`         | Use a stored auth profile                          |
| `--quiet`                  | Suppress non-essential output                      |
| `--no-color`               | Disable colors                                     |

### Files

```
~/.orbitflare/
├── config.yml                  # main config
├── templates_cache.json        # template registry cache
└── cache/
    └── rpc-plans.json          # plans cache (6-hour TTL)
```

API keys, tokens, and license keys are in the **OS keychain**, not on disk.

---

## orbitflare-sdk-rs (Rust SDK)

Official Rust SDK with typed clients for every OrbitFlare service. Built-in retry, failover, ping/pong liveness, automatic reconnection, and (where applicable) automatic re-subscribe.

### Install

```bash
cargo add orbitflare-sdk                          # RPC only (default)
cargo add orbitflare-sdk --features ws            # + WebSocket
cargo add orbitflare-sdk --features grpc          # + Yellowstone gRPC
cargo add orbitflare-sdk --features jetstream     # + Jetstream
```

You can stack features. `cargo add orbitflare-sdk --features "ws grpc jetstream"` gets you everything.

### Environment variables

The SDK reads these as defaults if you don't pass them explicitly:

| Variable                   | Used by              |
| -------------------------- | -------------------- |
| `ORBITFLARE_LICENSE_KEY`   | RPC, WebSocket       |
| `ORBITFLARE_RPC_URL`       | RPC                  |
| `ORBITFLARE_WS_URL`        | WebSocket            |
| `ORBITFLARE_GRPC_URL`      | Yellowstone gRPC     |
| `ORBITFLARE_JETSTREAM_URL` | Jetstream            |

### RPC client

```rust
use orbitflare_sdk::{RpcClientBuilder, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = RpcClientBuilder::new()
        .url("https://mainnet.rpc.orbitflare.com")
        .fallback_url("https://fra.rpc.orbitflare.com")
        .commitment("confirmed")
        .build()?;

    let slot = client.get_slot().await?;
    let balance = client.get_balance("So111...").await?;
    let (blockhash, _) = client.get_latest_blockhash().await?;

    Ok(())
}
```

Typed helpers: `get_slot`, `get_balance`, `get_account_info`, `get_multiple_accounts` (auto-chunks 100 at a time), `get_latest_blockhash`, `get_transaction`, `get_signatures_for_address`, `get_program_accounts`, `get_recent_prioritization_fees`, `send_transaction`, `simulate_transaction`, `get_token_accounts_by_owner`, **`get_transactions_for_address`** (typed wrapper for OrbitFlare's enriched method).

Escape hatches: `client.request("methodName", json!([...]))` and `client.request_raw("...")` for any RPC method by name.

### WebSocket client

```rust
use orbitflare_sdk::{WsClientBuilder, Result};

let client = WsClientBuilder::new()
    .url("wss://mainnet.rpc.orbitflare.com")
    .build().await?;

let mut slots = client.slot_subscribe().await?;
let mut usdc  = client.account_subscribe("EPjFWdd5...", "confirmed").await?;
let mut logs  = client.logs_subscribe(&["6EF8r..."], "confirmed").await?;

while let Some(slot) = slots.next().await {
    println!("slot {}", slot["slot"]);
}
```

All subscriptions on a single client share one underlying WebSocket. The SDK pings every 10s by default and re-subscribes automatically after reconnect.

### Yellowstone gRPC client

```rust
use orbitflare_sdk::{GeyserClientBuilder, Result};
use orbitflare_sdk::proto::geyser::subscribe_update::UpdateOneof;

let client = GeyserClientBuilder::new()
    .url("http://fra.rpc.orbitflare.com:10000")
    .ping_interval_secs(15)        // safe under the 10-min LB timeout
    .max_missed_pongs(3)
    .build()?;

let mut stream = client.subscribe_yaml("grpc.yml")?;
while let Some(update) = stream.next().await {
    match update?.update_oneof {
        Some(UpdateOneof::Transaction(tx)) => { /* tx.slot, tx.transaction.meta */ }
        Some(UpdateOneof::Slot(s))         => { /* s.slot, s.status */ }
        _ => {}
    }
}
```

Programmatic filters (no YAML) live under `orbitflare_sdk::proto::geyser::*`. See `yellowstone.md`.

### Jetstream client

```rust
use orbitflare_sdk::{JetstreamClientBuilder, Result};
use orbitflare_sdk::proto::jetstream::subscribe_update::UpdateOneof;

let client = JetstreamClientBuilder::new()
    .url("http://fra.jetstream.orbitflare.com")
    .build()?;

let mut stream = client.subscribe_yaml("jetstream.yml")?;
while let Some(update) = stream.next().await {
    if let Some(UpdateOneof::Transaction(tx)) = update?.update_oneof {
        // ...
    }
}
```

Same builder shape as the Geyser client. See `jetstream.md`.

### Common builder options

| Method                      | Effect                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `.url(url)`                 | Primary endpoint                                                       |
| `.urls(&[...])`             | Primary + fallbacks in one call                                        |
| `.fallback_url(url)`        | Add a fallback endpoint                                                |
| `.api_key(key)`             | License key (or set `ORBITFLARE_LICENSE_KEY`)                          |
| `.commitment(level)`        | RPC default commitment                                                 |
| `.retry(RetryPolicy { ... })`| Backoff policy: initial_delay, max_delay, multiplier, max_attempts    |
| `.timeout(Duration)`        | Per-request timeout (RPC)                                              |
| `.timeout_secs(n)`          | Per-request timeout (gRPC, Jetstream)                                  |
| `.keepalive_secs(n)`        | TCP keepalive (gRPC, Jetstream)                                        |
| `.ping_interval_secs(n)`    | App-level ping cadence                                                 |
| `.max_missed_pongs(n)`      | Reconnect after N missed pongs                                         |
| `.channel_capacity(n)`      | Bounded channel between background task and your code                  |

### Multiple streams

One client can run many streams concurrently. Each gets its own background connection but they share endpoint health state — if one quarantines a failing endpoint, the others skip it on the next reconnect.

```rust
let mut s1 = client.subscribe_yaml("config/pumpfun.yml")?;
let mut s2 = client.subscribe_yaml("config/raydium.yml")?;
let mut s3 = client.subscribe_yaml("config/slots.yml")?;
```

### When to use SDK vs CLI vs raw HTTP

| Use this                | When                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| **CLI**                 | Shell scripting, ops, ad-hoc queries, quick streaming with `--json` output |
| **Rust SDK**            | Long-lived services, trading bots, indexers, anything in Rust              |
| **Raw HTTP / web3.js**  | TypeScript / Python / Go / Ruby / etc. — no first-party SDK exists yet     |
| **`@triton-one/yellowstone-grpc`** | TypeScript Yellowstone client                                  |

For TypeScript apps, use `fetch` for HTTP RPC, the standard `ws` client for WebSockets, and `@triton-one/yellowstone-grpc` for Yellowstone. There is no first-party Jetstream TypeScript client yet — use the [example repo](https://github.com/orbitflare/jetstream-client-example) as a starting point or call into the Rust client.
