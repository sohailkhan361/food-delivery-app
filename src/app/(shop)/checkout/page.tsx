"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { useSession } from "@/lib/use-session";
import { formatMoney } from "@/lib/money";
import { selectSubtotalMinor, useCart } from "@/lib/stores/cart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type Address = {
  id: string; label: string | null; line1: string; city: string;
  postalCode: string; isDefault: boolean; zone: { id: string; name: string } | null;
};

type Quote = {
  restaurantName: string; etaMinutes: number;
  breakdown: {
    subtotalMinor: number; packingFeeMinor: number; deliveryFeeMinor: number;
    taxMinor: number; discountMinor: number; totalMinor: number;
  };
};

const ONLINE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ONLINE_PAYMENT === "true";

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();

  const restaurantId = useCart((s) => s.restaurantId);
  const lines = useCart((s) => s.lines);
  const clearCart = useCart((s) => s.clear);
  const subtotalMinor = useCart(selectSubtotalMinor);

  const [type, setType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);

  // One key per checkout attempt, so a double submit resolves to one order.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: () => apiFetch<Address[]>("/api/addresses"),
    enabled: Boolean(session.data?.user),
  });

  useEffect(() => {
    if (session.data?.user?.phone && !contactPhone) setContactPhone(session.data.user.phone);
  }, [session.data?.user?.phone, contactPhone]);

  useEffect(() => {
    if (!addressId && addresses.data?.length) {
      setAddressId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id);
    }
  }, [addresses.data, addressId]);

  const orderPayload = useMemo(
    () =>
      restaurantId
        ? {
            restaurantId,
            type,
            addressId: type === "DELIVERY" ? (addressId ?? undefined) : undefined,
            lines: lines.map((l) => ({
              menuItemId: l.menuItemId, quantity: l.quantity,
              optionIds: l.optionIds, note: l.note,
            })),
            contactPhone,
            customerNote: customerNote || undefined,
            paymentMethod: ONLINE_ENABLED ? ("ONLINE" as const) : ("COD" as const),
            idempotencyKey,
          }
        : null,
    [restaurantId, type, addressId, lines, contactPhone, customerNote, idempotencyKey],
  );

  const canQuote = Boolean(
    orderPayload && lines.length > 0 && contactPhone.length >= 8 &&
    (type === "PICKUP" || addressId),
  );

  // The server prices the order; the client only renders the result.
  const quote = useQuery({
    queryKey: ["quote", orderPayload],
    queryFn: () => apiFetch<Quote>("/api/orders/quote", { method: "POST", json: orderPayload }),
    enabled: canQuote,
    retry: false,
  });

  const createAddress = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch<Address>("/api/addresses", { method: "POST", json: input }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setAddressId(created.id);
      setShowAddressForm(false);
      toast.success("Address saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const placeOrder = useMutation({
    mutationFn: () => apiFetch<{ orderNumber: string }>("/api/orders", { method: "POST", json: orderPayload }),
    onSuccess: (order) => {
      clearCart();
      setIdempotencyKey(crypto.randomUUID());
      router.push(`/orders/${order.orderNumber}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (session.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!session.data?.user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted-foreground">Sign in to place your order.</p>
        <Link href="/sign-in?next=/checkout" className={`inline-flex ${buttonVariants({})}`}>Sign in</Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        <Link href="/" className={`inline-flex ${buttonVariants({ variant: "outline" })}`}>Browse restaurants</Link>
      </div>
    );
  }

  const quoteError = quote.error instanceof ApiClientError ? quote.error : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">How would you like it?</h2>
          <div className="flex gap-2">
            {(["DELIVERY", "PICKUP"] as const).map((option) => (
              <Button key={option} size="sm" variant={type === option ? "default" : "outline"} onClick={() => setType(option)}>
                {option === "DELIVERY" ? "Deliver to me" : "I'll pick it up"}
              </Button>
            ))}
          </div>
        </section>

        {type === "DELIVERY" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Delivery address</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowAddressForm((v) => !v)}>
                {showAddressForm ? "Cancel" : "Add new"}
              </Button>
            </div>

            {addresses.data?.length === 0 && !showAddressForm && (
              <p className="text-sm text-muted-foreground">No saved addresses yet — add one to continue.</p>
            )}

            <div className="space-y-2">
              {addresses.data?.map((address) => (
                <Label key={address.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal">
                  <input type="radio" name="address" className="mt-1 size-4 accent-primary"
                    checked={addressId === address.id} onChange={() => setAddressId(address.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{address.label ?? "Address"}</span>
                    <span className="block text-sm text-muted-foreground">
                      {address.line1}, {address.city} {address.postalCode}
                    </span>
                    {!address.zone && (
                      <span className="mt-1 block text-xs text-destructive">Outside our delivery zones</span>
                    )}
                  </span>
                </Label>
              ))}
            </div>

            {showAddressForm && (
              <form className="space-y-3 rounded-md border p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  createAddress.mutate({
                    label: String(form.get("label") ?? "") || undefined,
                    line1: String(form.get("line1") ?? ""),
                    city: String(form.get("city") ?? ""),
                    postalCode: String(form.get("postalCode") ?? ""),
                    isDefault: (addresses.data?.length ?? 0) === 0,
                  });
                }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="line1">Street address</Label>
                    <Input id="line1" name="line1" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" name="city" defaultValue="Bengaluru" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode">Postal code</Label>
                    <Input id="postalCode" name="postalCode" placeholder="560025" required />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="label">Label (optional)</Label>
                    <Input id="label" name="label" placeholder="Home" />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={createAddress.isPending}>
                  {createAddress.isPending ? "Saving…" : "Save address"}
                </Button>
              </form>
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Contact &amp; notes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" inputMode="tel" value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Note for the restaurant (optional)</Label>
            <Textarea id="note" rows={2} value={customerNote}
              onChange={(event) => setCustomerNote(event.target.value)} placeholder="Ring the bell twice" />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium">Payment</h2>
          <p className="text-sm text-muted-foreground">
            {ONLINE_ENABLED ? "Online payment" : "Cash on delivery — online payment goes live in Phase 6."}
          </p>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-lg border p-4 lg:sticky lg:top-20">
        <h2 className="text-sm font-medium">Order summary</h2>
        <ul className="space-y-1.5 text-sm">
          {lines.map((line) => (
            <li key={line.key} className="text-muted-foreground">{line.quantity}× {line.name}</li>
          ))}
        </ul>
        <Separator />
        {quoteError ? (
          <p className="text-sm text-destructive">{quoteError.message}</p>
        ) : quote.data ? (
          <dl className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={quote.data.breakdown.subtotalMinor} />
            {quote.data.breakdown.packingFeeMinor > 0 && <Row label="Packing" value={quote.data.breakdown.packingFeeMinor} />}
            {type === "DELIVERY" && <Row label="Delivery" value={quote.data.breakdown.deliveryFeeMinor} />}
            <Row label="Tax" value={quote.data.breakdown.taxMinor} />
            <Separator className="my-2" />
            <div className="flex justify-between font-semibold">
              <dt>Total</dt><dd>{formatMoney(quote.data.breakdown.totalMinor)}</dd>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">Ready in about {quote.data.etaMinutes} min</p>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {canQuote ? "Calculating…" : `Subtotal ${formatMoney(subtotalMinor)}`}
          </p>
        )}
        <Button className="w-full" disabled={!quote.data || placeOrder.isPending} onClick={() => placeOrder.mutate()}>
          {placeOrder.isPending ? "Placing order…" : "Place order"}
        </Button>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{formatMoney(value)}</dd>
    </div>
  );
}
