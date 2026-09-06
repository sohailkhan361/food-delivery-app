"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatMoney, toMinor } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type MenuResponse = {
  restaurant: { id: string; name: string; isAcceptingOrders: boolean };
  categories: {
    id: string; name: string;
    items: { id: string; name: string; description: string | null; priceMinor: number; isVeg: boolean | null; isAvailable: boolean }[];
  }[];
};

export function MenuManager() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboard", "menu"] });

  const menu = useQuery({
    queryKey: ["dashboard", "menu"],
    queryFn: () => apiFetch<MenuResponse>("/api/dashboard/menu"),
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      apiFetch(`/api/dashboard/menu/items/${id}/availability`, { method: "PATCH", json: { isAvailable } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(error.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/dashboard/menu/items/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); toast.success("Item removed from the menu"); },
    onError: (error) => toast.error(error.message),
  });

  const createItem = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiFetch("/api/dashboard/menu/items", { method: "POST", json: input }),
    onSuccess: () => { invalidate(); toast.success("Item added"); },
    onError: (error) => toast.error(error.message),
  });

  const createCategory = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/dashboard/menu/categories", { method: "POST", json: { name } }),
    onSuccess: () => { invalidate(); toast.success("Category added"); },
    onError: (error) => toast.error(error.message),
  });

  if (menu.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (menu.error) return <p className="text-sm text-destructive">{menu.error.message}</p>;
  if (!menu.data) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">{menu.data.restaurant.name}</p>
        </div>
        <Button size="sm" variant="outline"
          onClick={() => {
            const name = window.prompt("New category name");
            if (name?.trim()) createCategory.mutate(name.trim());
          }}>
          Add category
        </Button>
      </div>

      {menu.data.categories.map((category) => (
        <section key={category.id} className="space-y-3">
          <h2 className="text-lg font-medium">{category.name}</h2>

          <ul className="divide-y rounded-lg border">
            {category.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  {item.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-1 text-sm">{formatMoney(item.priceMinor)}</p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <Label className="flex items-center gap-2 text-xs font-normal">
                    <Switch checked={item.isAvailable}
                      onCheckedChange={(checked) =>
                        toggleAvailability.mutate({ id: item.id, isAvailable: Boolean(checked) })
                      } />
                    {item.isAvailable ? "In stock" : "Out of stock"}
                  </Label>
                  <Button variant="ghost" size="sm" className="text-muted-foreground"
                    onClick={() => { if (window.confirm(`Remove ${item.name} from the menu?`)) archive.mutate(item.id); }}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
            {category.items.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">No items in this category yet.</li>
            )}
          </ul>

          <form className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const price = String(form.get("price") ?? "");
              createItem.mutate({
                categoryId: category.id,
                name: String(form.get("name") ?? ""),
                priceMinor: toMinor(price),
              });
              event.currentTarget.reset();
            }}>
            <div className="space-y-1.5">
              <Label htmlFor={`name-${category.id}`} className="text-xs">New item</Label>
              <Input id={`name-${category.id}`} name="name" required placeholder="Item name" className="w-48" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`price-${category.id}`} className="text-xs">Price</Label>
              <Input id={`price-${category.id}`} name="price" required inputMode="decimal" placeholder="249" className="w-24" />
            </div>
            <Button type="submit" size="sm" disabled={createItem.isPending}>Add</Button>
          </form>
        </section>
      ))}
    </div>
  );
}
