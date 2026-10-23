# Muscle House Gym & Fitness Centre — Website

A premium, responsive single-page website for **Muscle House Gym & Fitness Centre**, HSR Layout, Bengaluru.

It's a static site (HTML, CSS and vanilla JavaScript) with no build step, so it can be hosted anywhere. Online membership sign-ups and the admin dashboard use a free [Supabase](https://supabase.com) database.

```
index.html             All page sections, SEO meta, Open Graph, LocalBusiness JSON-LD, join/login dialogs
admin.html             Owner dashboard: members, add/link memberships, plan prices
assets/css/styles.css  Design system, textures, layout, motion (respects reduced-motion)
assets/css/admin.css   Dashboard styles
assets/js/main.js      Nav, mobile menu, parallax, scroll reveals, map lazy-load, enquiry form
assets/js/config.js    Supabase project URL + public (anon) key: the only file you edit to connect
assets/js/core.js      Shared config, rupee formatting and REST helpers
assets/js/auth.js      Member log in / sign up (email or Google), password reset, "My membership"
assets/js/join.js      Live plan prices + "Join on WhatsApp" (log in, then WhatsApp the gym)
assets/js/chat.js      "Ask Muscle House" help assistant (rule-based, runs in the browser, no API key)
assets/js/admin.js     Dashboard logic
assets/vendor/         supabase-js 2.45.4 (MIT), bundled locally
supabase/schema.sql    Database tables, security rules and admin setup: run once in Supabase
assets/img/            Optimised WebP photography, og.jpg (social preview), favicon.svg
```

## Updating files (browser cache)

`index.html` and `admin.html` load the site's CSS and JS with a version tag (`styles.css?v=20261022-2`). GitHub Pages lets browsers cache files for about 10 minutes, so **whenever you change a CSS or JS file, bump that `?v=` value in both HTML files**. Otherwise visitors can get the new page with an old script.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `index.html` directly in a browser.

## Deploy

Any static host works. Pick one:

- **GitHub Pages:** Repo → Settings → Pages → *Deploy from a branch* → pick the branch and `/ (root)` → Save. The site goes live at `https://<user>.github.io/<repo>/`.
- **Netlify:** drag the project folder onto <https://app.netlify.com/drop>, or connect the repo with no build command and publish directory `.`.
- **Vercel:** `npx vercel` in the project folder, or import the repo with framework preset *Other* and no build command.
- **Cloudflare Pages:** connect the repo with no build command and output directory `/`.

After deploying to a final domain, change the relative `og:image` / `twitter:image` URLs in `index.html` to absolute URLs (for example `https://yourdomain.com/assets/img/og.jpg`). Some social platforms need absolute URLs to show the preview image.

## Memberships and the admin dashboard

> **Current setting: membership by phone.** The plan cards and prices are **hidden** on the website. The Membership section shows a "One call. A stronger you." panel with Call and WhatsApp buttons for **063633 42090**, and the chat assistant points visitors to the phone too. **To show the plans again:** in `index.html`, remove `hidden` from `<div class="plans-wrap" data-plans hidden>` and delete the `[data-call-panel]` block above it. Everything below then works as described.

### How it works

**There are no online payments.** The client decided against payment integration for now, so members arrange payment with the gym on WhatsApp:

1. **Member (website):** picks a plan → **Join on WhatsApp** → **logs in or creates an account** (email + password or **Continue with Google**) → **Continue on WhatsApp** opens a chat with the gym, pre-filled with the plan, price, name and email, asking for payment details → presses send.
2. **Owner:** replies on WhatsApp with payment details. Once paid, they open **`/admin.html` → + Add member**, enter the member's name, phone, plan, payment method and **the member's login email**. The membership is saved as **Active**, with the end date set from the plan length.
3. **Member:** sees it under **My membership** (person icon in the header) as *Active from … to …*. The login email is what links the two. Without it, or if that email has no website login, the membership is still recorded but doesn't appear on the member's page.

The dashboard shows **Active**, **Expiring in 7 days** and **Expired** members, plus search and CSV export. Under **Plans & prices** the owner edits prices, hides or shows plans, and switches the "sample prices" notice on or off. The website updates immediately.

The gym's WhatsApp number is set once in `assets/js/config.js` (`whatsappNumber`) and is used by both the enquiry form and the join button.

**Re-enabling online payments later:** the earlier UPI QR flow is kept in the git history (commit `62ba1be` and before) and can be restored.

### Member accounts: Supabase + Google settings

After pulling this version, do these once:

1. **Update the database:** SQL Editor → New query → paste all of `supabase/schema.sql` → Run. It's safe to re-run, and existing members, prices and your admin login are kept.
2. **Allow sign-ups:** Authentication → Sign In / Providers → turn **on** *Allow new users to sign up*.
3. **No email confirmation:** on the same page, open **Email** → turn **off** *Confirm email* → Save.
4. **Site address:** Authentication → URL Configuration → *Site URL* = `https://harshavardhangowda525-spec.github.io/Muscle-House-Gym-Fitness-Centre/`. Under *Redirect URLs*, add `https://harshavardhangowda525-spec.github.io/Muscle-House-Gym-Fitness-Centre/**`.
5. **Google:** create an OAuth client in Google Cloud (Web application). Set *Authorized JavaScript origins* to `https://harshavardhangowda525-spec.github.io` and *Authorized redirect URIs* to `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the Client ID and Client Secret into Supabase → Authentication → Sign In / Providers → **Google** → Enable → Save.

**Google sign-in without the supabase.co page:** set `googleClientId` in `assets/js/config.js` to the OAuth **Client ID** (Google Cloud → Google Auth Platform → Clients; it ends in `.apps.googleusercontent.com`; never use the Client *Secret* here). The login screen then shows Google's own button, which opens a Google popup over the website. Supabase verifies the result in the background, so visitors never land on `supabase.co`. Google shows the app name from **Branding** and the website's address. In Supabase → Authentication → Sign In / Providers → Google, the same Client ID must be listed under **Client IDs**. If Google's script is blocked, or no Client ID is set, the site falls back to the redirect flow.

Until Google is set up, "Continue with Google" shows a friendly "isn't switched on yet" message, and email sign-up still works. Supabase's built-in email sender is rate-limited (a few emails per hour), which only affects *Forgot password* emails. For higher volume, add your own SMTP under Authentication → Emails → SMTP Settings.

### One-time setup (about 10 minutes)

1. Create a free project at <https://supabase.com> (pick the Mumbai region for India).
2. **SQL Editor → New query:** paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user → Create new user:** enter the owner's email and a strong password, and tick *Auto confirm user*.
4. Back in the **SQL Editor**, make that user an admin:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'owner@example.com';
   ```
5. **Authentication → Sign In / Providers:** leave *Allow new users to sign up* **on**, because members create their own accounts. Admin access only comes from the `admins` table.
6. **Project Settings → API:** copy the **Project URL** and the **anon public** key into `assets/js/config.js`, then commit and deploy. Never use the `service_role` key on the website.
7. Open `https://<your-site>/admin.html` and sign in. Each plan on the website now shows **Join on WhatsApp**.

Until `config.js` is filled in, the website keeps working exactly as before, with "Enquire now" buttons and the static sample prices.

### Security

- Visitors who aren't logged in can only **read active plans** (and the sample-notice setting). **Logged-in members** can read **only their own** memberships. They can't create, change or delete anything, and only admins can add, see or manage members. All of this is enforced by Postgres row-level security in `schema.sql`.
- The **price and plan length are set by the database** from the plan, not typed in the browser. Duplicate payment references are rejected.
- Member names and other text are HTML-escaped in the dashboard, and the CSV export guards against spreadsheet formula injection.
- `admin.html` is marked `noindex`, but it relies on the login and database rules for protection, not on staying hidden.

## Help assistant ("Ask Muscle House")

The chat button in the bottom-right corner opens an **automated FAQ assistant**. It runs entirely in the visitor's browser: **no AI service, no API key, no cost**, and nothing typed into it is sent anywhere.

- It matches questions to topics by keywords and phrases. It tolerates plurals, small typos (for example "pirce", "timmings") and some Hinglish ("fees kitna hai", "gym kaha hai").
- It answers only from **verified facts** (address, phone, the listed 10:00 PM closing time, Google rating) and **live page data**: current plan prices from the dashboard, whether the sample-price notice is on, whether online joining is available, and whether the visitor is logged in.
- For anything unconfirmed (opening hours, parking, showers, lockers, classes, diet plans, trials, discounts and similar), it says it doesn't have confirmed details. It then offers **WhatsApp with the question pre-filled**, or a call.
- Answers include buttons: Get directions, Call, WhatsApp, Log in / My membership, and jump-to-section links.

**Editing answers:** all topics are in the `INTENTS` list in `assets/js/chat.js`. Each has `keys` (words or phrases; `word^2` gives a word more weight) and a `reply`. Gym facts are in the `GYM` object at the top of the file. Once the owner confirms details such as opening hours, update the relevant reply. Remove a facility from the `UNVERIFIED` list once it's confirmed. Bump the `?v=` version in `index.html` after editing.

## Enquiry form: how it works

The form validates the name, a 10-digit Indian mobile number, the fitness goal and the preferred contact time in the browser. When the visitor submits, it **opens WhatsApp with the enquiry pre-filled** to `+91 63633 42090`.

- Nothing is sent until the visitor presses **send in WhatsApp**, and the page says so clearly. It never shows a fake "message sent" confirmation.
- The website stores and transmits no personal data itself.
- **Before launch: make sure 063633 42090 is a WhatsApp number** (ideally a WhatsApp Business account). If it isn't, change `WHATSAPP_NUMBER` at the top of `assets/js/main.js`.

**Integration point for a form backend (optional):** to deliver enquiries to email or a CRM instead, replace the `window.open(...)` hand-off in the `submit` handler in `assets/js/main.js` with a `fetch()` POST to your provider (for example Formspree, Basin or your own endpoint). Show the success state only after the response is `ok`, and keep the error state for failures.

## Photography

The images in `assets/img/` are **AI-generated representative images** of strength-training environments, made with Floot. They are **not** photographs of the Muscle House premises, and the page says so in the gallery and the footer.

To use real photos of the gym, replace the files and keep the same names:

| File | Used in | Shape |
|---|---|---|
| `hero.webp` | Hero background | Landscape 16:9 |
| `intro.webp` | "More than a workout" | Portrait 4:5 |
| `strength.webp`, `trainer.webp`, `journey.webp` | Training panels 01–03 | Portrait |
| `deadlift.webp` | Gallery (wide) | Landscape |
| `cable.webp`, `chalk.webp` | Gallery (tall) | Portrait |
| `bench.webp`, `rope.webp` | Gallery | Square or landscape |
| `final.webp` | Final CTA background | Landscape 16:9 |
| `og.jpg` | Social share preview | 1200×630 |

Aim for about 1600px on the long edge, WebP at roughly 70–80% quality. If you swap in genuine gym photos, update the alt text in `index.html` and remove the "representative imagery" notes.

## Content accuracy

Only verified facts are used: name, address, phone, the 4.4/5 Google rating from 105 reviews, the listed 10:00 PM closing time, and the three supplied review quotes. Opening hours, trainer credentials, amenities and statistics are deliberately left out.

The structured data contains no hours or rating markup.

**Membership prices are placeholders** (₹2,000 / ₹5,500 / ₹9,500 / ₹16,000), and the page labels them "sample prices … to be confirmed". Once Supabase is connected, set the real prices in **admin → Plans & prices** and untick *Show the "sample prices" notice* under **Payment details**. Without Supabase, edit the numbers in the `MEMBERSHIP` block of `index.html` and delete the `.plans__disclaimer` note.

The "Read all reviews" and Maps links use a Google Maps **search** for the exact business name and address, because no verified listing URL was supplied. If you have the gym's Google Maps place link, use it for those `href`s instead.
