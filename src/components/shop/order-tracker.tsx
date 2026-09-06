"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { CUSTOMER_STATUS_LABEL, isTerminal } from "@/lib/orders/status";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type OrderDetail = {
  orderNumber: string; status: OrderStatus; type: "DELIVERY" | "PICKUP";
  subtotalMinor: number; packingFeeMinor: number; deliveryFeeMinor: number;
  taxMinor: number; totalMinor: number; contactPhone: string;
  customerNote: string | null; cancelReason: string | null;
  estimatedReadyAt: string | null; createdAt: string;
  restaurant: { name: string; slug: string; phone: string };
  payment: { method: string; status: string } | null;
  items: {
    id: string; nameSnapshot: string; quantity: number; lineTotalMinor: number;
    note: string | null; options: { id: string; nameSnapshot: string }[];
  }[];
  events: { id: string; status: OrderStatus; note: string | null; createdAt: string }[];
};

export function OrderTracker({ orderNumber }: { orderNumber: string }) {
  const queryClient = useQueryClient();

  const order = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => apiFetch<OrderDetail>(`/api/orders/${orderNumber}`),
    // Poll while the order is live; stop once it reaches a terminal status.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isTerminal(status) ? false : 15_000;
    },
  });

  const cancel = useMutation({
    mutationFn: () =>
      apiFetch(`/api/orders/${orderNumber}/cancel`, { method: "POST", json: {} }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["order", orderNumber] });
      toast.success("Order cancelled");
    },
    onError: (error) => toast.error(error.message),
  });

  if (order.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (order.error) return <p className="text-sm text-destructive">{order.error.message}</p>;
  if (!order.data) return null;

  const data = order.data;
  const canCancel = data.status === "PLACED";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs text-muted-foreground">{data.orderNumber}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {CUSTOMER_STATUS_LABEL[data.status]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.restaurant.name} · {data.type === "DELIVERY" ? "Delivery" : "Pickup"}
        </p>
        {data.estimatedReadyAt && !isTerminal(data.status) && (
          <p className="text-sm">
            Expected around {new Date(data.estimatedReadyAt).toLocaleTimeString()}
          </p>
        )}
        {data.cancelReason && (
          <p className="text-sm text-destructive">Reason: {data.cancelReason}</p>
        )}
      </header>

      <section className="rounded-lg border">
        <ul className="divide-y">
          {data.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.quantity}× {item.nameSnapshot}</p>
                {item.options.length > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.options.map((o) => o.nameSnapshot).join(", ")}
                  </p>
                )}
                {item.note && <p className="mt-0.5 text-xs italic text-muted-foreground">{item.note}</p>}
              </div>
              <span className="shrink-0 text-sm">{formatMoney(item.lineTotalMinor)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <dl className="space-y-1.5 p-4 text-sm">
          <Row label="Subtotal" value={data.subtotalMinor} />
          {data.packingFeeMinor > 0 && <Row label="Packing" value={data.packingFeeMinor} />}
          {data.deliveryFeeMinor > 0 && <Row label="Delivery" value={data.deliveryFeeMinor} />}
          <Row label="Tax" value={data.taxMinor} />
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <dt>Total</dt><dd>{formatMoney(data.totalMinor)}</dd>
          </div>
          {data.payment && (
            <p className="pt-1 text-xs text-muted-foreground">
              {data.payment.method === "COD" ? "Cash on delivery" : "Paid online"} · {data.payment.status.toLowerCase()}
            </p>
          )}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Progress</h2>
        <ol className="space-y-2 text-sm">
          {data.events.map((event) => (
            <li key={event.id} className="flex justify-between gap-4">
              <span>{CUSTOMER_STATUS_LABEL[event.status]}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {canCancel && (
        <Button variant="destructive" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
          {cancel.isPending ? "Cancelling…" : "Cancel order"}
        </Button>
      )}
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
