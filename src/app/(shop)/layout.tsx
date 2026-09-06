import { SiteHeader } from "@/components/shop/site-header";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        MVP · single market
      </footer>
    </div>
  );
}
