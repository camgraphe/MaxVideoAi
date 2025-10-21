import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] = '2023-10-16';

const stripe =
  STRIPE_SECRET_KEY.trim().length > 0
    ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION })
    : null;

export async function GET(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe credentials are not configured.' }, { status: 500 });
  }

  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const clientIp =
      forwardedFor?.split(',')[0]?.trim() ||
      realIp?.trim() ||
      (typeof req.ip === 'string' && req.ip.trim()) ||
      '8.8.8.8';

    const useAccountTokens = process.env.USE_ACCOUNT_TOKENS === 'true';
    const tokenResource =
      (stripe as unknown as {
        accountTokens?: {
          create?: (params: Record<string, unknown>, options?: Stripe.RequestOptions) => Promise<{ id?: string }>;
        };
      }).accountTokens ?? null;
    const supportsAccountTokens = useAccountTokens && typeof tokenResource?.create === 'function';

    const createWithAccountToken = async () => {
      if (!tokenResource?.create) {
        throw new Error('Stripe account token resource unavailable');
      }
      const token = await tokenResource.create({
        account: {
          country: 'FR',
          business_type: 'individual',
          company: null,
          individual: {
            email: 'ops@maxvideoai.com',
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
            card_issuing: { requested: true },
          },
          controller: {
            requirement_collection: 'application',
            stripe_dashboard: { type: 'none' },
            fees: { payer: 'application' },
            losses: { payments: 'application' },
          },
          tos_shown_and_accepted: true,
        },
      });

      if (!token?.id) {
        throw new Error('Stripe account token missing id');
      }

      return stripe.accounts.create({
        account_token: token.id,
        business_profile: {
          name: 'MaxVideoAI Ops',
          url: 'https://maxvideoai.com',
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          card_issuing: { requested: true },
        },
      });
    };

    const createWithFallback = async () => {
      const account = await stripe.accounts.create({
        type: 'custom',
        country: 'FR',
        email: 'ops@maxvideoai.com',
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          card_issuing: { requested: true },
        },
        business_profile: {
          name: 'MaxVideoAI Ops',
          url: 'https://maxvideoai.com',
        },
      });

      try {
        await stripe.accounts.update(account.id, {
          tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: clientIp,
          },
        });
      } catch (updateError) {
        console.warn('[stripe] failed to record controller/tos on fallback account:', updateError);
      }

      return account;
    };

    const handleFallbackFailure = (error: unknown): NextResponse | undefined => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Failed to create Stripe account';
      console.error('[stripe] fallback creation failed:', message);
      if (message.toLowerCase().includes('account tokens')) {
        return NextResponse.json({ error: 'fr-account-token-required' }, { status: 500 });
      }
      return undefined;
    };

    let account: Stripe.Account;

    if (supportsAccountTokens) {
      try {
        account = await createWithAccountToken();
      } catch (tokenError) {
        const stripeErr = tokenError as Stripe.errors.StripeError | Error;
        const message = 'message' in stripeErr && typeof stripeErr.message === 'string' ? stripeErr.message : String(stripeErr);
        if (stripeErr instanceof Error) {
          console.error('[stripe] account token flow failed:', {
            type: (stripeErr as Stripe.errors.StripeError)?.type,
            code: (stripeErr as Stripe.errors.StripeError)?.code,
            param: (stripeErr as Stripe.errors.StripeError)?.param,
            message,
          });
        }
        const lowered = message.toLowerCase();
        if (lowered.includes('unrecognized request url')) {
          console.warn('[stripe] account token endpoint unavailable. Falling back to direct creation.');
          try {
            account = await createWithFallback();
          } catch (fallbackError) {
            const response = handleFallbackFailure(fallbackError);
            if (response) return response;
            throw fallbackError;
          }
        } else if (lowered.includes('account tokens')) {
          return NextResponse.json({ error: 'fr-account-token-required' }, { status: 500 });
        } else {
          throw tokenError;
        }
      }
    } else {
      console.warn('[stripe] account token flow disabled or unsupported; using fallback creation.');
      try {
        account = await createWithFallback();
      } catch (fallbackError) {
        const response = handleFallbackFailure(fallbackError);
        if (response) return response;
        throw fallbackError;
      }
    }

    console.log('[stripe] Custom account created:', account.id);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      type: 'account_onboarding',
      refresh_url: 'https://maxvideoai.com/reauth',
      return_url: 'https://maxvideoai.com/success',
    });

    return NextResponse.json(
      {
        accountId: account.id,
        onboardingUrl: accountLink.url,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const StripeErrorCtor =
      (Stripe as typeof Stripe & { errors?: { StripeError?: typeof Error } }).errors?.StripeError ?? null;
    if (StripeErrorCtor && error instanceof StripeErrorCtor) {
      const stripeErr = error as { type?: string; code?: string; param?: string; message?: string };
      console.error('[stripe] setup-custom-account error:', {
        type: stripeErr.type,
        code: stripeErr.code,
        param: stripeErr.param,
        message: stripeErr.message,
      });
      const message = stripeErr.message ?? 'Stripe error';
      if (message.toLowerCase().includes('account token')) {
        return NextResponse.json({ error: 'fr-account-token-required' }, { status: 500 });
      }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Failed to create Stripe account';
    console.error('[stripe] setup-custom-account unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
