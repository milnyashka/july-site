import { HeroSection } from '@/components/sections/hero';
import { StatsSection } from '@/components/sections/stats';
import { FeaturesMarquee } from '@/components/sections/features-marquee';
import { FeaturedProducts } from '@/components/sections/featured-products';
import { SocialProof } from '@/components/sections/social-proof';
import { HowItWorks } from '@/components/sections/how-it-works';
import { WhyChooseUs } from '@/components/sections/why-choose-us';
import { Faq } from '@/components/sections/faq';
import { CTA } from '@/components/sections/cta';

export default function Home() {
  return (
    <div className="flex flex-col gap-16 md:gap-24">
      <HeroSection />
      <StatsSection />
      <FeaturesMarquee />
      <FeaturedProducts />
      <SocialProof />
      <HowItWorks />
      <WhyChooseUs />
      <Faq />
      <CTA />
    </div>
  );
}