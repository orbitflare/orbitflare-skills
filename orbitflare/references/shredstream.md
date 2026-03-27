# OrbitFlare Shredstream

Raw Solana shreds — the smallest unit of block propagation in the Turbine protocol — forwarded to your server via UDP from top-of-turbine validators across 9 global regions. See transactions before they hit any RPC, gRPC, or WebSocket endpoint.

Source: [docs.orbitflare.com/shredstream](https://docs.orbitflare.com/shredstream)

## When to use

- HFT and market-making engines where microseconds matter.
- MEV searchers building bundles from pending state.
- Memecoin snipers and liquidation engines that need to act before the rest of the network.
- DEX aggregators refreshing routes from raw transaction fragments.

If you can use processed gRPC, **don't use Shredstream** — it requires you to implement deshredding and FEC reassembly yourself, accept UDP packet loss, and operate at network-engineer speed. For developer-friendly streams use Jetstream (`jetstream.md`) or Yellowstone (`yellowstone.md`).

## How it sits in the stack

```
Leader validator
    │
    ▼
Turbine propagation tree
    │
    ▼
OrbitFlare Shredstream  <─── you are here, upstream of every other feed
    │
    ▼
Your trading server (UDP)
    │
    ▼
... meanwhile, gRPC and RPC are still assembling the block ...
```

OrbitFlare's servers sit close to the root of the Turbine tree (high-stake validators), forwarding raw shreds to your IP:port within < 1ms of receipt.

## Regions

9 total. Premium regions cost more but sit at the highest-density validator hubs.

### Premium — $1,000/month

| Region              | Code          |
| ------------------- | ------------- |
| Frankfurt           | `fra`         |
| Amsterdam           | `ams`         |
| New York            | `ny`          |
| London              | `lon`         |

### Standard — $500/month

| Region              | Code          |
| ------------------- | ------------- |
| Singapore           | `sgp`         |
| Dublin              | `dub`         |
| Siauliai (Lithuania)| `siau`        |
| Salt Lake City      | `slc`         |
| Tokyo               | `tok`         |

Billing discounts: monthly (—), quarterly (-5%), semi-annual (-10%), annual (-15%). Pay with account balance, Stripe, or USDC on Solana.

## Free trials & perks

- 60-minute self-service trial from the dashboard for existing customers (14-day cooldown).
- New customers — contact the team for trial access.
- **OrbitFlare Pass NFT holders**: 1 free Shredstream slot per active license, restricted to OrbitServers IPv4 prefixes, claimable from the dashboard.

## Provisioning

1. Purchase a slot from the dashboard. Pick region and billing period.
2. Enter your **public IP and UDP port** in the dashboard. The system validates and registers it.
3. Within seconds shreds start flowing.

You need:

- A server with a **public IPv4** and an **open UDP port** (no NAT or CGNAT).
- ~50–100 Mbps of inbound bandwidth for a full shred stream.
- Enough CPU and disk to run deshredding and FEC reconstruction in real time.

Authentication is by IP whitelist. Source IP changes are managed in the dashboard or via the Customer API.

## Technical specs

| Spec                  | Value                                            |
| --------------------- | ------------------------------------------------ |
| Transport             | UDP (raw packets, no TCP/HTTP overhead)          |
| Max shred size        | 1,228 bytes (1,232-byte UDP datagram cap)        |
| Frequency             | Continuous per slot                              |
| Auth                  | IP whitelist                                     |
| Destination           | IP:port set in dashboard                         |
| Sync                  | IP / port changes propagate every ~5 seconds    |
| Bandwidth             | ~50–100 Mbps for a full feed                     |
| Forwarding overhead   | < 1ms                                            |
| Uptime SLA            | 99.99%                                           |

## Shred header layout

| Offset  | Size      | Field                                   |
| ------- | --------- | --------------------------------------- |
| `0x00`  | 64 bytes  | Signature (Ed25519)                     |
| `0x40`  | 1 byte    | Variant (type + auth)                   |
| `0x41`  | 8 bytes   | Slot (u64 LE)                           |
| `0x49`  | 4 bytes   | Index (u32 LE)                          |
| `0x4D`  | 2 bytes   | Version (u16 LE)                        |
| `0x4F`  | 4 bytes   | FEC set index (u32 LE)                  |
| `0x53+` | varies    | Type-specific header + payload          |

## Minimal Rust listener

This binds a UDP socket and prints headers as shreds arrive. For real use you'll then group shreds by `(slot, fec_set_index)` and reconstruct entries via Reed–Solomon FEC.

```rust
use solana_ledger::shred::{merkle::Shred, ShredType};
use std::net::UdpSocket;

fn main() -> std::io::Result<()> {
    let socket = UdpSocket::bind("0.0.0.0:9000")?;
    let mut buf = [0u8; 1232];

    loop {
        let (len, _src) = socket.recv_from(&mut buf)?;
        let raw = buf[..len].to_vec();

        let shred = match Shred::from_payload(raw) {
            Ok(s) => s,
            Err(_) => continue,    // not a valid shred (bad packet, partial UDP, etc.)
        };

        let hdr = shred.common_header();
        let kind = match shred.shred_type() {
            ShredType::Data => "DATA",
            ShredType::Code => "CODE",
        };

        println!(
            "[{kind}] slot={} idx={} fec={} len={len}B",
            hdr.slot,
            shred.index(),
            shred.fec_set_index(),
        );
    }
}
```

You'll want to:

1. Drop duplicates (Turbine can deliver the same shred twice).
2. Group `Data` shreds by `(slot, fec_set_index)`; once you have enough data + code shreds, run Reed–Solomon decoding to recover the original entries.
3. Decode the entries to extract individual transactions.
4. Verify each transaction's signature before acting on it (Turbine itself doesn't authenticate per-shred at the application level).

For a more complete starting point, look at the Solana Labs `solana-ledger` crate, or the `agave-shredstream-client` family of projects.

## OrbitFlare vs. other Shredstream providers

| Feature             | OrbitFlare        | Other providers   |
| ------------------- | ----------------- | ----------------- |
| Starting price      | $500/mo           | $1,000–$6,000/mo  |
| Protocol            | Raw UDP           | Raw UDP           |
| Regions             | 9                 | 1–5               |
| Free trial          | 60 min self-serve | Sales gated       |
| NFT Pass free slot  | Yes               | No                |
| Payment             | Balance / card / SOL+USDC | Varies     |
| Dashboard mgmt      | Full self-service | Varies            |
| Uptime SLA          | 99.99%            | Varies            |

## Best practices

- Co-locate your server in the **same data center / region** as the Shredstream POP. Shredstream's value is microseconds — adding 30ms of cross-region latency erases the edge.
- Run multiple slots in different regions for redundancy and to be the first packet from *whichever* region a given leader propagates through fastest.
- Handle UDP loss explicitly. Lost shreds are common; rely on FEC + duplicate delivery.
- Keep deshredding off the listener thread — buffer raw packets and process them on a worker pool, otherwise you'll drop packets at the kernel.
- Monitor `recvmmsg` socket statistics and bump `SO_RCVBUF` if you see drops.

## Common pitfalls

- **No packets arriving.** Your destination IP:port isn't reachable from OrbitFlare. Check firewall, security groups, NAT (must not be present), and that you entered the public IP, not a private one.
- **Lots of "not a valid shred" packets.** Some other UDP traffic is hitting your port. Bind to a dedicated port and consider source IP filtering at the firewall.
- **Reassembly stalls.** You're missing data shreds and don't have enough code shreds to FEC-recover. Either you have packet loss (network or socket buffer) or your FEC implementation is wrong.
- **Latency feels the same as gRPC.** You're either not co-located, or your processing pipeline is slow enough to hide the wire-level edge. Profile end-to-end.
