'use client';

import React, { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Sparkles, ShieldCheck, Megaphone } from 'lucide-react';
import { AdItem } from '@/lib/ads-config';
import { GoogleAdUnit } from './google-ad';

interface AdBannerProps {
  ad?: AdItem;
  type?: 'banner-300x250' | 'leaderboard' | 'step-sponsor' | 'google-adsense';
  scriptCode?: string; // Для интеграции Yandex RTB / Google AdSense если задан
  googleAdClient?: string;
  googleAdSlot?: string;
  className?: string;
}

export function AdBanner({
  ad,
  type = 'banner-300x250',
  scriptCode,
  googleAdClient,
  googleAdSlot,
  className = '',
}: AdBannerProps) {
  const scriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scriptCode && scriptContainerRef.current) {
      scriptContainerRef.current.innerHTML = '';
      const range = document.createRange();
      const fragment = range.createContextualFragment(scriptCode);
      scriptContainerRef.current.appendChild(fragment);
    }
  }, [scriptCode]);

  if (type === 'google-adsense' || googleAdSlot) {
    return (
      <GoogleAdUnit
        client={googleAdClient || 'ca-pub-6910725183348370'}
        slot={googleAdSlot || '7828550365'}
        className={className}
      />
    );
  }

  if (scriptCode) {
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-border bg-card p-2 text-center ${className}`}>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
          <Megaphone className="w-3 h-3" /> Реклама
        </div>
        <div ref={scriptContainerRef} className="min-h-[100px] flex items-center justify-center" />
      </div>
    );
  }

  if (!ad) return null;

  if (type === 'leaderboard') {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r ${ad.gradient || 'from-primary/10 via-accent/10 to-transparent'} p-4 shadow-sm transition-all hover:border-primary/40 ${className}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-primary/20 text-primary hover:bg-primary/30">
                  {ad.badge || 'Спонсор'}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">{ad.sponsorName}</span>
              </div>
              <h4 className="font-semibold text-sm sm:text-base mt-0.5 text-foreground">{ad.title}</h4>
              <p className="text-xs text-muted-foreground hidden sm:block">{ad.description}</p>
            </div>
          </div>

          <Button
            size="sm"
            className="shrink-0 gap-1.5 shadow-sm font-medium w-full sm:w-auto"
            onClick={() => window.open(ad.url, '_blank', 'noopener,noreferrer')}
          >
            <span>{ad.buttonText}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (type === 'step-sponsor') {
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br ${ad.gradient || 'from-card via-card/80 to-primary/5'} p-5 shadow-md relative group ${className}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/15 transition-all pointer-events-none" />

        <div className="flex items-center justify-between gap-2 mb-3">
          <Badge className="bg-primary/15 text-primary border-primary/20 text-xs font-semibold px-2.5 py-0.5">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 inline" />
            {ad.badge || 'Партнерский блок'}
          </Badge>
          <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">
            {ad.sponsorName}
          </span>
        </div>

        <h3 className="text-base font-bold text-foreground mb-1.5 leading-snug">
          {ad.title}
        </h3>

        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          {ad.description}
        </p>

        <Button
          variant="default"
          size="sm"
          className="w-full gap-2 font-semibold shadow hover:shadow-primary/20"
          onClick={() => window.open(ad.url, '_blank', 'noopener,noreferrer')}
        >
          <span>{ad.buttonText}</span>
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Default: banner-300x250 / square banner with Google AdSense
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-card p-2 flex items-center justify-center min-h-[250px] shadow-sm ${className}`}>
      <GoogleAdUnit
        client={googleAdClient || 'ca-pub-6910725183348370'}
        slot={googleAdSlot || '7828550365'}
      />
    </div>
  );
}
