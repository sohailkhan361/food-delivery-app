import { Suspense } from "react";
import { SignInForm } from "@/components/shop/sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<p className="p-16 text-sm text-muted-foreground">Loading…</p>}>
      <SignInForm />
    </Suspense>
  );
}
