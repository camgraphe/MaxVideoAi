import archive from './launch-example-pricing-records.json';

const receipts = new Map(archive.records.map((record) => [record.jobId, record]));

/** Historical display receipts only; never used for quotes, charges or refunds. */
export function findLaunchExamplePrice(input: {
  jobId: string;
  engineId: string;
  durationSec: number;
  currency: string | null;
}) {
  const receipt = receipts.get(input.jobId);
  if (
    !receipt ||
    receipt.engineId !== input.engineId ||
    receipt.durationSec !== input.durationSec ||
    (input.currency !== null && receipt.currency !== input.currency)
  ) {
    return null;
  }
  return receipt;
}
