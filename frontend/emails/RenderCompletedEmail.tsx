import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { resolveSiteUrl, withUtm } from '@/lib/email-links';

export type RenderCompletedEmailProps = {
  recipientName?: string | null;
  jobId: string;
  engineLabel?: string | null;
  durationSec?: number | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

function formatDuration(durationSec?: number | null): string | null {
  if (!durationSec || durationSec <= 0) return null;
  if (durationSec < 60) return `${durationSec}s`;
  const minutes = Math.round(durationSec / 6) / 10;
  return `${minutes.toFixed(1)} min`;
}

function formatEngineLabel(engineLabel?: string | null): string {
  return engineLabel ? engineLabel : 'ton moteur MaxVideoAI';
}

export function RenderCompletedEmail({
  recipientName,
  jobId,
  engineLabel,
  durationSec,
  videoUrl,
  thumbnailUrl,
}: RenderCompletedEmailProps) {
  const siteUrl = resolveSiteUrl();
  const baseHref = videoUrl && videoUrl.startsWith('http')
    ? videoUrl
    : `${siteUrl}/jobs`;
  const viewHref = withUtm(baseHref, 'render-completed');
  const ctaHref = `${siteUrl}/app?job=${encodeURIComponent(jobId)}`;
  const trackedCtaHref = withUtm(ctaHref, 'render-completed');
  const previewText = `Ton rendu ${engineLabel ?? ''} est prêt. Clique pour le découvrir.`;
  const friendlyName = recipientName ?? 'Salut';
  const durationLabel = formatDuration(durationSec);
  const engineLabelText = formatEngineLabel(engineLabel);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.logoRow}>
            <Img src="https://maxvideoai.com/apple-touch-icon.png" width={36} height={36} alt="MaxVideoAI" style={styles.logo} />
            <Text style={styles.brandLabel}>MAXVIDEOAI</Text>
          </Section>
          <Text style={styles.greeting}>{friendlyName}, ton rendu est prêt.</Text>
          <Text style={styles.intro}>
            Ton rendu généré avec {engineLabelText}
            {durationLabel ? ` (${durationLabel})` : ''} est terminé. Visionne la preview ci-dessous et continue directement sur ton workspace.
          </Text>
          {thumbnailUrl ? (
            <a href={viewHref} style={styles.thumbnailLink}>
              <Img src={thumbnailUrl} alt="Preview render" width={560} style={styles.thumbnail} />
            </a>
          ) : null}
          <Button href={trackedCtaHref} style={styles.button}>
            Voir le rendu
          </Button>
          <Text style={styles.secondary}>
            En cas de souci, contacte-nous sur <a href="mailto:support@maxvideo.ai" style={styles.link}>support@maxvideo.ai</a>.
          </Text>
          <Text style={styles.footer}>
            MaxVideoAI · Build the right engine for every shot.<br />
            Lien direct : <a href={trackedCtaHref} style={styles.link}>{trackedCtaHref}</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default RenderCompletedEmail;

const styles = {
  body: {
    margin: 0,
    padding: '32px 0',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    backgroundColor: '#0b1220',
    color: '#e9ecf5',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    background: 'linear-gradient(135deg, rgba(36,44,64,0.96), rgba(21,27,41,0.96))',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '36px',
    textAlign: 'left' as const,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  brandLabel: {
    fontSize: '15px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: '#ccd4ef',
  },
  logo: {
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  greeting: {
    fontSize: '24px',
    fontWeight: 600,
    margin: '16px 0 12px',
    color: '#f5f7fb',
  },
  intro: {
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 24px',
    color: 'rgba(233,236,245,0.85)',
  },
  thumbnailLink: {
    display: 'block',
    margin: '0 0 24px',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'block',
  },
  button: {
    display: 'inline-block',
    backgroundColor: '#61708b',
    color: '#ffffff',
    padding: '14px 28px',
    borderRadius: '999px',
    fontWeight: 600,
    textDecoration: 'none',
  },
  secondary: {
    fontSize: '13px',
    lineHeight: '1.6',
    margin: '24px 0 12px',
    color: 'rgba(233,236,245,0.7)',
  },
  link: {
    color: '#9fb4ff',
    textDecoration: 'none',
  },
  footer: {
    fontSize: '12px',
    lineHeight: '1.6',
    color: 'rgba(233,236,245,0.6)',
  },
};
