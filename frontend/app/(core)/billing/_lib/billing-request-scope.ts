export type BillingRequestToken = Readonly<{
  accountId: string;
  requestId: number;
}>;

export function createBillingRequestScope() {
  let activeAccountId: string | null = null;
  let activeRequestId = 0;

  return {
    begin(accountId: string): BillingRequestToken {
      activeAccountId = accountId;
      activeRequestId += 1;
      return { accountId, requestId: activeRequestId };
    },
    invalidate(): void {
      activeAccountId = null;
      activeRequestId += 1;
    },
    isCurrent(token: BillingRequestToken): boolean {
      return token.accountId === activeAccountId && token.requestId === activeRequestId;
    },
  };
}
