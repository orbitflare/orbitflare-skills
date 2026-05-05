# OrbitFlare WebSockets

Persistent `wss://` subscriptions for the standard Solana real-time methods (slot, account, logs, signature, program, block, root, vote).

Source: [docs.orbitflare.com/rpc/websocket](https://docs.orbitflare.com/rpc/websocket) · [docs.orbitflare.com/authentication](https://docs.orbitflare.com/authentication)

## When to use

- A single client UI that needs live slot ticks, an account watcher, or "wait for my signature to confirm" — pick WebSockets.
- A backend that wants live transaction streams from many programs, with filters that change at runtime — pick **Yellowstone gRPC** (`yellowstone.md`) instead. WebSockets cannot stream transactions directly; the closest option is `logsSubscribe`.
- A latency-sensitive trading bot that needs every relevant transaction the moment it lands — pick **Jetstream** (`jetstream.md`) instead.

WebSocket subscriptions are perfect for low-volume, single-connection tooling. They are *not* a good fit for high-fanout indexing or trading.

## Endpoints

```
ws://fra.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
ws://{region}.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
wss://devnet.rpc.orbitflare.com?api_key=YOUR_LICENSE_KEY
```

Same region codes as HTTP RPC (`ash`, `ny`, `la`, `slc`, `ams`, `fra`, `lon`, `dub`, `siau`, `tok`, `sgp`). Same `?api_key=` license key. See `rpc.md` for the full table.

## Connection limits

- **50 concurrent WebSocket connections per IP**, shared with the gRPC pool. Hitting the cap rejects the new connection with WebSocket close code `1008 Policy Violation` and message `connection limit exceeded`.
- **60-second idle timeout.** A connection with no traffic in either direction is closed by the server. Send a ping (or any RPC envelope) every ~30 seconds to keep it open.

If you need more than 50 concurrent connections from a single IP, you need a Dedicated gRPC Node — see `dedicated-nodes.md`.

## Subscription methods

| Method               | Notifies on                                                                       |
| -------------------- | --------------------------------------------------------------------------------- |
| `accountSubscribe`   | Account lamports / data / owner change                                            |
| `logsSubscribe`      | Transaction log messages, optionally filtered by `mentions: [pubkey]`             |
| `slotSubscribe`      | Each slot processed by the node                                                   |
| `signatureSubscribe` | Transaction reaches the requested commitment (one-shot, auto-unsubscribes)        |
| `programSubscribe`   | Any account owned by the given program changes                                    |
| `blockSubscribe`     | Full block data (add-on; contact support)                                         |
| `rootSubscribe`      | Highest confirmed root advances                                                   |
| `voteSubscribe`      | Raw vote transactions from gossip — high volume, filter aggressively              |

Each has a corresponding `*Unsubscribe` method that takes the subscription ID returned at subscribe time.

## Connecting

```js
const WebSocket = require("ws");

const ws = new WebSocket(
  "ws://fra.rpc.orbitflare.com?api_key=" + process.env.ORBITFLARE_LICENSE_KEY
);

ws.on("open", () => console.log("connected"));
ws.on("message", (data) => console.log("msg:", JSON.parse(data)));
ws.on("error", (err) => console.error(err));
ws.on("close", (code, reason) => console.log("closed", code, reason.toString()));
```

## Subscribing

### Slot subscription

```js
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "slotSubscribe",
  params: [],
}));
// Notification:
// { jsonrpc: "2.0", method: "slotNotification",
//   params: { result: { slot, parent, root }, subscription: <id> } }
```

### Account subscription

```js
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 2,
  method: "accountSubscribe",
  params: [
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",      // USDC mint
    { encoding: "jsonParsed", commitment: "confirmed" }
  ],
}));
```

### Logs subscription, filtered to a program

```js
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 3,
  method: "logsSubscribe",
  params: [
    { mentions: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"] },  // Raydium AMM v4
    { commitment: "confirmed" }
  ],
}));
```

### Wait-for-signature

```js
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 4,
  method: "signatureSubscribe",
  params: ["5K8F2j...", { commitment: "finalized" }],
}));
// One notification, then the subscription auto-closes.
```

### Program subscription with filters

```js
ws.send(JSON.stringify({
  jsonrpc: "2.0",
  id: 5,
  method: "programSubscribe",
  params: [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",       // SPL Token program
    {
      encoding: "jsonParsed",
      commitment: "confirmed",
      filters: [{ dataSize: 165 }],                       // Standard token account size
    },
  ],
}));
```

## Unsubscribing

The first message back from a subscribe call has the subscription ID in `result`. Hold onto it and pass it to the matching unsubscribe method:

```js
ws.on("message", (raw) => {
  const msg = JSON.parse(raw);
  if (msg.id === 2 && typeof msg.result === "number") {
    const subId = msg.result;

    setTimeout(() => {
      ws.send(JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "accountUnsubscribe",
        params: [subId],
      }));
    }, 10_000);
  }
});
```

Available unsubscribe methods: `accountUnsubscribe`, `logsUnsubscribe`, `slotUnsubscribe`, `signatureUnsubscribe`, `programUnsubscribe`, `blockUnsubscribe`, `rootUnsubscribe`, `voteUnsubscribe`.

## Keepalive

The 60-second idle timeout is real. Send a JSON-RPC ping every 30 seconds:

```js
const pingInterval = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "ping" }));
  }
}, 30_000);

ws.on("close", () => clearInterval(pingInterval));
```

## Reconnection

For anything beyond a quick script, wrap the connection in an exponential-backoff loop and re-subscribe on every reconnect:

```js
function connect(url, subscribeAll) {
  let ws;
  let delay = 1000;

  function open() {
    ws = new WebSocket(url);

    ws.on("open", () => {
      console.log("connected");
      delay = 1000;
      subscribeAll(ws);
    });

    ws.on("message", (raw) => {
      // ... route message to the right subscription ...
    });

    ws.on("close", () => {
      const wait = delay;
      delay = Math.min(delay * 2, 30_000);
      setTimeout(open, wait);
    });

    ws.on("error", (err) => console.error(err));
  }

  open();
  return () => ws?.close();
}

const stop = connect(
  "ws://fra.rpc.orbitflare.com?api_key=" + process.env.ORBITFLARE_LICENSE_KEY,
  (ws) => {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "slotSubscribe", params: [] }));
  }
);
```

## Rust (orbitflare-sdk)

The Rust SDK handles connection lifecycle, ping/pong, reconnection, and re-subscription automatically:

```rust
use orbitflare_sdk::{WsClientBuilder, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = WsClientBuilder::new()
        .url("ws://fra.rpc.orbitflare.com")
        .fallback_url("ws://ams.rpc.orbitflare.com")
        .build()
        .await?;

    let mut slots = client.slot_subscribe().await?;
    let mut usdc = client.account_subscribe(
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "confirmed",
    ).await?;

    loop {
        tokio::select! {
            Some(s) = slots.next() => println!("slot {}", s["slot"]),
            Some(a) = usdc.next()  => println!("usdc updated: {} lamports", a["lamports"]),
        }
    }
}
```

All subscriptions on a single client share one underlying WebSocket. Add the `ws` feature: `cargo add orbitflare-sdk --features ws`. See `cli-sdk.md`.

## When NOT to use WebSockets

- **Streaming transactions, not just logs.** `logsSubscribe` gives you logs and the signature, not the full transaction. Use Yellowstone (`transactions: {...}` filter) for that.
- **High-fanout indexing.** A single WebSocket can technically carry many subscriptions but the per-IP cap of 50 connections plus 60s idle timeout makes Yellowstone gRPC a much better fit.
- **Sub-millisecond trading signals.** WebSockets sit downstream of block confirmation. For lowest latency, use Jetstream gRPC or Shredstream.

## Common pitfalls

- Connection closes after exactly 60 seconds → you forgot keepalive. Send a `ping` every 30s.
- Close code `1008` → you've hit the per-IP 50-connection cap. Close idle connections or move to a Dedicated gRPC Node.
- Stale subscription after reconnect → re-subscribe in the `open` handler, every time.
- Subscribed to `voteSubscribe` and got firehosed → vote transactions are very high volume. Filter or just don't.
