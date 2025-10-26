# Google OAuth & Custom Email From Address

This app now surfaces a **Continue with Google** option in the `/login` screen. To finish the setup in Supabase:

1. Open the Supabase dashboard for this project and navigate to **Authentication → Providers**.
2. Enable **Google** and paste the Client ID/Secret from your Google Cloud OAuth app.
3. Set the *Redirect URL* to `https://maxvideoai.com` (or your preview domain). Supabase will append the `?next=...` query automatically.
4. Add `/login` explicitly to **Additional Redirect URLs** (e.g. `https://maxvideoai.com/login` plus any preview domains). Supabase only accepts exact paths, so without this the Google flow drops back to the homepage.
5. If you run the workspace locally, add the same domain to the **Additional Redirect URLs** list (e.g. `http://localhost:3000`).

For email delivery with your own domain:

1. In the Supabase dashboard go to **Authentication → Email Templates → SMTP settings**.
2. Provide SMTP credentials from your provider (Resend, Postmark, Mailgun, etc.) using an address like `auth@maxvideoai.com`.
3. Update DNS (SPF, DKIM, DMARC) for the domain so the provider can send on your behalf.
4. Once verified, Supabase sends all auth emails (sign-up, magic link, reset) via that mailbox instead of the default `supabase.io` sender.

Make sure `NEXT_PUBLIC_SITE_URL` in your environment matches the public domain so links in those emails point back to the correct host. During development you can set it to `http://localhost:3000`.
