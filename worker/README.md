# Mandaly activation worker

Verifies box activation codes (format `MDLY-XXXX-XXXX`), allowing at most
**2 devices per code**. Runs on Cloudflare Workers' free tier (no cost for
this volume of traffic).

This is the *only* part of the activation system that needs a manual,
one-time setup outside this repo — everything else (the app, the code
generator) is already done and will just work once you finish these steps.

## 1. Prerequisites

- A free Cloudflare account: https://dash.cloudflare.com/sign-up
- Node.js installed (you already have this, for the app itself)

## 2. Install and log in to Wrangler (Cloudflare's CLI)

```bash
cd worker
npm install
npx wrangler login
```

This opens a browser tab to authorize the CLI against your Cloudflare
account.

## 3. Create the KV namespace (where codes and their usage are stored)

```bash
npx wrangler kv namespace create ACTIVATION_CODES
```

This prints something like:

```
{ binding = "ACTIVATION_CODES", id = "abcd1234...") }
```

Copy the `id` value into `worker/wrangler.toml`, replacing
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

> If your Wrangler version is older and `wrangler kv namespace create`
> isn't recognized, try `wrangler kv:namespace create ACTIVATION_CODES`
> instead (older colon-separated syntax).

## 4. Set the admin token (the "password" for viewing code usage)

```bash
npx wrangler secret put ADMIN_TOKEN
```

Paste any long random string when prompted (e.g. generate one at
https://1password.com/password-generator/ or run
`node -e "console.log(crypto.randomUUID())"`). Save it somewhere safe — you'll
need it every time you want to check which codes have been used (see step 7).

## 5. Deploy

```bash
npx wrangler deploy
```

This prints your worker's live URL, something like:

```
https://mandaly-activation.YOUR-SUBDOMAIN.workers.dev
```

Copy this URL.

## 6. Point the app at your worker

Open `src/config.ts` in the main project (not this `worker/` folder) and
replace the placeholder with the URL from step 5:

```ts
export const ACTIVATION_API_URL = 'https://mandaly-activation.YOUR-SUBDOMAIN.workers.dev';
```

Then commit and push this one-line change — the existing GitHub Actions
workflow will rebuild and redeploy the PWA automatically, same as every
other change so far.

## 7. Generate and upload activation codes

From the project root (not `worker/`):

```bash
node scripts/gen-codes.mjs 200
```

This creates two files (git-ignored — **never commit or share these**,
they're the real activation codes):

- `codes-batch-1.csv` — the 200 codes, for your own records / for
  whoever prints the boxes
- `codes-batch-1-seed.json` — same codes in the format Wrangler needs to
  bulk-upload them into KV

Upload them to the worker's KV store:

```bash
cd worker
npx wrangler kv bulk put ../codes-batch-1-seed.json --namespace-id=<the id from step 3>
```

(Older Wrangler: `wrangler kv:bulk put ...`)

Run `node scripts/gen-codes.mjs 200` again any time you need a second batch —
it automatically names the next batch `codes-batch-2.csv`, etc., and never
overwrites a previous batch.

## 8. Checking which codes have been used

Visit this URL in any browser (bookmark it):

```
https://mandaly-activation.YOUR-SUBDOMAIN.workers.dev/admin/export?token=YOUR_ADMIN_TOKEN
```

It downloads a `.csv` file that opens directly in Excel, with one row per
code: `code,uses,device1,device2` — `uses` is 0, 1, or 2.

## How it works, briefly

- The app calls `POST /activate` with `{ code, deviceId }` exactly once,
  the very first time it's opened on a given device — never again after
  that (see `src/activation.ts`).
- The worker looks up the code in KV. Unknown code → rejected. Same device
  retrying → allowed (no-op). New device and fewer than 2 already used →
  allowed, device added. Already 2 devices, this one's new → rejected.
- There's no real DRM here — a technically sophisticated person could still
  extract a valid code and use it up before a real customer does. This is
  meant to stop *casual* sharing (forwarding the QR to a friend who didn't
  buy the box), not to be an unbreakable lock.
