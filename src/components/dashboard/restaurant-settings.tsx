"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type MenuResponse = {
  restaurant: {
    id: string; name: string; slug: string; isAcceptingOrders: boolean;
    avgPrepMinutes: number; packingFeeMinor: number;
  };
};

export function RestaurantSettings() {
  const queryClient = useQueryClient();

  const menu = useQuery({
    queryKey: ["dashboard", "menu"],
    queryFn: () => apiFetch<MenuResponse>("/api/dashboard/menu"),
  });

  const update = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch("/api/dashboard/restaurant", { method: "PATCH", json: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "menu"] });
      toast.success("Saved");
    },
    onError: (error) => toast.error(error.message),
  });

  if (menu.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (menu.error) return <p className="text-sm text-destructive">{menu.error.message}</p>;
  if (!menu.data) return null;

  const restaurant = menu.data.restaurant;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">{restaurant.name}</p>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <Label className="flex items-center justify-between gap-4 font-normal">
          <span>
            <span className="block text-sm font-medium">Accepting orders</span>
            <span className="block text-xs text-muted-foreground">
              Turn this off to stop new orders immediately, whatever the opening hours say.
            </span>
          </span>
          <Switch checked={restaurant.isAcceptingOrders}
            onCheckedChange={(checked) => update.mutate({ isAcceptingOrders: Boolean(checked) })} />
        </Label>
      </div>

      <dl className="space-y-2 rounded-lg border p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Average prep time</dt>
          <dd>{restaurant.avgPrepMinutes} min</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Packing fee</dt>
          <dd>{formatMoney(restaurant.packingFeeMinor)}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        Opening hours and staff accounts are Phase 3.
      </p>
    </div>
  );
}
