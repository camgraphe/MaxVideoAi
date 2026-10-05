import { persistPendingAnalyticsEvent } from '@/lib/analytics-client';
import { resolveBrowserCommercialAnalyticsAuthContext } from '@/lib/analytics/commercial-client';
import { consumePendingGoogleAuthCompletionEvent } from './login-helpers';

export function persistGoogleAuthCompleted(userCreatedAt?: string, appMetadata?: unknown, userId?: string, accessToken?: string): void {
  // A cookie proves navigation may proceed, but carries no account creation
  // evidence. Keep the intent available for a later verified user response.
  if (!userCreatedAt) return;
  if (userId) void resolveBrowserCommercialAnalyticsAuthContext(userId, accessToken, appMetadata);
  const eventName = consumePendingGoogleAuthCompletionEvent(userCreatedAt);
  if (!eventName) return;
  persistPendingAnalyticsEvent(eventName, {
    route_family: 'auth', auth_surface: 'login', method: 'google',
    ...(eventName === 'sign_up_completed' ? { email_confirmation_required: false } : {}),
  });
}
