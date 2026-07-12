import type { Dictionary } from '@/lib/i18n/types';

export type ClientMessageNamespace = keyof Dictionary;

export const HOMEPAGE_CLIENT_MESSAGE_NAMESPACES = ['nav', 'footer'] as const satisfies readonly ClientMessageNamespace[];
export const MARKETING_CLIENT_MESSAGE_NAMESPACES = HOMEPAGE_CLIENT_MESSAGE_NAMESPACES;

export function pickClientMessageNamespaces<T extends Record<string, unknown>, K extends keyof T>(
  dictionary: T,
  namespaces?: readonly K[]
): T {
  if (!namespaces) {
    return dictionary;
  }

  return Object.fromEntries(namespaces.map((namespace) => [namespace, dictionary[namespace]])) as T;
}
