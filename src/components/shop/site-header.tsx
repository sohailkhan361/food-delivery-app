"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/use-session";
import { selectItemCount, useCart } from "@/lib/stores/cart";
import { Button, buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  const { data } = useSession();
  const itemCount = useCart(selectItemCount);
  const clearCart = useCart((s) => s.clear);
  const router = useRouter();
  const queryClient = useQueryClient();

  const signOut = useMutation({
    mutationFn: () => apiFetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      clearCart();
      queryClient.clear();
      router.push("/");
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Food&nbsp;Delivery
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/orders" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Orders
          </Link>

          <Link href="/cart" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Cart
            {itemCount > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Link>

          {data?.user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              Sign out
            </Button>
          ) : (
            <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
