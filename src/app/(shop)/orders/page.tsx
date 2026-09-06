"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/use-session";
import { formatMoney } from "@/lib/money";
import { CUSTOMER_STATUS_LABEL } from "@/lib/orders/status";
import type { OrderStatus } from "@/generated/prisma/enums";
import { buttonVariants } from "@/components/ui/button";

type OrderRow = {
  orderNumber: string; status: OrderStatus; type: string; totalMinor: number;
  createdAt: string; restaurant: { name: string; slug: string };
  items: { id: string; nameSnapshot: string; quantity: number }[];
};

export default function OrdersPage() {
  const session = useSession();
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiFetch<OrderRow[]>("/api/orders"),
    enabled: Boolean(session.data?.user),
    refetchInterval: 30_000,
  });

  if (!session.isLoading && !session.data?.user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>
        <Link href="/sign-in?next=/orders" className={`inline-flex ${buttonVariants({})}`}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Your orders</h1>

      {orders.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : orders.data?.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">No orders yet</p>
          <Link href="/" className={`mt-4 inline-flex ${buttonVariants({ variant: "outline", size: "sm" })}`}>
            Browse restaurants
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {orders.data?.map((order) => (
            <li key={order.orderNumber}>
              <Link href={`/orders/${order.orderNumber}`} className="flex items-start justify-between gap-4 p-4 hover:bg-accent">
                <div className="min-w-0">
                  <p className="font-medium">{order.restaurant.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {order.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()} · {order.orderNumber}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium">{formatMoney(order.totalMinor)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {CUSTOMER_STATUS_LABEL[order.status]}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
