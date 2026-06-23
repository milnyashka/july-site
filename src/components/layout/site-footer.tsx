'use client';

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useI18n } from "@/i18n/I18nProvider";
import { localizedPath } from "@/i18n/localized-path";
export function SiteFooter() {
  const { locale, dict } = useI18n();

  const footerLinks = {
    support: [
      { name: dict.footer.download, href: "/download" },
      { name: dict.footer.terms, href: "/terms" },
      { name: dict.nav.support, href: "/support" },
      { name: dict.footer.discord, href: "https://discord.com/invite/ap4pWsGuGW", external: true },
      { name: dict.nav.status, href: "/status" },
    ],
    products: [
      { name: dict.product.name, href: "/products" },
    ],
  };

  return (
    <footer className="border-t">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href={localizedPath(locale, '/')} className="flex items-center space-x-2">
                <Icon.Logo className="h-8 w-8 text-primary" />
                <span className="font-bold text-2xl font-headline">July</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              {dict.footer.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:col-span-3 sm:grid-cols-3">
            <div>
              <h3 className="font-semibold tracking-wider uppercase font-headline">{dict.footer.supportContact}</h3>
              <ul className="mt-4 space-y-2">
                {footerLinks.support.map((link) => (
                  <li key={link.name}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link href={localizedPath(locale, link.href)} className="text-sm text-muted-foreground hover:text-foreground">
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
                <h3 className="font-semibold tracking-wider uppercase font-headline">{dict.footer.supportedProducts}</h3>
                <ul className="mt-4 space-y-2">
                    {footerLinks.products.map((link) => (
                    <li key={link.name}>
                        <Link href={localizedPath(locale, link.href)} className="text-sm text-muted-foreground hover:text-foreground">
                        {link.name}
                        </Link>
                    </li>
                    ))}
                </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} July. {dict.footer.rights}</p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Link href={localizedPath(locale, '/terms')} className="hover:text-foreground">{dict.footer.terms}</Link>
            <Link href={localizedPath(locale, '/support')} className="hover:text-foreground">{dict.nav.support}</Link>
            <Link href={localizedPath(locale, '/status')} className="hover:text-foreground">{dict.nav.status}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}