'use client';

import { useI18n } from '@/i18n/I18nProvider';

export function StatsSection() {
    const { dict } = useI18n();
    const stats = [
        { value: "1K+", label: dict.stats.activeUsers },
        { value: "99.9%", label: dict.stats.uptime },
        { value: "<1min", label: dict.stats.deliveryTime },
        { value: "24/7", label: dict.stats.support },
    ];

    return (
        <section className="bg-background">
            <div className="container">
                <div className="bg-card rounded-lg border">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                        {stats.map((stat, index) => (
                            <div key={index} className="p-6 text-center">
                                <p className="text-3xl md:text-4xl font-bold text-primary font-headline">
                                    {stat.value}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground uppercase tracking-wider">
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}