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

export type WalletLowBalanceEmailProps = {
  recipientName?: string | null;
  balanceCents: number;
  currency?: string;
  thresholdCents: number;
};

function formatCurrency(cents: number, currency?: string): string {
  const code = (currency ?? 'USD').toUpperCase();
  return Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(cents / 100)));
}

export function WalletLowBalanceEmail({ recipientName, balanceCents, currency, thresholdCents }: WalletLowBalanceEmailProps) {
  const siteUrl = resolveSiteUrl();
  const topUpUrl = withUtm(`${siteUrl}/billing`, 'wallet-low-balance');
  const friendlyName = recipientName ?? 'Salut';
  const balanceLabel = formatCurrency(balanceCents, currency);
  const thresholdLabel = formatCurrency(thresholdCents, currency);
  const previewText = `Ton wallet MaxVideoAI passe sous ${thresholdLabel}. Recharge-le pour garantir tes prochains rendus.`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.logoRow}>
            <Img src="https://www.maxvideo.ai/apple-touch-icon.png" width={34} height={34} alt="MaxVideoAI" style={styles.logo} />
            <Text style={styles.brandLabel}>MAXVIDEOAI</Text>
          </Section>
          <Text style={styles.greeting}>{friendlyName}, ton wallet approche du seuil bas.</Text>
          <Text style={styles.intro}>
            Il reste <strong>{balanceLabel}</strong> sur ton wallet MaxVideoAI. En dessous de {thresholdLabel}, certains rendus pourraient être bloqués.
          </Text>
          <Button href={topUpUrl} style={styles.button}>
            Recharger mon wallet
          </Button>
          <Text style={styles.secondary}>
            Astuce : programme une alerte Slack ou une recharge automatique pour ton équipe afin d’éviter toute interruption.
          </Text>
          <Text style={styles.footer}>
            MaxVideoAI · Build the right engine for every shot.<br />
            Besoin d’aide ? <a href="mailto:support@maxvideo.ai" style={styles.link}>support@maxvideo.ai</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WalletLowBalanceEmail;

const styles = {
  body: {
    margin: 0,
    padding: '32px 0',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    backgroundColor: '#0b1220',
    color: '#e9ecf5',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    background: 'linear-gradient(135deg, rgba(36,44,64,0.96), rgba(21,27,41,0.96))',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '32px',
    textAlign: 'left' as const,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  brandLabel: {
    fontSize: '14px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    color: '#ccd4ef',
  },
  logo: {
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  greeting: {
    fontSize: '22px',
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
  button: {
    display: 'inline-block',
    backgroundColor: '#61708b',
    color: '#ffffff',
    padding: '12px 26px',
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
