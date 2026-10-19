import React from 'react';
import { notFound } from 'next/navigation';
import type { AppLocale } from '@/i18n/locales';
import { isCreatorToolPublic, type CreatorToolId } from '@/lib/toolbox/creator-availability';
import { CreatorLandingView } from './CreatorLandingView';
import { buildCreatorToolMetadata } from './creator-marketing-routing';
export type CreatorRouteProps = { params: Promise<{ locale: AppLocale }> };
export async function creatorMetadata(id: CreatorToolId, props: CreatorRouteProps) {
  if (!isCreatorToolPublic(id)) notFound();
  return buildCreatorToolMetadata(id, (await props.params).locale);
}
export async function CreatorMarketingRoute({ id, params }: CreatorRouteProps & { id: CreatorToolId }) {
  if (!isCreatorToolPublic(id)) notFound();
  return <CreatorLandingView id={id} locale={(await params).locale}/>;
}
