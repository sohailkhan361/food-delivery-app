import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Orders" },
  { href: "/dashboard/menu", label: "Menu" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Tablet-first: merchants run this on a propped-up iPad all day. */}
      <header className="border-b">
        <div className="flex h-14 items-center gap-6 px-4 sm:px-6">
          <span className="font-semibold tracking-tight">Merchant</span>
          <nav className="flex items-center gap-4 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
