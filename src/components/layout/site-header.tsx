"use client";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import Countdown from "../countdown";
import { Icon } from "../icons";
import { LanguageSwitcher } from "../language-switcher";
import { WalletBadge } from "../wallet-badge";
import { useAuth } from "@/components/auth-provider";
import { canAccessModeratorPanel } from "@/lib/permissions";
import { isReseller } from "@/lib/roles";
import { useI18n } from "@/i18n/I18nProvider";
import { localizedPath } from "@/i18n/localized-path";

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const { user, profile } = useAuth();
  const accountRoles = profile?.roles ?? [];

  const navLinks = [
    { name: dict.nav.home, href: "/" },
    { name: dict.nav.products, href: "/products" },
    ...(user && isReseller(accountRoles) ? [{ name: dict.nav.reseller, href: "/reseller" }] : []),
    ...(user && canAccessModeratorPanel(accountRoles) ? [{ name: dict.nav.moderator, href: "/moderator" }] : []),
    { name: dict.nav.download, href: "/download" },
    { name: dict.nav.reviews, href: "/reviews" },
    { name: dict.nav.status, href: "/status" },
    { name: dict.nav.support, href: "/support" },
  ];

  const isActive = (href: string) => {
    const full = localizedPath(locale, href);
    if (href === '/') return pathname === full;
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  const linkHref = (href: string) =>
    href.startsWith('http') || href === '#' ? href : localizedPath(locale, href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-semibold">
        <div className="container flex items-center justify-between gap-3">
            <span className="truncate">{dict.header.sale}</span>
            <Countdown />
        </div>
      </div>
      <div className="container flex h-16 items-center gap-2">
        <Link href={localizedPath(locale, '/')} className="flex shrink-0 items-center space-x-2 mr-2">
          <Icon.Logo className="h-6 w-6 text-primary" />
          <span className="hidden font-bold sm:inline-block font-headline text-lg">July</span>
        </Link>

        <nav className="hidden xl:flex items-center gap-4 text-sm font-medium min-w-0">
          {navLinks.map((link) => (
            <Link
              key={link.href + link.name}
              href={linkHref(link.href)}
              className={cn(
                "whitespace-nowrap transition-colors hover:text-foreground/80",
                isActive(link.href) ? "text-foreground" : "text-foreground/60"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <WalletBadge />
          <LanguageSwitcher />
          <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-green-400 max-w-[140px] lg:max-w-none">
            <ShieldCheck className="h-5 w-5 shrink-0 text-green-400" />
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs truncate">{dict.header.statusUndetected}</span>
              <span className="text-xs text-muted-foreground truncate">{dict.header.lastUpdated}</span>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="xl:hidden h-9 w-9 shrink-0"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">{dict.header.toggleMenu}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <Link href={localizedPath(locale, '/')} className="flex items-center space-x-2">
                <Icon.Logo className="h-6 w-6 text-primary" />
                <span className="font-bold font-headline text-lg">July</span>
              </Link>
              <div className="flex flex-col space-y-4 mt-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href + link.name}
                    href={linkHref(link.href)}
                    className={cn(
                      "text-lg",
                      isActive(link.href) ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}