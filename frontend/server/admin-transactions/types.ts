export type RawTransactionRow = {
  receipt_id: number;
  user_id: string | null;
  type: string;
  amount_cents: number | string | null;
  currency: string | null;
  description: string | null;
  job_id: string | null;
  created_at: string;
  job_status: string | null;
  job_payment_status: string | null;
  job_engine_label: string | null;
  job_video_url: string | null;
  job_thumb_url: string | null;
  job_message: string | null;
  job_progress: number | null;
  job_created_at: string | null;
  job_duration_sec: number | null;
  has_refund: boolean;
  latest_charge_id: number | null;
};

export type AdminTransactionRecord = {
  receiptId: number;
  userId: string | null;
  userEmail: string | null;
  type: 'topup' | 'charge' | 'refund' | 'discount' | 'tax';
  amountCents: number;
  currency: string;
  description: string | null;
  jobId: string | null;
  jobStatus: string | null;
  jobPaymentStatus: string | null;
  jobEngineLabel: string | null;
  jobVideoUrl: string | null;
  jobDurationSec: number | null;
  jobCreatedAt: string | null;
  jobProgress: number | null;
  jobMessage: string | null;
  createdAt: string;
  hasRefund: boolean;
  latestChargeId: number | null;
  isLatestCharge: boolean;
  canRefund: boolean;
};

export type TransactionAnomalies = {
  largeRefunds: Array<{
    receiptId: number;
    userId: string | null;
    amountCents: number;
    currency: string;
    jobId: string | null;
    createdAt: string;
    description: string | null;
  }>;
  frequentRefundUsers: Array<{
    userId: string | null;
    refundCount: number;
    totalCents: number;
    lastRefundAt: string | null;
  }>;
  invalidCharges: Array<{
    receiptId: number;
    userId: string | null;
    amountCents: number;
    jobId: string | null;
    createdAt: string;
    description: string | null;
  }>;
};

export type ManualWalletRefundParams = {
  jobId: string;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

export type ManualWalletRefundByReceiptParams = {
  receiptId: number;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

export type ManualRefundResult = { refundReceiptId: number; createdAt: string };

export type ManualWalletTopUpParams = {
  userId: string;
  amountCents: number;
  currency?: string | null;
  description?: string | null;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

export type ManualWalletTopUpResult = {
  receiptId: number;
  createdAt: string;
  amountCents: number;
  currency: string;
};
