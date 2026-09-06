"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { lineSubtotalMinor, selectSubtotalMinor, useCart } from "@/lib/stores/cart";
import { Button, buttonVariants } from "@/components/ui/button";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const restaurantName = useCart((s) => s.restaurantName);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const subtotalMinor = useCart(selectSubtotalMinor);

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Your cart is empty</p>
          <Link href="/" className={`mt-4 inline-flex ${buttonVariants({ variant: "outline", size: "sm" })}`}>
            Browse restaurants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>
        <p className="text-sm text-muted-foreground">{restaurantName}</p>
      </div>

      <ul className="divide-y rounded-lg border">
        {lines.map((line) => (
          <li key={line.key} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-medium">{line.name}</p>
              {line.optionLabels.length > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">{line.optionLabels.join(", ")}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{formatMoney(lineSubtotalMinor(line))}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Decrease" onClick={() => setQuantity(line.key, line.quantity - 1)}>−</Button>
              <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
              <Button variant="outline" size="icon-sm" aria-label="Increase" onClick={() => setQuantity(line.key, line.quantity + 1)}>+</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => remove(line.key)}>Remove</Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="text-lg font-semibold">{formatMoney(subtotalMinor)}</p>
          <p className="text-xs text-muted-foreground">Fees and tax are calculated at checkout.</p>
        </div>
        <Link href="/checkout" className={`inline-flex ${buttonVariants({})}`}>Checkout</Link>
      </div>
    </div>
  );
}
