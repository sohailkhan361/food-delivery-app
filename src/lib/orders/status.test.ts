import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  allowedTransitions,
  assertTransition,
  canTransition,
  InvalidTransitionError,
  isTerminal,
} from "./status";

describe("order state machine", () => {
  it("lets staff accept or reject a new order", () => {
    expect(allowedTransitions("PLACED", "STAFF", "DELIVERY").sort()).toEqual([
      "ACCEPTED",
      "REJECTED",
    ]);
  });

  it("lets a customer cancel only before the kitchen commits", () => {
    expect(canTransition("PLACED", "CANCELLED", "CUSTOMER", "DELIVERY")).toBe(true);
    expect(canTransition("PREPARING", "CANCELLED", "CUSTOMER", "DELIVERY")).toBe(false);
  });

  it("routes the ready step by fulfilment type", () => {
    expect(canTransition("PREPARING", "OUT_FOR_DELIVERY", "STAFF", "DELIVERY")).toBe(true);
    expect(canTransition("PREPARING", "OUT_FOR_DELIVERY", "STAFF", "PICKUP")).toBe(false);
    expect(canTransition("PREPARING", "READY_FOR_PICKUP", "STAFF", "PICKUP")).toBe(true);
  });

  it("never lets an order leave a terminal status", () => {
    for (const status of ["DELIVERED", "COLLECTED", "REJECTED", "CANCELLED"] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(allowedTransitions(status, "ADMIN", "DELIVERY")).toEqual([]);
    }
  });

  it("forbids skipping straight from PLACED to DELIVERED", () => {
    expect(() => assertTransition("PLACED", "DELIVERED", "STAFF", "DELIVERY")).toThrow(
      InvalidTransitionError,
    );
  });

  it("keeps only live statuses on the queue", () => {
    expect(ACTIVE_STATUSES).toContain("PLACED");
    expect(ACTIVE_STATUSES).not.toContain("DELIVERED");
  });
});
