'use client';

import Link from 'next/link';
import { CreditCard, KeyRound, Download, Rocket, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

const stepIcons = [CreditCard, KeyRound, Download, Rocket, Headphones];

export function HowItWorks() {
    const { locale, dict } = useI18n();
    const t = dict.howItWorks;

    return (
        <section id="how-it-works" className="bg-card py-16 md:py-24 scroll-mt-24">
            <div className="container">
                <div className="text-center mb-12">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{t.eyebrow}</h2>
                    <p className="mt-2 text-3xl md:text-4xl font-bold tracking-tighter font-headline">
                        {t.title}
                    </p>
                    <p className="mt-4 max-w-3xl mx-auto text-muted-foreground">
                        {t.description}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {t.steps.map((step, index) => {
                        const Icon = stepIcons[index];
                        return (
                            <div key={index} className="flex gap-6">
                                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        {Icon && <Icon className="h-6 w-6" />}
                                    </div>
                                    <span className="text-xs font-bold font-headline text-muted-foreground">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold font-headline">{step.title}</h3>
                                    <p className="mt-2 text-muted-foreground">{step.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href={localizedPath(locale, '/products')}>
                        <Button size="lg">{t.ctaProducts}</Button>
                    </Link>
                    <Link href={localizedPath(locale, '/download')}>
                        <Button size="lg" variant="outline">{t.ctaDownload}</Button>
                    </Link>
                    <Link href={localizedPath(locale, '/support')}>
                        <Button size="lg" variant="ghost">{t.ctaSupport}</Button>
                    </Link>
                </div>
            </div>
        </section>
    )
}