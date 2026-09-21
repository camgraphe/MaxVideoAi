type PasswordSignupData = {
  user: { id: string; identities?: readonly unknown[] } | null;
  session: object | null;
};

export async function submitPasswordSignupConsents(
  data: PasswordSignupData,
  submitConsents: (userId: string) => Promise<void>
): Promise<boolean> {
  // Supabase masks an existing confirmed account with a synthetic user and
  // empty identities. That id cannot own consent records in our application.
  if (!data.user || (!data.session && data.user.identities?.length === 0)) {
    return false;
  }
  await submitConsents(data.user.id);
  return true;
}
