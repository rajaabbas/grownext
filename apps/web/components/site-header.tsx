import Link from "next/link";
import { Button } from "@ma/ui";
import { LogoutButton } from "@/components/logout-button";

interface SiteHeaderProps {
  isAuthenticated: boolean;
}

const authedLinks = [
  { href: "/dashboard", label: "Dashboard", testId: "nav-dashboard" },
  { href: "/organization", label: "Organization", testId: "nav-organization" },
  { href: "/profile", label: "Profile", testId: "nav-profile" }
];

const guestLinks = [
  { href: "/login", label: "Login", testId: "nav-login" },
  { href: "/signup", label: "Sign Up", testId: "nav-signup" }
];

export const SiteHeader = ({ isAuthenticated }: SiteHeaderProps) => {
  const links = isAuthenticated ? authedLinks : guestLinks;

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur" data-testid="site-header">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link className="font-semibold" href="/" data-testid="nav-home">
          GrowNext
        </Link>
        <nav className="flex items-center gap-2" data-testid="site-nav">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost">
              <Link href={link.href} data-testid={link.testId}>
                {link.label}
              </Link>
            </Button>
          ))}
          {isAuthenticated ? (
            <LogoutButton variant="outline" idleLabel="Logout" loadingLabel="Logging out..." />
          ) : null}
        </nav>
      </div>
    </header>
  );
};
