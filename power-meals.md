# Power Meals

Source brief for a portfolio case study. Rewrite this in the portfolio's voice. Keep the facts. Do not add metrics, client quotes, revenue, or launch claims that are not in this document.

## One-line summary

Spanish-language marketing and ordering site for a Tijuana meal-prep kitchen. Customers browse the menu and pickup points, then send a fully written order to WhatsApp. Payment happens later by bank transfer, not on the site.

## Role

I designed and built the site end to end: information architecture, visual system, page layouts, order flow, map, and the static deployment.

## The product

Power Meals is a local meal-prep brand in Tijuana, Baja California. The offer is weekly high-protein meals, cooked and packed so the customer heats and eats. The audience is urban and local: people training, working, and ordering in Spanish (Mexico).

The banner is: **Comida real. Energía real. Resultados reales.**

The site does not pretend to be an app, a marketplace, or an online store. It is a brand site with one conversion path:

1. Choose dishes, or choose a pickup point.
2. Fill a short order form.
3. The form opens WhatsApp with the order already written: name, phone, delivery or pickup, line items, estimated total in MXN, and notes.
4. The kitchen confirms availability in chat and sends bank details there.
5. The order is confirmed when the transfer arrives.

There is no card checkout, no account, and no WhatsApp Business API. `wa.me` deep links are the integration. The business number is +1 619 600 1137.

That constraint is the product decision. A meal-prep kitchen in Tijuana already sells through WhatsApp and transfer. The site's job is to make that conversation start with a complete, readable order instead of a blank "hola, quiero pedir."

## Pages

| Route | What it does |
| --- | --- |
| `/` | Brand home. Full-viewport split hero, how ordering works, a horizontal menu strip, a map teaser, and a closing call to order. |
| `/nosotros` | Editorial about page. Origin story and what the kitchen cares about: local ingredients, protein, ready-for-the-week packaging, and proximity. |
| `/menu` | Menu and prices. Category tabs (all, high protein, balanced, light, breakfast). Each dish links into the order form with that dish preselected. |
| `/ubicaciones` | Pickup explorer. A list of drop-off points beside a MapLibre map of Tijuana. Choosing a point flies the map there. "Recoger en este punto" opens the order form in pickup mode. |
| `/proyectos` | Partner page for gyms, studios, and offices. Logo row and two case rows, plus a WhatsApp prompt for businesses that want to partner. |
| `/pedido` | The order form, with the payment explanation beside it on desktop and below it on mobile. |

Shared chrome: sticky header (logo, nav, persistent "Pedir" button, full-screen mobile menu), footer with the WhatsApp number, and a skip link.

Deep links carry context so people do not retype what they already chose:

- `/pedido?platillo=salmon-quinoa` adds that dish at quantity 1.
- `/pedido?zona=zona-rio` preselects the delivery zone.
- `/pedido?punto=recoleccion-playas` switches the form to pickup and selects that point.

## What is real and what is still placeholder

Say this plainly if the portfolio mentions content. Do not present placeholders as a live catalog or a client roster.

- Menu names, descriptions, prices, and food photography are an editable stand-in catalog in `lib/menu-data.ts`. Eight dishes, four categories, prices in MXN.
- Partner names and case studies on `/proyectos` are stand-ins, marked that way in the source.
- Pickup addresses, hours, and coordinates are stand-in points in Tijuana (Zona Río and Playas).
- Delivery zones (Zona Río, Chapultepec, Hipódromo, Otay, Playas de Tijuana) and their delivery days are real product structure, used by the order form. They are no longer drawn on the map.
- Bank, CLABE, and account holder are intentionally absent. The form says those details are sent on WhatsApp after confirmation.

## Tech stack

- **Next.js 16** App Router, **React 19**, **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/postcss`), brand tokens in `@theme`
- **Motion** (`motion/react`) for hero and scroll reveals, menu transitions, and form state changes
- **MapLibre GL JS** with a **MapTiler** `dataviz-light` style, recolored to the brand
- **Phosphor Icons**, bold weight. Server components import `@phosphor-icons/react/dist/ssr`
- **Fonts:** Cabinet Grotesk (local, display), Geist (body), Geist Mono (prices)
- **Static export** (`output: "export"`) deployed as **Cloudflare Workers static assets** via Wrangler. The build writes `out/`, and `wrangler.jsonc` serves that directory. Node 22.
- Content lives in typed modules (`lib/menu-data.ts`, `lib/locations-data.ts`, `lib/whatsapp.ts`). No CMS, no database, no API routes.

`next/image` is used for layout and `sizes`, with `images.unoptimized: true`, because the image optimizer needs a server and this deploy is a folder of static files. The favicon is generated with `next/og` `ImageResponse` and `dynamic = "force-static"`: black square, yellow lightning bolt.

## Visual system

Clean and minimal, light only. No dark mode.

- Ink `#111111` (not pure black), paper `#FFFFFF`, cream `#F5F1E8`, one accent: Power Yellow `#F5C400`
- Muted text `#5E5A52`, hairline borders at 8% and 16% ink
- Controls and inputs use a 6px radius. Cards, photos, and the map frame use 12px. No pills.
- Buttons are shared class strings in `lib/ui.ts`: yellow primary, ink outline secondary, ink dark. Press scales to 0.98. Hover on the yellow button deepens to `#E3B500`.
- Prices use tabular monospace and `Intl.NumberFormat` for `es-MX`.
- Motion is short and eased (`cubic-bezier(0.16, 1, 0.3, 1)`). Every animation checks `prefers-reduced-motion` and renders the final state immediately when it is on.
- Copy is Spanish (Mexico). UI chrome uses the lightning mark from `public/logo.svg`, not an emoji.

The home hero is a brand statement, not a dashboard: one headline, one short support line, two actions ("Ver menú", "Pedir"), and one full-bleed food photograph. No stat strip, no badge row, no card grid in the first viewport.

## Architecture

Most of the site is server-rendered static HTML. Client JavaScript is limited to four islands:

- `Header` for the mobile menu
- `MenuBrowser` for category tabs
- `OrderForm` for validation and the WhatsApp handoff
- `BrandMap` / `LocationsExplorer` / `MapTeaser` for the map

`Reveal` is a small Motion wrapper. `onMount` fades the hero in on load. Everything else uses `whileInView` once, at 25% visibility.

The order message is built in `lib/whatsapp.ts`, separate from the form, so the Spanish template and the MXN total have one definition. A general question, a pickup question, and a partner inquiry each have their own template and button.

## Map

The locations page is a list plus a sticky map. On desktop the list is on the left and the map fills the right column. On mobile the map sits on top at `60dvh` and the list follows. Mobile turns on MapLibre cooperative gestures so a vertical swipe still scrolls the page; the first gesture on the map asks for two fingers.

The home teaser does not load MapLibre until the section is within 300px of the viewport (`IntersectionObserver`). It is non-interactive. A cream panel over the map links to `/ubicaciones`. Padding shifts with viewport width so the panel does not cover the pins.

Pickup markers are custom HTML: a 12px-radius black square with a yellow lightning icon, rendered with `createRoot` because MapLibre markers are DOM nodes, not React children. Popups show name, address, and hours. Selecting a point in the list highlights its marker and moves the camera. Reduced motion uses `jumpTo` instead of `flyTo`.

On `style.load`, `lib/map-style.ts` walks every MapTiler layer and repaints it: cream land, warm water and parks, white roads with hairline casings, ink labels with a cream halo. POI, transit, and building extrusions are hidden. Popup and zoom-control CSS in `globals.css` removes MapLibre's default shadow and matches the type and radius of the rest of the site. MapTiler and OpenStreetMap attribution stay visible.

If the MapTiler key is missing or WebGL fails, the same coordinates are drawn by `ZonesSketch`, a small SVG projection, with a WhatsApp link to ask about another pickup point. The slot keeps its height so the page does not jump.

## Order form

Fields: name, phone (at least 10 digits), delivery or pickup, zone plus street address or pickup point, dish quantities from 0 to 20, optional notes.

Validation is inline. The first invalid field is focused. Submitting builds the message, opens it in a new tab, and swaps the form for a confirmation. If the browser blocks the popup, the UI says so and keeps a direct WhatsApp link with the same prefilled text, so the order is not lost. A "Nuevo pedido" action clears quantities and notes and returns to the form.

Beside the form, three steps explain the offline payment: send the WhatsApp message, receive the bank details, then schedule delivery or pickup once the transfer lands. The page states outright that the site does not charge cards.

## Security headers

`public/_headers` is served with the static files:

- `nosniff`, `DENY` framing, strict referrer, HSTS, and a locked-down permissions policy (no camera, microphone, or geolocation)
- Content Security Policy locked to `'self'`, with MapTiler allowed for images and `connect-src`, and `worker-src 'self' blob:` so the MapLibre worker can start

## Experience from building it

These are the parts worth putting on a portfolio. They are decisions and problems, not a feature list.

### Match the business, then build the interface

The tempting version of this site is a cart and a payment provider. The useful version is a message the kitchen can read in WhatsApp. I kept scope there: no accounts, no inventory sync, no card gateway, no chatbot API. The form's success state is "your message is ready," and the page explains that money moves by transfer afterward. That is a product decision a portfolio should show, because it is why the site is small enough to be static and still complete.

### Static export changes what "Next.js" means

The plan started with a normal Next.js server. Shipping on Cloudflare Workers static assets required `output: "export"`. That removed the image optimizer, server actions, and any runtime Node code. I treated that as a design constraint: pages stay as React server components that compile to HTML, client components stay few, and images are ordinary files with explicit `sizes`. The favicon still uses `ImageResponse`, but only because it is forced static at build time. Forgetting the Wrangler assets config (`directory: "./out"`) was enough to make a finished build undeployable. The deploy target has to be part of the app design, not a last step.

### A map inside a bundler is its own project

MapLibre loads a web worker relative to its own module URL. Once Next bundles the library, that URL is wrong and the map dies quietly. The fix is operational, not cosmetic: a small Node script copies `maplibre-gl-worker.mjs` and the shared chunk it imports into `public/maplibre` on install, dev, and build, and the map calls `setWorkerUrl` before `new Map()`. The worker files are gitignored because they come from `node_modules`.

Around that, the map had to behave like the rest of the site:

- Dynamic `import()` and `ssr: false`, because MapLibre touches `window` and WebGL.
- Lazy mount on the home page so the hero does not pay for a map.
- Cooperative gestures on phones.
- `jumpTo` when the user prefers reduced motion.
- React roots inside marker elements, unmounted on a microtask during cleanup so React 19 does not warn while the map is being destroyed.
- A CSS pass and a layer-walking recolor, because the stock MapTiler style would have been a different brand in the middle of the page.
- A CSP that allows MapTiler tiles and a same-origin worker. A strict `default-src 'self'` without those exceptions looks secure and breaks the map.
- An SVG fallback using the same coordinates, so a missing API key or a failed WebGL context still shows the pickup points.

### Simplify the map when the action changes

The first map drew shaded delivery polygons for five zones. After using it, the clearer action was pickup: two points, a list, and a link that opens the order form already set to that point. I removed the polygons, the zone hover state, and the GeoJSON overlay. Zones stayed in the order form, where they answer "where do you deliver, and on which days?" The map answers a different question: "where do I pick up?" Splitting those jobs made both screens shorter. The deleted code was the point.

### Accessibility is part of the motion and the form

Reduced motion is checked in the reveal component, the menu filter, the form's success swap, and the map camera. The header traps body scroll while the mobile menu is open and closes on Escape and on navigation. The menu uses a tab pattern. Form errors sit on the fields, and the result panel is an `aria-live` region. Focus rings are ink on cream. The skip link is the first thing in the page. None of this is a separate "a11y pass." It is how the interactions were written.

### A small design system beats restyling every page

Tokens live in Tailwind v4 `@theme`: colors, two radii, the easing curve, and the three font roles. Buttons are three exported class strings. Pages compose those, so a yellow button on the home page and a yellow button on the order form are the same control. The palette is intentionally narrow. Cream, ink, and one yellow are enough for a food brand if type scale and photography do the work. I kept the hero free of cards and kept partner marks as simple geometric SVG shapes instead of fake logos.

### Content as data, with an honest boundary

Dishes, zones, pickup points, and message templates are typed TypeScript. Adding a dish is a data edit, and the menu page, the home strip, and the order form all read that list. I did not build a CMS for a catalog that is still being written. The portfolio should not imply this is a production menu or a signed partner list. The engineering is the system those real values can drop into.

## Suggested portfolio framing

**Title:** Power Meals

**Subtitle:** Brand site and WhatsApp ordering for a Tijuana meal-prep kitchen

**Tags:** Next.js, React, TypeScript, Tailwind CSS, MapLibre, static deployment, Cloudflare

**Highlight three things:**

1. An order form that writes the WhatsApp message, including dish, zone, and pickup deep links, and still works when the popup is blocked.
2. A brand-recolored MapLibre map that lazy-loads, respects reduced motion, and falls back to a drawn map of the same points.
3. A static Next.js site on Cloudflare, with the image pipeline, worker bundling, and content security policy adjusted for a folder of files instead of a Node server.

## Do not claim

- Live sales, traffic, conversion, or a launched client engagement
- Online payments, user accounts, or a real-time WhatsApp integration
- That the menu, prices, partners, or pickup addresses are final business data
- A custom backend or CMS
