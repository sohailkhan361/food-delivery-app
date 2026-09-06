"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_ACCOUNTS = [
  { label: "Customer", phone: "+919000000001" },
  { label: "Merchant", phone: "+919000000002" },
  { label: "Admin", phone: "+919000000003" },
];

export function SignInForm() {
  const [phone, setPhone] = useState("");
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const signIn = useMutation({
    mutationFn: (value: string) =>
      apiFetch<{ user: { role: string } }>("/api/auth/login", {
        method: "POST",
        json: { phone: value },
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      const next = params.get("next");
      router.push(next ?? (data.user.role === "CUSTOMER" ? "/" : "/dashboard"));
    },
  });

  const error = signIn.error instanceof ApiClientError ? signIn.error : null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your phone number to continue.
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          signIn.mutate(phone);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919000000001"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={signIn.isPending}>
          {signIn.isPending ? "Signing in…" : "Continue"}
        </Button>
      </form>

      <div className="rounded-lg border border-dashed p-4">
        <p className="text-xs font-medium text-muted-foreground">
          Development sign-in — no OTP is sent or verified. Replace with Clerk
          before launch.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.phone}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setPhone(account.phone);
                signIn.mutate(account.phone);
              }}
            >
              {account.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
