# OrbitFlare Fetching Data

Two things: (1) `getTransactionsForAddress` — OrbitFlare's enriched RPC method that replaces the N+1 `getSignaturesForAddress` + `getTransaction` loop; and (2) historical / archive data, including managed backfills.

Source: [docs.orbitflare.com/fetching-data/getTransactionsForAddress](https://docs.orbitflare.com/fetching-data/getTransactionsForAddress) · [docs.orbitflare.com/fetching-data/historical-data](https://docs.orbitflare.com/fetching-data/historical-data)

## Why `getTransactionsForAddress`

Standard Solana RPC for "show me this wallet's transactions" requires two methods:

1. `getSignaturesForAddress` → list of signatures.
2. `getTransaction` → for each signature, fetch the full transaction.

That's 1 + N round trips. For a 1,000-tx wallet, you make 1,001 calls.

`getTransactionsForAddress` returns up to **100 full transactions** or **1,000 signatures** in a **single call**, with bidirectional sorting, time/slot/status filters, token-account inclusion, and cursor-based pagination.

It also fixes the "where are my SPL transfers?" gap: when tokens are sent to a wallet, the transaction references the wallet's *Associated Token Account*, not the wallet pubkey. Standard methods miss those entirely. Pass `tokenAccounts: "balanceChanged"` (or `"all"`) and they're included.

## Method signature

```
method:  getTransactionsForAddress
params:  [address, options?]
```

### Options

| Field                          | Type      | Default       | Notes                                                         |
| ------------------------------ | --------- | ------------- | ------------------------------------------------------------- |
| `transactionDetails`           | string    | `signatures`  | `signatures` / `none` / `accounts` / `full`                   |
| `sortOrder`                    | string    | `desc`        | `desc` (newest first) / `asc` (oldest first)                  |
| `limit`                        | number    | `100`         | Max 1000 in `signatures` mode, 100 in `full`/`accounts` mode  |
| `paginationToken`              | string    | —             | Cursor `"slot:txIndex"` from the previous response            |
| `commitment`                   | string    | `finalized`   | `finalized` or `confirmed` only — **`processed` is rejected** |
| `encoding`                     | string    | `json`        | `json` / `jsonParsed` / `base64` / `base58` (only in `full`)  |
| `maxSupportedTransactionVersion` | number  | `0` in `full` | Set to handle versioned txs                                   |
| `minContextSlot`               | number    | —             | Reject if the node is behind this slot                        |
| `filters.tokenAccounts`        | string    | `none`        | `none` / `balanceChanged` / `all`                             |
| `filters.blockTime`            | object    | —             | `{ gte, gt, lte, lt, eq }` Unix seconds                       |
| `filters.slot`                 | object    | —             | `{ gte, gt, lte, lt, eq }`                                    |
| `filters.signature`            | object    | —             | `{ gte, gt, lte, lt }` base-58                                |
| `filters.status`               | string    | —             | `succeeded` / `failed`                                        |

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "data": [ ... ],
    "paginationToken": "387936002:541"
  }
}
```

`paginationToken` is only present when more results are available. Pass it back as `paginationToken` to get the next page.

## Detail levels

| `transactionDetails` | What you get                                                     | Max per call |
| -------------------- | ---------------------------------------------------------------- | ------------ |
| `signatures` (default)| `signature`, `slot`, `txIndex`, `blockTime`, `err`, `memo`     | 1000         |
| `none`               | Same fields as `signatures`                                      | 1000         |
| `accounts`           | Above + `accountKeys` (incl. lookup table loaded)                | 100          |
| `full`               | Above + full `transaction` and `meta`                            | 100          |

Use `signatures` for counting / listing. Use `accounts` to filter client-side by what's in the tx without paying for `meta`. Use `full` only when you need balances, logs, or inner instructions.

## cURL examples

### Recent signatures (default)

```bash
curl -X POST "https://mainnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTransactionsForAddress",
    "params": ["WALLET_ADDRESS"]
  }'
```

### 100 full transactions for a wallet, including SPL transfers

```bash
curl -X POST "https://mainnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTransactionsForAddress",
    "params": [
      "WALLET_ADDRESS",
      {
        "transactionDetails": "full",
        "limit": 100,
        "filters": { "tokenAccounts": "balanceChanged" }
      }
    ]
  }'
```

### Oldest-first within a time window

```bash
curl -X POST "https://mainnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTransactionsForAddress",
    "params": [
      "WALLET_ADDRESS",
      {
        "sortOrder": "asc",
        "filters": { "blockTime": { "gte": 1704067200, "lte": 1706745600 } }
      }
    ]
  }'
```

### Failed transactions only (debugging)

```bash
curl -X POST "https://mainnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTransactionsForAddress",
    "params": [
      "WALLET_ADDRESS",
      { "transactionDetails": "full", "filters": { "status": "failed" } }
    ]
  }'
```

## TypeScript

```ts
type Range = { gte?: number; gt?: number; lte?: number; lt?: number; eq?: number };

interface Options {
  transactionDetails?: "full" | "signatures" | "accounts" | "none";
  sortOrder?: "asc" | "desc";
  limit?: number;
  paginationToken?: string;
  commitment?: "finalized" | "confirmed";
  encoding?: "json" | "jsonParsed" | "base64" | "base58";
  maxSupportedTransactionVersion?: number;
  minContextSlot?: number;
  filters?: {
    tokenAccounts?: "none" | "balanceChanged" | "all";
    blockTime?: Range;
    slot?: Range;
    signature?: { gte?: string; gt?: string; lte?: string; lt?: string };
    status?: "succeeded" | "failed";
  };
}

interface Result {
  data: any[];
  paginationToken?: string;
}

const RPC = process.env.ORBITFLARE_RPC_URL!;

async function getTransactionsForAddress(addr: string, opts: Options = {}): Promise<Result> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransactionsForAddress",
      params: [addr, opts],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${json.error.code} ${json.error.message}`);
  return json.result;
}

// Page through every signature for an address
async function getAllSignatures(addr: string) {
  const all: any[] = [];
  let token: string | undefined;

  while (true) {
    const page = await getTransactionsForAddress(addr, {
      transactionDetails: "signatures",
      limit: 1000,
      paginationToken: token,
    });

    if (!page.data || page.data.length === 0) break;
    all.push(...page.data);

    token = page.paginationToken;
    if (!token) break;

    await new Promise((r) => setTimeout(r, 100)); // gentle on rate limits
  }

  return all;
}

// Build a wallet feed for a UI
async function walletFeed(wallet: string, cursor?: string) {
  return getTransactionsForAddress(wallet, {
    limit: 20,
    paginationToken: cursor,
    transactionDetails: "full",
    filters: { tokenAccounts: "balanceChanged" },
  });
}
```

## Rust (orbitflare-sdk)

The SDK has a typed wrapper for this method:

```rust
use orbitflare_sdk::{
    GetTransactionsFilters, GetTransactionsOptions, RangeFilter, RpcClientBuilder, Result,
};

#[tokio::main]
async fn main() -> Result<()> {
    let client = RpcClientBuilder::new()
        .url("https://mainnet.rpc.orbitflare.com")
        .build()?;

    let opts = GetTransactionsOptions::new()
        .transaction_details("full")
        .limit(100)
        .sort_order("asc")
        .filters(
            GetTransactionsFilters::new()
                .token_accounts("balanceChanged")
                .status("succeeded")
                .block_time(RangeFilter {
                    gte: Some(1704067200),
                    lte: Some(1706745600),
                    ..Default::default()
                }),
        );

    let mut token = None;
    loop {
        let mut o = opts.clone();
        if let Some(t) = &token { o = o.pagination_token(t); }

        let res = client.get_transactions_for_address("WALLET_ADDRESS", o).await?;
        for tx in &res.data {
            println!("slot {}", tx["slot"]);
        }
        match res.pagination_token {
            Some(t) => token = Some(t),
            None => break,
        }
    }

    Ok(())
}
```

## Common use cases

| Goal                                      | Recipe                                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Build a wallet feed for a UI              | `transactionDetails: "full"`, `limit: 20`, `tokenAccounts: "balanceChanged"`, paginate with `paginationToken`     |
| Trace a wallet's first activity           | `sortOrder: "asc"`, `transactionDetails: "full"`, `limit: 100`                                                    |
| Audit / compliance dump                   | Loop `transactionDetails: "signatures"`, `limit: 1000` until `paginationToken` is gone                            |
| Token-launch analysis (early holders)     | Address = mint, `sortOrder: "asc"`, `tokenAccounts: "all"`, `transactionDetails: "full"`                          |
| Failed-tx debugging                       | `filters.status: "failed"`, `transactionDetails: "full"`                                                          |
| Trades in a specific month                | `filters.status: "succeeded"`, `filters.blockTime: { gte, lt }`, `transactionDetails: "full"`                     |

## Error codes

| Code     | Message                                              | Cause / fix                                                  |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `-32602` | Invalid params                                       | Wrong shape (e.g. `processed` commitment) — fix the request. |
| `-32602` | Invalid paginationToken format                       | Use the exact `"slot:txIndex"` string from the prior page.   |
| `-32602` | commitment must be 'finalized' or 'confirmed'        | Don't pass `processed`.                                      |
| `-32603` | Internal error                                       | Retry with backoff.                                          |

## Historical / archive data

All OrbitFlare RPC plans include the **full archive from genesis (March 2020)** at no extra cost. Standard archive RPC methods all work on any slot:

| Method                          | Use                                       |
| ------------------------------- | ----------------------------------------- |
| `getBlock`                      | Any slot since genesis                    |
| `getBlocks`, `getBlocksWithLimit`| Slot ranges                              |
| `getBlockTime`                  | Block timestamp                           |
| `getBlockHeight`                | Current block height                      |
| `getFirstAvailableBlock`        | Lowest slot with data                     |
| `getTransaction`                | Any signature, ever                       |
| `getSignaturesForAddress`       | History per address (1000 max per call)   |
| `getAccountInfo`                | **Current** state only (see limitation)   |

### Important limitation: no historical account state

Solana stores **current** account state, not snapshots. You can replay every transaction that touched an account, but you cannot ask "what was this account's balance at slot N". For point-in-time state, you must compute it from the transaction history (or use Managed Backfills below).

### Examples

Block 100,000,000 with full transactions:

```bash
curl -X POST "https://mainnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBlock",
    "params": [
      100000000,
      { "encoding": "json", "transactionDetails": "full", "rewards": false, "maxSupportedTransactionVersion": 0 }
    ]
  }'
```

Block timestamp:

```bash
curl ... -d '{ "jsonrpc": "2.0", "id": 1, "method": "getBlockTime", "params": [100000000] }'
```

Always pass `maxSupportedTransactionVersion: 0` so versioned transactions don't throw.

## Managed backfills

For large-scale historical data delivery (seeding an indexer, ML datasets, audits, post-downtime backfills), don't loop RPC. OrbitFlare's engineering team will extract structured Solana data and deliver it directly to your storage.

| Output         | Destinations                          |
| -------------- | ------------------------------------- |
| JSON (NDJSON)  | AWS S3, Google Cloud Storage          |
| Parquet        | AWS S3, Google Cloud Storage          |
| SQL            | PostgreSQL, ClickHouse                |

Common deliverables:

- All transactions for a program / wallet / token mint.
- Full block data for any slot range.
- SPL Token / Token-2022 transfer history.
- Custom queries.

SLA: 3–5 business days for standard backfills, genesis-to-present coverage, dedicated engineer for the duration of the job. Enterprise service — contact [sales@orbitflare.com](mailto:sales@orbitflare.com) or [discord.gg/orbitflare](https://discord.gg/orbitflare).

For ongoing streams of new data (rather than a one-shot backfill), use Yellowstone gRPC (`yellowstone.md`) instead.

## Best practices

- Default to `getTransactionsForAddress` for any address-history workload.
- For wallets, set `tokenAccounts: "balanceChanged"` so you don't miss SPL transfers.
- Use `signatures` mode + 1000 limit for cheap counting and pagination.
- Cache finalized blocks and finalized transactions — they never change.
- Don't paginate concurrently — pages depend on the previous page's token. Sequential is correct.
- Treat `processed` commitment as forbidden for this method — it is.

## Common pitfalls

- **Empty results for a wallet that obviously has activity.** You forgot `tokenAccounts: "balanceChanged"`. SPL transfers reference the ATA, not the wallet.
- **`-32602` on the first call.** You passed `commitment: "processed"`. Use `confirmed` or `finalized`.
- **Paginating in parallel and getting duplicates.** Each page's `paginationToken` is the cursor for the *next* page; pages must be fetched sequentially.
- **Using `getSignaturesForAddress` + `getTransaction` instead.** That's the N+1 problem. Switch to `getTransactionsForAddress`.
- **Querying historical account state.** Solana doesn't keep it. Replay transactions or buy a managed backfill.
