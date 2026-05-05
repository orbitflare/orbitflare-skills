# OrbitFlare Onboarding

How to go from zero to authenticated and building on OrbitFlare. Covers signup, plan selection, the two distinct keys, USDC top-ups, and key resolution order.

Source: [docs.orbitflare.com/quickstart](https://docs.orbitflare.com/quickstart) · [docs.orbitflare.com/products](https://docs.orbitflare.com/products) · [docs.orbitflare.com/authentication](https://docs.orbitflare.com/authentication)

## 1. Sign up

[orbitflare.com](https://orbitflare.com) → create an account. Free tier is real and unlimited in time — 10 RPS / 1 TPS, no credit card required, full access to 11 regions, all WebSockets, and the historical archive. Use it to prototype before committing to a paid plan.

You can sign up with email or by linking a Solana wallet (which lets you authenticate to the Customer API by signing a challenge later).

## 2. Pick the right plan

| Plan       | RPS   | TPS   | gRPC                     | Monthly | Best for                                         |
| ---------- | ----- | ----- | ------------------------ | ------- | ------------------------------------------------ |
| Free       | 10    | 1     | Devnet only              | $0      | Prototyping                                      |
| Developer  | 50    | 10    | Devnet only              | $99     | Side projects, low-volume tools                  |
| Growth     | 200   | 75    | Add-on (+$500)           | $399    | Growing apps                                     |
| Scale ⭐   | 400   | 150   | Add-on (+$500)           | $799    | Production apps with traffic                     |
| Pro        | 600   | 200   | Included                 | $999    | High-throughput services + streaming             |
| Dedicated  | ∞     | ∞     | Included (no shared cap) | from $2,500 | HFT, custody, anything that scales beyond Pro |

All plans include: 11 regions, WebSockets, devnet, full historical archive, Shredstream-optimized routing, 99.99% SLA. There are **no monthly credit caps** — only per-second RPS / TPS.

Quarterly billing saves 5%, semi-annual 10%, annual 15%.

Add-ons:

- **Shared gRPC** — $500/mo, includes Jetstream + Yellowstone, 1 IP. Required if your plan doesn't include gRPC.
- **Shredstream** — $500/mo (standard regions) or $1,000/mo (premium regions). Per region.
- **OrbitFlare Pass** — limited NFT pass with VIP support, gRPC included, free Shredstream slot. Only 95 ever minted; resold on Magic Eden / Tensor.

## 3. Get your keys

OrbitFlare has **two different keys**. Don't mix them up.

| Key                  | Format                            | Used for                                                       | Auth method                       |
| -------------------- | --------------------------------- | -------------------------------------------------------------- | --------------------------------- |
| **RPC license key**  | `ORBIT-XXXXXX-NNNNNN-NNNNNN`      | HTTP RPC, WebSockets, gRPC, Jetstream, Shredstream, BNB        | `?api_key=...` query parameter    |
| **Customer API key** | (opaque string)                   | `https://api.orbitflare.com/customer/v2/...`                   | `X-ORBIT-KEY: ...` HTTP header    |

Both live in the [dashboard](https://orbitflare.com/dashboard):

- License key → "Licenses" tab. Each license has its own key, IP whitelist, plan, and renewal settings.
- Customer API key → "API Keys" tab. The full key is shown **once**, on create or regenerate. Store it securely.

For production, **enable IP whitelisting on both** so a leaked key alone is useless from elsewhere.

## 4. Make your first call

```bash
curl -X POST "http://fra.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getBlockHeight"}'
```

Or in JavaScript:

```js
const res = await fetch(`http://fra.rpc.orbitflare.com?api_key=${process.env.ORBITFLARE_LICENSE_KEY}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBlockHeight" }),
});
console.log(await res.json());
```

Or in Rust with the SDK:

```rust
use orbitflare_sdk::{RpcClientBuilder, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = RpcClientBuilder::new()
        .url("http://fra.rpc.orbitflare.com")
        .build()?;
    println!("slot: {}", client.get_slot().await?);
    Ok(())
}
```

Or with the CLI:

```bash
cargo install orbitflare
orbitflare auth login --x-orbit-key YOUR_API_KEY
orbitflare config set rpc.url http://fra.rpc.orbitflare.com
orbitflare ping
orbitflare rpc slot
```

## 5. Set environment variables

Both the SDK and the CLI read these as defaults:

```bash
export ORBITFLARE_LICENSE_KEY=ORBIT-XXXXXX-NNNNNN-NNNNNN
export ORBITFLARE_RPC_URL=http://fra.rpc.orbitflare.com
export ORBITFLARE_WS_URL=ws://fra.rpc.orbitflare.com
export ORBITFLARE_GRPC_URL=http://fra.rpc.orbitflare.com:10000
export ORBITFLARE_JETSTREAM_URL=http://fra.jetstream.orbitflare.com
```

Once these are set, you don't need to pass URLs or keys to `RpcClientBuilder::new().build()?` or to `orbitflare` commands — they pick them up automatically.

## Funding your account

Most plans, top-ups, and renewals can be paid from your account **balance**. The balance is denominated in USD-equivalent and you fund it with USDC on Solana (the cleanest path), Stripe (credit card), or, for enterprise, invoiced.

### Top up with USDC (recommended for crypto-native users)

Two-step on-chain flow handled by the Customer API. The server builds the unsigned transaction (with a verifiable memo + recent blockhash), you sign locally, the server broadcasts and credits.

```
POST /customer/v2/topup/prepare    →  { transaction (b64), memo, blockhash, ... }
                                       │
                                       ▼ sign locally
POST /customer/v2/topup/confirm    →  broadcasts + verifies on-chain + credits
```

Range: **5 USDC minimum, 10,000 USDC maximum** per top-up.

The CLI wraps this for you:

```bash
orbitflare pay topup 100 --wallet ~/.config/solana/id.json
orbitflare pay history
```

See `customer-api.md` for the raw flow.

### Buy a plan from balance

```bash
# Validate first (dry-run pricing + balance check)
orbitflare pay purchase growth monthly --coupon WELCOME --dry-run

# Purchase (atomic: deducts balance, creates order + invoice + payment + license)
orbitflare pay purchase growth monthly
```

Or via REST:

```
POST /customer/v2/orders/validate   →  pricing breakdown
POST /customer/v2/orders            →  create order
```

### Renewals & invoices

```bash
orbitflare pay invoice --list
orbitflare pay invoice INV_REF
orbitflare pay renew INV_REF        # pay invoice from balance
```

Auto-renewal is on by default; toggle per-license from the dashboard or the Customer API.

## Key resolution order (CLI)

When you run a CLI command, the active license/API key comes from (highest priority first):

1. `--x-orbit-key` flag passed on the command line.
2. `--profile <name>` flag selecting a stored profile.
3. The default profile in `~/.orbitflare/config.yml`.

For the SDK, builder methods (`.api_key(...)`) override env vars (`ORBITFLARE_LICENSE_KEY`).

## Where things live on disk (CLI)

```
~/.orbitflare/
├── config.yml                  # endpoints, default commitment, network, theme
├── templates_cache.json        # template registry cache
└── cache/
    └── rpc-plans.json          # plans cache (6-hour TTL)
```

API keys, license keys, and Bearer tokens are stored in the **OS keychain** (Keychain on macOS, Secret Service on Linux, Credential Manager on Windows). They are never written to disk in plaintext.

## Devnet

```
https://devnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
wss://devnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
http://devnet.rpc.orbitflare.com:10000          # gRPC
```

The CLI auto-knows these. Use `--network devnet` or `orbitflare config set network devnet` to switch.

## Common starter prompts to try

After installing the skill, ask the agent:

- "Build a real-time wallet tracker on OrbitFlare Jetstream that prints SOL/SPL transfers."
- "Quote 1 SOL → USDC with Metis on a dedicated OrbitFlare node and submit the swap with a maxLamports priority fee."
- "Page through every transaction for `<wallet>` since Jan 1 using `getTransactionsForAddress`, including SPL transfers."
- "Set up a Yellowstone subscription for Raydium swaps with `vote: false`, `failed: false`, ping every 30s, exponential backoff reconnect."
- "Top up my OrbitFlare balance by 50 USDC from this Solana keypair."

## Help

- Docs: [docs.orbitflare.com](https://docs.orbitflare.com) — full index at [llms.txt](https://docs.orbitflare.com/llms.txt).
- Discord: [discord.gg/orbitflare](https://discord.gg/orbitflare) — fastest support.
- GitHub: [github.com/orbitflare](https://github.com/orbitflare) — SDK, CLI, examples.
- Status: [status.orbitflare.com](https://status.orbitflare.com).
- Sales: [sales@orbitflare.com](mailto:sales@orbitflare.com) for dedicated nodes, managed backfills, enterprise.
