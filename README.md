# Muscle House Gym & Fitness Centre — Website

A premium, responsive single-page website for **Muscle House Gym & Fitness Centre**, HSR Layout, Bengaluru.

It's a static site (HTML, CSS and vanilla JavaScript) with no build step and no dependencies, so it can be hosted anywhere.

```
index.html            All page sections, SEO meta, Open Graph, LocalBusiness JSON-LD
assets/css/styles.css Design system, textures, layout, motion (respects reduced-motion)
assets/js/main.js     Nav, mobile menu, parallax, scroll reveals, map lazy-load, enquiry form
assets/img/           Optimised WebP photography, og.jpg (social preview), favicon.svg
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

Only verified facts are used: name, address, phone, the 4.4/5 Google rating from 105 reviews, the listed 10:00 PM closing time, and the three supplied review quotes. Opening hours, prices, trainer credentials, amenities and statistics are deliberately left out. The structured data contains no hours or rating markup.

The "Read all reviews" and Maps links use a Google Maps **search** for the exact business name and address, because no verified listing URL was supplied. If you have the gym's Google Maps place link, use it for those `href`s instead.
