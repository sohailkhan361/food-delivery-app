import { OrderStatus, OrderType, UserRole } from "@/generated/prisma/enums";

/**
 * The single source of truth for order lifecycle.
 *
 * Every client (customer web, restaurant dashboard, admin) and every API
 * route goes through `assertTransition`. Statuses are never assigned by
 * writing `status` directly — that is how four-sided marketplaces end up
 * with orders that are both DELIVERED and CANCELLED.
 */

type Actor = "CUSTOMER" | "STAFF" | "ADMIN" | "SYSTEM";

type Transition = {
  to: OrderStatus;
  actors: Actor[];
  /** Restrict to one fulfilment type, when the step only exists there. */
  orderType?: OrderType;
};

const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  PLACED: [
    { to: "ACCEPTED", actors: ["STAFF", "ADMIN"] },
    { to: "REJECTED", actors: ["STAFF", "ADMIN"] },
    // Free cancellation window: only before the kitchen commits.
    { to: "CANCELLED", actors: ["CUSTOMER", "ADMIN", "SYSTEM"] },
  ],
  ACCEPTED: [
    { to: "PREPARING", actors: ["STAFF", "ADMIN"] },
    { to: "CANCELLED", actors: ["ADMIN"] },
  ],
  PREPARING: [
    { to: "OUT_FOR_DELIVERY", actors: ["STAFF", "ADMIN"], orderType: "DELIVERY" },
    { to: "READY_FOR_PICKUP", actors: ["STAFF", "ADMIN"], orderType: "PICKUP" },
    { to: "CANCELLED", actors: ["ADMIN"] },
  ],
  OUT_FOR_DELIVERY: [{ to: "DELIVERED", actors: ["STAFF", "ADMIN"] }],
  READY_FOR_PICKUP: [{ to: "COLLECTED", actors: ["STAFF", "ADMIN"] }],

  // Terminal.
  DELIVERED: [],
  COLLECTED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const TERMINAL_STATUSES = (
  Object.keys(TRANSITIONS) as OrderStatus[]
).filter((s) => TRANSITIONS[s].length === 0);

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Statuses still live on the restaurant's queue. */
export const ACTIVE_STATUSES: OrderStatus[] = (
  Object.keys(TRANSITIONS) as OrderStatus[]
).filter((s) => !isTerminal(s));

export function actorForRole(role: UserRole): Actor {
  switch (role) {
    case "ADMIN":
      return "ADMIN";
    case "RESTAURANT_STAFF":
      return "STAFF";
    default:
      return "CUSTOMER";
  }
}

export function allowedTransitions(
  from: OrderStatus,
  actor: Actor,
  orderType: OrderType,
): OrderStatus[] {
  return TRANSITIONS[from]
    .filter((t) => t.actors.includes(actor))
    .filter((t) => !t.orderType || t.orderType === orderType)
    .map((t) => t.to);
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
  orderType: OrderType,
): boolean {
  return allowedTransitions(from, actor, orderType).includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
    readonly actor: Actor,
  ) {
    super(`${actor} cannot move an order from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
  orderType: OrderType,
): void {
  if (!canTransition(from, to, actor, orderType)) {
    throw new InvalidTransitionError(from, to, actor);
  }
}

/** Customer-facing copy. The dashboard uses its own, terser labels. */
export const CUSTOMER_STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Waiting for the restaurant to confirm",
  ACCEPTED: "Order confirmed",
  PREPARING: "Being prepared",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  COLLECTED: "Collected",
  REJECTED: "Declined by the restaurant",
  CANCELLED: "Cancelled",
};
