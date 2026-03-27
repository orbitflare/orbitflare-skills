# OrbitFlare Dedicated Nodes

Bare-metal Solana and BNB Chain nodes reserved exclusively for one customer. Unlimited RPS/TPS, choice of validator client, and access to OrbitFlare-only features (Metis Swap, Jito Bundle Simulation, no shared connection cap).

Source: [docs.orbitflare.com/dedicated-nodes](https://docs.orbitflare.com/dedicated-nodes) · [docs.orbitflare.com/bnb-chain](https://docs.orbitflare.com/bnb-chain)

## When to use

- Sustained workloads that exceed shared plan RPS / TPS (Pro plan tops out at 600 RPS / 200 TPS).
- More than 50 concurrent gRPC + WebSocket connections from one IP (the shared cap).
- Trading workloads that need **Metis Swap** (`/jup` path) or **Jito Bundle Simulation** (`simulateBundle`) — both are dedicated-node only.
- Custom validator client (Solana Labs, Jito, or Frankendancer).
- Custom configuration: cache sizes, enabled methods, networking, peering.
- Predictable, isolated performance with no noisy neighbors.

For most apps, the shared Growth/Scale/Pro plans + Shared gRPC are enough. Move to dedicated when one of the above bullets actually bites.

## Plans

| Product               | Starting price       | Highlights                                                                                |
| --------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| Dedicated RPC Node    | $2,500/mo            | Unlimited RPS/TPS, choice of client, Metis & Jito-bundle access, 99.99% SLA                |
| Dedicated gRPC Node   | $1,800/mo            | Dedicated streaming hardware, no 50-conn cap, optimized for HFT/analytics                  |
| Dedicated BNB Node    | $1,800/mo            | Full BNB/BSC JSON-RPC + WebSocket, unlimited RPS/TPS, 11 regions                          |
| Enterprise Custom     | Contact sales        | Multiple nodes, custom SLAs, on-prem, dedicated account manager, volume discounts          |

All dedicated tiers come with priority 24/7 engineering support.

## Validator client choices (Solana RPC)

| Client             | Best for                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Solana Labs (Agave)| Default. Broadest RPC method support, most stability.                                                   |
| Jito Labs          | Trading / MEV. Native bundle support, integrated Shredstream, MEV tip distribution.                     |
| Frankendancer      | Performance-critical. Higher throughput, lower latency, optimized networking (built on Firedancer + Agave). |

Pick **Jito** if you want `simulateBundle` and bundle submission on the same node. Pick **Frankendancer** if you're CPU/throughput-bound on Agave.

## Dedicated vs. shared comparison

| Feature             | Dedicated node                       | Shared RPC                       |
| ------------------- | ------------------------------------ | -------------------------------- |
| RPS / TPS           | Unlimited                            | Plan-tiered                      |
| Hardware            | Bare-metal, isolated                 | Multi-tenant                     |
| Connection cap      | None                                 | 50 per IP (gRPC + WS)            |
| Shredstream         | Available (Jito client)              | N/A                              |
| Metis Swap (`/jup`) | Yes                                  | No                               |
| Jito `simulateBundle`| Yes                                 | No                               |
| Uptime SLA          | 99.99%                               | 99.9%                            |
| Client selection    | Labs / Jito / Frankendancer          | Labs only                        |
| Custom config       | Full                                 | None                             |
| Support             | Priority 24/7 engineering            | Standard                         |

## Deployment timeline

| Type                                 | Time                |
| ------------------------------------ | ------------------- |
| Standard dedicated node              | 24–48 hours         |
| Custom config / multi-node / enterprise | 3–5 business days |

## Connecting

You'll receive a private endpoint URL after provisioning. It looks like the shared RPC URL but resolves to your own hardware:

```
https://your-node.dedicated.orbitflare.com?api_key=YOUR_LICENSE_KEY
```

All standard JSON-RPC methods work. The same `?api_key=` license key authenticates you. The endpoint is yours alone — no shared rate limiting.

### Metis Swap on a dedicated node

Metis is mounted under the `/jup` path on your dedicated node:

```
https://your-node.dedicated.orbitflare.com/jup/swap/v1/quote?...
```

This is functionally equivalent to `https://api.jup.ag/swap/v1/...` but runs on your hardware with no rate limit. See `trading-apis.md`.

### Jito bundle simulation

If you provisioned the **Jito** client, `simulateBundle` is exposed at the standard JSON-RPC endpoint with no extra setup:

```bash
curl -X POST "https://your-node.dedicated.orbitflare.com?api_key=YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "simulateBundle",
    "params": [{
      "encodedTransactions": ["base64_tx_1", "base64_tx_2", "base64_tx_3"]
    }]
  }'
```

See `trading-apis.md` for the full bundle simulation contract (max 5 txs, last must include a Jito tip ≥ 1,000 lamports).

## Dedicated BNB Chain nodes

OrbitFlare also provisions dedicated BNB / BSC nodes (`chainId: 56` mainnet, `97` BSC testnet) for the same architecture and pricing:

```
https://bnb-{region}.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
wss://bnb-{region}.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
```

Same `?api_key=` auth as Solana. Same 11 regions. Full BSC JSON-RPC API and `eth_subscribe` WebSockets:

| Category    | Methods                                                                              |
| ----------- | ------------------------------------------------------------------------------------ |
| Blocks      | `eth_blockNumber`, `eth_getBlockByHash`, `eth_getBlockByNumber`                      |
| Tx          | `eth_sendRawTransaction`, `eth_getTransactionByHash`, `eth_getTransactionReceipt`    |
| Accounts    | `eth_getBalance`, `eth_getCode`, `eth_getStorageAt`, `eth_getTransactionCount`       |
| Contracts   | `eth_call`, `eth_estimateGas`, `eth_getLogs`                                         |
| Network     | `net_version`, `eth_chainId`, `eth_gasPrice`, `eth_feeHistory`                       |
| WebSocket   | `eth_subscribe` for `newHeads`, `logs`, `newPendingTransactions`                     |

```js
const res = await fetch(
  "https://bnb-fra.rpc.orbitflare.com?api_key=" + process.env.ORBITFLARE_LICENSE_KEY,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    }),
  }
);
const data = await res.json();
console.log("BNB latest block:", parseInt(data.result, 16));
```

Use BNB dedicated nodes for: DeFi protocols (AMMs, lending), arbitrage / MEV bots, DEX aggregators, NFT marketplaces handling minting events, bridge protocols.

## When to upgrade from shared to dedicated

Trigger upgrade when **any** of these happens:

| Symptom                                                              | Move to                                  |
| -------------------------------------------------------------------- | ---------------------------------------- |
| Sustained `429` on Pro plan (600 RPS)                                | Dedicated RPC                            |
| `RESOURCE_EXHAUSTED` from gRPC, can't fit under 50 conn cap          | Dedicated gRPC                           |
| Need Metis Swap                                                      | Dedicated RPC (Solana Labs or Jito)      |
| Need `simulateBundle` / Jito bundle submission from your own node    | Dedicated RPC with Jito client           |
| Need a non-default validator client (Frankendancer / Jito)           | Dedicated RPC                            |
| Latency-sensitive trading + multi-region presence                    | Dedicated RPC + Shredstream              |
| Building on BNB Chain                                                | Dedicated BNB Node                       |

Contact sales via [discord.gg/orbitflare](https://discord.gg/orbitflare) to spec a node and get a quote.
