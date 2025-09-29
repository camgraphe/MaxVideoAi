import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    question: "Can I switch between Veo Quality and Veo Fast?",
    answer:
      "Absolutely. Presets pick the best engine by default, but you can override it. The live price badge refreshes instantly based on duration and audio settings.",
  },
  {
    question: "How does usage-based billing work?",
    answer:
      "Every Veo render tracks the actual seconds generated, while FAL is billed per clip. We send both metrics to Stripe once the job completes so your invoice stays precise.",
  },
  {
    question: "Where are the final videos stored?",
    answer:
      "In Pack 1 we rely on provider URLs. Pack 2 enables S3 or GCS with Cloudflare CDN and signed links, so you can scale without changing your workflow.",
  },
  {
    question: "Do you support multiple seats?",
    answer:
      "Agency tier unlocks team workspaces, API access, and SLA-backed priority lanes so creative ops can scale confidently.",
  },
];

export default function FAQPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(134,91,255,0.28),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,18,0.9),rgba(6,8,18,1))]" />
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Frequently Asked Questions</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Everything you need to know about presets, billing, and scaling from Pack 1 to Pack 2.
          </p>
        </div>
        <div className="rounded-3xl border border-black/10 bg-white/85 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/30 sm:p-6">
          <Accordion type="single" collapsible className="w-full divide-y divide-white/5 text-sm text-muted-foreground">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger className="text-left text-base font-medium text-foreground">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm text-muted-foreground/90">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </div>
  );
}
