# OrbitFlare Yellowstone gRPC

The full Geyser-plugin gRPC interface, served by OrbitFlare. Subscribe to accounts, transactions, slots, blocks, block metadata, and entries — with full transaction metadata including inner instructions, fees, balance changes, and logs.

Source: [docs.orbitflare.com/data-streaming/yellowstone](https://docs.orbitflare.com/data-streaming/yellowstone) · [docs.orbitflare.com/data-streaming/yellowstone-quickstart](https://docs.orbitflare.com/data-streaming/yellowstone-quickstart)

## When to use

- Indexing pipelines that need full transaction metadata (inner ix, balance deltas, logs).
- Analytics, dashboards, and explorers that need slot/block context plus transactions.
- Anything that needs runtime control over `commitment` (`processed` / `confirmed` / `finalized`).
- Anything that needs `vote: false` / `failed: false` filtering, signature filters, or account-data slicing.

If you need **lowest latency** and don't need metadata or slot/block streams, use **Jetstream** instead (`jetstream.md`). If you need data before any block exists, use **Shredstream** (`shredstream.md`).

## Endpoint

```
http://{region}.rpc.orbitflare.com:10000
```

Region codes match HTTP RPC (`ash`, `ny`, `la`, `slc`, `ams`, `fra`, `lon`, `dub`, `siau`, `tok`, `sgp`). The token is sent on the gRPC metadata, not the URL — pass it as the `x-token` argument when constructing the client.

Available with the **Shared gRPC** plan ($500/mo), the **Pro** plan ($999/mo), the **OrbitFlare Pass**, or a **Dedicated gRPC Node** (from $1,800/mo).

## Connection limits

- **50 concurrent connections per IP**, shared across all gRPC and WebSocket endpoints.
- Idle streams are terminated by cloud load balancers at ~10 minutes — **always ping every 30 seconds**.
- Bidirectional streams: you can `write()` new subscriptions onto an open stream without reconnecting.

For more than 50 concurrent connections, get a Dedicated gRPC Node — see `dedicated-nodes.md`.

## Subscribe request shape

Every Yellowstone subscription uses the same envelope. Empty maps mean "no subscription of this type":

```ts
import { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";

const req: SubscribeRequest = {
  commitment: CommitmentLevel.CONFIRMED,    // PROCESSED | CONFIRMED | FINALIZED
  accounts: {},
  accountsDataSlice: [],
  transactions: {},
  transactionsStatus: {},
  slots: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  ping: { id: 1 },
};
```

| Field                | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `commitment`         | Commitment level for *all* filters in this request                                   |
| `accounts`           | Map of named account filters                                                         |
| `accountsDataSlice`  | Array of `{offset, length}` byte ranges to slice account data                        |
| `transactions`       | Map of named transaction filters                                                     |
| `transactionsStatus` | Compact status-only transaction stream                                               |
| `slots`              | Map of named slot filters                                                            |
| `blocks`             | Map of named block filters (full assembled blocks)                                   |
| `blocksMeta`         | Map of named block-metadata filters (cheap)                                          |
| `entry`              | Map of named entry filters (low-level execution units)                               |
| `ping`               | Optional `{ id }`. Server replies with `pong`. Send every 30s on the stream.         |

You can `write()` a new full request to the same stream at any time to *replace* the subscription.

## Filter shapes

### Transactions

| Field             | Type        | Effect                                                                            |
| ----------------- | ----------- | --------------------------------------------------------------------------------- |
| `vote`            | `bool?`     | Include or exclude vote transactions. Default: include all.                       |
| `failed`          | `bool?`     | Include or exclude failed transactions. Default: include all.                     |
| `signature`       | `string?`   | Watch a single signature.                                                         |
| `accountInclude`  | `string[]`  | Match if the tx touches any of these accounts (OR).                               |
| `accountExclude`  | `string[]`  | Drop the tx if it touches any of these accounts.                                  |
| `accountRequired` | `string[]`  | Match only if all of these accounts are present (AND).                            |

### Accounts

| Field      | Type        | Effect                                                                                |
| ---------- | ----------- | ------------------------------------------------------------------------------------- |
| `account`  | `string[]`  | Watch these specific account addresses.                                               |
| `owner`    | `string[]`  | Watch all accounts owned by these programs.                                           |
| `filters`  | `Filter[]`  | Optional `{memcmp}` and `{datasize}` filters, same shape as `getProgramAccounts`.     |

### Slots / blocks / entries

- `slots: { name: { filterByCommitment: true } }` — only emit slot updates at the requested commitment.
- `blocks` and `blocksMeta` accept the same `accountInclude` filter to limit which transactions / accounts are included in the assembled block.
- `entry: { name: {} }` — emits raw entries (batches of transactions plus their results).

## TypeScript quick start

```bash
npm install @triton-one/yellowstone-grpc
```

```ts
import Client, { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";
import bs58 from "bs58";

const GRPC_URL = "http://fra.rpc.orbitflare.com:10000";
const X_TOKEN  = process.env.ORBITFLARE_LICENSE_KEY!;

const client = new Client(GRPC_URL, X_TOKEN, {
  "grpc.max_receive_message_length": 64 * 1024 * 1024,   // 64 MiB
});

const stream = await client.subscribe();

const closed = new Promise<void>((resolve, reject) => {
  stream.on("error", (e) => { reject(e); stream.end(); });
  stream.on("end", () => resolve());
  stream.on("close", () => resolve());
});

stream.on("data", (data) => {
  if (data.transaction) {
    const { transaction, slot } = data.transaction;
    const sig = bs58.encode(transaction.signature);
    const failed = transaction.meta?.err != null;
    const fee = transaction.meta?.fee ?? 0;
    console.log(`[slot ${slot}] ${failed ? "FAIL" : "OK "} fee=${fee} sig=${sig.slice(0, 16)}…`);
  } else if (data.slot) {
    console.log("slot", data.slot.slot, "status", data.slot.status);
  } else if (data.pong) {
    // ignore
  }
});

const req: SubscribeRequest = {
  transactions: {
    raydium: {
      vote: false,
      failed: false,
      accountInclude: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"],
      accountExclude: [],
      accountRequired: [],
    },
  },
  slots: { all: { filterByCommitment: true } },
  commitment: CommitmentLevel.CONFIRMED,
  accounts: {},
  accountsDataSlice: [],
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  ping: { id: 1 },
};

await new Promise<void>((resolve, reject) => {
  stream.write(req, (err) => (err == null ? resolve() : reject(err)));
});

// Keep-alive ping every 30 seconds.
const pingReq: SubscribeRequest = {
  ping: { id: 1 },
  accounts: {}, accountsDataSlice: [], transactions: {},
  transactionsStatus: {}, slots: {}, blocks: {}, blocksMeta: {}, entry: {},
};
const pingTimer = setInterval(() => {
  stream.write(pingReq, () => {});
}, 30_000);
closed.finally(() => clearInterval(pingTimer));

await closed;
```

## Rust (orbitflare-sdk)

```bash
cargo add orbitflare-sdk --features grpc
```

```rust
use orbitflare_sdk::{GeyserClientBuilder, Result};
use orbitflare_sdk::proto::geyser::subscribe_update::UpdateOneof;

#[tokio::main]
async fn main() -> Result<()> {
    let client = GeyserClientBuilder::new()
        .url("http://fra.rpc.orbitflare.com:10000")
        .fallback_url("http://ny.rpc.orbitflare.com:10000")
        .ping_interval_secs(15)
        .max_missed_pongs(3)
        .build()?;

    let mut stream = client.subscribe_yaml("grpc.yml")?;

    while let Some(update) = stream.next().await {
        let update = update?;
        match update.update_oneof {
            Some(UpdateOneof::Transaction(tx)) => {
                if let Some(info) = &tx.transaction {
                    let sig = bs58::encode(&info.signature).into_string();
                    let fee = info.meta.as_ref().map(|m| m.fee).unwrap_or(0);
                    println!("slot={} fee={fee} sig={}...", tx.slot, &sig[..16]);
                }
            }
            Some(UpdateOneof::Slot(s)) => {
                println!("slot {} status {:?}", s.slot, s.status);
            }
            Some(UpdateOneof::BlockMeta(m)) => {
                println!("block {} bh={} txs={}", m.slot, m.blockhash, m.executed_transaction_count);
            }
            _ => {}
        }
    }

    Ok(())
}
```

```yaml
# grpc.yml
transactions:
  raydium:
    vote: false
    failed: false
    account_include:
      - "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
  jupiter:
    vote: false
    failed: false
    account_include:
      - "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"

accounts:
  usdc:
    account:
      - "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  spl_token_holders:
    owner:
      - "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

slots:
  all:
    filter_by_commitment: true

commitment: confirmed
```

The SDK handles ping/pong, exponential reconnect, fallback rotation, and re-subscribe. Multiple streams on one client are independent but share endpoint health state.

## Common subscription recipes

| Goal                                          | Filter                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Watch a DEX for swaps                         | `transactions: { ...: { accountInclude: [dexProgramId], vote: false } }`                     |
| Track wallet activity (success only)          | `transactions: { ...: { accountInclude: [wallet], vote: false, failed: false } }`            |
| Watch a token mint                            | `transactions: { ...: { accountInclude: [mint] } }`                                          |
| Track slot progress                           | `slots: { all: { filterByCommitment: true } }`                                               |
| Stream account data for every SPL token acct  | `accounts: { tokens: { owner: [TOKEN_PROGRAM] } }`                                           |
| Watch a single account                        | `accounts: { my: { account: [pubkey] } }`                                                    |
| Receive only block metadata (cheap)           | `blocksMeta: { all: {} }`                                                                    |
| Wait for a specific signature                 | `transactions: { wait: { signature: "5K8..." } }`                                            |

## Best practices

- Use `commitment: CONFIRMED` for most workloads. Only step down to `PROCESSED` when latency matters more than reorg risk.
- Use `accountsDataSlice` to receive only the byte ranges you actually parse — saves bandwidth and CPU on big accounts.
- Use `blocksMeta` instead of `blocks` if you only need block headers (slot, blockhash, parent, tx count). Full `blocks` are heavy.
- Combine `accountInclude` with `accountRequired` carefully: `Include` is OR, `Required` is AND. Setting both narrows the match further.
- Treat the gRPC stream as the source of truth for "did this happen". For point-in-time state, use HTTP RPC (`getAccountInfo`).

## Common pitfalls

- **`RESOURCE_EXHAUSTED` at connect.** Per-IP 50-connection cap was hit. Close idle streams or move to a dedicated gRPC node.
- **No events arriving.** Filter is too strict — try a broader `accountInclude` to confirm the wiring works.
- **Streams die at 10 minutes.** Forgot the 30-second ping. Add it and reconnect.
- **High memory / dropped events.** Your consumer is too slow; the Rust SDK channel will fill up. Bump `.channel_capacity(...)` and process events in a worker pool.
- **Confusing Jetstream and Yellowstone.** If `tx.transaction.meta` is missing, you're on Jetstream. Switch to Yellowstone for full metadata.
