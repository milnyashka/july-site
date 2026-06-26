'use client';

import { Zap, ShieldCheck, LifeBuoy, EyeOff, Gauge, ChevronsUp, CreditCard, Settings } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { usePageVisible } from '@/hooks/use-page-visible';

const icons = [ShieldCheck, ChevronsUp, Zap, LifeBuoy, EyeOff, Gauge, CreditCard, Settings];

export function FeaturesMarquee() {
    const visible = usePageVisible();
    const { dict } = useI18n();
    const features = dict.features.map((text, index) => ({
        icon: icons[index] ?? ShieldCheck,
        text,
    }));
    const marqueeContent = [...features, ...features];

    return (
        <div className="relative w-full overflow-hidden bg-primary/5 py-4">
            <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[10px_10px]"></div>
            <div
                className="relative flex animate-marquee-horizontal motion-reduce:animate-none"
                style={{ animationPlayState: visible ? 'running' : 'paused' }}
            >
                {marqueeContent.map((feature, index) => (
                    <div key={index} className="flex-shrink-0 flex items-center gap-3 px-6 mx-4">
                        <feature.icon className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{feature.text}</span>
                    </div>
                ))}
            </div>
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-background via-transparent to-background"></div>
        </div>
    );
}