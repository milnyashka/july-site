'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useI18n } from '@/i18n/I18nProvider';

export function Faq() {
  const { dict } = useI18n();

  return (
    <section className="container max-w-4xl">
      <div className="text-center mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">{dict.faq.eyebrow}</h2>
        <p className="mt-2 text-3xl md:text-4xl font-bold tracking-tighter font-headline">
          {dict.faq.title}
        </p>
        <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            {dict.faq.description}
        </p>
      </div>
      <Accordion type="single" collapsible className="w-full">
        {dict.faq.items.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-lg text-left hover:no-underline">{faq.question}</AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}