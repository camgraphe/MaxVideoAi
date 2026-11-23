import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { loadSonioxDictationUsage } from '@/server/soniox-dictation-usage';

const integer = new Intl.NumberFormat('en-US');
const minutes = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });

const usageNotice = {
  'not-configured': 'Set SONIOX_USAGE_API_KEY to enable usage reporting.',
  'access-denied': 'Check that the Soniox usage key belongs to the dictation project and has Usage and limits enabled.',
  unavailable: 'Soniox usage is temporarily unavailable. Try reloading this page.',
};

export async function SonioxDictationUsagePanel() {
  const usage = await loadSonioxDictationUsage({
    apiKey: process.env.SONIOX_USAGE_API_KEY,
    region: process.env.SONIOX_REGION,
  });

  return (
    <AdminSection
      title="Soniox dictation"
      description="Last 7 days · All accounts · Completed sessions since tracking began"
    >
      {usage.status === 'ready' ? (
        <AdminMetricGrid
          density="compact"
          columnsClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
          items={[
            { label: 'Unique accounts', value: integer.format(usage.accounts) },
            { label: 'Dictations', value: integer.format(usage.sessions) },
            {
              label: 'Audio minutes',
              value: usage.audioMs > 0 && usage.audioMs < 6000 ? '<0.1' : minutes.format(usage.audioMs / 60000),
            },
            {
              label: 'Tokens',
              value: integer.format(usage.inputAudioTokens + usage.inputTextTokens + usage.outputTextTokens),
              helper: [
                integer.format(usage.inputAudioTokens) + ' audio in',
                integer.format(usage.inputTextTokens) + ' text in',
                integer.format(usage.outputTextTokens) + ' text out',
              ].join(' · '),
            },
            {
              label: 'Soniox cost',
              value: usage.costUsd > 0 && usage.costUsd < 0.0001 ? '<$0.0001' : usd.format(usage.costUsd),
            },
          ]}
        />
      ) : (
        <AdminNotice tone={usage.status === 'not-configured' ? 'default' : 'warning'}>
          {usageNotice[usage.status]}
        </AdminNotice>
      )}
    </AdminSection>
  );
}
