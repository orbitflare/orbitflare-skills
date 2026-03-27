# OrbitFlare Trading APIs

Two trading-specific surfaces, both available exclusively on **Dedicated Nodes** (`dedicated-nodes.md`):

1. **Metis Swap API** — Jupiter's low-level routing engine. Quote and build swap transactions with full control over fees, compute units, slippage, and broadcasting.
2. **Jito Bundle Simulation** — `simulateBundle` on a node running the Jito client. Test atomic bundles before paying the tip.

Source: [docs.orbitflare.com/trading-apis/metis-swap](https://docs.orbitflare.com/trading-apis/metis-swap) · [docs.orbitflare.com/trading-apis/jito-bundle-simulation](https://docs.orbitflare.com/trading-apis/jito-bundle-simulation)

---

# Metis Swap API

Jupiter's low-level routing engine, mounted on your OrbitFlare dedicated node under the `/jup` path. Use Metis when you need any of:

- CPI (Cross-Program Invocation) into your own on-chain program.
- Custom instruction composition around the swap.
- Full control over priority fees, compute units, slippage, and broadcasting strategy.
- Your own RPC or Jito broadcasting endpoint.

If you want end-to-end execution and don't need any of the above, use Jupiter Ultra (their hosted product) instead — it's simpler.

## Endpoints

On a dedicated node:

```
https://your-node.dedicated.orbitflare.com/jup/swap/v1/quote
https://your-node.dedicated.orbitflare.com/jup/swap/v1/swap
https://your-node.dedicated.orbitflare.com/jup/swap/v1/swap-instructions
```

Or directly against Jupiter's hosted API with a Jupiter API key:

```
https://api.jup.ag/swap/v1/quote
https://api.jup.ag/swap/v1/swap
```

Header: `x-api-key: YOUR_JUPITER_API_KEY` for hosted; on a dedicated node the `?api_key=YOUR_LICENSE_KEY` query param authenticates.

## Step 1 — Get a quote

`GET /swap/v1/quote`

| Param          | Required | Notes                                                                                |
| -------------- | -------- | ------------------------------------------------------------------------------------ |
| `inputMint`    | yes      | Mint address of the token you're selling                                             |
| `outputMint`   | yes      | Mint address of the token you want                                                   |
| `amount`       | yes      | Raw integer (lamports for SOL, atomic units for SPL; use `decimals`)                 |
| `slippageBps`  | yes      | Max slippage in basis points (`50` = 0.5%)                                           |
| `restrictIntermediateTokens` | no | `true` to route only via highly-liquid intermediates (more stable)              |
| `onlyDirectRoutes` | no   | `true` to disallow multi-hop                                                         |
| `maxAccounts`  | no       | Cap account count in the inner swap ix. Recommended ≥ 64                             |
| `platformFeeBps` | no     | Fee credited to your `feeAccount` in the swap request                                |

```js
const quote = await (
  await fetch(
    `${METIS}/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112` +
      `&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` +
      `&amount=100000000` +
      `&slippageBps=50` +
      `&restrictIntermediateTokens=true`,
    { headers: { "x-api-key": process.env.JUP_KEY! } }
  )
).json();
```

Response highlights:

- `outAmount` — best possible output at quote time.
- `otherAmountThreshold` — minimum you'll accept (driven by `slippageBps`).
- `routePlan[]` — DEX-by-DEX path the swap will take.
- `priceImpactPct`, `contextSlot`, `timeTaken`.

`slippageBps` does NOT change `outAmount`; it sets `otherAmountThreshold`.

## Step 2 — Build the swap transaction

`POST /swap/v1/swap` with the quote object plus your wallet:

```js
const swap = await (
  await fetch(`${METIS}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.JUP_KEY! },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toString(),
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 1_000_000,        // hard cap to prevent fee spikes from draining you
          priorityLevel: "veryHigh",
        },
      },
    }),
  })
).json();

// swap.swapTransaction         — base64 VersionedTransaction
// swap.lastValidBlockHeight    — for blockhash expiry checks
// swap.prioritizationFeeLamports
// swap.computeUnitLimit
// swap.dynamicSlippageReport
// swap.simulationError
```

### Priority fee levels

| `priorityLevel` | Percentile | When to use                                       |
| --------------- | ---------- | ------------------------------------------------- |
| `medium`        | 25th       | Calm conditions, non-urgent                       |
| `high`          | 50th       | Normal trading                                    |
| `veryHigh`      | 75th       | Competitive / MEV / time-sensitive swaps          |

**Always set `maxLamports` as a safety cap.** Without it, a fee spike can drain SOL from the signer.

```js
prioritizationFeeLamports: {
  priorityLevelWithMaxLamports: {
    maxLamports: 10_000_000,
    global: false,        // local fee market (writable accounts), not global
    priorityLevel: "veryHigh",
  },
}
```

### Need raw instructions instead?

`POST /swap/v1/swap-instructions` returns individual instruction objects so you can compose them with your own ix in a single transaction:

```js
const ix = await (await fetch(`${METIS}/swap/v1/swap-instructions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.JUP_KEY! },
  body: JSON.stringify({ quoteResponse: quote, userPublicKey: wallet.publicKey.toString() }),
})).json();

const {
  computeBudgetInstructions,
  setupInstructions,
  swapInstruction,           // the actual Jupiter swap ix
  cleanupInstruction,
  addressLookupTableAddresses,
} = ix;
```

## Step 3 — Sign and send

```ts
import { VersionedTransaction } from "@solana/web3.js";

const tx = VersionedTransaction.deserialize(Buffer.from(swap.swapTransaction, "base64"));
tx.sign([wallet]);

const signature = await connection.sendRawTransaction(tx.serialize(), {
  maxRetries: 2,
  skipPreflight: true,    // OK because we already simulated via /swap (or simulateTransaction)
});

const conf = await connection.confirmTransaction({ signature }, "finalized");
if (conf.value.err) {
  throw new Error(`tx failed: ${JSON.stringify(conf.value.err)}`);
}
```

### Broadcasting via Jito

To go through Jito's block engine, replace `prioritizationFeeLamports` with a Jito tip and submit to a Jito RPC endpoint (or your dedicated node running the Jito client):

```js
body: JSON.stringify({
  quoteResponse: quote,
  userPublicKey: wallet.publicKey.toString(),
  prioritizationFeeLamports: {
    jitoTipLamports: 1_000_000,    // fixed lamports, not a cap
  },
}),
```

Jito tips only take effect when the bundle is submitted to Jito's block engine. On a standard RPC the tip is ignored.

## Advanced

### Dynamic slippage

`dynamicSlippage: true` simulates the transaction and applies category-based heuristics. Note that Jupiter has officially deprecated dynamic slippage in favor of Ultra's RTSE; for production-grade swap routing they recommend Ultra. Metis remains the right choice when you need CPI / instruction composition.

### CPI (recommended on-chain integration path, since Jan 2025)

Add the `jupiter-cpi` crate and invoke the shared accounts route from your program:

```toml
[dependencies]
jupiter-cpi = { git = "https://github.com/jup-ag/jupiter-cpi", rev = "5eb8977" }
```

See [jupiter-cpi-swap-example](https://github.com/jup-ag/jupiter-cpi-swap-example) for a full reference.

### `maxAccounts` and DEX coverage

`maxAccounts` caps the account count in the inner swap ix. Set it too low and DEXes silently drop from routing, giving you worse prices.

| DEX                   | Max accts | Min accts |
| --------------------- | --------- | --------- |
| Meteora DLMM          | 47        | 19        |
| Meteora               | 45        | 18        |
| Raydium AMM v4        | 45        | 18        |
| Raydium CLMM          | 45        | 19        |
| Raydium CPMM          | 37        | 14        |
| Pumpfun AMM           | 42        | 17        |
| Pumpfun bonding curve | 40        | 16        |
| Moonshot              | 37        | 15        |
| Orca Whirlpool        | 30        | 12        |
| Obric                 | 30        | 12        |
| Solfi                 | 22        | 9         |
| Sanctum / Sanctum Inf | 80        | 80        |

Keep `maxAccounts` as high as the 1232-byte transaction size limit allows. Only reduce it when you need room for your own instructions.

---

# Jito Bundle Simulation

Available on dedicated nodes provisioned with the **Jito client**. Lets you simulate atomic transaction bundles before paying the tip.

## What you can do

- Simulate up to 5 transactions as an atomic bundle.
- Verify atomic execution (all-or-nothing).
- Inspect logs and consumed compute units per transaction.
- Snapshot account states before and after execution.

## Endpoint

Just your standard dedicated-node JSON-RPC URL:

```
POST https://your-node.dedicated.orbitflare.com?api_key=YOUR_LICENSE_KEY
```

## Method: `simulateBundle`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "simulateBundle",
  "params": [{
    "encodedTransactions": [
      "base64_encoded_transaction_1",
      "base64_encoded_transaction_2"
    ],
    "config": {
      "skipSigVerify": false,
      "replaceRecentBlockhash": false,
      "simulationBank": "confirmed",
      "preExecutionAccountsConfigs": [
        { "accountIndex": 0, "addresses": ["Vault111...", "Pool111..."] }
      ],
      "postExecutionAccountsConfigs": [
        { "accountIndex": 0, "addresses": ["Vault111...", "Pool111..."] }
      ]
    }
  }]
}
```

| Config field                     | Meaning                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `skipSigVerify`                  | Skip signature verification — faster, but you trust the signers      |
| `replaceRecentBlockhash`         | Replace blockhash so older transactions still simulate               |
| `simulationBank`                 | `processed` / `confirmed` / `finalized`                              |
| `preExecutionAccountsConfigs`    | Snapshot these accounts before executing tx at `accountIndex`        |
| `postExecutionAccountsConfigs`   | Snapshot these accounts after executing tx at `accountIndex`         |

### Response includes

- Overall success / failure status.
- Per-transaction results (logs, consumed compute units, return data).
- Pre and post account states (if requested).

## Bundle requirements

- **Maximum 5 transactions** per bundle.
- **Last transaction must include a Jito tip** of **at least 1,000 lamports** (typically more — current market rate often sits in the 100k–1M lamport range).
- All transactions must use a **recent blockhash**.
- Bundles are only *executed* when a Jito-Solana validator is the slot leader. Simulation works any time.

## Best practices

- Always **simulate first**, then submit. The tip is non-refundable on a failed bundle.
- Snapshot the critical state accounts (vaults, pools, user ATAs) with `preExecutionAccountsConfigs` and `postExecutionAccountsConfigs` to confirm the bundle does what you expect.
- Pin the `simulationBank` to match your downstream confirmation strategy — usually `confirmed`.
- Use bundle simulation as part of CI / pre-flight, not just at runtime.

## Resources

- [Jito Labs docs](https://docs.jito.wtf/)
- [Jito searcher examples](https://github.com/jito-labs/searcher-examples/)
- [Jito bundle explorer](https://explorer.jito.wtf/bundle/)

## Common pitfalls

- **Bundle simulation works but submission fails.** Check that you're submitting to a Jito-aware endpoint (your dedicated node with Jito client, or a Jito RPC). Standard RPC endpoints will not route to Jito's block engine.
- **`Method not found`** for `simulateBundle`. Your dedicated node is running the Solana Labs or Frankendancer client, not Jito. Reprovision with the Jito client.
- **Tip ignored.** Same root cause — must go through Jito's block engine.
- **Bundle never lands.** A Jito-Solana leader wasn't producing during your bundle's blockhash window. Resubmit with a fresh blockhash.
