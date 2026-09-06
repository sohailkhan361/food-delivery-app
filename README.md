# Food Delivery — MVP

Single-market food ordering: a customer web app and a restaurant dashboard on
one Next.js codebase, backed by Postgres.

Fulfilment is **restaurant self-delivery** — there is no driver app and no live
map. The restaurant marks an order out for delivery and their own person takes
it. Pickup orders are supported too.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind 4 + shadcn/ui (Base UI) |
| Server data | TanStack Query (polling) |
| Client state | Zustand (cart only, persisted) |
| Validation | Zod 4 — schemas shared by client and server |
| API | REST route handlers under `/api` |
| Database | PostgreSQL + Prisma 6 |
| Tests | Vitest (domain logic) |

## Getting started

```bash
npm install
cp .env.example .env          # set DATABASE_URL and SESSION_SECRET
npm run db:migrate            # apply schema
npm run db:seed               # 3 restaurants, 2 zones, demo accounts
npm run dev
```

Demo accounts (the sign-in page has one-click buttons):

| Role | Phone | Lands on |
|---|---|---|
| Customer | `+919000000001` | `/` |
| Merchant | `+919000000002` | `/dashboard` |
| Admin | `+919000000003` | `/dashboard` |

Seeded delivery postal codes: `560001`, `560025`, `560042` (Central, ₹29 fee,
₹149 minimum) and `560045`, `560080` (North, ₹49 fee, ₹199 minimum).

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm test` | Vitest (pricing + state machine) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Re-seed (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | Drop, re-migrate, re-seed |

## What works today

**Customer** — browse restaurants, menu with option groups and add-ons,
cart (one restaurant at a time, persisted), delivery or pickup, saved
addresses with zone resolution, server-priced checkout, order placement,
order tracking with a status timeline, order history, cancel while `PLACED`.

**Merchant** — live order queue (10s poll, audible alert on new orders),
accept with a prep time, reject with a reason, advance through the lifecycle,
menu CRUD, out-of-stock toggle, accepting-orders switch.

## Design decisions worth keeping

1. **Money is always an integer of minor units** (paise). Never a float.
   `src/lib/money.ts`.
2. **Pricing is server-authoritative.** `src/lib/orders/pricing.ts` is a pure
   function; `prepareOrder` in `src/lib/orders/service.ts` is the only path to
   a total, shared by `/api/orders/quote` and `/api/orders`. The client sends
   ids and quantities — never prices.
3. **One order state machine.** `src/lib/orders/status.ts` owns every legal
   transition and who may make it. Nothing writes `status` directly.
4. **Orders snapshot names and prices.** Menus change; order history must not.
5. **Menu rows are archived, never deleted** — orders reference them.
6. **Every mutation is idempotent.** Orders carry a client-generated
   `idempotencyKey`; a double submit returns the original order.
7. **Authorization lives in the data layer**, not in `proxy.ts`. Per the Next
   docs, Proxy is only an optimistic redirect; `requireStaffFor()` is the real
   check.
8. **Zone-based delivery fees, not routing APIs.** Flat fee per postal-code
   zone means no Distance Matrix bill and a predictable fee.
9. **Polling, not websockets.** Correct at this scale; swap for Ably/Pusher
   when merchants complain about lag.

## Known gaps before this can take real money

- **Auth is dev-grade.** `src/lib/auth.ts` signs a cookie but sends no OTP —
  anyone who knows a phone number can sign in. Replace with Clerk phone OTP.
- **No online payments.** COD only. `Payment` and `WebhookEvent` tables and the
  provider-agnostic `provider` column are in place; wire Razorpay or Stripe and
  set `PAYMENT_PROVIDER`.
- **No web push.** The dashboard alert only fires while the tab is open.
- **Opening hours are stored but not enforced** at checkout — only the
  `isAcceptingOrders` switch is.
- **The dashboard is single-restaurant.** Staff see their first linked
  restaurant; admins see the first active one.
- **No image uploads.** `imageUrl` accepts a URL; wire UploadThing/Cloudinary.
- **No E2E tests.** Domain logic is unit-tested; add Playwright on the happy path.
- One transitive `npm audit` high finding sits in `deepmerge-ts` via
  `@prisma/config` (a build-time dev dependency, not in the runtime bundle).

## Layout

```
prisma/schema.prisma          15 models, the data contract
prisma/seed.ts               idempotent dev seed
src/lib/
  money.ts                   minor-unit helpers
  db.ts                      Prisma singleton
  auth.ts                    session + guards (swap for Clerk)
  api.ts                     domain error -> HTTP mapping
  api-client.ts              typed fetch for client components
  contracts/                 Zod schemas shared client/server
  orders/
    pricing.ts + .test.ts    the only place a total is computed
    status.ts  + .test.ts    the order state machine
    service.ts               prepareOrder / placeOrder / transitions
  stores/cart.ts             Zustand cart
src/app/(shop)/              customer app
src/app/dashboard/           merchant app
src/app/api/                 REST handlers
src/proxy.ts                 Next 16 Proxy (was middleware)
```

## Next up

Phase 6–7 from the plan: Clerk phone OTP, a payment provider behind the
existing interface, web push for the dashboard, opening-hours enforcement at
checkout, and a Playwright happy-path test. Then a pilot with 3 restaurants in
one neighbourhood.
