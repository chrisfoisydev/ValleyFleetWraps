# Valley Fleet Wraps — Website

A conversion-focused, single-page static website for **Valley Fleet Wraps**, a commercial fleet wrapping company serving Deer Valley, North Phoenix, and Greater Phoenix.

**Primary goal:** drive leads for the **Free Fleet Visibility Audit** (form at `#contact`).

## Stack

- Plain **HTML / CSS / JavaScript** — no build step, no framework.
- **three.js** (CDN) — fixed background scene: a stylized desert road at dusk that responds to scroll.
- **GSAP + ScrollTrigger** (CDN) — hero entrance, section reveals, and scroll scrubbing.
- Google Fonts: Barlow Condensed (headlines) + Inter (body).

Everything degrades gracefully: if a CDN script fails or the visitor prefers reduced motion, the site renders as a normal static page over a CSS gradient.

## File structure

```
index.html        All sections + SEO meta + LocalBusiness JSON-LD
css/styles.css    Mobile-first styles (palette, layout, components)
js/scene.js       three.js desert-road background scene
js/main.js        Nav, GSAP animations, form validation & submission
README.md         This file
assets/img/       (create when you have photos — see placeholders below)
```

## Run locally

Any static file server works:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open http://localhost:8000. (Opening `index.html` directly via `file://` also works, since there are no module imports or fetches on load.)

## Connect the lead form

The form (`#lead-form` in `index.html`) validates client-side and serializes to JSON. Delivery is stubbed until you set an endpoint.

**One line to change:** in `js/main.js`, find:

```js
var FORM_ENDPOINT = ''; // ← leave empty until an endpoint exists
```

### Option A — Zapier (recommended to start)
1. Create a Zap with the **Webhooks by Zapier → Catch Hook** trigger.
2. Paste the hook URL into `FORM_ENDPOINT`.
3. Add actions: send email, create Airtable/HubSpot/Google Sheets record, Slack alert, etc.

### Option B — Airtable
Create an Airtable Automation with a **"When webhook received"** trigger and paste its URL into `FORM_ENDPOINT`. Map the JSON fields (`name`, `business`, `email`, `phone`, `industry`, `vehicle_count`, `vehicle_types`, `need`, `message`, `contact_method`) to table columns.

### Option C — HubSpot
Either:
- Replace the `<form>` block with a HubSpot embedded form (keeps HubSpot analytics/attribution), or
- POST the payload to the [HubSpot Forms API](https://developers.hubspot.com/docs/api/marketing/forms) (`/submissions/v3/integration/submit/{portalId}/{formGuid}`) — adapt the `fetch()` body in `js/main.js` to HubSpot's `fields: [{name, value}]` shape.

### Option D — Plain email
Use a form-to-email service (Formspree, Basin, Getform): paste the service URL into `FORM_ENDPOINT`, or set it as the form's `action` attribute and remove the `fetch()` path.

**Until an endpoint is set**, submissions log the JSON payload to the browser console and show the success message, so the full UX can be reviewed.

### Photo upload
The form shows a **"Photo upload coming soon"** placeholder (`.upload-placeholder` in `index.html`). Enable it once your form backend supports attachments (Formspree/Basin support files; for Zapier/Airtable use a file-upload widget or reply-by-email flow). Replace the placeholder `div` with `<input type="file" name="photos" multiple accept="image/*">` and matching styles.

## Replace the placeholders

| Placeholder | Where | Replace with |
|---|---|---|
| Hero van mockup (SVG) | `index.html` → `.hero-van` | Real photo of a wrapped van: `<img src="assets/img/hero-van.jpg" alt="Wrapped HVAC service van in North Phoenix">` |
| Before/after boxes | `index.html` → `#before-after` → `.ba-placeholder` | Real before/after photos with descriptive alt text (section is `hidden` until then) |
| Phone number | Header, footer, mobile call bar, JSON-LD, van wrap textures | Set to (480) 788-8859 — update everywhere at once if it changes |
| Email | Footer (`hello@valleyfleetwraps.com`) | Real email |
| Street address | Footer ("Street address coming soon") + JSON-LD `address` | Real address |
| Canonical URL | `<link rel="canonical">` | Live domain |
| `og:image` | Commented in `<head>` | 1200×630 social share image |
| Analytics | Commented block before closing `</body>` | GA4 / GTM snippet |

## Editing tips

- **Colors** live as CSS variables at the top of `css/styles.css` (`--navy-*`, `--copper-*`, `--sand-*`).
- **Section order** — each section is a self-contained `<section id="…">` in `index.html`; reorder freely, nav anchors follow the `id`s.
- **Animations** — all scroll reveals hang off `data-reveal` / `data-reveal-group` attributes; add them to any new element to opt in.
- **Three.js scene** — tune colors and motion in `js/scene.js` (`COLORS` object, camera math in `tick()`). Delete the two `<script>` tags for three.js + `js/scene.js` to run without WebGL entirely.

## SEO notes

- Title/description target: *fleet wraps Deer Valley, commercial vehicle wraps North Phoenix, service van wraps Phoenix, contractor vehicle wraps Phoenix, HVAC fleet wraps Phoenix, plumbing van wraps Phoenix, truck wraps Deer Valley, fleet graphics Phoenix.*
- `LocalBusiness` JSON-LD is in `<head>` — update `telephone` and `address` when real details exist.
- One `<h1>` (hero), one `<h2>` per section; keep that hierarchy when adding content.
