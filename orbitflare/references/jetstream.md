# OrbitFlare Jetstream

OrbitFlare's lowest-latency gRPC stream of decoded Solana transactions and account updates. Use this when you want every relevant transaction the moment it lands, with the smallest possible per-event payload.

Source: [docs.orbitflare.com/data-streaming/jetstream](https://docs.orbitflare.com/data-streaming/jetstream) · [docs.orbitflare.com/sdk/rust-jetstream](https://docs.orbitflare.com/sdk/rust-jetstream)

## When to use

- Real-time trading bots, snipers, and market-making engines.
- Live wallet trackers (transactions + account updates) where latency matters more than full metadata.
- Live alerts: PumpFun launches, large transfers, new pool creation, etc.

If you need **inner instructions, transaction metadata, slot/block/entry feeds, or `commitment` control**, you need **Yellowstone** instead — Jetstream intentionally omits those for speed. See `yellowstone.md`.

If you need data **before** any block exists at all (raw turbine shreds), use **Shredstream** — see `shredstream.md`.

## Jetstream vs. Yellowstone

| Feature                    | Jetstream                                       | Yellowstone                                       |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Latency                    | Ultra-low (decoded shreds)                      | Low (Geyser plugin)                               |
| Inner instructions         | No                                              | Yes                                               |
| Transaction metadata       | No                                              | Yes (fee, balances, logs)                         |
| Slot / block / entry feeds | No                                              | Yes                                               |
| Commitment control         | No (always tip-of-shred)                        | Yes (`processed` / `confirmed` / `finalized`)     |
| Filters                    | `transactions`, `accounts`                      | `transactions`, `accounts`, `slots`, `blocks`, `blocksMeta`, `entry` |
| Best for                   | Real-time trading                               | Indexing / analytics                              |
| Connection                 | gRPC (decoded shreds)                           | gRPC (Geyser)                                     |

Both share the same 50 concurrent connections per IP cap.

## Endpoint

```
http://{region}.jetstream.orbitflare.com
```

Region codes are the same as HTTP RPC (`ash`, `ny`, `la`, `slc`, `ams`, `fra`, `lon`, `dub`, `siau`, `tok`, `sgp`). Pick the region closest to the validators you care about (Frankfurt and New York are usually fastest for mainstream programs).

Authentication is via metadata on the gRPC channel — the orbitflare-sdk handles it from `ORBITFLARE_LICENSE_KEY`.

## Connection limits

- **50 concurrent connections per IP**, shared with WebSockets and Yellowstone.
- Idle gRPC streams behind cloud load balancers (Cloudflare etc.) get terminated at ~10 minutes. Send a ping every 30 seconds.
- One stream can carry many filters — don't open one stream per filter.

## Filters

Jetstream supports two filter blocks: `transactions` and `accounts`. Each is a map of named filters; a transaction or account matches if any *named* filter matches.

### Transaction filters

| Field              | Effect                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `account_include`  | Match if the transaction touches **any** of these addresses (logical OR).                           |
| `account_exclude`  | Drop transactions that touch any of these addresses.                                                |
| `account_required` | Only match if **every** listed address appears in the transaction (logical AND).                    |

### Account filters

| Field              | Effect                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `account`          | Watch these specific account addresses.                                                             |
| `owner`            | Watch every account owned by these programs.                                                        |

There is **no** `vote`, `failed`, `signature`, `slots`, `blocks`, or `commitment` field on Jetstream — those are Yellowstone-only.

## Quick start (CLI)

The `orbitflare` CLI is the fastest way to try Jetstream. See `cli-sdk.md` for install.

```bash
orbitflare config set jetstream.url http://fra.jetstream.orbitflare.com
orbitflare jet --config jetstream.yml
```

```yaml
# jetstream.yml
transactions:
  pumpfun:
    account_include:
      - "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"   # pump.fun program
  raydium:
    account_include:
      - "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"   # Raydium AMM v4

accounts:
  my_wallet:
    account:
      - "YOUR_WALLET_ADDRESS"

reconnect:
  initial_delay_ms: 100
  max_delay_ms: 30000
  multiplier: 2.0
  max_retries: 0     # 0 = infinite
```

YAML supports `${ENV_VAR}` expansion.

## Rust (orbitflare-sdk)

```bash
cargo add orbitflare-sdk --features jetstream
```

```rust
use orbitflare_sdk::{JetstreamClientBuilder, Result};
use orbitflare_sdk::proto::jetstream::subscribe_update::UpdateOneof;

#[tokio::main]
async fn main() -> Result<()> {
    let client = JetstreamClientBuilder::new()
        .url("http://fra.jetstream.orbitflare.com")
        .fallback_url("http://ny.jetstream.orbitflare.com")
        .ping_interval_secs(15)        // safe under the 10-min LB timeout
        .max_missed_pongs(3)
        .build()?;

    let mut stream = client.subscribe_yaml("jetstream.yml")?;

    while let Some(update) = stream.next().await {
        let update = update?;
        match update.update_oneof {
            Some(UpdateOneof::Transaction(tx)) => {
                if let Some(info) = &tx.transaction {
                    let sig = bs58::encode(&info.signature).into_string();
                    println!("slot={} sig={}...", tx.slot, &sig[..16]);
                }
            }
            Some(UpdateOneof::Account(acct)) => {
                if let Some(info) = &acct.account {
                    let pk = bs58::encode(&info.pubkey).into_string();
                    println!("account {pk} updated at slot {}", acct.slot);
                }
            }
            _ => {}
        }
    }

    Ok(())
}
```

The SDK handles reconnect, ping/pong, fallback URL rotation, and re-subscription automatically. Multiple streams on one client share endpoint health state — if one stream quarantines a failing endpoint, the others skip it on their next reconnect.

### Programmatic filters (no YAML)

```rust
use std::collections::HashMap;
use orbitflare_sdk::proto::jetstream::*;

let mut filters = HashMap::new();
filters.insert("target".into(), SubscribeRequestFilterTransactions {
    account_include: vec!["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P".into()],
    account_exclude: vec![],
    account_required: vec![],
});

let request = SubscribeRequest {
    transactions: filters,
    accounts: HashMap::new(),
    ping: Some(SubscribeRequestPing { id: 1 }),
};

let mut stream = client.subscribe(request);
```

## TypeScript (Node.js example client)

There isn't a first-party TypeScript client for Jetstream. Use the example repo as a starting point:

```bash
git clone https://github.com/orbitflare/jetstream-client-example
cd jetstream-client-example
cargo build --release
./target/release/jetstream-client-example \
  -j http://fra.jetstream.orbitflare.com \
  -i 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
```

Or for a fuller real-world example, [orbitflare/solana-wallet-tracker](https://github.com/orbitflare/solana-wallet-tracker) has PumpFun decoding, whale alerts, and YAML-based filters.

## Pricing & access

- **Shared gRPC** (covers both Jetstream and Yellowstone): $500/month — 1 IP, full gRPC access. Best for developers and small bots.
- **Pro plan** ($999/mo): includes gRPC.
- **OrbitFlare Pass** NFT: includes gRPC.
- **Dedicated gRPC Node**: from $1,800/mo, no shared connection cap, dedicated hardware. Best for HFT and analytics platforms. See `dedicated-nodes.md`.

## Best practices

- Combine `account_include` with `account_exclude` to keep noisy accounts (e.g., wrapped SOL ATA) off your stream.
- Use `account_required` only when *all* addresses must be present (e.g., a specific pool + the user's wallet).
- One stream per logical workload, not one per filter. Streams are cheap to add but each costs you a connection from the 50-conn pool.
- Always send pings every 15-30 seconds. The Rust SDK does it for you; if you write your own client, schedule a `SubscribeRequest { ping: Some(SubscribeRequestPing { id: 1 }), ..default() }` writer.
- For HA, configure at least one fallback region. The SDK rotates through them on reconnect.

## Common pitfalls

- **Picked Jetstream when you needed Yellowstone.** Jetstream events have no `meta` field, no inner instructions, no slot/block context beyond `tx.slot`. If you find yourself reaching for fields that aren't there, switch streams.
- **Stream silently dies after 10 minutes.** Cloudflare killed the idle stream. Add a ping interval ≤ 30s.
- **`RESOURCE_EXHAUSTED`** on connect. You hit the 50-connection cap across all gRPC + WebSocket. Close orphans or upgrade to a dedicated gRPC node.
- **Trying to filter by `vote: false`.** That's a Yellowstone field. On Jetstream, exclude votes by adding the vote program to `account_exclude` or filter downstream.
