'use client';

import { downloads } from '@/lib/downloads';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileArchive, KeyRound, Monitor } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';
import { cn } from '@/lib/utils';

export default function DownloadPage() {
  const { locale, dict } = useI18n();
  const t = dict.downloadPage;

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {t.title}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {t.description}
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-10">
        {downloads.map((item, index) => {
          const label = t.items[index];
          const isMain = item.id === 'july-bypass';

          return (
            <section
              key={item.id}
              id={item.id}
              className={cn(
                'rounded-xl border p-6 md:p-8',
                isMain
                  ? 'border-primary/40 bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border/50 bg-card/40'
              )}
            >
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-bold font-headline">
                  {label?.name ?? item.name}
                </h2>
                {item.requiresKey && (
                  <Badge className="w-fit uppercase tracking-wider text-xs">
                    {t.licenseRequired}
                  </Badge>
                )}
              </div>

              <Card className="bg-card/80 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base font-medium text-muted-foreground">
                    {t.file}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2 text-foreground font-mono text-sm">
                    <FileArchive className="h-4 w-4 shrink-0 text-primary" />
                    {item.fileName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    {label?.description ?? item.description}
                  </p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Monitor className="h-4 w-4" />
                      {item.platform}
                    </span>
                    <span>v{item.version}</span>
                    <span>{item.size}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-6">
                  {item.requiresKey ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <KeyRound className="h-4 w-4" />
                      {t.enterKey}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.noLicense}</p>
                  )}
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto font-bold" size="lg">
                      <Download className="mr-2 h-4 w-4" />
                      {t.download}
                    </Button>
                  </a>
                </CardFooter>
              </Card>
            </section>
          );
        })}
      </div>

      <div className="mt-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">{t.noKey}</p>
        <Link href={localizedPath(locale, '/products')}>
          <Button size="lg" variant="outline">
            {t.browseProducts}
          </Button>
        </Link>
      </div>
    </div>
  );
}