# Power Meals

Source brief for a portfolio case study. Rewrite this in the portfolio's voice. Keep the facts. Do not add metrics, client quotes, revenue, or launch claims that are not in this document.

The runtime model for anyone changing the code is [`.cursor/rules/application.mdc`](./.cursor/rules/application.mdc). This file is the case-study source. When they disagree, follow the code.

## One-line summary

Spanish-language ordering site for a Tijuana meal-prep kitchen. Customers build plates or pick weekly packages, then place an order that the kitchen tracks. Live checkout is WhatsApp plus a bank transfer. Accounts, a kitchen dashboard, and a receipt tracker are part of the site. Card checkout is built and stays off.

## Role

I designed and built the product end to end: information architecture, visual system, plate builder, cart, accounts, order pipeline, kitchen board, map, and the print and notification outbox.

## The product

Power Meals is a local meal-prep brand in Tijuana, Baja California. The offer is weekly high-protein meals, cooked and packed so the customer heats and eats. The audience is urban and local: people training, working, and ordering in Spanish (Mexico).

The banner is: **Comida real. Energía real. Resultados reales.**

The first version was a static brand site whose only conversion was a `wa.me` link. The kitchen already sold through WhatsApp and a bank transfer, so the useful job was a complete, readable order instead of a blank "hola, quiero pedir." That path is still the live one. The current app keeps it and adds the records the kitchen needs: a priced cart, an order row, a status the customer can watch, and a board for the staff at each kitchen.

There is still no card charge on the live path, and no WhatsApp Business message to the customer until a template is approved. The business number on the public `wa.me` links is +1 619 600 1137. That link only opens a chat the customer starts. It is not how the site messages them after an order is paid.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Brand home. Full-viewport split hero, how ordering works, a menu strip, a map teaser, and a closing call to order. Copy switches when card payment is on. |
| `/nosotros` | Editorial about page. Origin story and what the kitchen cares about: local ingredients, protein, ready-for-the-week packaging, and proximity. |
| `/menu` | Menu of suggested plates, with filters. Each plate can start an order. Copy switches when card payment is on. |
| `/ubicaciones` | Map of the four kitchens. Choosing one flies the map there. Pickup at checkout uses these same kitchens. |
| `/proyectos` | Partner page for gyms, studios, and offices. Logo row and two case rows, plus a WhatsApp prompt for businesses that want to partner. |
| `/pedido` | Plate builder, suggested plates, POWER packages, cart, and checkout. |
| `/pedido/success`, `/pedido/cancel` | Sessionless receipt by `order_ref`. The success page shows each kitchen step and polls until the order is completed or cancelled. |
| `/ingresar`, `/registro`, `/cuenta`, `/historial` | Customer sign-in, registration, profile, and order history. |
| `/verificar` | Email confirmation link. Opening it signs the person in. |
| `/recuperar`, `/recuperar/nueva` | Password reset request and the one-time new-password page. |
| `/kitchen/dashboard` | Staff only, scoped to one kitchen. Marketing header and footer are hidden. |

Shared chrome: sticky header (logo, nav, persistent "Pedir" button, full-screen mobile menu), footer with the WhatsApp number, and a skip link.

## Ordering

The sellable catalog is not a list of fixed dishes. It is proteins, carb bases, portion sizes, suggested plates, and two package families, POWER Chicken and POWER Mix. Prices are integer cents in PostgreSQL. Checkout recomputes them on the server. The total shown in the browser is a preview.

A plate is base, protein, tamaño (Regular or Plus), estilo (Balanceado or Doble carb), and salsa (Roja or Verde). A new row opens with Regular, Balanceado, and Roja already selected. Confirmar stays disabled until base and protein are chosen too. Confirming adds one cart line at quantity 1 and leaves a new empty row underneath. A confirmed plate can change quantity (1–20) or be removed. The cart holds at most 30 lines.

Suggested plates sit under the builder. A few stay visible. The rest are behind "Ver más platillos," which expands with a height animation and a fade so the hidden rows do not cut off hard. Choosing one fills the open row. It does not add a line by itself. Packages stay on their own tab: 6, 10, or 15 meals, Regular or Plus. A package is one priced header plus a slot per meal.

Checkout is pickup only, at the four kitchens on the map: Zona Río, Otay, Plaza Monarca, and Rio Tijuana 3ra Etapa. "Entrega a domicilio" is visible and disabled. A posted delivery is rejected. The order is assigned to the kitchen of the pickup point.

Two ways an order is born:

- **Logged in, WhatsApp.** One transaction writes the order, frozen line items, a pending payment, and the first status event. Status is `ordered_whatsapp`. The cart is cleared. This is not paid and does not print.
- **Guest, WhatsApp.** Nothing is inserted. The checkout body is stored on that browser's session. Login or register on the same browser claims it, re-prices it, and inserts the order. A login on another device does not see it. If a line no longer resolves, the snapshot is dropped and the cart stays.
- **Card, only when Openpay is configured.** Status starts at `pending_payment`. The webhook re-fetches the charge. The first verified success sets `paid` and clears the cart. A WhatsApp order is never marked paid from that webhook. `POST /api/checkout` returns 503 while the keys are unset. Home, menu, footer, and the order page keep the transfer copy until both keys are set.

After a WhatsApp order, only a staff action moves it to paid. The path is `ordered_whatsapp` → `paid` → `preparing` → `ready` → `completed`. The customer sees the same steps on `/historial` and on the receipt link, without the phone number.

The first transition to `paid` writes one notification and one kitchen ticket in that same transaction. Email is used when the order has an address; otherwise WhatsApp. Later steps send nothing. If the mail sender or the queue is unset, the row is stored as `skipped`, and turning the channel on later does not message or print those old orders.

## Accounts

Passwords are Argon2id with a server-side pepper, minimum 10 characters. The session cookie is HttpOnly and SameSite=Strict and holds only the session id. Redis stores the session, the guest cart, and a guest WhatsApp snapshot, and slides them together.

Public registration requires a Cloudflare Turnstile token. A missing or failed token does not create a user. A new account is not signed in. Redis holds a single-use confirm link for 24 hours, and Amazon SES sends it. If the sender is unset or the send fails, the new user row is not kept. Login with the right password before the link is opened tells them to confirm. A wrong password stays a generic error. Opening the link marks the email confirmed and signs them in.

Password reset is only the email link. The request form requires Turnstile and always answers the same sentence, whether or not the address exists. The link lasts one hour, sets the new password once, marks the email confirmed, and signs them in.

Kitchen staff are a separate role, tied to one facility. Public registration creates customers only. Staff accounts are created with a script.

## Kitchen

`/kitchen/dashboard` loads only the staff member's facility. It polls every 10 seconds, pauses while the tab is hidden, and rolls back an optimistic status change the server rejects. The client sends the expected current status so a double click cannot skip a step. Staff see phone, fulfillment, notes, grams, style, and salsa.

The ticket is an 80mm Spanish receipt. A small Node daemon pulls one Amazon SQS queue, prints tickets for its own kitchen, and hands other kitchens' messages back. The queue has been verified against a local stand-in. A real AWS queue has not been exercised.

## What is real and what is still off

Say this plainly if the portfolio mentions content or launch. Do not present stand-ins as a live catalog, a client roster, or a production deploy.

- The catalog the app prices is seeded in PostgreSQL: seven proteins, five bases, nineteen suggested plates, and POWER Chicken / POWER Mix at 6, 10, and 15 meals. Regular plates start at $139 MXN and Plus at $179 MXN. Premium proteins add a per-plate upgrade. Food photography reuses stand-in images until a menu shoot.
- Partner names and case studies on `/proyectos` are placeholders, marked that way in the source.
- Map pins are the four kitchen coordinates. They have no street address, and the checkout choice does not invent one.
- Bank, CLABE, and account holder are intentionally absent. The kitchen sends those details on WhatsApp after the order.
- Card payment (Openpay) is implemented and off until merchant credentials exist. The site copy says transfer, not card.
- Delivery is shown and cannot be selected.
- Paid-order email needs `ORDER_EMAIL_FROM`. Paid-order WhatsApp needs an approved Spanish utility template and three Cloud API env vars. The kitchen printer needs `SQS_QUEUE_URL`. Each of those stays skipped until it is set.
- The app runs locally on Node, PostgreSQL, and Redis. Production cutover to EC2 and `powermeals.mx` is not done. The old Cloudflare static deploy is still in the repo and is not the current app.

## Tech stack

- **Next.js 16** App Router on **Node**, **React 19**, **TypeScript**. Not a static export.
- **Tailwind CSS v4** (`@tailwindcss/postcss`), brand tokens in `@theme`
- **Drizzle ORM** and **PostgreSQL** for the catalog, users, orders, payments, and status events
- **Redis** for sessions, guest carts, WhatsApp order snapshots, and one-time email tokens
- **Motion** (`motion/react`) for hero and scroll reveals, menu transitions, and the suggested-plate expand
- **MapLibre GL JS** with a **MapTiler** `dataviz-light` style, recolored to the brand
- **Phosphor Icons**, bold weight. Server components import `@phosphor-icons/react/dist/ssr`
- **Argon2id** (`@node-rs/argon2`) and a `PASSWORD_PEPPER`
- **Cloudflare Turnstile** on registration and password-reset requests
- **Amazon SES** for confirmation, reset, and paid-order email
- **Amazon SQS** and a separate Node print daemon (`packages/print-daemon`) for kitchen tickets
- **Openpay** redirect checkout and webhook, compiled in and left off
- **Fonts:** Cabinet Grotesk (local, display), Geist (body), Geist Mono (prices)
- Money is formatted with `Intl.NumberFormat` for `es-MX` from integer cents. Timezone is `America/Tijuana`.

`next/image` is used with `images.unoptimized: true`. Security headers, including the content security policy, are set from `next.config.ts`. The policy allows MapTiler and the Turnstile script and frame. `worker-src 'self' blob:` lets the MapLibre worker start.

## Visual system

Clean and minimal, light only. No dark mode.

- Ink `#111111` (not pure black), paper `#FFFFFF`, cream `#F5F1E8`, one accent: Power Yellow `#F5C400`
- Muted text `#5E5A52`, hairline borders at 8% and 16% ink
- Controls and inputs use a 6px radius. Cards, photos, and the map frame use 12px. No pills.
- Buttons are shared class strings in `lib/ui.ts`: yellow primary, ink outline secondary, ink dark. Press scales to 0.98. Hover on the yellow button deepens to `#E3B500`.
- Prices use tabular monospace.
- Motion is short and eased (`cubic-bezier(0.16, 1, 0.3, 1)`). Every animation checks `prefers-reduced-motion` and renders the final state immediately when it is on.
- Copy is Spanish (Mexico). UI chrome uses the lightning mark from `public/logo.svg`, not an emoji.

The home hero is a brand statement, not a dashboard: one headline, one short support line, two actions ("Ver menú", "Pedir"), and one full-bleed food photograph. No stat strip, no badge row, no card grid in the first viewport.

The order page has to stay usable on a phone. The builder, suggested plates, cart, and checkout are in normal document flow, so no part of the form sits under a fixed panel.

## Architecture

Marketing pages are server-rendered. Client JavaScript is limited to the interactions that need it: the mobile menu, the menu filters, the plate builder and cart, checkout, the map, auth forms, the receipt poll, and the kitchen board.

An order is one database transaction: `orders`, frozen `order_line_items`, one `payments` row, and the first `order_status_events` row. Package lines are one priced header plus zero-price slot rows. The kitchen is copied from the pickup point at that moment. Guest carts live in Redis. Logged-in carts live in Postgres. Login moves the guest cart onto the user.

Because the session cookie is SameSite=Strict, the Openpay return cannot use the session. The success and cancel pages load by `order_ref`. Openpay has one redirect URL; a failed charge is sent from the success page to the cancel page.

## Map

The locations page is a list plus a sticky map of the four kitchens. On desktop the list is on the left and the map fills the right column. On mobile the map sits on top at `60dvh` and the list follows. Mobile turns on MapLibre cooperative gestures so a vertical swipe still scrolls the page; the first gesture on the map asks for two fingers.

The home teaser does not load MapLibre until the section is within 300px of the viewport. It is non-interactive. A cream panel over the map links to `/ubicaciones`.

Markers are custom HTML: a 12px-radius black square with a yellow lightning icon. Selecting a kitchen highlights its marker and moves the camera. Reduced motion uses `jumpTo` instead of `flyTo`.

On `style.load`, `lib/map-style.ts` walks every MapTiler layer and repaints it: cream land, warm water and parks, white roads with hairline casings, ink labels with a cream halo. POI, transit, and building extrusions are hidden. If the MapTiler key is missing or WebGL fails, the same coordinates are drawn by an SVG fallback. The slot keeps its height so the page does not jump.

MapLibre's worker is copied into `public/maplibre` on install, dev, and build, and the map calls `setWorkerUrl` before `new Map()`. The worker files are gitignored because they come from `node_modules`.

## Experience from building it

These are the parts worth putting on a portfolio. They are decisions and problems, not a feature list.

### Keep the sale where the kitchen already is

The tempting version is a cart that charges a card and a chatbot that confirms it. The live version still ends in WhatsApp and a transfer, because that is how this kitchen gets paid. The app's job is to make that order complete before the chat starts, then keep a record: who it is for, which kitchen cooks it, and whether the transfer has been marked paid. Card checkout is written and switched off, so the copy on the site does not promise a payment the business cannot take yet.

### Price and assign the kitchen on the server

A plate is five choices, and a package is a header plus slots. The browser can preview a price. Checkout loads the catalog again and writes frozen line items, so a tampered total or a retired protein does not become the order. The kitchen is copied from the pickup point in the same transaction. Delivery is rejected even if someone posts it while the button is disabled.

### A guest can order without an account, and the order still has an owner

A guest checkout does not insert a row. It stores the body on that browser's session. Registering or signing in on the same browser re-prices it and creates the order. Registration itself does not sign anyone in: Turnstile, then a confirmation email, then the link. If the mail send fails, no user is kept. The receipt link works without a session, because the payment return cannot send the Strict cookie.

### One paid transition, one ticket, one message

Staff move a WhatsApp order to paid. That step sets `paid_at`, marks the payment succeeded, and writes the ticket and the customer message in the same transaction. A second click, a duplicate webhook, or a later status change does not print or message again. An unconfigured mail sender or queue is stored as skipped, so turning it on later does not flush a backlog.

### A map inside a bundler is its own project

MapLibre loads a web worker relative to its own module URL. Once Next bundles the library, that URL is wrong and the map dies quietly. The fix is a small Node script that copies the worker and the shared chunk it imports, plus `setWorkerUrl` before `new Map()`. Around that: dynamic import with `ssr: false`, a lazy home teaser, cooperative gestures on phones, `jumpTo` for reduced motion, React roots inside marker elements unmounted so React 19 does not warn during cleanup, a layer-walking recolor, a CSP that allows MapTiler and a same-origin worker, and an SVG fallback with the same coordinates.

### Accessibility is part of the motion and the forms

Reduced motion is checked in the reveal component, the menu filter, the suggested-plate expand, and the map camera. The header traps body scroll while the mobile menu is open and closes on Escape and on navigation. Form errors sit on the fields. The kitchen board and the receipt poll update in place. Focus rings are ink on cream. The skip link is the first thing in the page.

## Suggested portfolio framing

**Title:** Power Meals

**Subtitle:** Ordering platform for a Tijuana meal-prep kitchen, from plate builder to kitchen ticket

**Tags:** Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Redis, MapLibre

**Highlight three things:**

1. A plate builder that confirms one meal at a time, previews a price, and lets the server recompute the total and the kitchen at checkout. Pickup is the four kitchens on the map. Delivery cannot be submitted.
2. A WhatsApp order that is not paid until staff say so, then prints one ticket and sends one receipt message. Guests claim that order by signing in on the same browser.
3. A brand-recolored MapLibre map that lazy-loads, respects reduced motion, and falls back to a drawn map of the same four kitchens.

## Do not claim

- Live sales, traffic, conversion, or a launched client engagement
- That card payment is available to customers, or that a WhatsApp order is paid when it is placed
- That the site messages customers on WhatsApp today, or that a real kitchen printer has taken a ticket from AWS
- That delivery is available
- That the food photography, partner names, or case studies are final business assets
- A production deploy on EC2 or `powermeals.mx`
