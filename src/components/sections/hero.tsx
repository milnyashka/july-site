'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Status } from '../status';
import { Users, Lock, Zap } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export function HeroSection() {
    const { locale, dict } = useI18n();
    const heroImage = PlaceHolderImages.find(p => p.id === 'heroImage');
    const t = dict.hero;

    return (
        <section className="relative w-full py-20 md:py-32 overflow-hidden">
             {heroImage && (
                <Image
                    src={heroImage.imageUrl}
                    alt="Background"
                    fill
                    className="object-cover object-center opacity-10"
                    priority
                />
            )}
            <div className="container relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="text-center lg:text-left">
                        <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl md:text-6xl lg:text-7xl font-headline">
                            {t.title} <span className="text-primary">{t.titleHighlight}</span>
                        </h1>
                        <p className="mt-6 max-w-lg mx-auto lg:mx-0 text-lg text-muted-foreground md:text-xl">
                            {t.description}
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                            <Link href={localizedPath(locale, '/products')}>
                                <Button size="lg">{t.exploreProducts}</Button>
                            </Link>
                            <Link href="#how-it-works">
                                <Button size="lg" variant="outline">
                                    {t.howWeOperate}
                                </Button>
                            </Link>
                        </div>
                        <div className="mt-10 flex justify-center lg:justify-start space-x-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" />
                                <span>{t.secure}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" />
                                <span>{t.instantDelivery}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                <span>{t.users}</span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden lg:flex justify-center">
                       <Status />
                    </div>
                </div>
            </div>
        </section>
    );
}