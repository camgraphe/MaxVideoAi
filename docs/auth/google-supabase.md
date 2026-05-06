# Google OAuth & Custom Email From Address

This app now surfaces a **Continue with Google** option in the `/login` screen. To finish the setup in Supabase:

1. Open the Supabase dashboard for this project and navigate to **Authentication → Providers**.
2. Enable **Google** and paste the Client ID/Secret from your Google Cloud OAuth app.
3. Set the *Redirect URL* / Site URL to `https://maxvideoai.com` (or your preview domain).
4. Add both auth paths explicitly to **Additional Redirect URLs**:
   - `https://maxvideoai.com/auth/callback`
   - `https://maxvideoai.com/login`
   - the same paths for any preview domains you use
   Supabase only accepts exact paths. The app starts Google OAuth with `/auth/callback`, then forwards the PKCE `code` to `/login` so the browser can exchange it with the original verifier.
5. If you run the workspace locally, add the same domain to the **Additional Redirect URLs** list (e.g. `http://localhost:3000`).

For email delivery with your own domain:

1. In the Supabase dashboard go to **Authentication → Email Templates → SMTP settings**.
2. Provide SMTP credentials from your provider (Resend, Postmark, Mailgun, etc.) using an address like `auth@maxvideoai.com`.
3. Update DNS (SPF, DKIM, DMARC) for the domain so the provider can send on your behalf.
4. Once verified, Supabase sends all auth emails (sign-up, magic link, reset) via that mailbox instead of the default `supabase.io` sender.

Make sure `NEXT_PUBLIC_SITE_URL` in your environment matches the public domain so links in those emails point back to the correct host. During development you can set it to `http://localhost:3000`.
