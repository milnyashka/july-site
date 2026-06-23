'use client';

import { ReviewCard } from '@/components/review-card';
import { reviews } from '@/lib/reviews';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import { localizedPath } from '@/i18n/localized-path';

export default function ReviewsPage() {
  const { locale, dict } = useI18n();

  return (
    <div className="container py-12 md:py-20">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tighter font-headline sm:text-5xl md:text-6xl">
          {dict.reviewsPage.title}
        </h1>
        <p className="max-w-2xl mx-auto mt-4 text-muted-foreground md:text-xl">
          {dict.reviewsPage.description}
        </p>
      </div>

      <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 xl:columns-4">
        {reviews.map((review, index) => (
          <div key={index} className="mb-6 break-inside-avoid">
            <ReviewCard review={review} />
          </div>
        ))}
      </div>
      <div className="mt-12 text-center">
        <Link href={localizedPath(locale, '/products')}>
          <Button size="lg">
            {dict.reviewsPage.cta}
          </Button>
        </Link>
      </div>
    </div>
  );
}