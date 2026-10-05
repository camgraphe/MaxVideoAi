'use client';

import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowUpRight,Expand,Music2,X} from 'lucide-react';
import {useI18n} from '@/lib/i18n/I18nProvider';
import {useAccessibleModal} from '@/components/ui/useAccessibleModal';
import {buildLoginHref} from '@/lib/auth-entry-href';
import {listenForGuestCreationLogin} from '@/lib/guest-creation-continuation';
import {serializeStudioGuestDraft} from '../_lib/studio-guest-draft';
import {studioMarketingStarterMessage} from '../_lib/studio-project-marketing-entry';
import {STUDIO_GUEST_MEDIA,studioGuestDemoCopy,type StudioGuestAction,type StudioGuestCopy} from '../_lib/studio-guest-demo';
import {ImageConversationComposer} from '../conversation/[projectId]/_components/ImageConversationComposer.client';
import styles from '../conversation/[projectId]/image-conversation.module.css';
import shelf from '../conversation/[projectId]/conversation-media-shelf.module.css';
import demo from './studio-guest-demo.module.css';

type DemoView={image:'product'|'character'}|{action:StudioGuestAction};

export function StudioGuestDemo({starter,available=false}:{starter?:string;available?:boolean}) {
  const {locale}=useI18n();
  const copy=studioGuestDemoCopy(locale);
  const [text,setText]=useState(()=>studioMarketingStarterMessage(starter,locale));
  const [view,setView]=useState<DemoView|null>(null);
  const [audioError,setAudioError]=useState(false);
  const audio=useRef<HTMLAudioElement>(null);
  const libraryTrigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>listenForGuestCreationLogin('/app/studio',()=>serializeStudioGuestDraft(text.trim()?text:copy.personalBrief)),[text,copy.personalBrief]);
  useEffect(()=>{
    const pause=()=>{if(document.hidden)audio.current?.pause();};
    document.addEventListener('visibilitychange',pause);
    return ()=>document.removeEventListener('visibilitychange',pause);
  },[]);
  function gate(action:StudioGuestAction) {if(available)setView({action});}
  return <section className={styles.studio} aria-label="Studio" data-studio-guest-demo>
    <header className={styles.header}>
      <div><h1>Studio<span className={styles.headerDot}>.</span></h1><span>{copy.project}</span></div>
      <button className={demo.primary} disabled={!available} onClick={()=>gate('create')}>{copy.create}<ArrowUpRight size={14}/></button>
    </header>
    <div className={`${styles.canvas} ${demo.canvas}`}
      onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect=available?'copy':'none';}}}
      onDrop={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();gate('import');}}}>
      <aside className={shelf.shelf} data-expanded="true" aria-label={copy.references}>
        <div className={shelf.heading}><span>{copy.references}</span></div>
        <div className={shelf.content}>
          {(['product','character'] as const).map((kind,index)=><article key={kind} className={shelf.card} data-demo-reference={kind}>
            <div className={shelf.surface} style={{aspectRatio:1}}>
              <button className={shelf.select} aria-label={`${copy.enlarge} Image ${index+1}`} onClick={()=>setView({image:kind})}>
                <Image src={STUDIO_GUEST_MEDIA[kind]} alt={copy[kind]} width={900} height={900} sizes="(max-width:600px) 188px, (max-width:1100px) 154px, 290px" loading="lazy"/>
                <span className={demo.enlarge}><Expand size={15}/></span>
              </button>
            </div>
            <div className={shelf.caption}><span className={shelf.captionLabel}>Image {index+1} · {copy[kind]}</span></div>
          </article>)}
          <article className={`${shelf.card} ${demo.musicCard}`} data-demo-reference="music">
            <div className={`${shelf.surface} ${demo.musicSurface}`}>
              <div className={shelf.audio}><Music2 size={25}/><audio ref={audio} src={STUDIO_GUEST_MEDIA.music} controls preload="none" aria-label={copy.music} onError={()=>setAudioError(true)}/></div>
            </div>
            <div className={shelf.caption}><span className={shelf.captionLabel}>Audio 1 · {copy.music}</span></div>
            {audioError&&<p className={demo.audioError} role="alert">{copy.audioError}</p>}
          </article>
        </div>
      </aside>
      <div className={styles.conversation}>
        <div className={styles.log} aria-label={copy.project}>
          <article className={styles.turn}>
            <p className={styles.userMessage}>{copy.initial}</p>
            <div className={styles.reply}><p>{copy.request}</p></div>
          </article>
          <article className={styles.turn}>
            <p className={styles.userMessage}>{copy.brief}</p>
            <div className={styles.reply}>
              <p>{copy.proposal}</p>
              <ol className={demo.shots}>{copy.shots.map((shot,index)=><li key={shot.title}><strong>{shot.title}</strong><small>{index===0?'0–7 s':'7–14 s'}</small><p>{shot.body}</p></li>)}</ol>
              <p>{copy.sound}</p>
              <p className={demo.confirmation}>{copy.confirmation}</p>
            </div>
            <div className={demo.plan} aria-label={copy.plan}>
              <span>{copy.plan}</span>
              <div>{copy.shots.map((shot,index)=><button key={shot.title} disabled={!available} onClick={()=>gate('edit')}><span>{index===0?'00:00':'00:07'}</span>{shot.title}</button>)}</div>
              <div className={demo.musicTrack}><Music2 size={13}/>Audio 1 · 00:00 → 00:14</div>
            </div>
            <button className={demo.primary} disabled={!available} onClick={()=>gate('create')}>{copy.makeAd}<ArrowUpRight size={15}/></button>
          </article>
        </div>
        <div className={demo.composerRegion}>
          <ImageConversationComposer text={text} onTextChange={setText} onSend={()=>gate('send')} blocked={!available} onOpenLibrary={()=>gate('import')} libraryTrigger={libraryTrigger} libraryLabel={copy.addMedia} locale={locale}/>
        </div>
        <p className={styles.footnote}>{available?copy.note:copy.unavailable}</p>
      </div>
    </div>
    {view&&<DemoDialog view={view} copy={copy} locale={locale} onClose={()=>setView(null)}/>}
  </section>;
}

function DemoDialog({view,copy,locale,onClose}:{view:DemoView;copy:StudioGuestCopy;locale:'en'|'fr'|'es';onClose:()=>void}) {
  const {dialogRef,onDialogKeyDown}=useAccessibleModal({onClose});
  const image='image' in view?view.image:null;
  return <div className={demo.backdrop} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div ref={dialogRef} className={demo.dialog} role="dialog" aria-modal="true" aria-labelledby="studio-guest-dialog-title" tabIndex={-1} onKeyDown={onDialogKeyDown}>
      <header><h2 id="studio-guest-dialog-title">{image?copy[image]:copy.loginTitle}</h2><button aria-label={copy.close} onClick={onClose}><X size={20}/></button></header>
      {image?<Image src={STUDIO_GUEST_MEDIA[image]} alt={copy[image]} width={900} height={900} sizes="(max-width:600px) 90vw, 600px"/>:<>
        <p>{'action' in view?copy.actions[view.action]:''}</p><small>{copy.loginNote}</small>
        <Link className={demo.primary} data-modal-initial-focus="true" href={buildLoginHref({mode:'signup',nextPath:'/app/studio',locale})} prefetch={false}>{copy.signup}</Link>
        <Link href={buildLoginHref({mode:'signin',nextPath:'/app/studio',locale})} prefetch={false}>{copy.signin}</Link>
      </>}
    </div>
  </div>;
}
