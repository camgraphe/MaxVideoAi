type PasswordSignupData = {
  user: { id: string; identities?: readonly unknown[] } | null;
  session: { access_token: string; user: { id: string } } | null;
};

export async function submitPasswordSignupConsents(
  data: PasswordSignupData,
  submitConsents: (userId: string, accessToken: string) => Promise<void>
): Promise<boolean> {
  // A user id alone is not proof of ownership. Unconfirmed and obfuscated
  // signups must complete authenticated reconsent after email verification.
  if (!data.user || !data.session?.access_token || data.session.user.id !== data.user.id) {
    return false;
  }
  await submitConsents(data.user.id, data.session.access_token);
  return true;
}
