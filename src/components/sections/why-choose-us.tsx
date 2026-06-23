'use client';

import { ShieldCheck, Zap, Users, Gem, Lock, LifeBuoy } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

const icons = [ShieldCheck, Zap, Users, Gem, Lock, LifeBuoy];

export function WhyChooseUs() {
    const { dict } = useI18n();

    return (
        <section className="container">
            <div className="text-center mb-12">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{dict.whyChooseUs.eyebrow}</h2>
                <p className="mt-2 text-3xl md:text-4xl font-bold tracking-tighter font-headline">
                    {dict.whyChooseUs.title}
                </p>
                <p className="mt-4 max-w-3xl mx-auto text-muted-foreground">
                    {dict.whyChooseUs.description}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {dict.whyChooseUs.advantages.map((advantage, index) => {
                    const Icon = icons[index] ?? ShieldCheck;
                    return (
                    <div key={index} className="flex flex-col items-center text-center p-6 rounded-lg bg-card transition-all hover:bg-primary/10">
                        <div className="bg-primary/20 text-primary rounded-full p-3 mb-4">
                            <Icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold font-headline">{advantage.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{advantage.description}</p>
                    </div>
                )})}
            </div>
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                <div className="bg-card p-6 rounded-lg">
                    <p className="text-4xl font-bold font-headline text-primary">1,000+</p>
                    <p className="mt-1 text-muted-foreground">{dict.whyChooseUs.happyCustomers}</p>
                </div>
                <div className="bg-card p-6 rounded-lg">
                    <p className="text-4xl font-bold font-headline text-primary">99.9%</p>
                    <p className="mt-1 text-muted-foreground">{dict.whyChooseUs.uptimeGuarantee}</p>
                </div>
                <div className="bg-card p-6 rounded-lg">
                    <p className="text-4xl font-bold font-headline text-primary">24/7</p>
                    <p className="mt-1 text-muted-foreground">{dict.whyChooseUs.humanSupport}</p>
                </div>
            </div>
        </section>
    );
}