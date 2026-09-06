"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The cart is the only genuinely client-owned state in the app; everything
 * else is server data behind TanStack Query.
 *
 * Prices here are for OPTIMISTIC DISPLAY ONLY. Checkout sends ids and
 * quantities, and the server prices the order from its own menu rows.
 */

export type CartLine = {
  /** menuItemId + sorted option ids — same item, different add-ons = separate line. */
  key: string;
  menuItemId: string;
  name: string;
  unitPriceMinor: number;
  optionIds: string[];
  optionLabels: string[];
  optionDeltasMinor: number[];
  quantity: number;
  note?: string;
};

export type AddLineInput = Omit<CartLine, "key" | "quantity"> & {
  quantity?: number;
};

type CartState = {
  restaurantId: string | null;
  restaurantName: string | null;
  lines: CartLine[];
};

type CartActions = {
  /** Returns "conflict" when the cart holds another restaurant's items. */
  add: (
    restaurant: { id: string; name: string },
    line: AddLineInput,
  ) => "ok" | "conflict";
  /** Discard the old cart and start fresh at a new restaurant. */
  addForcingRestaurant: (
    restaurant: { id: string; name: string },
    line: AddLineInput,
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  setNote: (key: string, note: string) => void;
  remove: (key: string) => void;
  clear: () => void;
};

export function cartLineKey(menuItemId: string, optionIds: string[]): string {
  return [menuItemId, ...[...optionIds].sort()].join("|");
}

export function lineSubtotalMinor(line: CartLine): number {
  const perUnit =
    line.unitPriceMinor + line.optionDeltasMinor.reduce((s, d) => s + d, 0);
  return perUnit * line.quantity;
}

const EMPTY: CartState = { restaurantId: null, restaurantName: null, lines: [] };

function insert(lines: CartLine[], input: AddLineInput): CartLine[] {
  const key = cartLineKey(input.menuItemId, input.optionIds);
  const qty = input.quantity ?? 1;
  const existing = lines.find((l) => l.key === key);
  if (existing) {
    return lines.map((l) =>
      l.key === key ? { ...l, quantity: l.quantity + qty } : l,
    );
  }
  return [...lines, { ...input, key, quantity: qty }];
}

export const useCart = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      add: (restaurant, line) => {
        const { restaurantId } = get();
        if (restaurantId && restaurantId !== restaurant.id) return "conflict";
        set((s) => ({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          lines: insert(s.lines, line),
        }));
        return "ok";
      },

      addForcingRestaurant: (restaurant, line) =>
        set({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          lines: insert([], line),
        }),

      setQuantity: (key, quantity) =>
        set((s) => {
          const lines =
            quantity <= 0
              ? s.lines.filter((l) => l.key !== key)
              : s.lines.map((l) => (l.key === key ? { ...l, quantity } : l));
          return lines.length === 0 ? EMPTY : { ...s, lines };
        }),

      setNote: (key, note) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.key === key ? { ...l, note } : l)),
        })),

      remove: (key) =>
        set((s) => {
          const lines = s.lines.filter((l) => l.key !== key);
          return lines.length === 0 ? EMPTY : { ...s, lines };
        }),

      clear: () => set(EMPTY),
    }),
    { name: "fd.cart.v1", version: 1 },
  ),
);

/** Selectors — keep components from re-rendering on unrelated cart changes. */
export const selectItemCount = (s: CartState) =>
  s.lines.reduce((n, l) => n + l.quantity, 0);

export const selectSubtotalMinor = (s: CartState) =>
  s.lines.reduce((sum, l) => sum + lineSubtotalMinor(l), 0);
