"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface BillingNavItem {
  label: string;
  href: string;
  description?: string;
}

export const BillingNav = ({ items }: { items: BillingNavItem[] }) => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-4 text-sm font-medium text-muted-foreground">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 transition ${
              isActive ? "bg-primary/10 text-primary" : "hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="block">{item.label}</span>
            {item.description ? (
              <span className="block text-xs font-normal text-muted-foreground">{item.description}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
};
