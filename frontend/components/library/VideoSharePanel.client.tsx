'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Check, Download, Ellipsis, Link2, Linkedin, Mail, Share2 } from 'lucide-react';
import type { AssetBrowserAsset } from './AssetLibraryBrowser';
import { buildAppDownloadUrl, suggestDownloadFilename } from '@/lib/download';
import { copyTextToClipboard } from '@/lib/clipboard';
import { buildVideoShareIntent, buildXVideoPostIntent, type LinkShareTarget } from './video-share-intents';
import { videoShareCopy } from './video-share-copy';

type VideoTarget = 'tiktok' | 'reels' | 'shorts' | 'x';

function BrandIcon({ name }: { name: 'tiktok' | 'instagram' | 'youtubeshorts' | 'x' | 'whatsapp' | 'facebook' | 'telegram' }) {
  return <Image src={`/brand/share/${name}.svg`} width={21} height={21} alt="" aria-hidden unoptimized />;
}

export function VideoSharePanel({ asset, locale, fixedShareUrl }: { asset: AssetBrowserAsset; locale: string; fixedShareUrl?: string }) {
  const copy = videoShareCopy(locale);
  const panelRef = useRef<HTMLElement>(null);
  const [signature, setSignature] = useState(copy.defaultSignature);
  const [hashtag, setHashtag] = useState('#MaxVideoAI');
  const [shareUrl, setShareUrl] = useState<string | null>(fixedShareUrl ?? null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(!fixedShareUrl);
  const [error, setError] = useState<string | null>(null);
  const [activeVideoTarget, setActiveVideoTarget] = useState<VideoTarget | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preparingFile, setPreparingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const filename = suggestDownloadFilename(asset.url, 'maxvideoai-video.mp4');
  const downloadHref = asset.source === 'public-example' && asset.jobId
    ? `/api/video-shares/public-download?${new URLSearchParams({ jobId: asset.jobId })}`
    : buildAppDownloadUrl(asset.url, filename);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ block: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeVideoTarget, moreOpen, fileError]);

  useEffect(() => {
    if (fixedShareUrl) return;
    const controller = new AbortController();
    void fetch('/api/video-shares', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ assetId: asset.id, sourceOutputId: asset.sourceOutputId, jobId: asset.jobId, url: asset.url, source: asset.source }),
    }).then(async response => {
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok || typeof body.url !== 'string' || (body.token !== null && typeof body.token !== 'string')) {
        throw new Error(response.status === 422 ? 'unavailable' : 'failed');
      }
      setShareUrl(body.url);
      setToken(body.token);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error && failure.message === 'unavailable' ? copy.linkUnavailable : copy.shareFailed);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [asset.id, asset.sourceOutputId, asset.jobId, asset.url, asset.source, copy.linkUnavailable, copy.shareFailed, fixedShareUrl]);

  useEffect(() => {
    setFile(null);
    setFileError(null);
    if (!activeVideoTarget) return;
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
      setFileError(copy.fileUnavailable);
      return;
    }
    const controller = new AbortController();
    setPreparingFile(true);
    void fetch(downloadHref, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('download');
      const blob = await response.blob();
      const prepared = new File([blob], filename, { type: blob.type || 'video/mp4' });
      if (!navigator.canShare({ files: [prepared] })) throw new Error('unsupported');
      setFile(prepared);
    }).catch(() => { if (!controller.signal.aborted) setFileError(copy.fileUnavailable); })
      .finally(() => { if (!controller.signal.aborted) setPreparingFile(false); });
    return () => controller.abort();
  }, [activeVideoTarget, copy.fileUnavailable, downloadHref, filename]);

  const copyLink = async () => {
    if (!shareUrl) return;
    const ok = await copyTextToClipboard(shareUrl);
    setFeedback(ok ? copy.copied : copy.shareFailed);
  };
  const copyCaption = async () => {
    const ok = await copyTextToClipboard(activeVideoTarget ? hashtag : signature);
    setFeedback(ok ? (activeVideoTarget ? copy.hashtagCopied : copy.signatureCopied) : copy.shareFailed);
  };
  const shareFile = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], ...(hashtag.trim() ? { text: hashtag.trim() } : {}) });
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === 'AbortError')) setFileError(copy.fileUnavailable);
    }
  };
  const shareNativeLink = async () => {
    if (!shareUrl || typeof navigator.share !== 'function') return;
    try { await navigator.share({ url: shareUrl, ...(signature.trim() ? { text: signature.trim() } : {}) }); }
    catch (failure) { if (!(failure instanceof Error && failure.name === 'AbortError')) setFeedback(copy.shareFailed); }
  };
  const revoke = async () => {
    if (!token) return;
    setRevoking(true);
    try {
      const response = await fetch('/api/video-shares', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      if (!response.ok) throw new Error('revoke');
      setToken(null);
      setShareUrl(null);
      setError(copy.linkRevoked);
    } catch { setFeedback(copy.shareFailed); }
    finally { setRevoking(false); }
  };

  const linkIntent = (target: LinkShareTarget) => shareUrl ? buildVideoShareIntent(target, shareUrl, target === 'x' ? hashtag : signature, locale) : undefined;
  const chooseVideoTarget = (target: VideoTarget) => {
    setActiveVideoTarget(current => current === target ? null : target);
    setMoreOpen(false);
    setFeedback(null);
  };
  const xManualFlow = <>
    <div className="app-video-share-file-actions">
      <a href={downloadHref} data-analytics-event="cta_click" data-analytics-cta-name="video_save_mp4" data-analytics-cta-location="share_panel"><Download size={17} aria-hidden />1. {copy.saveMp4}</a>
      <a href={buildXVideoPostIntent(hashtag, shareUrl)} target="_blank" rel="noopener noreferrer" data-analytics-event="cta_click" data-analytics-cta-name="video_share_x_video" data-analytics-cta-location="share_panel"><BrandIcon name="x" />2. {copy.xOpenComposer}</a>
    </div>
    <small>{copy.xAttachVideo}</small>
  </>;

  return <section ref={panelRef} className="app-media-share app-video-share" aria-label={copy.heading}>
    <div className="app-video-share-destinations">
      <button type="button" onClick={() => void copyLink()} disabled={!shareUrl} aria-label={copy.copied === feedback ? copy.copied : copy.link} data-analytics-event="cta_click" data-analytics-cta-name="video_share_link" data-analytics-cta-location="share_panel"><Link2 size={21} aria-hidden /><span>{copy.link}</span></button>
      <a href={linkIntent('email')} aria-disabled={!shareUrl} onClick={event => { if (!shareUrl) event.preventDefault(); }} data-analytics-event="cta_click" data-analytics-cta-name="video_share_email" data-analytics-cta-location="share_panel"><Mail size={21} aria-hidden /><span>{copy.email}</span></a>
      <button type="button" aria-pressed={activeVideoTarget === 'tiktok'} onClick={() => chooseVideoTarget('tiktok')} data-analytics-event="cta_click" data-analytics-cta-name="video_share_tiktok" data-analytics-cta-location="share_panel"><BrandIcon name="tiktok" /><span>TikTok</span></button>
      <button type="button" aria-pressed={activeVideoTarget === 'reels'} onClick={() => chooseVideoTarget('reels')} data-analytics-event="cta_click" data-analytics-cta-name="video_share_reels" data-analytics-cta-location="share_panel"><BrandIcon name="instagram" /><span>{copy.reels}</span></button>
      <button type="button" aria-pressed={activeVideoTarget === 'shorts'} onClick={() => chooseVideoTarget('shorts')} data-analytics-event="cta_click" data-analytics-cta-name="video_share_shorts" data-analytics-cta-location="share_panel"><BrandIcon name="youtubeshorts" /><span>{copy.shorts}</span></button>
      <button type="button" aria-pressed={activeVideoTarget === 'x'} onClick={() => chooseVideoTarget('x')} data-analytics-event="cta_click" data-analytics-cta-name="video_share_x" data-analytics-cta-location="share_panel"><BrandIcon name="x" /><span>X</span></button>
      <button type="button" aria-expanded={moreOpen} onClick={() => { setMoreOpen(value => !value); setActiveVideoTarget(null); }} data-analytics-event="cta_click" data-analytics-cta-name="video_share_more" data-analytics-cta-location="share_panel"><Ellipsis size={21} aria-hidden /><span>{copy.more}</span></button>
    </div>
    {activeVideoTarget === 'x' ? <div className="app-video-share-x-flow">
      {file || preparingFile ? <>
        <button type="button" disabled={!file || preparingFile} onClick={() => void shareFile()} data-analytics-event="cta_click" data-analytics-cta-name="video_share_x_file_apps" data-analytics-cta-location="share_panel"><Share2 size={17} aria-hidden />{preparingFile ? copy.preparing : copy.xShareApps}</button>
        <small>{copy.xNativeHint}</small>
      </> : null}
      {file || preparingFile ? <details><summary>{copy.xManualFallback}</summary>{xManualFlow}</details> : <><p>{copy.xVideoIntro}</p>{xManualFlow}</>}
      <a href={linkIntent('x')} target="_blank" rel="noopener noreferrer" aria-disabled={!shareUrl} onClick={event => { if (!shareUrl) event.preventDefault(); }} data-analytics-event="cta_click" data-analytics-cta-name="video_share_x_link" data-analytics-cta-location="share_panel">{copy.xLinkOnly}</a>
    </div> : activeVideoTarget ? <div className="app-video-share-file-actions">
      {file || preparingFile ? <button type="button" disabled={!file || preparingFile} onClick={() => void shareFile()} data-analytics-event="cta_click" data-analytics-cta-name="video_share_file_apps" data-analytics-cta-location="share_panel"><Share2 size={17} aria-hidden />{preparingFile ? copy.preparing : copy.shareApps}</button> : null}
      <a href={downloadHref} data-analytics-event="cta_click" data-analytics-cta-name="video_save_mp4" data-analytics-cta-location="share_panel"><Download size={17} aria-hidden />{copy.saveMp4}</a>
    </div> : null}
    {file && activeVideoTarget !== 'x' && activeVideoTarget ? <p className="app-video-share-note">{copy.nativeVideoHint}</p> : null}
    {fileError && activeVideoTarget && (activeVideoTarget !== 'x' || file) ? <p className="app-video-share-note" role="status">{fileError}</p> : null}
    {moreOpen ? <div className="app-video-share-more">
      {(['whatsapp', 'telegram', 'linkedin', 'facebook'] as const).map(target => <a key={target} href={linkIntent(target)} target="_blank" rel="noopener noreferrer" aria-disabled={!shareUrl} onClick={event => { if (!shareUrl) event.preventDefault(); }}>
        {target === 'linkedin' ? <Linkedin size={21} aria-hidden /> : <BrandIcon name={target} />}{target === 'whatsapp' ? 'WhatsApp' : target === 'telegram' ? 'Telegram' : target === 'linkedin' ? 'LinkedIn' : 'Facebook'}
      </a>)}
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? <button type="button" disabled={!shareUrl} onClick={() => void shareNativeLink()}><Share2 size={17} aria-hidden />{copy.nativeLink}</button> : null}
    </div> : null}
    <label className="app-video-share-signature"><span>{activeVideoTarget ? copy.hashtag : copy.signature}</span><input value={activeVideoTarget ? hashtag : signature} onChange={event => activeVideoTarget ? setHashtag(event.target.value) : setSignature(event.target.value)} maxLength={240} /></label>
    {activeVideoTarget || moreOpen ? <button className="app-video-share-copy-signature" type="button" onClick={() => void copyCaption()} disabled={activeVideoTarget ? !hashtag.trim() : !signature.trim()}>{feedback === (activeVideoTarget ? copy.hashtagCopied : copy.signatureCopied) ? <Check size={14} aria-hidden /> : null}{feedback === (activeVideoTarget ? copy.hashtagCopied : copy.signatureCopied) ? feedback : activeVideoTarget ? copy.copyHashtag : copy.copySignature}</button> : null}
    <div className="app-video-share-footnote">
      <small>{loading ? copy.preparing : error ?? (asset.source === 'public-example' ? copy.exampleNotice : copy.publicNotice)}</small>
      {token ? <button type="button" onClick={() => void revoke()} disabled={revoking}>{revoking ? copy.revoking : copy.revoke}</button> : null}
    </div>
    {feedback && feedback !== copy.signatureCopied && feedback !== copy.hashtagCopied ? <p role="status" className="app-video-share-feedback">{feedback}</p> : null}
  </section>;
}
