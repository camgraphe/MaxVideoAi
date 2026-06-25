type FAQEntry = {
  question: string;
  answer: string;
};

const serializeJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

export function buildFAQJsonLd(questions: FAQEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}

export function FAQSchema({ questions }: { questions: FAQEntry[] }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  const payload = buildFAQJsonLd(questions);

  return (
    <script
      type="application/ld+json"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
    />
  );
}
