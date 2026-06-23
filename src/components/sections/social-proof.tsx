'use client';

import Link from "next/link";
import { ReviewCard } from "@/components/review-card"
import { reviews } from "@/lib/reviews"
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { localizedPath } from "@/i18n/localized-path";

export function SocialProof() {
  const { locale, dict } = useI18n();
  const displayedReviews = reviews.slice(0, 9);

  return (
    <section className="container">
        <div className="text-center mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{dict.socialProof.eyebrow}</h2>
            <p className="mt-2 text-3xl md:text-4xl font-bold tracking-tighter font-headline">
                {dict.socialProof.title}
            </p>
            <p className="mt-4 max-w-3xl mx-auto text-muted-foreground">
                {dict.socialProof.description}
            </p>
        </div>

        <div className="relative">
            <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
                {displayedReviews.map((review) => (
                <div key={review.id} className="mb-6 break-inside-avoid">
                    <ReviewCard review={review} />
                </div>
                ))}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-48 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
        </div>

        <div className="mt-8 text-center">
            <Link href={localizedPath(locale, '/reviews')}>
                <Button variant="outline">
                    {dict.socialProof.viewAll}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        </div>
    </section>
  )
}