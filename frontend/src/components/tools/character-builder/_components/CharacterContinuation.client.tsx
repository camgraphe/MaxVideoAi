'use client';
import {useRequireAuth} from '@/hooks/useRequireAuth';
import {useI18n} from '@/lib/i18n/I18nProvider';
import {MediaDestinationActions} from '@/components/library/MediaDestinationActions.client';
import type {CharacterBuilderResult} from '@/types/character-builder';
/** The shared action resolves the exact saved job output before creating a handoff. */
export function CharacterContinuation({result}:{result:CharacterBuilderResult}){
 const {user}=useRequireAuth({redirectIfLoggedOut:false}),{locale}=useI18n();
 return <div className="px-3 pb-3"><MediaDestinationActions userId={user?.id} locale={locale} sourceEngineId={result.engineId} asset={{id:result.id,jobId:result.jobId,url:result.url,thumbUrl:result.thumbUrl,kind:'image',source:'gallery'}}/></div>;
}
