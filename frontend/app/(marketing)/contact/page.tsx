import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Contact — MaxVideo AI',
  description: 'Reach the MaxVideo AI team for support, partnerships, and enterprise onboarding.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Contact — MaxVideo AI',
    description: 'Get in touch with MaxVideo AI support or sales.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Contact MaxVideo AI.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/contact',
    languages: {
      en: 'https://www.maxvideo.ai/contact',
      fr: 'https://www.maxvideo.ai/contact?lang=fr',
    },
  },
};

export default function ContactPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.contact;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <form className="space-y-4" method="post" action="#" aria-label={content.hero.title}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-text-secondary">
              {content.form.name}
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary">
              {content.form.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
          </div>
          <div>
            <label htmlFor="topic" className="block text-sm font-medium text-text-secondary">
              {content.form.topic}
            </label>
            <select
              id="topic"
              name="topic"
              defaultValue=""
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              aria-label={content.form.topic}
            >
              <option value="" disabled>
                {content.form.selectPlaceholder}
              </option>
              {content.form.topics.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-text-secondary">
              {content.form.message}
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              required
              className="mt-2 w-full rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center rounded-pill bg-accent px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {content.form.submit}
          </button>
        </form>
        <div className="mt-6 rounded-card border border-dashed border-hairline bg-bg px-4 py-3 text-sm text-text-secondary">
          {content.form.alt.split('{email}')[0]}
          <a href="mailto:support@maxvideo.ai" className="font-semibold text-accent hover:text-accentSoft">
            support@maxvideo.ai
          </a>
          {content.form.alt.split('{email}')[1] ?? ''}
        </div>
      </section>
    </div>
  );
}
