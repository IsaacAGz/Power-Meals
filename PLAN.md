# Power Meals website plan

## Goal
Build a Clean Minimal, Spanish-language meal-prep site for an urban Mexican audience (Tijuana). Customers browse brand pages and submit an order form that opens WhatsApp with a prefilled message; payment is finalized offline via bank transfer.

## Stack (locked)
- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/postcss`, with brand tokens as CSS variables in `@theme`
- **Motion** (`motion/react`) for restrained scroll/hero motion
- **MapLibre GL JS** + **MapTiler** for the locations map
- Static/content-first pages; client interactivity only for nav mobile menu, order form, and map
- Hosting target: Vercel (default for Next.js)

## Brand system
- Name: **Power Meals**
- Logo mark: lightning bolt (`public/logo.svg`, not emoji-only in UI chrome)
- Banner: *Comida real. Energía real. Resultados reales.*
- Palette:
  - Ink / Black `#111111` (never pure `#000`)
  - Paper / White `#FFFFFF`
  - Cream `#F5F1E8`
  - Power Yellow `#F5C400` (single accent, site-wide)
  - Muted `#5E5A52` (AA on cream)
  - Line `rgba(17,17,17,0.08)`
- Visual direction: Clean Minimal — cream/black/yellow hierarchy, strong typography, full-bleed hero on Home, no card clutter in the hero, intentional motion (2–3: subtle fade/slide on hero, CTA hover, form feedback)
- Site language: **Spanish (Mexico)** throughout UI, nav, forms, and WhatsApp message templates
- Theme: **light only**, locked. No `dark:` variants.

### Design read and dials
Guided by `.agents/skills/design-taste-frontend` (primary), `minimalist-ui` (palette/borders/restraint), and motion curves from `high-end-visual-design` (glass/pill/double-bezel look is **not** adopted). Ignore `.cursor/skills/frontend-design.md` (unrelated resume agent).

- **Design read:** Local meal-prep brand site for an urban Tijuana audience. Clean Minimal language, Tailwind v4 utilities, restrained Motion, editorial food photography.
- **Dials:** `DESIGN_VARIANCE 6` / `MOTION_INTENSITY 4` / `VISUAL_DENSITY 3`
- **Palette note:** Cream `#F5F1E8` sits in the skill’s banned “premium beige” family; allowed here because the brand brief names it explicitly.

### Design system tokens
- Tokens in `app/globals.css` `@theme`: `--color-ink`, `--color-paper`, `--color-cream`, `--color-power`, `--color-muted`, `--color-line`
- **Type:** Cabinet Grotesk (`next/font/local`) for display; Geist for body; Geist Mono for prices. No Inter, no serif.
- **Shape lock:** buttons/inputs `6px` radius; cards/images/map frame `12px`. No pill buttons.
- **Icons:** `@phosphor-icons/react`, bold weight only.
- **Copy rules:** Spanish (MX); zero em-dashes; max 1 eyebrow per 3 sections; no invented stats.
- **Images:** food photography for hero, menú, and Nosotros (generate with image tool when available; otherwise labeled Picsum seed placeholders).

## Site map

| Route | Screen | Purpose |
|-------|--------|---------|
| `/` | Inicio | Brand hero, banner, CTA to menú / pedir, map teaser |
| `/nosotros` | Nosotros | About the brand and value prop |
| `/menu` | Menú y precios | Meal catalog + prices + CTA to order form |
| `/ubicaciones` | Ubicaciones | Delivery zones + pickup points (full MapLibre map) |
| `/proyectos` | Proyectos partners | Partner projects |
| `/pedido` | Pedido | Order + “pago” form → WhatsApp (`?zona=` / `?platillo=` prefill) |

Shared chrome: sticky header (logo + nav), footer (contact, WhatsApp link, short legal line).

## Page compositions
Each page uses its own mix of layouts; no two sections on the same page share a layout family.

### Inicio `/`
1. Asymmetric split hero: text left, full-bleed food image bleeding off the right edge, `min-h-[100dvh]`, one headline (banner), support line ≤ 20 words, primary CTA “Ver menú” + secondary “Pedir”.
2. “Cómo funciona” as asymmetric 2+1 with verb labels (Elige, Confirma por WhatsApp, Paga por transferencia). No “Paso 1” labels.
3. Menu teaser: horizontal scroll-snap row of dishes.
4. **Map teaser:** full-width map strip + floating panel linking to `/ubicaciones`.
5. Closing CTA band.

### Nosotros `/nosotros`
Editorial split with image, then value-prop in a 2-column layout (no 3 equal cards).

### Menú `/menu`
Category tabs + dish grid (image, name, price in mono). CTA passes selection to `/pedido?platillo=...`.

### Ubicaciones `/ubicaciones`
Full map explorer (see Map section).

### Proyectos `/proyectos`
Partner logo grid + short case rows.

### Pedido `/pedido`
Order form: labels above inputs, errors below; `zona` select prefilled from `?zona=`; loading / success / error states.

### Motion
Hero fade/slide, scroll reveal via Motion `whileInView`, `active:scale-[0.98]` on CTAs, form feedback. All gated with `useReducedMotion`.

## Design constraints (Home first viewport)
- Brand-first hero: Power Meals + lightning, one headline (banner), one short support line, one CTA group, one dominant full-bleed food/atmosphere visual
- No stats strips, floating badges, or card grids in the hero
- Cream background atmosphere + yellow accent CTAs; black type
- Hero top padding max `pt-24`; CTA visible without scroll

## Order → WhatsApp → bank transfer flow
1. User selects meals (from Menú or Pedido) and fills: nombre, teléfono, dirección o zona, detalle del pedido, notas, método preferido (entrega/recolección).
2. On submit, build a Spanish WhatsApp body with order summary and open:
   `https://wa.me/16196001137?text=<urlencoded>`
3. UI copy on the form explains that **pago se confirma por transferencia bancaria** after WhatsApp confirmation (show placeholder CLABE/banco fields as “te las enviaremos por WhatsApp” unless real bank details are provided later).
4. No online card gateway in v1.

WhatsApp business number (locked): **+1 619 600 1137** → `16196001137` in `wa.me`.

## Map: MapLibre GL JS + MapTiler

Shows **delivery coverage zones** (shaded polygons) and **pickup points** on `/ubicaciones`, plus a compact non-interactive teaser on Inicio. Centered on **Tijuana**.

```
lib/locations-data.ts ──► LocationsExplorer ──► BrandMap ──► MapTiler style + tiles
                      └──► MapTeaser ──────────┘
LocationsExplorer ──"Pedir en esta zona"──► /pedido?zona=slug
lib/map-style.ts (brand recolor) ──► BrandMap
```

### Packages and env
- `maplibre-gl`
- `NEXT_PUBLIC_MAPTILER_KEY` in `.env.local`; committed `.env.example`
- Restrict the MapTiler key to the site’s domains in the MapTiler dashboard

### Base style + brand recolor
- Base: MapTiler `dataviz-light` (`https://api.maptiler.com/maps/dataviz-light/style.json?key=...`)
- On `style.load`, `lib/map-style.ts` recolors layers:
  - Background / land: `#F5F1E8`
  - Water: `#E4DDCD`
  - Parks: `#ECE6D8`
  - Roads: `#FFFFFF`, casing `rgba(17,17,17,0.08)`
  - Labels: `#111111` at 0.75 opacity, halo cream; sans stack MapTiler supports
  - Hide POI, transit, building-extrusion layers

### Brand overlays
- **Zones:** fill `#F5C400` at 0.22 opacity (0.45 on hover/selection via `feature-state`); line `#111111` at 1.25px
- **Pickup points:** custom HTML markers — 12px-radius black square with yellow Phosphor `Lightning`
- **Popups / controls:** CSS overrides on `.maplibregl-popup-content`, `.maplibregl-ctrl-group`, attribution — cream/white, 12px radius, Geist, hairline border (no shadow). Keep MapTiler + OSM attribution visible (compact).

### Data (`lib/locations-data.ts`)
- Center: `[-117.038, 32.515]`, zoom 11
- Placeholder zones: Zona Río, Chapultepec, Hipódromo, Otay, Playas
- 1–2 pickup points
- All marked as editable placeholders

### Components
- **`components/map/BrandMap.tsx`** (`"use client"`): create map in `useEffect`, `map.remove()` on cleanup. Props: `interactive`, `cooperativeGestures`, `selectedZone`, `onZoneClick`. Use `jumpTo` instead of `flyTo` under reduced motion.
- **`components/map/LocationsExplorer.tsx`:** desktop list (left) + sticky map (right, `lg:grid-cols-[5fr_7fr]`); click flies/highlights; “Pedir en esta zona” per zone. Mobile: map on top `h-[60dvh]` + `cooperativeGestures`, list below.
- **`components/map/MapTeaser.tsx`:** `next/dynamic` (`ssr: false`), mount on scroll into view (IntersectionObserver). Non-interactive, zones only; cream panel “Entregamos en Tijuana” → link to Ubicaciones.
- **States:** cream skeleton while loading; if key missing / WebGL fails, fall back to zone list + WhatsApp (“Pregunta por tu zona”). Reserve space to avoid CLS.

## Implementation structure
- `app/layout.tsx` — fonts, metadata `es-MX`, brand CSS variables
- `app/globals.css` — tokens, map control overrides
- `app/page.tsx` — Home hero + map teaser
- `app/nosotros/page.tsx`
- `app/menu/page.tsx`
- `app/ubicaciones/page.tsx`
- `app/proyectos/page.tsx`
- `app/pedido/page.tsx` — form
- `components/Header.tsx`, `Footer.tsx`, `OrderForm.tsx`, `WhatsAppButton.tsx`
- `components/Reveal.tsx` — Motion scroll-reveal leaf
- `components/map/BrandMap.tsx`, `LocationsExplorer.tsx`, `MapTeaser.tsx`
- `lib/whatsapp.ts` — build `wa.me` URL + message template
- `lib/menu-data.ts` — placeholder meals/prices (editable later)
- `lib/map-style.ts` — MapTiler brand recolor
- `lib/locations-data.ts` — zones GeoJSON + pickup points
- `public/logo.svg` — lightning mark
- `.env.example` — `NEXT_PUBLIC_MAPTILER_KEY=`

## Pre-flight before shipping
Run the Section 14 checklist from `design-taste-frontend`, with focus on:
- Zero em-dashes; eyebrow count; hero fits viewport
- CTA contrast (black text on yellow); form contrast on cream
- Reduced motion; map attribution present
- Lighthouse LCP &lt; 2.5s

## Out of scope for v1
- Mercado Pago / Stripe / online card capture
- User accounts, admin CMS, inventory sync
- Real-time WhatsApp Business API (deep link only)
- Dark mode / system theme toggle
