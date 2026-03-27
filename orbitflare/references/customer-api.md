# OrbitFlare Customer API

REST API for managing your OrbitFlare account programmatically: licenses, API keys, IP whitelists, profile, USDC balance top-ups, plan purchases, and invoices.

Source: [docs.orbitflare.com/api-documentation/welcome](https://docs.orbitflare.com/api-documentation/welcome) · OpenAPI spec: [docs.orbitflare.com/api-documentation/openapi.json](https://docs.orbitflare.com/api-documentation/openapi.json)

This is **not** the RPC interface. For Solana RPC, see `rpc.md`.

## Versions

| Version | Status     | Auth                          | Notes                                                          |
| ------- | ---------- | ----------------------------- | -------------------------------------------------------------- |
| v1      | Deprecated | `X-ORBIT-KEY` only            | Limited endpoints; will be removed in a future release         |
| v2      | Current    | `X-ORBIT-KEY` **or** Bearer   | Adds device/wallet auth, profile, invoices, top-up, orders     |

Always use **v2** for new integrations. Migration guide: [docs.orbitflare.com/api-documentation/migration](https://docs.orbitflare.com/api-documentation/migration).

## Base URL

```
https://api.orbitflare.com/customer/v2
```

(The OpenAPI spec lists `https://orbitflare.com/api/customer/v2` as the production server. Both routes resolve to the same backend.)

## Authentication

### API key (works in v1 and v2)

Pass the **Customer API key** in the `X-ORBIT-KEY` header:

```bash
curl -H "X-ORBIT-KEY: YOUR_API_KEY" \
  https://api.orbitflare.com/customer/v2/licenses
```

This is **not** the same key you use for RPC. The RPC license key (`?api_key=ORBIT-...`) is separate. Find your Customer API key under API Keys in the [dashboard](https://orbitflare.com/dashboard).

### Bearer token (v2 only)

Tokens are issued by either the **device authorization flow** or **wallet signature auth**. Pass them as:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.orbitflare.com/customer/v2/me
```

API key sessions cannot be revoked via `/auth/logout`; only Bearer tokens can.

## Endpoint groups

| Group        | Base path                  | Highlights                                                                  |
| ------------ | -------------------------- | --------------------------------------------------------------------------- |
| Auth         | `/auth/...`                | Device flow, wallet challenge / verify / register, `me`, `logout`, `ping`   |
| Licenses     | `/licenses`                | List, get, regenerate / reset key, IP & domain whitelist, auth-mode toggle  |
| API keys     | `/api-keys`                | Create, list, get, update, delete, regenerate, IP whitelist                 |
| Profile      | `/profile`                 | Get, update, balance                                                        |
| Top-up       | `/topup`                   | Prepare → Confirm USDC transfers; history                                   |
| Orders       | `/orders`                  | Validate, purchase RPC plan, list, get                                      |
| RPC plans    | `/rpc-plans`               | List the catalog, get details                                               |
| Invoices     | `/invoices`                | List, get, pay with balance                                                 |

## Auth flows

### Device flow (no password, browser-assisted)

```bash
# 1. Request a device code
curl -X POST https://api.orbitflare.com/customer/v2/auth/device/code

# Response:
# {
#   "verification_uri": "https://orbitflare.com/auth/device",
#   "user_code": "XXXX-XXXX",
#   "device_code": "...",
#   "interval": 5,
#   "expires_in": 600
# }

# 2. Show verification_uri + user_code to the user.
# 3. Poll for the token:
curl -X POST https://api.orbitflare.com/customer/v2/auth/device/token \
  -H "Content-Type: application/json" \
  -d '{ "device_code": "..." }'

# Returns 428 (authorization_pending) until the user authorizes,
# 429 (slow_down) if you poll too fast,
# 410 (expired_token) once the device code expires,
# or 200 with { "access_token": "..." } on success.
```

### Wallet auth (sign challenge with your Solana keypair)

```bash
# 1. Request a challenge
curl -X POST https://api.orbitflare.com/customer/v2/auth/wallet/challenge \
  -H "Content-Type: application/json" \
  -d '{ "wallet": "YourSolanaPublicKey" }'

# 2. Sign the returned challenge nonce with Ed25519.

# 3. Verify (existing accounts) or Register (first time):
curl -X POST https://api.orbitflare.com/customer/v2/auth/wallet/verify \
  -H "Content-Type: application/json" \
  -d '{ "wallet": "...", "signature": "base58-signed-challenge" }'

curl -X POST https://api.orbitflare.com/customer/v2/auth/wallet/register \
  -H "Content-Type: application/json" \
  -d '{ "wallet": "...", "signature": "..." }'
```

Returns a Bearer token on success.

## Licenses

A **license** is what you authenticate RPC traffic with. You can have many licenses per account (one per app, environment, etc.). Each license has its own RPC license key, IP / domain whitelist, and plan.

```bash
# List
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/licenses

# Detail
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/licenses/{license_id}

# Add an IP to mainnet whitelist
curl -X POST -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/licenses/{license_id}/ips \
  -d '{ "ip": "1.2.3.4", "location": "fra" }'

# Toggle auth mode (IP whitelist vs API key)
curl -X PATCH -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/licenses/{license_id}/auth-mode \
  -d '{ "mode": "api_key" }'

# Regenerate the RPC license key
curl -X POST -H "X-ORBIT-KEY: $KEY" \
  https://api.orbitflare.com/customer/v2/licenses/{license_id}/regenerate
```

Other useful operations: `add-domain`, `remove-domain`, `add-devnet-domain`, `regenerate-key`, `reset-key`, `toggle-auto-renewal`. See the OpenAPI spec for exact paths.

## API keys

The `X-ORBIT-KEY` keys themselves can be created, listed, regenerated, and deleted via the API:

```bash
# Create
curl -X POST -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/api-keys \
  -d '{ "name": "ci-pipeline" }'

# Add IP whitelist to a key
curl -X POST -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/api-keys/{api_key_id}/ips \
  -d '{ "ip": "1.2.3.4" }'

# Regenerate
curl -X POST -H "X-ORBIT-KEY: $KEY" \
  https://api.orbitflare.com/customer/v2/api-keys/{api_key_id}/regenerate
```

The full API key value is returned **once**, on create or regenerate. After that only a masked version is visible. Store it securely.

## USDC balance top-up

A two-step on-chain flow: the server builds the unsigned USDC transfer (so it can embed a verifiable memo and recent blockhash), you sign locally, then the server broadcasts and credits your balance.

### 1. Prepare

`POST /customer/v2/topup/prepare`

```json
{
  "amount": 100,
  "wallet_address": "YourSolanaPublicKey"
}
```

| Field            | Type   | Range                  |
| ---------------- | ------ | ---------------------- |
| `amount`         | float  | 5 – 10 000 USDC        |
| `wallet_address` | string | 32–44 char base58 pubkey |

Response:

```json
{
  "data": {
    "transaction": "base64-unsigned-tx",
    "memo": "TopUp:{userId}:{timestamp}",
    "amount_usdc": 100.0,
    "amount_micro_usdc": 100000000,
    "destination_wallet": "OrbitFlareUSDCDestination...",
    "blockhash": "...",
    "last_valid_block_height": 312_000_000
  }
}
```

### 2. Sign locally

Deserialize the base64 transaction, sign it with the wallet keypair you specified, then re-serialize.

### 3. Confirm

`POST /customer/v2/topup/confirm` with the signed base64 transaction. The server broadcasts it to Solana, waits for finalization, verifies the memo + signer + USDC transfer + amount + destination on-chain, then credits your account balance and creates an invoice + payment record.

### History

`GET /customer/v2/topup/history` — paginated list of credits and deductions.

Don't try to bypass `prepare` and craft the transaction yourself — `confirm` validates the embedded memo and recent blockhash.

## Orders & plan purchase

```bash
# List the RPC plan catalog
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/rpc-plans

# Plan details
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/rpc-plans/{slug}

# Validate (dry-run): pricing + can-you-afford check
curl -X POST -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/orders/validate \
  -d '{ "plan": "growth", "period": "monthly", "coupon": "OPTIONAL" }'

# Purchase from balance (atomic: deducts balance, creates order + invoice + payment + license)
curl -X POST -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/orders \
  -d '{ "plan": "growth", "period": "monthly" }'
```

Always run `validate` first to surface pricing and confirm balance.

## Invoices

```bash
# List
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/invoices

# Get
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/invoices/{ref}

# Pay with balance (supports partial payment)
curl -X POST -H "X-ORBIT-KEY: $KEY" \
  https://api.orbitflare.com/customer/v2/invoices/{ref}/pay-with-balance
```

## Profile

```bash
# Read
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/profile

# Update
curl -X PATCH -H "X-ORBIT-KEY: $KEY" -H "Content-Type: application/json" \
  https://api.orbitflare.com/customer/v2/profile \
  -d '{ "name": "...", "payment_wallet": "..." }'

# Balance
curl -H "X-ORBIT-KEY: $KEY" https://api.orbitflare.com/customer/v2/profile/balance
```

## Error shape (v2)

```json
{
  "success": false,
  "message": "Human readable message",
  "errors": { "field": ["validation msg"] },
  "error":   "authorization_pending"
}
```

Common `error` codes you'll see in auth flows: `authorization_pending`, `slow_down`, `expired_token`.

Common HTTP statuses: `401 Unauthorized` (bad key/token), `422 Validation error`, `428 Awaiting auth (device flow)`, `429 Too Many Requests / slow_down`, `410 expired_token`.

## Best practices

- Use **separate Customer API keys per integration** so you can revoke them independently.
- Whitelist IPs on the API key so a leaked key is useless from elsewhere.
- For unattended automation, prefer API keys. For interactive CLIs / dashboards, prefer the device flow or wallet auth.
- Always run `orders/validate` before `orders` so you don't surprise the user with a failed purchase.
- For top-ups, never construct the USDC transfer yourself — `prepare` embeds a memo `confirm` will check.
- Treat the values returned by `api-keys/.../regenerate` and `licenses/.../regenerate` as one-time secrets — they aren't shown again after the response.
