# OrbitFlare Apex

Solana transaction landing. You send one signed transaction that carries a tip, and the Apex endpoint races it to the current and upcoming leaders over three paths at once: **stake-weighted validator clients (SWQoS)**, **Jito bundles**, and **direct TPU** over QUIC. The first path to land wins; the others are deduplicated by signature. Apex keeps retrying until the transaction lands or its blockhash expires.

Apex is send-only and mainnet-only. Keep using your regular RPC (`rpc.md`) for blockhashes, account reads, simulation, and confirmation.

Source: [docs.orbitflare.com/apex/overview](https://docs.orbitflare.com/apex/overview) · [quickstart](https://docs.orbitflare.com/apex/quickstart) · [tips](https://docs.orbitflare.com/apex/tips) · [sending transactions](https://docs.orbitflare.com/apex/sending-transactions) · [errors and rate limits](https://docs.orbitflare.com/apex/errors-and-rate-limits) · Clients: [Rust](https://docs.orbitflare.com/apex/rust-client) · [Go](https://docs.orbitflare.com/apex/go-client)

## When to use

- Trading bots, snipers, liquidators, and anything where landing fast and reliably matters.
- Replacing a plain `sendTransaction` call: it's a URL swap, an API key, and a tip instruction.
- Atomic groups of 1 to 4 transactions (bundles) without talking to Jito directly.

For reads, simulation, or anything other than sending, use the RPC. For simulating Jito bundles before you send, see `trading-apis.md`.

## Cost

You pay the tip inside each transaction, and **only when it lands**. A rejected, expired, or dropped transaction costs nothing. There is no per-send subscription fee. A transaction that lands but fails on chain rolls back the tip too; you pay only the network fee.

One Apex tip covers all three paths. When the Jito path wins, the tip minus the 5,000 lamport base fee is bid to Jito in the same bundle. **Do not add a separate Jito tip.**

## Endpoints

Every endpoint serves both transports on one hostname:

| Transport | Address                              | Protocol    |
| --------- | ------------------------------------ | ----------- |
| HTTP      | `http://<code>.apex.orbitflare.com`  | TCP port 80 |
| QUIC      | `<code>.apex.orbitflare.com:7001`    | UDP 7001    |

| Region          | Code     |
| --------------- | -------- |
| Global (nearest)| `global` |
| Frankfurt       | `fra`    |
| Amsterdam       | `ams`    |
| Dublin          | `dub`    |
| London          | `lon`    |
| New York        | `nyc`    |
| Salt Lake City  | `slc`    |
| Singapore       | `sgp`    |
| Tokyo           | `tyo`    |
| Siauliai        | `sqq`    |

**Apex region codes differ from RPC and Jetstream** (`nyc` not `ny`, `tyo` not `jp`, `sgp` not `sg`; Apex also has `dub` and `sqq`, and no Ashburn or LA). `global` resolves at DNS time to the nearest healthy endpoint; use a named region when you need a fixed host. Pick the endpoint with the lowest round trip from your sender, measured with `GET /ping` (no key, returns `pong`). The choice only affects your own hop; every endpoint routes toward the upcoming leaders.

Outbound firewall: TCP 80 (HTTP), UDP 7001 (QUIC).

## Authentication

Apex uses its **own API key**, created in the [dashboard](https://orbitflare.com/dashboard) under **Dashboard > Apex**. It is not the RPC license key or the Customer API key. Each key has a tier that sets its tip floor and rate limit.

| Transport | How the key is passed                                                       |
| --------- | --------------------------------------------------------------------------- |
| HTTP      | `x-api-key: KEY` header (recommended), or `?api-key=KEY` query param        |
| QUIC      | Client TLS certificate derived from the key; the key never crosses the wire |

Note the spellings: header `x-api-key`, query `api-key` (hyphen, unlike RPC's `api_key`).

`getTipAccounts`, `getVersion`, `health`, and `GET /ping` need no key. Everything that submits does. The HTTP routes are plain HTTP (unencrypted); prefer QUIC or send from a trusted network. CORS is open, but don't ship a key in a public frontend.

QUIC certificate derivation for other languages: `seed = HKDF-SHA256(ikm = api_key, salt = "orbitflare-apex", info = "orbitflare-apex/quic-client-cert/v1", L = 32)`, ed25519 keypair from the seed, wrapped in Solana's dummy X.509 cert. Test vector: `test-api-key` → `2ovF9aU8fszHXpZwxaC1S9NF2m5VVDRBUvDUVQvXs4Tv`. The dashboard shows the derived public key next to each key.

## The tip rule

Every transaction must contain **exactly one** tip that is:

1. A plain `SystemProgram::Transfer` to a published Apex tip account.
2. A **top-level** instruction (a CPI transfer does not count).
3. Funded by an account that **signs** the transaction (not necessarily the fee payer).
4. To a tip account in the **static account keys**, not loaded through an address lookup table.
5. At or above your tier's floor: **0.001 SOL (1,000,000 lamports)** on the standard tier.

Missing, duplicate, or below-floor tips are rejected before anything is sent. Get the accounts with JSON-RPC `getTipAccounts` (no key), cache them at startup, and **pick one at random per transaction** to avoid write-lock contention. Every address starts with `APeX` (vaults of tip program `9ig7pd4gqe2m16ACGPbPo4HfMGD3ba38poDhXEayx7EF`); `getTipAccounts` is the authoritative list.

The tip is not a priority fee. The leader still orders by priority fee, so set `setComputeUnitLimit` (simulated units + 10–20%) and `setComputeUnitPrice` on every legacy/v0 transaction, ComputeBudget instructions first.

## Transports

| Transport                 | Body                              | Reply                              | Best for                     |
| ------------------------- | --------------------------------- | ---------------------------------- | ---------------------------- |
| JSON-RPC `sendTransaction`| base64/base58 in JSON             | signature or JSON-RPC error        | Drop-in for existing code    |
| `POST /send`              | `{"transaction":"<base64>","mevProtect"?,"maxRetries"?}` | `{"signature"}` | Simple JSON clients |
| `POST /send-bin`          | Raw bytes, `application/octet-stream` | `{"signature"}`                | Lowest HTTP overhead         |
| `POST /send-batch`        | Up to 16 frames (u16 BE length + bytes) | `attempted`, `accepted`, `rejected`, `results` | Many independent sends |
| `POST /send-bundle`       | 1–4 frames, same framing          | `{"bundle_id","signatures"}`       | Atomic bundles               |
| QUIC unidirectional       | One packet per stream             | Nothing                            | Fastest path, production     |
| QUIC bidirectional        | One packet per stream             | Admission code                     | Integration, debugging       |

JSON-RPC `sendTransaction` params: `[tx, { encoding: "base64", maxRetries? }, mevProtect]`. Also `sendBundle` and `getInflightBundleStatuses`.

- **No preflight.** Apex doesn't simulate; `skipPreflight` and `preflightCommitment` are ignored. Call `simulateTransaction` on your RPC first if you want it.
- **Sizes:** legacy and v0 up to 1232 bytes; transaction v1 (SIMD-0385) up to 4096 bytes on every route. Serialize v1 with the canonical encoder (`orbitflare_apex::serialize_transaction`, `apex.SerializeTransaction`), not bincode. v1 sets its compute budget in `TransactionConfig`, and every unset limit is 0, so set CU limit, loaded accounts data size, and priority fee.
- **Batches are not atomic**: each frame is admitted on its own. Use a bundle for all-or-nothing.
- **Accepted is not landed.** Confirm with `getSignatureStatuses` on any Solana RPC and check `err`.

## TypeScript (@orbitflare/sdk)

`ApexClient` in `@orbitflare/sdk` covers the HTTP routes (JSON-RPC, `/send-bin`, batches, bundles, `getTipAccounts`). It takes signed wire bytes from any Solana library. The builder reads `ORBITFLARE_APEX_API_KEY`, and `ORBITFLARE_APEX_URL` or `ORBITFLARE_APEX_REGION` (default `fra`).

```bash
npm install @orbitflare/sdk @solana/web3.js
```

```ts
import { ComputeBudgetProgram, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { APEX_MIN_TIP_LAMPORTS, ApexClientBuilder, RpcClientBuilder, pickApexTipAccount, waitForConfirmation } from '@orbitflare/sdk';

const apex = new ApexClientBuilder()
  .region('fra')
  .fallbackRegion('ams')
  .apiKey(process.env.ORBITFLARE_APEX_API_KEY!)
  .build();
const solana = new RpcClientBuilder().url('http://fra.rpc.orbitflare.com').build();

const tipAccount = new PublicKey(pickApexTipAccount(await apex.getTipAccounts()));
const { blockhash } = await solana.getLatestBlockhash();

const message = new TransactionMessage({
  payerKey: payer.publicKey,
  recentBlockhash: blockhash,
  instructions: [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
    ...yourInstructions,
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: tipAccount, lamports: APEX_MIN_TIP_LAMPORTS }),
  ],
}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([payer]);

const signature = await apex.sendTransactionBinary(tx.serialize());
const slot = await waitForConfirmation(solana, signature); // null if not confirmed in time
```

Other methods: `sendTransaction(tx, opts?)` (JSON-RPC), `sendBatch(txs, opts?)`, `sendBundle(txs)` → `{ bundleId, signatures }`, `getBundleStatuses(ids)`, `ping()`. `opts` takes `mevProtect` and `maxRetries`; both can also be set on the builder. `apexClientPubkey(apiKey)` returns the derived key shown on the dashboard.

Without the SDK, `fetch` works the same: `POST http://fra.apex.orbitflare.com` with `x-api-key` and a standard `sendTransaction` body.

## Rust (orbitflare-apex)

The reference client: one persistent QUIC connection per endpoint, certificate auth, 1 s keep-alive, 0-RTT reconnects. The `rpc` feature adds the HTTP helpers and a blockhash/confirm helper for any Solana RPC. Solana types are re-exported through `orbitflare_apex::prelude`, so you don't add `solana-*` crates yourself. Requires Rust 1.92+.

```toml
[dependencies]
orbitflare-apex = { version = "0.1", features = ["rpc"] }
tokio = { version = "1", features = ["full"] }
```

```rust
use std::time::Duration;

use orbitflare_apex::prelude::*;
use orbitflare_apex::rpc::{RpcClient, SolanaRpc};
use orbitflare_apex::tip;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_key = std::env::var("APEX_API_KEY")?;
    let payer = read_keypair_file("payer.json")?;
    let region = Region::Frankfurt;

    // Create once per process and endpoint; clones share the connection.
    let client = ApexSenderClient::connect(region, &api_key).await?;
    let tip_accounts = RpcClient::new(region, &api_key).get_tip_accounts().await?;
    let tip_account = tip::pick_tip_account(&tip_accounts).ok_or("no tip accounts")?;

    let solana = SolanaRpc::new(std::env::var("SOLANA_RPC_URL")?);
    let instructions = [
        ComputeBudgetInstruction::set_compute_unit_limit(50_000),
        ComputeBudgetInstruction::set_compute_unit_price(10_000),
        your_instruction,
        tip_instruction(&payer.pubkey(), &tip_account, MIN_TIP_LAMPORTS),
    ];
    let tx = VersionedTransaction::from(Transaction::new_signed_with_payer(
        &instructions,
        Some(&payer.pubkey()),
        &[&payer],
        solana.latest_blockhash().await?,
    ));

    let signature = client.send_transaction(&tx).await?; // unidirectional, no acknowledgement
    let slot = solana.confirm(&signature.to_string(), Duration::from_secs(30)).await?;
    println!("{signature} landed in {slot:?}");
    Ok(())
}
```

- `send_transaction_with_response(&tx)` uses a bidirectional stream and returns `Err(Error::Rejected { code, message })` on rejection. Use it while integrating.
- `send_transaction_bytes(bytes)` sends bytes you already serialized against your own Solana crates.
- `ApexSenderClient::connect_with_options(ClientOptions { endpoint, mev_protect, max_retries, bind_addr, .. }, &api_key)` for options. MEV protection is per connection over QUIC: hold two clients if you need both.
- HTTP: `RpcClient::send_transaction`, `send_transaction_binary`, `send_batch`.
- `orbitflare_apex::client_pubkey(&api_key)` prints the derived certificate key.

## Go (orbitflare-apex-go)

Same transport as the Rust client. Requires Go 1.26+.

```bash
go get github.com/orbitflare/orbitflare-apex-go@latest github.com/gagliardetto/solana-go@v1.24.0
```

```go
client, err := apex.Connect(ctx, apex.Frankfurt, apiKey)
if err != nil {
	log.Fatal(err)
}
defer client.Close()

tipAccounts, err := rpc.New(apex.Frankfurt, apiKey).GetTipAccounts(ctx)
if err != nil {
	log.Fatal(err)
}
tipAccount, _ := apex.PickTipAccount(tipAccounts)

solanaRPC := rpc.NewSolanaRPC(os.Getenv("SOLANA_RPC_URL"))
blockhash, err := solanaRPC.LatestBlockhash(ctx)
if err != nil {
	log.Fatal(err)
}

tx, err := solana.NewTransaction([]solana.Instruction{
	computebudget.NewSetComputeUnitLimitInstruction(50_000).Build(),
	computebudget.NewSetComputeUnitPriceInstruction(10_000).Build(),
	yourInstruction,
	apex.TipInstruction(payer.PublicKey(), tipAccount, apex.MinTipLamports),
}, blockhash, solana.TransactionPayer(payer.PublicKey()))
if err != nil {
	log.Fatal(err)
}
if _, err := tx.Sign(func(solana.PublicKey) *solana.PrivateKey { return &payer }); err != nil {
	log.Fatal(err)
}

signature, err := client.SendTransaction(ctx, tx)
if err != nil {
	log.Fatal(err)
}
slot, landed, err := solanaRPC.Confirm(ctx, signature.String(), 30*time.Second)
```

Imports: `apex "github.com/orbitflare/orbitflare-apex-go"`, `"github.com/orbitflare/orbitflare-apex-go/rpc"`, `"github.com/gagliardetto/solana-go"`, `computebudget "github.com/gagliardetto/solana-go/programs/compute-budget"`. `SendTransactionWithResponse` returns `*apex.RejectedError` on rejection; `apex.ConnectWithOptions(ctx, apex.Options{MEVProtect: true, ...}, apiKey)` for options.

## Bundles

1 to 4 transactions, executed **in order** and **all or nothing**.

- **Exactly one** transaction in the bundle carries the Apex tip; the tip minus 5,000 lamports is the Jito bid for the whole bundle.
- Bundles go through the Jito block engine only, so they **only land on Jito-enabled leaders**. For a single transaction, a normal send (all three paths) lands sooner.
- Rate: **2 bundles/s per key** (burst 4), on top of the transaction limit.
- Send with JSON-RPC `sendBundle` (`[[tx1, tx2], { encoding: "base64" }]`, returns a bundle id) or `POST /send-bundle`.
- Track with `getInflightBundleStatuses` (up to 100 ids, same key and same endpoint that sent it): `Pending`, `Landed` (with `landed_slot`), `Failed`, `Invalid` (unknown or older than five minutes).

## MEV protection

`mevProtect: true` skips leaders on the Yellowstone Shield blocklist. It can delay landing by a blocklisted leader's slots (4 slots, about 1.6 s), so use it for swaps and price-sensitive trades, not transfers or liquidations.

| Transport                       | Setting                         |
| ------------------------------- | ------------------------------- |
| JSON-RPC `sendTransaction`      | Third param `true`              |
| `POST /send`                    | `"mevProtect": true`            |
| `/send-bin`, `/send-batch`      | `?mev_protect=1`                |
| QUIC (Rust / Go)                | `ClientOptions::mev_protect` / `apex.Options{MEVProtect: true}` |

## Errors and rate limits

Rate limits are per API key, counted in transactions per second across every transport (each batch frame counts): **standard tier 5 tx/s** (no burst), **pro tier 50 tx/s** (+10 burst). Over it: `-32029`, HTTP `429`, or admission code `2`; the transaction is not queued.

| JSON-RPC | HTTP  | Meaning                                    | Retry?                           |
| -------- | ----- | ------------------------------------------ | -------------------------------- |
| `-32001` | `401` | Missing or invalid API key                 | No, fix the key                  |
| `-32029` | `429` | Rate limited                               | Yes, after a short backoff       |
| `-32602` | `400` | Invalid transaction or tip (message says what; states your floor) | No, rebuild |
| `-32603` | `503` | Busy, endpoint shedding load               | Yes, shortly or on another endpoint |

HTTP `400` labels include `no_tip`, `below_floor`, `multiple_tips`, `tip_not_static`, `tip_source_not_signer`, `too_large`, `malformed`, `bundle`, `nonce_used`. QUIC admission codes: `0` ok, `1` unauthorized, `2` rate limited, `3` invalid, `4` no tip, `5` below floor, `6` busy, `7` malformed packet. QUIC handshake close codes: `1` no cert, `2` unknown key, `3` too many connections (128 per key, 64 per address; one is enough).

A network error before any reply is safe to retry with the same bytes: the endpoint deduplicates by signature.

## Best practices

- Create **one client per process and endpoint** at startup and keep it warm (QUIC clients ping every second against a 30 s idle timeout; on HTTP reuse a keep-alive connection and call `GET /ping` every few seconds).
- Fetch the blockhash at `confirmed` right before signing.
- **Don't resend an accepted transaction**; Apex already retries. When the blockhash expires, rebuild with a fresh one and re-sign.
- Size the tip to the trade. The floor is the minimum to be accepted; a floor-level Jito bid may lose a contested auction. You only pay on landing.
- Integrate with feedback (JSON-RPC, HTTP, or bidirectional QUIC), then move hot paths to unidirectional QUIC.
- Make every transaction unique (memo or a 1 micro-lamport price change) if you send the same action twice; identical signatures dedupe to one.
- Sending the same signed transaction to several Apex endpoints or other senders is safe; each copy counts against your rate limit. With a durable nonce, send **one** signed transaction everywhere rather than separately signed copies.

## Common pitfalls

- **Using the RPC license key.** Apex has its own key from Dashboard > Apex, sent as `x-api-key` or `?api-key=`.
- **Reusing RPC region codes.** `ny`, `jp`, `sg`, `va`, `la` don't exist on Apex; use `nyc`, `tyo`, `sgp`.
- **Tip through a lookup table, via CPI, or from a non-signer.** Rejected as `tip_not_static`, `no_tip`, or `tip_source_not_signer`.
- **Two tips**, or a tip in every bundle member. Exactly one per transaction or bundle.
- **Adding a Jito tip as well.** Unnecessary; the Apex tip funds the Jito bid.
- **Treating the returned signature as landed.** Always confirm and check `err`.
- **Calling reads on Apex.** It accepts sends only (plus `getTipAccounts`, `getInflightBundleStatuses`, `getVersion`, `health`).
- **Serializing v1 with bincode.** Wrong bytes; rejected as malformed.
- **Devnet.** Apex serves mainnet only.
