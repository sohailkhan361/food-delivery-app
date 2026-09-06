"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { allowedTransitions } from "@/lib/orders/status";
import type { OrderStatus, OrderType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type QueueOrder = {
  id: string; orderNumber: string; status: OrderStatus; type: OrderType;
  totalMinor: number; prepMinutes: number | null; estimatedReadyAt: string | null;
  contactPhone: string; customerNote: string | null; createdAt: string;
  addressSnapshot: { line1?: string; city?: string; postalCode?: string } | null;
  payment: { method: string; status: string } | null;
  items: { id: string; nameSnapshot: string; quantity: number; note: string | null; options: { id: string; nameSnapshot: string }[] }[];
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PREPARING: "Start preparing",
  OUT_FOR_DELIVERY: "Out for delivery",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Mark delivered",
  COLLECTED: "Mark collected",
};

const PREP_CHOICES = [10, 15, 20, 30, 45];

export function OrderQueue() {
  const queryClient = useQueryClient();
  const [muted, setMuted] = useState(false);

  const queue = useQuery({
    queryKey: ["dashboard", "orders"],
    queryFn: () => apiFetch<{ restaurantId: string; orders: QueueOrder[] }>("/api/dashboard/orders"),
    // Polling is correct at this scale. Swap for Ably/Pusher when merchants
    // start complaining about the lag, not before.
    refetchInterval: 10_000,
  });

  const newCount = queue.data?.orders.filter((o) => o.status === "PLACED").length ?? 0;
  const previousNewCount = useRef(0);

  // A merchant who misses an order churns immediately, so a new PLACED order
  // makes noise. Web Push (for when the tab is closed) is Phase 6.
  useEffect(() => {
    if (newCount > previousNewCount.current && !muted) {
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 880;
        gain.gain.value = 0.1;
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.35);
      } catch {
        // Autoplay policy blocked it — the badge still shows the count.
      }
      toast.info(`${newCount} order${newCount === 1 ? "" : "s"} waiting to be accepted`);
    }
    previousNewCount.current = newCount;
  }, [newCount, muted]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard", "orders"] });

  const accept = useMutation({
    mutationFn: ({ id, prepMinutes }: { id: string; prepMinutes: number }) =>
      apiFetch(`/api/dashboard/orders/${id}/accept`, { method: "POST", json: { prepMinutes } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/api/dashboard/orders/${id}/reject`, { method: "POST", json: { reason } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  const advance = useMutation({
    mutationFn: ({ id, to }: { id: string; to: OrderStatus }) =>
      apiFetch(`/api/dashboard/orders/${id}/advance`, { method: "POST", json: { to } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  if (queue.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (queue.error) return <p className="text-sm text-destructive">{queue.error.message}</p>;

  const orders = queue.data?.orders ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} in the queue{newCount > 0 && ` · ${newCount} awaiting confirmation`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMuted((v) => !v)}>
          {muted ? "Unmute alerts" : "Mute alerts"}
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nothing in the queue</p>
          <p className="mt-1 text-sm text-muted-foreground">New orders appear here within 10 seconds.</p>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => {
            const nextStatuses = allowedTransitions(order.status, "STAFF", order.type)
              .filter((s) => s !== "REJECTED" && s !== "CANCELLED" && s !== "ACCEPTED");

            return (
              <li key={order.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleTimeString()} · {order.type}
                      {order.payment?.method === "COD" && " · COD"}
                    </p>
                  </div>
                  <Badge variant={order.status === "PLACED" ? "default" : "secondary"}>
                    {order.status}
                  </Badge>
                </div>

                <ul className="space-y-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium">{item.quantity}×</span> {item.nameSnapshot}
                      {item.options.length > 0 && (
                        <span className="text-muted-foreground"> ({item.options.map((o) => o.nameSnapshot).join(", ")})</span>
                      )}
                      {item.note && <span className="block text-xs italic text-muted-foreground">{item.note}</span>}
                    </li>
                  ))}
                </ul>

                {order.customerNote && (
                  <p className="rounded bg-muted p-2 text-xs">Note: {order.customerNote}</p>
                )}

                {order.type === "DELIVERY" && order.addressSnapshot && (
                  <p className="text-xs text-muted-foreground">
                    {order.addressSnapshot.line1}, {order.addressSnapshot.postalCode} · {order.contactPhone}
                  </p>
                )}

                <p className="text-sm font-medium">{formatMoney(order.totalMinor)}</p>

                {order.status === "PLACED" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Accept with a prep time:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PREP_CHOICES.map((minutes) => (
                        <Button key={minutes} size="xs" disabled={accept.isPending}
                          onClick={() => accept.mutate({ id: order.id, prepMinutes: minutes })}>
                          {minutes} min
                        </Button>
                      ))}
                      <Button size="xs" variant="destructive" disabled={reject.isPending}
                        onClick={() => {
                          const reason = window.prompt("Why are you rejecting this order?");
                          if (reason && reason.trim().length >= 3) {
                            reject.mutate({ id: order.id, reason: reason.trim() });
                          }
                        }}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {nextStatuses.map((status) => (
                      <Button key={status} size="sm" variant="outline" disabled={advance.isPending}
                        onClick={() => advance.mutate({ id: order.id, to: status })}>
                        {NEXT_LABEL[status] ?? status}
                      </Button>
                    ))}
                    {order.estimatedReadyAt && (
                      <span className="self-center text-xs text-muted-foreground">
                        due {new Date(order.estimatedReadyAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
