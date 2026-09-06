# Food Delivery — MVP

A single-market food ordering platform: a **customer web app** and a
**restaurant merchant dashboard**, built on one Next.js codebase with a
PostgreSQL database.

Fulfilment is **restaurant self-delivery** — there is no driver app and no live
map tracking. The restaurant marks an order "out for delivery" and their own
person takes it. Pickup orders are supported too. This is a deliberate MVP cut:
it removes dispatch, driver onboarding, and GPS ingestion entirely, which is
the right trade for one neighbourhood and a handful of restaurants.

**Status:** feature-complete MVP. Type-clean, builds for production, 14 unit
tests passing, verified end to end. Not yet production-ready — see
[Known gaps](#known-gaps).

---

## Table of contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Detailed setup](#detailed-setup)
- [Database setup](#database-setup)
- [Database structure](#database-structure)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Architecture decisions](#architecture-decisions)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Known gaps](#known-gaps)
- [Roadmap](#roadmap)

---

## Screenshots

### Customer app

| Browse restaurants | Restaurant menu |
|---|---|
| ![Home](docs/screenshots/01-customer-home.png) | ![Menu](docs/screenshots/02-restaurant-menu.png) |

| Item options (required groups enforced) | Cart |
|---|---|
| ![Options](docs/screenshots/03-item-options.png) | ![Cart](docs/screenshots/04-cart.png) |

**Checkout** — the price breakdown is computed by the server, never the browser.

![Checkout](docs/screenshots/05-checkout.png)

| Order tracking | Order history |
|---|---|
| ![Tracking](docs/screenshots/06-order-tracking.png) | ![History](docs/screenshots/07-order-history.png) |

**Sign in** — one-click demo accounts in development.

![Sign in](docs/screenshots/08-sign-in.png)

### Merchant dashboard

**Live order queue** — polls every 10s, plays an audible alert on new orders,
accept with a prep time or reject with a reason.

![Queue](docs/screenshots/09-dashboard-queue.png)

| Menu manager (out-of-stock toggle) | Settings |
|---|---|
| ![Menu manager](docs/screenshots/10-dashboard-menu.png) | ![Settings](docs/screenshots/11-dashboard-settings.png) |

---

## Features

### Customer app (`/`)

- Browse active restaurants with open/closed state and prep-time estimate
- Restaurant menu grouped by category, with veg markers and out-of-stock state
- Item option groups — single-select (spice level) and multi-select (add-ons),
  with min/max rules enforced on both client and server
- Cart persisted to `localStorage`, scoped to one restaurant, with a
  "start a new cart" prompt when you add from a different one
- Delivery **or** pickup
- Saved addresses, automatically resolved to a delivery zone on save
- Server-priced checkout showing subtotal, packing, delivery, tax and total
- Minimum-order enforcement per zone
- Order placement with idempotency (a double-tap cannot create two orders)
- Order tracking page with a status timeline, polled every 15s until terminal
- Order history
- Cancel while the order is still `PLACED`

### Merchant dashboard (`/dashboard`)

- Live order queue, polled every 10s, tablet-first layout
- Audible alert + toast when a new order arrives (mutable)
- Accept with a prep time (10/15/20/30/45 min) or reject with a reason
- Advance through the lifecycle; the UI only offers legal transitions
- Menu manager — add categories and items, remove items (archived, not deleted)
- **Out-of-stock toggle** — the highest-frequency merchant action
- Accepting-orders switch (the merchant's panic button)

### Platform

- Phone-based sign-in with role routing (customer / merchant / admin)
- Append-only order audit trail for support
- COD settled automatically on delivery
- Health endpoint with database connectivity check

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router), React 19 | Both surfaces in one codebase and one deploy |
| Language | **TypeScript** | Types shared end to end |
| Styling | **Tailwind CSS 4** + shadcn/ui (Base UI) | Own the component code, no lock-in |
| Server data | **TanStack Query** | Caching, retries and polling for free |
| Client state | **Zustand** (persisted) | Cart only — the only genuinely client-owned state |
| Validation | **Zod 4** | One schema validates client form and server body |
| API | REST route handlers | Framework-agnostic; a future mobile app reuses it |
| Database | **PostgreSQL 14+** | Orders and payments need real transactions |
| ORM | **Prisma 6** | Best-in-class migrations and DX |
| Tests | **Vitest** | Fast, no config, pure domain logic |

---

## Quick start

Already have PostgreSQL running? Four commands:

```bash
npm install
cp .env.example .env     # then edit DATABASE_URL and SESSION_SECRET
npm run db:migrate
npm run db:seed
```

```bash
npm run dev
```

Open **http://localhost:3000** and sign in with a one-click demo account.

---

## Detailed setup

### 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | **20.9+** (22 LTS or 24 recommended) | `node -v` |
| npm | 10+ | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |

> Next 16 requires Node 20.9 or newer. Odd-numbered releases like Node 23 work
> but the ESLint toolchain warns about them — prefer Node 22 LTS or 24.

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```ini
DATABASE_URL="postgresql://YOUR_USER@localhost:5432/food_delivery_dev?schema=public"
SESSION_SECRET="any-long-random-string"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_CURRENCY="INR"
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Every variable is documented in [`.env.example`](.env.example). The auth,
payment, maps, upload and notification keys are all optional — the app runs
without them (cash on delivery, dev sign-in, no image uploads).

### 4. Set up the database

See [Database setup](#database-setup) below, then:

```bash
npm run db:migrate
```

This applies `prisma/migrations/` and generates the Prisma client into
`src/generated/prisma/`.

### 5. Seed sample data

```bash
npm run db:seed
```

Creates 2 delivery zones, 3 restaurants with full menus, 3 user accounts and
3 sample orders. The seed is **idempotent** — safe to re-run.

### 6. Run

```bash
npm run dev
```

| URL | Surface |
|---|---|
| http://localhost:3000 | Customer app |
| http://localhost:3000/dashboard | Merchant dashboard |
| http://localhost:3000/sign-in | Sign in (demo buttons) |
| http://localhost:3000/api/health | Health + DB check |

### 7. Demo accounts

The sign-in page has one-click buttons for each. No OTP is sent in development.

| Role | Phone | Lands on |
|---|---|---|
| Customer | `+919000000001` | `/` |
| Merchant | `+919000000002` | `/dashboard` |
| Admin | `+919000000003` | `/dashboard` |

**Tip:** open the customer app and the dashboard in two browser windows
(one in a private window) to watch an order move through the queue live.

### Seeded data

**Restaurants:** Tandoor House, Dosa Corner, Wok & Roll — all open 11:00–23:00,
closed Mondays.

**Delivery zones** (matched on postal code):

| Zone | Postal codes | Fee | Minimum order | ETA |
|---|---|---|---|---|
| Central | 560001, 560025, 560042 | ₹29 | ₹149 | 35 min |
| North | 560045, 560080 | ₹49 | ₹199 | 45 min |

Any other postal code is treated as outside the delivery area — useful for
testing the `OUT_OF_ZONE` path.

---

## Database setup

Pick whichever matches your machine.

### Option A — Local PostgreSQL on macOS (Homebrew)

```bash
brew install postgresql@14
```

```bash
brew services start postgresql@14
```

```bash
createdb food_delivery_dev
```

Your `DATABASE_URL` is then:

```ini
DATABASE_URL="postgresql://YOUR_MAC_USERNAME@localhost:5432/food_delivery_dev?schema=public"
```

Homebrew Postgres uses your macOS username with no password by default.
Find it with `whoami`.

### Option B — Docker

```bash
docker run --name food-delivery-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=food_delivery_dev -p 5432:5432 -d postgres:16
```

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/food_delivery_dev?schema=public"
```

### Option C — Hosted (Neon, Supabase, Railway)

Create a Postgres instance and paste its connection string. Most providers
require SSL:

```ini
DATABASE_URL="postgresql://user:password@host.region.aws.neon.tech/neondb?sslmode=require"
```

Neon is a good fit — its database branching gives you a throwaway database per
pull request.

### Applying the schema

```bash
npm run db:migrate
```

| Command | What it does |
|---|---|
| `npm run db:migrate` | Create + apply a migration (development) |
| `npm run db:push` | Push the schema without a migration (prototyping only) |
| `npm run db:seed` | Load sample data (idempotent) |
| `npm run db:reset` | **Drops everything**, re-migrates, re-seeds |
| `npm run db:studio` | Browse and edit data in Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |

For production, use `npx prisma migrate deploy` — it applies committed
migrations without prompting and never resets.

---

## Database structure

**17 models, 7 enums.** The schema lives in
[`prisma/schema.prisma`](prisma/schema.prisma).

### Entity relationships

```mermaid
erDiagram
    User ||--o{ Address : "saves"
    User ||--o{ Order : "places"
    User ||--o{ RestaurantStaff : "works as"

    Zone ||--o{ Address : "covers"
    Zone ||--o{ RestaurantZone : "served by"

    Restaurant ||--o{ RestaurantStaff : "employs"
    Restaurant ||--o{ RestaurantZone : "delivers to"
    Restaurant ||--o{ OpeningHours : "opens"
    Restaurant ||--o{ MenuCategory : "organises"
    Restaurant ||--o{ MenuItem : "sells"
    Restaurant ||--o{ Order : "fulfils"

    MenuCategory ||--o{ MenuItem : "groups"
    MenuItem ||--o{ OptionGroup : "configured by"
    OptionGroup ||--o{ Option : "offers"

    Order ||--|{ OrderItem : "contains"
    Order ||--o{ OrderStatusEvent : "audited by"
    Order ||--|| Payment : "settled by"
    Order }o--o| Address : "delivered to"

    OrderItem ||--o{ OrderItemOption : "customised by"
    OrderItem }o--o| MenuItem : "snapshot of"
    OrderItemOption }o--o| Option : "snapshot of"
```

### Tables

#### Identity

| Model | Purpose | Notes |
|---|---|---|
| **User** | Customers, staff and admins | `phone` unique; `role` drives routing; `authProviderId` reserved for Clerk |
| **Address** | Saved customer addresses | `zoneId` resolved at save time so checkout never guesses |

#### Geography

| Model | Purpose | Notes |
|---|---|---|
| **Zone** | A deliverable area | `postalCodes String[]`, flat `deliveryFeeMinor`, `minOrderMinor`, `etaMinutes` |

Zone-based fees avoid per-request Maps billing entirely. Swap for real routing
when you expand beyond one city.

#### Merchant

| Model | Purpose | Notes |
|---|---|---|
| **Restaurant** | A merchant | `isActive` (admin) vs `isAcceptingOrders` (merchant's panic switch) |
| **RestaurantStaff** | Who may act for a restaurant | Composite unique `(userId, restaurantId)`; the real authorization check |
| **RestaurantZone** | Which zones a restaurant serves | Join table |
| **OpeningHours** | Weekly hours | `dayOfWeek` 0=Sunday; `"HH:mm"` local time |

#### Menu

| Model | Purpose | Notes |
|---|---|---|
| **MenuCategory** | Menu section | Archived, never deleted |
| **MenuItem** | A dish | `isAvailable` = out-of-stock toggle; `isArchived` = removed from menu |
| **OptionGroup** | "Spice level", "Add-ons" | `selectionType`, `minSelect`, `maxSelect` |
| **Option** | One choice | `priceDeltaMinor` applied **per unit** |

#### Orders

| Model | Purpose | Notes |
|---|---|---|
| **Order** | The order | `orderNumber` human-readable; `idempotencyKey` unique; full price breakdown |
| **OrderItem** | A line | **Snapshots** `nameSnapshot` and `unitPriceMinor` |
| **OrderItemOption** | A chosen option on a line | Also snapshotted |
| **OrderStatusEvent** | Append-only audit trail | Every support conversation starts here |

#### Payments

| Model | Purpose | Notes |
|---|---|---|
| **Payment** | One per order | `provider` is a string, so the gateway choice isn't baked into the schema |
| **WebhookEvent** | Webhook de-duplication | Unique `(provider, externalId)` — a repeat delivery is a no-op |

### Enums

| Enum | Values |
|---|---|
| `UserRole` | `CUSTOMER`, `RESTAURANT_STAFF`, `ADMIN` |
| `StaffRole` | `OWNER`, `MANAGER`, `STAFF` |
| `OrderType` | `DELIVERY`, `PICKUP` |
| `OrderStatus` | `PLACED`, `ACCEPTED`, `PREPARING`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `COLLECTED`, `REJECTED`, `CANCELLED` |
| `PaymentMethod` | `ONLINE`, `COD` |
| `PaymentStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| `OptionSelectionType` | `SINGLE`, `MULTIPLE` |

### Order state machine

Defined once in [`src/lib/orders/status.ts`](src/lib/orders/status.ts). Nothing
writes `status` directly — every change goes through `assertTransition`.

```mermaid
stateDiagram-v2
    [*] --> PLACED
    PLACED --> ACCEPTED : staff
    PLACED --> REJECTED : staff (with reason)
    PLACED --> CANCELLED : customer
    ACCEPTED --> PREPARING : staff
    PREPARING --> OUT_FOR_DELIVERY : staff (delivery)
    PREPARING --> READY_FOR_PICKUP : staff (pickup)
    OUT_FOR_DELIVERY --> DELIVERED : staff
    READY_FOR_PICKUP --> COLLECTED : staff
    DELIVERED --> [*]
    COLLECTED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
```

A customer may cancel **only** while `PLACED` — once the kitchen commits, only
an admin can cancel. `PLACED → DELIVERED` is rejected with a `409`.

### Money

Every monetary column is an **integer of minor units** (paise, cents) and named
`*Minor`. Floats are never used for money. Helpers live in
[`src/lib/money.ts`](src/lib/money.ts).

`₹249.00` is stored as `24900`.

---

## Project structure

```
food-delivery-app/
├── prisma/
│   ├── schema.prisma              17 models — the data contract
│   ├── migrations/                committed SQL migrations
│   └── seed.ts                    idempotent development seed
├── docs/screenshots/              images used by this README
├── src/
│   ├── app/
│   │   ├── (shop)/                CUSTOMER APP
│   │   │   ├── page.tsx                   restaurant list
│   │   │   ├── restaurants/[slug]/        menu
│   │   │   ├── cart/                      cart
│   │   │   ├── checkout/                  checkout
│   │   │   └── orders/[orderNumber]/      tracking
│   │   ├── dashboard/             MERCHANT APP
│   │   │   ├── page.tsx                   live order queue
│   │   │   ├── menu/                      menu manager
│   │   │   └── settings/                  restaurant settings
│   │   ├── api/                   REST route handlers
│   │   ├── sign-in/
│   │   ├── layout.tsx             root layout
│   │   └── providers.tsx          TanStack Query provider
│   ├── components/
│   │   ├── ui/                    shadcn/ui primitives
│   │   ├── shop/                  customer components
│   │   └── dashboard/             merchant components
│   ├── lib/
│   │   ├── db.ts                  Prisma singleton
│   │   ├── money.ts               minor-unit helpers
│   │   ├── auth.ts                session + authorization guards
│   │   ├── api.ts                 domain error → HTTP mapping
│   │   ├── api-client.ts          typed fetch for client components
│   │   ├── use-session.ts
│   │   ├── contracts/             Zod schemas shared client/server
│   │   ├── orders/
│   │   │   ├── pricing.ts         THE only place a total is computed
│   │   │   ├── pricing.test.ts
│   │   │   ├── status.ts          THE order state machine
│   │   │   ├── status.test.ts
│   │   │   ├── service.ts         prepareOrder / placeOrder / transitions
│   │   │   └── order-number.ts
│   │   └── stores/cart.ts         Zustand cart
│   ├── generated/prisma/          generated client (gitignored)
│   └── proxy.ts                   Next 16 Proxy (formerly middleware.ts)
├── .env.example
└── vitest.config.ts
```

---

## API reference

All endpoints return JSON. Errors use a single envelope:

```json
{ "error": { "code": "BELOW_MINIMUM", "message": "Add ₹89.00 more…", "fields": {} } }
```

### Public

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Liveness + database check |
| `GET` | `/api/restaurants` | Active restaurants |
| `GET` | `/api/restaurants/[slug]` | Full menu with option groups |
| `GET` | `/api/zones/resolve?postalCode=` | Is this postal code deliverable? |

### Auth

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Dev sign-in by phone (no OTP) |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/me` | Current user + linked restaurant |

### Customer (requires session)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` `POST` | `/api/addresses` | List / create addresses |
| `POST` | `/api/orders/quote` | **Server-priced preview** — creates nothing |
| `GET` `POST` | `/api/orders` | History / place an order |
| `GET` | `/api/orders/[orderNumber]` | Order detail + timeline |
| `POST` | `/api/orders/[orderNumber]/cancel` | Cancel while `PLACED` |

### Merchant (requires staff or admin)

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/dashboard/orders` | Live queue (`?scope=active\|today`) |
| `POST` | `/api/dashboard/orders/[id]/accept` | Accept with `prepMinutes` |
| `POST` | `/api/dashboard/orders/[id]/reject` | Reject with `reason` |
| `POST` | `/api/dashboard/orders/[id]/advance` | Advance status |
| `GET` | `/api/dashboard/menu` | Restaurant + full menu |
| `POST` | `/api/dashboard/menu/categories` | Create category |
| `POST` | `/api/dashboard/menu/items` | Create item |
| `PATCH` `DELETE` | `/api/dashboard/menu/items/[id]` | Update / archive |
| `PATCH` | `/api/dashboard/menu/items/[id]/availability` | Out-of-stock toggle |
| `PATCH` | `/api/dashboard/restaurant` | Accepting-orders switch, fees |

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION` | 422 | Zod rejected the body; `fields` says which |
| `UNAUTHORIZED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Signed in, wrong role |
| `NOT_FOUND` | 404 | Missing, or not yours |
| `CLOSED` | 409 | Restaurant is not accepting orders |
| `OUT_OF_ZONE` | 409 | Address is not deliverable |
| `BELOW_MINIMUM` | 409 | Under the zone's minimum order |
| `ITEM_UNAVAILABLE` | 409 | An item went out of stock |
| `OPTION_COUNT` | 400 | Option group min/max violated |
| `INVALID_TRANSITION` | 409 | Illegal status change |
| `PAYMENT_DISABLED` | 409 | Online payment not enabled |

---

## Architecture decisions

These are load-bearing. Change them deliberately.

1. **Money is an integer of minor units.** Never a float. `0.1 + 0.2` problems
   become customer refunds.

2. **Pricing is server-authoritative.**
   [`pricing.ts`](src/lib/orders/pricing.ts) is a pure, tested function.
   `prepareOrder()` in [`service.ts`](src/lib/orders/service.ts) is the single
   path to a total, shared by `/api/orders/quote` and `/api/orders` — so the
   price shown can never drift from the price charged. The client sends item
   ids and quantities; it never sends prices.

3. **One order state machine.** [`status.ts`](src/lib/orders/status.ts) owns
   every legal transition and which actor may make it. This is how four-sided
   marketplaces avoid orders that are both delivered and cancelled.

4. **Orders snapshot names and prices.** Menus get renamed and repriced daily;
   order history must not change retroactively.

5. **Menu rows are archived, never deleted.** Existing orders reference them.

6. **Every order carries an idempotency key.** A double-tapped "Place order"
   returns the original order instead of creating a second one. Concurrent
   submits are resolved by a unique constraint, not by luck.

7. **Authorization lives in the data layer.** `proxy.ts` (Next 16's renamed
   middleware) only does an optimistic redirect — the Next docs are explicit
   that Proxy must not be the authorization solution. `requireStaffFor()` is
   the real check, and it runs on every merchant read and write.

8. **Zone-based delivery fees, not routing APIs.** A flat fee per postal-code
   zone means no Distance Matrix bill, a predictable fee, and no ETA-accuracy
   problem. Swap for real routing at city number two.

9. **Polling, not websockets.** 10s on the dashboard, 15s on tracking, stopping
   at terminal statuses. Correct at this scale; move to Ably/Pusher when
   merchants complain about lag, not before.

---

## Testing

```bash
npm test
```

14 unit tests covering the two things that must not break — the pricing engine
and the state machine:

- options priced per unit, not per line
- tax applies to goods + packing, never to the delivery fee
- discounts capped at subtotal so a total can never go negative
- no delivery fee on pickup
- delivery without a resolved zone is refused
- minimum order measured against goods, not fees
- customers can cancel only before the kitchen commits
- the ready step routes by fulfilment type
- terminal statuses are truly terminal
- `PLACED → DELIVERED` is rejected

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
```

---

## Troubleshooting

**`Can't reach database server at localhost:5432`**
Postgres isn't running. `brew services start postgresql@14`, or start your
Docker container.

**`Environment variable not found: DATABASE_URL`**
You skipped `cp .env.example .env`, or the file is outside the project root.

**`SESSION_SECRET is not set`**
Add it to `.env`. Any long random string works in development.

**`Invalid username or token` on `git push`**
GitHub removed password auth. Use an SSH key or a fine-grained Personal
Access Token.

**Prisma types look stale after editing the schema**
```bash
npm run db:generate
```

**`useSearchParams() should be wrapped in a suspense boundary`**
A client component reading search params needs a `<Suspense>` parent — see
`src/app/sign-in/page.tsx` for the pattern.

**Route types out of date after adding a page**
```bash
npx next typegen
```

**Want a completely clean database**
```bash
npm run db:reset
```

---

## Known gaps

Honest list of what stands between this and taking real money.

| Gap | Detail |
|---|---|
| **Auth is dev-grade** | `src/lib/auth.ts` signs a session cookie but sends **no OTP** — anyone who knows a phone number can sign in. Replace with Clerk phone OTP before any public deployment. |
| **No online payments** | COD only. The `Payment` and `WebhookEvent` tables and the provider-agnostic `provider` column are ready; the gateway choice (Razorpay for India, Stripe elsewhere) is still open. |
| **No web push** | The dashboard alert only fires while the tab is open. A merchant who closes the tab misses orders. |
| **Opening hours not enforced** | Stored and editable, but checkout only honours the `isAcceptingOrders` switch. |
| **Single-restaurant dashboard** | Staff see their first linked restaurant; admins see the first active one. No restaurant switcher. |
| **No image uploads** | `imageUrl` accepts a URL; wire UploadThing or Cloudinary. |
| **No E2E tests** | Domain logic is unit-tested; add Playwright on the happy path. |
| **No admin console** | Admin is a role, not a screen. Restaurant onboarding is done via the seed or Prisma Studio. |
| **npm audit finding** | One transitive high in `deepmerge-ts` via `@prisma/config` — a build-time dev dependency, not in the runtime bundle. |

---

## Roadmap

**Phase 6 — production auth and payments**
Clerk phone OTP · Razorpay or Stripe behind the existing interface · idempotent
webhook handling · refunds

**Phase 7 — merchant reliability**
Web Push so alerts survive a closed tab · opening-hours enforcement · restaurant
switcher · staff invitations

**Phase 8 — ops**
Admin console for onboarding, refunds and intervention · payouts report ·
Sentry + PostHog

**Phase 9 — pilot**
Playwright happy path · load-test order placement · rate limiting · then
**3 real restaurants in one neighbourhood** before any marketing

**Later, in rough order**
Live tracking with a driver mobile-web page → promo codes → reviews →
scheduled orders → native apps (the REST API is already suitable) →
second city

---

## Licence

Private / unlicensed.
