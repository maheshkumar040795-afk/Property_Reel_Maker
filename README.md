# Property Reel Maker — Think Through Technology

Browser tool that turns property photos, video clips and details into vertical (1080×1920) MP4 reels for Instagram, YouTube Shorts and WhatsApp — with client logins, 30-day subscriptions, cloned AI voice and Cashfree payments.

| File | What it is |
|---|---|
| `index.html` | **Client Reel Maker** — clients log in with code + PIN |
| `admin.html` | **Your admin page** — add clients, plans, keys, mark paid |
| `config.js` | One line: your Worker URL |
| `worker/` | Cloudflare Worker (server) — keys, subscriptions, voice, payments |
| `standalone.html` | Old version without login (for your own quick reels) |
| `src/` | Source + build script for `index.html` |

## Designs
6 layouts (Card, Split, Magazine, Bold, Minimal, Polaroid) × 10 colour sets + brand colours × 3 fonts (Modern, Elegant, Bold).
**Shuffle** picks a new combination; **New design after every video** (on by default) makes every reel look different.
Admin → client → *Starting design* (or 🎲 Random) and *Use only brand colours*.
**Cover image**: 1080×1920 JPG thumbnail for Instagram/YouTube/WhatsApp; the video can also start with it.

## Plans (enforced on the server)

| Plan | ₹ / 30 days | Reels / month | Voice | Extras |
|---|---|---|---|---|
| Basic | 600 | 10 | Own recording only | — |
| Standard | 1,200 | 15 | Cloned AI voice (9,000 chars) | — |
| Premium | 3,000 | 20 | Cloned AI voice (12,000 chars) | 1 shoot visit + posting |

Change prices/limits in `worker/src/index.js` → `PLANS`, or per client in admin.

---

## One-time setup (about 20 minutes, no coding)

### 1. Create the Worker (free)
1. Sign up at **dash.cloudflare.com** (free plan).
2. **Workers & Pages → Create → Create Worker** → name it `reel-api` → **Deploy**.
3. Click **Edit code**, delete everything, paste the whole of `worker/src/index.js`, click **Deploy**.
4. Copy the Worker URL, e.g. `https://reel-api.yourname.workers.dev`.

### 2. Storage (KV)
1. **Storage & Databases → KV → Create namespace** → name `reel-db`.
2. Open the Worker → **Settings → Bindings → Add → KV namespace** → Variable name **`DB`** → choose `reel-db` → Save.

### 3. Settings & secrets
Worker → **Settings → Variables and Secrets → Add**:

| Name | Type | Value |
|---|---|---|
| `ADMIN_PASSWORD` | Secret | a strong password only you know |
| `SESSION_SECRET` | Secret | any long random text (40+ characters) |
| `ALLOWED_ORIGINS` | Text | `https://maheshkumar040795-afk.github.io` |
| `APP_URL` | Text | `https://maheshkumar040795-afk.github.io/Property_Reel_Maker/` |
| `CF_ENV` | Text | `sandbox` while testing, then `production` |
| `CF_APP_ID` | Secret | Cashfree App ID (step 5) |
| `CF_SECRET` | Secret | Cashfree Secret Key (step 5) |

Do **not** add `MOCK_TTS` (only for local testing).

### 4. Point the pages to your Worker
Edit `config.js` on GitHub and paste your Worker URL. Commit.

### 5. Cashfree (automatic renewals)
1. Cashfree dashboard → **Payment Gateway → Developers → API Keys** → copy **App ID** and **Secret Key** → add as `CF_APP_ID` / `CF_SECRET`.
2. **Developers → Webhooks → Add** → URL `https://reel-api.yourname.workers.dev/api/pay/webhook` → events **Payment success**.
3. Whitelist your domain `maheshkumar040795-afk.github.io` in Cashfree if asked.
4. Test with `CF_ENV = sandbox` and Cashfree test keys first, then switch to production keys.

When a client pays, the Worker confirms with Cashfree and adds **30 days** automatically. UPI/cash payments: use **Mark paid** in admin.

### 6. ElevenLabs
Open `admin.html` → **⚙ Settings** → paste your ElevenLabs key as the **default key** (write-only). For each Standard/Premium client: clone their voice in ElevenLabs, paste the **Voice ID** in the client's Edit screen, then **▶ Test voice**. Optionally give a client their own key (with a credit limit) so usage is separated.

---

## Daily use
- **Add client:** admin → + Add client → choose plan → code, name, phone, logo, colours → Save → send the code + PIN on WhatsApp.
- **Renewal reminders:** the client sees a banner 5 days before expiry; you can tap **WhatsApp reminder** in admin.
- **Not paid:** after expiry + 3 grace days the tool locks (no voice, no export) until payment.
- **Usage:** admin shows reels and AI voice used this month for every client.

## Rebuilding `index.html` after editing `src/app.html`
```
pip install fonttools brotli
python3 src/build.py
```
