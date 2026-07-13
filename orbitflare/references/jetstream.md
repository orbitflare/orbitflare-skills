# OrbitFlare Jetstream

OrbitFlare's lowest-latency gRPC stream of decoded Solana transactions. Use this when you want every relevant transaction the moment it lands, with the smallest possible per-event payload. Jetstream is transaction-focused: account filters and account updates exist in the v1 proto but are **not currently implemented**, so don't build against them.

Two protocol versions ship on the **same endpoints and auth**: **v1** (fixed filters, one server stream) and **v2** (runtime-managed filters, per-message sequence numbers, opt-in enrichment, and slot lifecycle events). See the "Jetstream v2" section below.

Source: [docs.orbitflare.com/data-streaming/jetstream](https://docs.orbitflare.com/data-streaming/jetstream) · [v2 overview](https://docs.orbitflare.com/data-streaming/jetstream-v2) · [v2 protocol reference](https://docs.orbitflare.com/data-streaming/jetstream-v2-reference) · SDKs: [Rust](https://docs.orbitflare.com/sdk/rust-jetstream) · [TypeScript](https://docs.orbitflare.com/sdk/typescript-jetstream)

## When to use

- Real-time trading bots, snipers, and market-making engines.
- Live wallet trackers keyed on the transactions that touch a wallet, where latency matters more than full metadata.
- Live alerts: PumpFun launches, large transfers, new pool creation, etc.

If you need **inner instructions, transaction metadata, slot/block/entry feeds, or `commitment` control**, you need **Yellowstone** instead. Jetstream intentionally omits those for speed. See `yellowstone.md`.

If you need data **before** any block exists at all (raw turbine shreds), use **Shredstream** — see `shredstream.md`.

## Jetstream vs. Yellowstone

| Feature                    | Jetstream                                       | Yellowstone                                       |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Latency                    | Ultra-low (decoded shreds)                      | Low (Geyser plugin)                               |
| Inner instructions         | No                                              | Yes                                               |
| Transaction metadata       | No                                              | Yes (fee, balances, logs)                         |
| Slot / block / entry feeds | No                                              | Yes                                               |
| Commitment control         | No (always tip-of-shred)                        | Yes (`processed` / `confirmed` / `finalized`)     |
| Filters                    | `transactions` (v2 also streams slot events)    | `transactions`, `accounts`, `slots`, `blocks`, `blocksMeta`, `entry` |
| Best for                   | Real-time trading                               | Indexing / analytics                              |
| Connection                 | gRPC (decoded shreds)                           | gRPC (Geyser)                                     |

Both share the same 50 concurrent connections per IP cap.

## Endpoint

```
http://{region}.jetstream.orbitflare.com
```

Region codes: `ny`, `slc` (US); `fra`, `ams`, `lon`, `dub`, `siau` (EU); `jp`, `sgp` (APAC). Pick the region closest to the validators you care about (Frankfurt and New York are usually fastest for mainstream programs).

Authentication is via metadata on the gRPC channel — the orbitflare-sdk handles it from `ORBITFLARE_LICENSE_KEY`.

## Connection limits

- **50 concurrent connections per IP**, shared with WebSockets and Yellowstone.
- Idle gRPC streams behind cloud load balancers (Cloudflare etc.) get terminated at ~10 minutes. Send a ping every 30 seconds.
- One stream can carry many filters — don't open one stream per filter.

## Filters

Jetstream filters on **transactions**. Filters are a map of named filters; a transaction matches if any *named* filter matches. (An `accounts` filter block appears in the v1 proto but is **not currently implemented**, along with account updates, so it never fires.)

### Transaction filters

| Field              | Effect                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `account_include`  | Match if the transaction touches **any** of these addresses (logical OR).                           |
| `account_exclude`  | Drop transactions that touch any of these addresses.                                                |
| `account_required` | Only match if **every** listed address appears in the transaction (logical AND).                    |

There is **no** `vote`, `failed`, `signature`, `slots`, `blocks`, or `commitment` field on Jetstream. Those are Yellowstone-only. Vote transactions are already excluded server-side, so you never receive them.

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
        if let Some(UpdateOneof::Transaction(tx)) = update.update_oneof {
            if let Some(info) = &tx.transaction {
                let sig = bs58::encode(&info.signature).into_string();
                println!("slot={} sig={}...", tx.slot, &sig[..16]);
            }
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

## TypeScript (@orbitflare/sdk)

There is a first-party TypeScript client. `@grpc/grpc-js` is a peer dependency for streaming.

```bash
npm install @orbitflare/sdk @grpc/grpc-js
```

```ts
import {
  JetstreamClientBuilder,
  SubscribeRequestBuilder,
  TransactionFilter,
} from '@orbitflare/sdk/jetstream';
import bs58 from 'bs58';

const client = new JetstreamClientBuilder()
  .url('http://fra.jetstream.orbitflare.com')
  .fallbackUrl('http://ny.jetstream.orbitflare.com')
  .build();

// Typed account filters, no hand-written protobuf.
const request = new SubscribeRequestBuilder()
  .transactions(
    'pumpfun',
    new TransactionFilter().accountInclude(['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P']),
  )
  .build();

const stream = client.subscribe(request);

for await (const update of stream) {
  const info = update.transaction?.transaction;
  if (info?.signature) {
    console.log(`slot=${update.transaction!.slot} sig=${bs58.encode(info.signature).slice(0, 16)}`);
  }
}
```

The SDK also accepts a YAML config via `client.subscribeYaml('jetstream.yml')`, same schema as the CLI.

### Example repos

- [orbitflare/jetstream-client-example](https://github.com/orbitflare/jetstream-client-example): minimal Rust and TypeScript clients built on the SDKs, each with a v1 and a v2 example that decode pump.fun instructions from a shared decoder. Run `cargo run --bin v1` / `--bin v2` (Rust) or `npm run v1` / `npm run v2` (TypeScript).
- [orbitflare/solana-wallet-tracker](https://github.com/orbitflare/solana-wallet-tracker): fuller real-world example with PumpFun decoding, whale alerts, and YAML-based filters.

## Jetstream v2

v2 runs on the **same endpoints and auth** as v1 and is fully additive: v1 keeps working unchanged. Reach for v2 when you want any of:

- **Runtime-managed filters.** Add and remove filters on a live stream with no reconnect. Each filter carries a client-chosen `filter_id`, echoed back on every matching transaction so you can route by which filter matched.
- **Per-message sequence numbers.** Every response carries a monotonic `sequence`, so you can detect dropped messages.
- **Opt-in enrichment.** Set `include_enrichment` on a filter to also receive fee payer, program ids, compute-unit price, compute limit, tx size, and resolved address-table addresses. Off by default (lean payload); enabling it on any active filter enriches every transaction the session receives.
- **Slot lifecycle events.** A separate server stream of slot alive/complete/dead events.

A v2 filter must set at least one of `account_include` / `account_exclude` / `account_required`; empty (match-everything) filters are rejected. There is no account-watching in v2.

The priority fee is not a field; compute it as `compute_unit_price * compute_limit / 1_000_000` (lamports).

### Rust

```rust
use orbitflare_sdk::jetstream::v2::{JetstreamClientBuilder, TransactionFilter};
use orbitflare_sdk::proto::jetstream::v2::subscribe_transactions_response::Payload;
use orbitflare_sdk::Result;

#[tokio::main]
async fn main() -> Result<()> {
    let client = JetstreamClientBuilder::new()
        .url("http://fra.jetstream.orbitflare.com")
        .build()?;

    let filter = TransactionFilter::new()
        .account_include(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"])
        .include_enrichment(true)
        .with_id("pumpfun");

    let mut stream = client.subscribe_transactions(vec![filter]);
    let handle = stream.handle();

    while let Some(resp) = stream.next().await {
        match resp?.payload {
            Some(Payload::Transaction(ft)) => {
                if let Some(tx) = &ft.transaction {
                    println!("slot={} cu_price={} matched={:?}", tx.slot, tx.compute_unit_price, ft.filter_ids);
                }
            }
            Some(Payload::FilterValidation(r)) => println!("filter {} accepted={}", r.filter_id, r.accepted),
            _ => {}
        }
    }
    Ok(())
}

// Add/remove filters on the live stream, no reconnect:
// handle.add_filters(vec![TransactionFilter::new().account_include(["..."]).with_id("raydium")])?;
// handle.remove_filters(vec!["pumpfun".to_string()])?;

// Slot lifecycle events (separate stream):
// let mut slots = client.subscribe_slots();
// while let Some(event) = slots.next().await { let e = event?; println!("slot={} {:?}", e.slot, e.status()); }
```

### TypeScript

```ts
import { JetstreamClientBuilder, TransactionFilter } from '@orbitflare/sdk/jetstream/v2';

const client = new JetstreamClientBuilder().url('http://fra.jetstream.orbitflare.com').build();

const stream = client.subscribeTransactions([
  new TransactionFilter().accountInclude(['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P']).includeEnrichment(true).withId('pumpfun'),
]);
const handle = stream.handle();

for await (const resp of stream) {
  if (resp.transaction) {
    const tx = resp.transaction.transaction;
    if (tx) console.log(`seq=${resp.sequence} slot=${tx.slot} cuPrice=${tx.computeUnitPrice} matched=${JSON.stringify(resp.transaction.filterIds)}`);
  } else if (resp.filterValidation) {
    console.log(`filter ${resp.filterValidation.filterId} accepted=${resp.filterValidation.accepted}`);
  }
}

// handle.addFilters([new TransactionFilter().accountInclude(['...']).withId('raydium')]);
// handle.removeFilters(['pumpfun']);
// const slots = client.subscribeSlots();  // separate slot lifecycle stream
```

`getVersion()` / `get_version()` and `ping()` are unary health probes with the same failover as the streams.

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
