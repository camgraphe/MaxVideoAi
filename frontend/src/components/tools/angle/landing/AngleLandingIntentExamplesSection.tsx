import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ANGLE_INTENT_EXAMPLE_ASSETS, type AngleLandingContent } from './angle-landing-assets';
import { SectionHeader } from './AngleLandingPrimitives';

export function AngleLandingIntentExamplesSection({ content }: { content: AngleLandingContent }) {
  return (
    <section className="border-t border-hairline bg-bg section">
      <div className="container-page max-w-6xl stack-gap-lg">
        <SectionHeader eyebrow={content.intentExamples.eyebrow} title={content.intentExamples.title} body={<p>{content.intentExamples.body}</p>} />

        <div className="grid gap-5 lg:grid-cols-3">
          {content.intentExamples.items.map((example, index) => {
            const assets = ANGLE_INTENT_EXAMPLE_ASSETS[index];
            if (!assets) return null;

            return (
              <Card key={example.title} className="overflow-hidden border-hairline bg-surface p-0 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
                <div className="grid grid-cols-2 gap-px border-b border-hairline bg-hairline">
                  <div className="bg-bg p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{example.sourceLabel}</p>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#edf3f8]">
                      <Image src={assets.source} alt={example.sourceAlt} fill sizes="(max-width: 1024px) 50vw, 250px" className="object-cover" />
                    </div>
                  </div>
                  <div className="bg-bg p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">{example.outputLabel}</p>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#e8f0f8]">
                      <Image src={assets.output} alt={example.outputAlt} fill sizes="(max-width: 1024px) 50vw, 250px" className="object-cover" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold tracking-tight text-text-primary">{example.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">{example.body}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div>
          <ButtonLink
            href="/app/tools/angle"
            linkComponent={Link}
            size="lg"
            data-analytics-event="tool_cta_click"
            data-analytics-cta-name="angle_try_tool_examples"
            data-analytics-cta-location="tool_angle_examples"
            data-analytics-tool-name="angle"
            data-analytics-tool-surface="public"
            data-analytics-target-family="app_tools"
          >
            {content.intentExamples.primaryCta}
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
