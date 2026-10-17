# Muscle House Gym & Fitness Centre — Website

A premium, responsive single-page website for **Muscle House Gym & Fitness Centre**, HSR Layout, Bengaluru.

It's a static site (HTML, CSS and vanilla JavaScript) with no build step, so it can be hosted anywhere. Online membership sign-ups and the admin dashboard use a free [Supabase](https://supabase.com) database.

```
index.html             All page sections, SEO meta, Open Graph, LocalBusiness JSON-LD, Join & pay dialog
admin.html             Owner dashboard: members, payment verification, UPI details, plan prices
assets/css/styles.css  Design system, textures, layout, motion (respects reduced-motion)
assets/css/admin.css   Dashboard styles
assets/js/main.js      Nav, mobile menu, parallax, scroll reveals, map lazy-load, enquiry form
assets/js/config.js    Supabase project URL + public (anon) key: the only file you edit to connect
assets/js/upi.js       Shared UPI link / QR code / REST helpers
assets/js/auth.js      Member log in / sign up (email or Google), password reset, "My membership"
assets/js/join.js      Live plan prices + the Join & pay (UPI QR) flow on the website
assets/js/admin.js     Dashboard logic
assets/vendor/         supabase-js 2.45.4 and qrcode-generator 1.4.4 (both MIT), bundled locally
supabase/schema.sql    Database tables, security rules and admin setup: run once in Supabase
assets/img/            Optimised WebP photography, og.jpg (social preview), favicon.svg
```

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

## Memberships, UPI payments and the admin dashboard

### How it works

There's no payment gateway. Members pay the gym's own UPI ID directly by scanning a QR code, so there are no fees, but the website **cannot see whether a payment succeeded**. The owner therefore confirms each payment:

1. **Member (website):** picks a plan → **Join & pay** → **logs in or creates an account** (email + password or **Continue with Google**) → enters name and phone → scans the QR (the amount is pre-filled; on phones there's also an *Open UPI app* button) → pays → enters the UPI transaction ID (UTR) from the receipt → **Submit for verification**. The site says the request is *pending verification*. It never says "paid".
2. **Owner (`/admin.html`):** signs in → **Members → Pending** → checks that the amount and UTR appear in the bank or UPI app → **Verify**. The membership becomes **Active**, and the end date is set from the plan length. Use **Reject** if the payment isn't there.

The dashboard also shows **Active**, **Expiring in 7 days**, **Expired** and **Rejected** members, plus search, CSV export, and **+ Add member** for walk-in or cash payments.

Under **Payment details** the owner enters their **UPI ID** (for example `name@okaxis`) and **payee name**, and can test-scan a preview QR. A bank account number and IFSC can't be encoded in a UPI QR, so use the UPI ID linked to the account. A merchant or business UPI ID is the most reliable for receiving payments. Some UPI apps limit amounts or show warnings when paying a *personal* UPI ID from a QR.

Under **Plans & prices** the owner edits prices and hides or shows plans. The website updates immediately.

Members can open **My membership** (person icon in the header) to see each request's status: *Pending verification*, *Active until …*, *Expired* or *Not approved*. They can also log out there.

### Member accounts: Supabase + Google settings

After pulling this version, do these once:

1. **Update the database:** SQL Editor → New query → paste all of `supabase/schema.sql` → Run. It's safe to re-run, and existing members, prices and your admin login are kept.
2. **Allow sign-ups:** Authentication → Sign In / Providers → turn **on** *Allow new users to sign up*.
3. **No email confirmation:** on the same page, open **Email** → turn **off** *Confirm email* → Save.
4. **Site address:** Authentication → URL Configuration → *Site URL* = `https://harshavardhangowda525-spec.github.io/Muscle-House-Gym-Fitness-Centre/`. Under *Redirect URLs*, add `https://harshavardhangowda525-spec.github.io/Muscle-House-Gym-Fitness-Centre/**`.
5. **Google:** create an OAuth client in Google Cloud (Web application). Set *Authorized JavaScript origins* to `https://harshavardhangowda525-spec.github.io` and *Authorized redirect URIs* to `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the Client ID and Client Secret into Supabase → Authentication → Sign In / Providers → **Google** → Enable → Save.

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
7. Open `https://<your-site>/admin.html`, sign in, and fill in **Payment details**. Each plan on the website then shows **Join & pay**.

Until `config.js` is filled in, the website keeps working exactly as before, with "Enquire now" buttons and the static sample prices.

### Security

- Visitors who aren't logged in can only **read active plans and the UPI settings**. **Logged-in members** can submit a pending request (automatically linked to their account and email) and read **only their own** records. They can't change or delete anything, and only admins see other people's data. All of this is enforced by Postgres row-level security in `schema.sql`.
- The **price, plan length and status are set by the database**, not the browser, so nobody can submit a lower amount or mark themselves active.
- Duplicate UPI transaction IDs are rejected, and a phone number can have at most 3 pending requests per day.
- Member names and other text are HTML-escaped in the dashboard, and the CSV export guards against spreadsheet formula injection.
- `admin.html` is marked `noindex`, but it relies on the login and database rules for protection, not on staying hidden.

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
