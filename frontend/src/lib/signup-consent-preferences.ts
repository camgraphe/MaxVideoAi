// This is a form draft, never proof of identity, age or legal acceptance.
const key = (userId: string) => `legal:signup-marketing:${userId}`;

export function rememberSignupMarketingPreference(userId: string, value: boolean) {
  try { window.localStorage.setItem(key(userId), String(value)); } catch { /* optional browser storage */ }
}

export function readSignupMarketingPreference(userId: string): boolean | null {
  try {
    const value = window.localStorage.getItem(key(userId));
    return value === 'true' ? true : value === 'false' ? false : null;
  } catch { return null; }
}

export function clearSignupMarketingPreference(userId: string) {
  try { window.localStorage.removeItem(key(userId)); } catch { /* optional browser storage */ }
}
