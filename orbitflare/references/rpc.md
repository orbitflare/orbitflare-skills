# OrbitFlare HTTP RPC

Standard Solana JSON-RPC 2.0 over HTTPS, served from 11 global regions with automatic routing.

Source: [docs.orbitflare.com/rpc/http](https://docs.orbitflare.com/rpc/http) · [docs.orbitflare.com/authentication](https://docs.orbitflare.com/authentication)

## When to use

- Standard reads (`getBalance`, `getAccountInfo`, `getMultipleAccounts`, `getProgramAccounts`).
- Transaction lifecycle (`simulateTransaction`, `sendTransaction`, `getTransaction`, `getSignatureStatuses`).
- Block and slot queries (`getBlock`, `getBlocks`, `getSlot`, `getEpochInfo`).
- One-shot history queries (`getSignaturesForAddress`, `getTransaction`) — but for any wallet-history workload, prefer **`getTransactionsForAddress`** instead. See `fetching-data.md`.

For real-time push, use `websockets.md`, `jetstream.md`, or `yellowstone.md`.

## Endpoints

Solana RPC is always region-pinned. Pick the region closest to the client:

```
http://{region}.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
```

| Continent | Region code | City                       |
| --------- | ----------- | -------------------------- |
| US        | `ash`       | Ashburn, Virginia          |
| US        | `ny`        | New York                   |
| US        | `la`        | Los Angeles                |
| US        | `slc`       | Salt Lake City, Utah       |
| EU        | `ams`       | Amsterdam                  |
| EU        | `fra`       | Frankfurt                  |
| EU        | `lon`       | London                     |
| EU        | `dub`       | Dublin                     |
| EU        | `siau`      | Siauliai, Lithuania        |
| APAC      | `tok`       | Tokyo                      |
| APAC      | `sgp`       | Singapore                  |

Devnet:

```
https://devnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
```

Health check (GET, not POST):

```
GET http://{region}.rpc.orbitflare.com/health?api_key=YOUR_LICENSE_KEY
# returns: ok | behind { slots: N } | error
```

## Authentication

Pass your **license key** as the `?api_key=` query parameter. This is *not* the same as the `X-ORBIT-KEY` Customer API key — see `customer-api.md`. License keys look like `ORBIT-XXXXXX-NNNNNN-NNNNNN` and live in the Licenses tab of the [dashboard](https://orbitflare.com/dashboard).

Optional hardening: enable IP whitelisting on the license so a leaked URL is not enough to use the key.

## Rate limits

Per-second only — there are no monthly credit caps.

| Plan       | RPS         | TPS         |
| ---------- | ----------- | ----------- |
| Free       | 10          | 1           |
| Developer  | 50          | 10          |
| Growth     | 200         | 75          |
| Scale      | 400         | 150         |
| Pro        | 600         | 200         |
| Dedicated  | Unlimited   | Unlimited   |

Exceeding a limit returns HTTP `429 Too Many Requests`. Use exponential backoff (1s → 2s → 4s → ... cap at 30s).

## Request format

```bash
curl -X POST "http://fra.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getBalance",
    "params": ["83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri"]
  }'
```

Response:

```json
{ "jsonrpc": "2.0", "id": 1, "result": { "context": { "slot": 312849539 }, "value": 12345678 } }
```

### Commitment

Pass `{"commitment": "..."}` as the last param on most read methods:

| Level       | Use it for                                              |
| ----------- | ------------------------------------------------------- |
| `processed` | UI ticking / dashboards (fastest, may be reorged)       |
| `confirmed` | Most app reads — supermajority confirmed                |
| `finalized` | Custody, settlement, anything irreversible              |

### Batch requests

JSON-RPC 2.0 supports batching — send an *array* of request objects to make N calls in one HTTP round trip. Use this when you have 5+ unrelated calls in flight; otherwise use `getMultipleAccounts` etc.

```bash
curl -X POST "http://fra.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    { "jsonrpc": "2.0", "id": 1, "method": "getSlot", "params": [] },
    { "jsonrpc": "2.0", "id": 2, "method": "getBlockHeight", "params": [] },
    { "jsonrpc": "2.0", "id": 3, "method": "getEpochInfo", "params": [] }
  ]'
```

## TypeScript example

Use `fetch` against the JSON-RPC endpoint, or the standard `@solana/web3.js` `Connection`:

```ts
import { Connection, PublicKey } from "@solana/web3.js";

const RPC = process.env.ORBITFLARE_RPC_URL!;            // e.g. http://fra.rpc.orbitflare.com?api_key=...
const connection = new Connection(RPC, "confirmed");

const balance = await connection.getBalance(
  new PublicKey("83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri")
);

const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

const sigStatus = await connection.getSignatureStatuses([
  "5K8F2j..."
]);
```

## Rust example (orbitflare-sdk)

```rust
use orbitflare_sdk::{RpcClientBuilder, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = RpcClientBuilder::new()
        .url("http://fra.rpc.orbitflare.com")
        .fallback_url("http://ams.rpc.orbitflare.com")
        .commitment("confirmed")
        .build()?;

    let slot = client.get_slot().await?;
    let balance = client.get_balance("83astBRguLMdt2h5U1Tpdq5tjFoJ6noeGwaY3mDLVcri").await?;
    let (blockhash, _last_valid) = client.get_latest_blockhash().await?;

    println!("slot={slot} balance={balance} bh={blockhash}");
    Ok(())
}
```

The SDK reads `ORBITFLARE_RPC_URL` and `ORBITFLARE_LICENSE_KEY` from the environment if you don't pass them, and chunks `get_multiple_accounts` automatically. See `cli-sdk.md`.

## Common methods

OrbitFlare supports the full Solana JSON-RPC method set. Highlights:

| Category          | Methods                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Accounts          | `getBalance`, `getAccountInfo`, `getMultipleAccounts`, `getProgramAccounts`                          |
| Tokens            | `getTokenAccountBalance`, `getTokenAccountsByOwner`, `getTokenAccountsByDelegate`, `getTokenSupply`  |
| Transactions      | `simulateTransaction`, `sendTransaction`, `getTransaction`, `getSignatureStatuses`                   |
| History           | `getSignaturesForAddress`, **`getTransactionsForAddress`** (OrbitFlare-only, see `fetching-data.md`) |
| Blocks/Slots      | `getBlock`, `getBlocks`, `getSlot`, `getBlockHeight`, `getBlockTime`, `getFirstAvailableBlock`       |
| Network/Epoch     | `getEpochInfo`, `getEpochSchedule`, `getInflationRate`, `getSupply`, `getRecentPerformanceSamples`   |
| Fees              | `getRecentPrioritizationFees`, `getFeeForMessage`                                                    |
| Validator         | `getVoteAccounts`, `getClusterNodes`, `getLeaderSchedule`                                            |

Full method list: [docs.orbitflare.com/llms.txt](https://docs.orbitflare.com/llms.txt) (search for `rpc/methods/`).

## Sending transactions

1. Build the transaction (versioned tx with `maxSupportedTransactionVersion: 0`).
2. Add `ComputeBudgetProgram.setComputeUnitLimit(...)` and `setComputeUnitPrice(...)` instructions. Pick the unit price from a recent call to `getRecentPrioritizationFees` for the writable accounts.
3. `simulateTransaction` to surface logs / errors before paying for landing.
4. `sendTransaction` with `skipPreflight: false` (let the RPC reject obviously bad txs) unless you've already simulated locally and need every microsecond.
5. Poll `getSignatureStatuses` or subscribe via `signatureSubscribe` (see `websockets.md`) to wait for confirmation.
6. If the blockhash expires (last valid block height passed), rebuild and resend — never reuse a stale blockhash.

For DEX swaps, use the **Metis Swap API** which handles fee selection, dynamic compute units, and dynamic slippage for you. See `trading-apis.md`.

## HTTP error codes

| Code | Meaning              | What to do                                                                  |
| ---- | -------------------- | --------------------------------------------------------------------------- |
| 401  | Unauthorized         | License key wrong / missing. Check `?api_key=` and IP whitelist.            |
| 403  | Forbidden            | Plan does not allow this method or your IP is not whitelisted.              |
| 429  | Too Many Requests    | RPS / TPS exceeded. Exponential backoff.                                    |
| 500  | Internal Server      | Transient. Retry once.                                                      |
| 502  | Bad Gateway          | Upstream issue. Retry; check status page.                                   |
| 503  | Service Unavailable  | Maintenance / overload. Backoff.                                            |
| 504  | Gateway Timeout      | Request too heavy. Reduce scope or batch differently.                       |

## JSON-RPC error codes

| Code     | Meaning                          | Note                                                              |
| -------- | -------------------------------- | ----------------------------------------------------------------- |
| `-32700` | Parse error                      | Body isn't valid JSON.                                            |
| `-32600` | Invalid request                  | Missing/wrong fields in the envelope.                             |
| `-32601` | Method not found                 | Typo in `method`, or method not enabled on this plan.             |
| `-32602` | Invalid params                   | Wrong shape — common for `getTransactionsForAddress` filters.     |
| `-32603` | Internal error                   | Retry with backoff.                                               |
| `-32001` | Transaction simulation failed    | Inspect the embedded logs.                                        |
| `-32002` | Account not found                | Verify the pubkey.                                                |
| `-32003` | Block not found                  | Use `getFirstAvailableBlock` to check ledger range.               |
| `-32004` | Node unhealthy                   | Switch region or wait — the SDK does this automatically.          |

## Best practices

- Pick the region closest to the client (e.g. `fra` for EU, `ny` for US East, `tok` for APAC).
- Configure fallback regions in the SDK (`.fallback_url(...)`) for HA.
- Set `maxSupportedTransactionVersion: 0` on every `getBlock` / `getTransaction` to handle versioned txs.
- Use `getMultipleAccounts` (max 100 per call) instead of looping `getAccountInfo`.
- Cache immutable data (finalized blocks, finalized transactions) locally — it never changes.
- Treat the license key as a secret. Don't ship it in browser bundles.
