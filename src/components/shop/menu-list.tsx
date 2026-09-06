"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { useCart, type AddLineInput } from "@/lib/stores/cart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type MenuOption = {
  id: string;
  name: string;
  priceDeltaMinor: number;
  isAvailable: boolean;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  selectionType: "SINGLE" | "MULTIPLE";
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  isVeg: boolean | null;
  isAvailable: boolean;
  optionGroups: MenuOptionGroup[];
};

export type MenuCategory = { id: string; name: string; items: MenuItem[] };

type Restaurant = { id: string; name: string; isAcceptingOrders: boolean };

export function MenuList({
  restaurant,
  categories,
}: {
  restaurant: Restaurant;
  categories: MenuCategory[];
}) {
  const add = useCart((s) => s.add);
  const addForcingRestaurant = useCart((s) => s.addForcingRestaurant);
  const cartRestaurantName = useCart((s) => s.restaurantName);

  const [configuring, setConfiguring] = useState<MenuItem | null>(null);
  const [pendingLine, setPendingLine] = useState<AddLineInput | null>(null);

  function commit(line: AddLineInput) {
    const result = add({ id: restaurant.id, name: restaurant.name }, line);
    if (result === "conflict") {
      // A cart holds one restaurant's items. Ask before discarding.
      setPendingLine(line);
      return;
    }
    toast.success(`${line.name} added`);
  }

  function handleAdd(item: MenuItem) {
    if (item.optionGroups.length > 0) {
      setConfiguring(item);
      return;
    }
    commit({
      menuItemId: item.id,
      name: item.name,
      unitPriceMinor: item.priceMinor,
      optionIds: [],
      optionLabels: [],
      optionDeltasMinor: [],
    });
  }

  return (
    <>
      <div className="space-y-8">
        {categories.map((category) => (
          <section key={category.id} className="space-y-3">
            <h2 className="text-lg font-medium">{category.name}</h2>
            <ul className="divide-y rounded-lg border">
              {category.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.name}
                      {item.isVeg === true && (
                        <span className="ml-2 align-middle text-xs text-green-600">veg</span>
                      )}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <p className="mt-1 text-sm">{formatMoney(item.priceMinor)}</p>
                  </div>

                  {item.isAvailable && restaurant.isAcceptingOrders ? (
                    <Button size="sm" variant="outline" onClick={() => handleAdd(item)}>
                      Add
                    </Button>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.isAvailable ? "Closed" : "Out of stock"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {configuring && (
        <OptionDialog
          item={configuring}
          onCancel={() => setConfiguring(null)}
          onConfirm={(line) => {
            setConfiguring(null);
            commit(line);
          }}
        />
      )}

      <Dialog open={pendingLine !== null} onOpenChange={() => setPendingLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start a new cart?</DialogTitle>
            <DialogDescription>
              Your cart has items from {cartRestaurantName}. An order can only
              come from one restaurant.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingLine(null)}>
              Keep my cart
            </Button>
            <Button
              onClick={() => {
                if (pendingLine) {
                  addForcingRestaurant(
                    { id: restaurant.id, name: restaurant.name },
                    pendingLine,
                  );
                  toast.success(`${pendingLine.name} added`);
                }
                setPendingLine(null);
              }}
            >
              Clear and add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OptionDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  onCancel: () => void;
  onConfirm: (line: AddLineInput) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(item.optionGroups.map((g) => [g.id, []])),
  );

  const flat = useMemo(() => {
    const map = new Map<string, { group: MenuOptionGroup; option: MenuOption }>();
    for (const group of item.optionGroups) {
      for (const option of group.options) map.set(option.id, { group, option });
    }
    return map;
  }, [item]);

  const chosenIds = Object.values(selected).flat();

  // Mirrors the server's group validation so the button disables instead of
  // the request failing. The server still re-checks.
  const invalidGroup = item.optionGroups.find((group) => {
    const count = selected[group.id]?.length ?? 0;
    return count < group.minSelect || count > group.maxSelect;
  });

  const extraMinor = chosenIds.reduce(
    (sum, id) => sum + (flat.get(id)?.option.priceDeltaMinor ?? 0),
    0,
  );

  function toggle(group: MenuOptionGroup, optionId: string) {
    setSelected((current) => {
      const existing = current[group.id] ?? [];
      if (group.selectionType === "SINGLE") {
        return { ...current, [group.id]: existing[0] === optionId ? [] : [optionId] };
      }
      const next = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      return { ...current, [group.id]: next };
    });
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{formatMoney(item.priceMinor)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {item.optionGroups.map((group) => (
            <fieldset key={group.id} className="space-y-2">
              <legend className="text-sm font-medium">
                {group.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {group.minSelect > 0 ? "required" : "optional"}
                  {group.maxSelect > 1 && ` · up to ${group.maxSelect}`}
                </span>
              </legend>

              <div className="space-y-1.5">
                {group.options.map((option) => {
                  const isChecked = (selected[group.id] ?? []).includes(option.id);
                  return (
                    <Label
                      key={option.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 font-normal has-disabled:opacity-50"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type={group.selectionType === "SINGLE" ? "radio" : "checkbox"}
                          name={group.id}
                          checked={isChecked}
                          disabled={!option.isAvailable}
                          onChange={() => toggle(group, option.id)}
                          className="size-4 accent-primary"
                        />
                        <span>{option.name}</span>
                      </span>
                      {option.priceDeltaMinor !== 0 && (
                        <span className="text-sm text-muted-foreground">
                          +{formatMoney(option.priceDeltaMinor)}
                        </span>
                      )}
                    </Label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(invalidGroup)}
            onClick={() =>
              onConfirm({
                menuItemId: item.id,
                name: item.name,
                unitPriceMinor: item.priceMinor,
                optionIds: chosenIds,
                optionLabels: chosenIds.map((id) => flat.get(id)?.option.name ?? ""),
                optionDeltasMinor: chosenIds.map(
                  (id) => flat.get(id)?.option.priceDeltaMinor ?? 0,
                ),
              })
            }
          >
            {invalidGroup
              ? `Choose ${invalidGroup.name}`
              : `Add · ${formatMoney(item.priceMinor + extraMinor)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
