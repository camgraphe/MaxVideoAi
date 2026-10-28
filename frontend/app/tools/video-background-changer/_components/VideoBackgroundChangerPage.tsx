import Link from 'next/link';
import type { VideoBackgroundMedia } from '../_lib/media';
import { VideoBackgroundComparison } from './VideoBackgroundComparison.client';
import styles from '../video-background-changer.module.css';

export function VideoBackgroundChangerPage({ media }: { media: VideoBackgroundMedia }) {
  return (<div id="main" className={[styles["page"]].join(" ")}>
    <section className={[styles["hero"],styles["wrap"]].join(" ")} aria-labelledby="hero-title">
      <p className={[styles["eyebrow"]].join(" ")}><span></span>AI VIDEO BACKGROUND CHANGER</p>
      <div className={[styles["hero-grid"]].join(" ")}>
        <h1 id="hero-title">Change the scene.<br /><span>Start with your take.</span></h1>
        <div className={[styles["hero-intro"]].join(" ")}><p>Give the video you already have a different setting. Describe the place; Wan 3 Prime creates a new version guided by your clip.</p><Link className={[styles["button"],styles["primary"]].join(" ")} href="/app?engine=wan-3-prime&mode=v2v" prefetch={false}>Change my video background <span aria-hidden="true">↗</span></Link><p className={[styles["button-note"]].join(" ")}>Opens Wan 3 Prime · Modify Video<br />Review the price before you generate.</p></div>
      </div>
    </section>
    <section className={[styles["proof"],styles["wrap"]].join(" ")} id="comparison" aria-labelledby="comparison-title">
      <div className={[styles["section-top"]].join(" ")}><div><p className={[styles["eyebrow"]].join(" ")}>ONE CLIP, TWO SETTINGS</p><h2 id="comparison-title">From a home office to orbit.</h2></div><span className={[styles["small-marker"]].join(" ")}>6 seconds · Actual source & output</span></div>




    <VideoBackgroundComparison media={media} /></section>
    <section className={[styles["workflow"],styles["wrap"]].join(" ")} id="how-it-works" aria-labelledby="workflow-title">
      <div className={[styles["section-heading"]].join(" ")}><p className={[styles["eyebrow"]].join(" ")}>WORK WITH THE VIDEO YOU HAVE</p><h2 id="workflow-title">One complete moment.<br />A new direction.</h2><p>A finished sentence, a gesture, a short take. Start with the part you want to build on.</p></div>
      <ol className={[styles["steps"]].join(" ")}><li><span className={[styles["step-number"]].join(" ")}>01</span><h3>Choose your moment</h3><p>Open Modify Video in Wan 3 Prime. Upload a clip or choose one from Media, then keep the whole action inside your excerpt.</p></li><li><span className={[styles["step-number"]].join(" ")}>02</span><h3>Describe the new place</h3><p>Name the setting and its light. Say which details matter—your subject, clothing, framing or timing—and treat those as things to check.</p></li><li><span className={[styles["step-number"]].join(" ")}>03</span><h3>Review, then decide</h3><p>Check the current quote before starting. Compare the finished clip with the original, listen if audio is on, and download the version you want.</p></li></ol>
    </section>
    <section className={[styles["choose-route"]].join(" ")} aria-labelledby="route-title"><div className={[styles["wrap"],styles["route-grid"]].join(" ")}>
      <div className={[styles["section-heading"]].join(" ")}><p className={[styles["eyebrow"]].join(" ")}>CHOOSE THE RIGHT KIND OF CHANGE</p><h2 id="route-title">A new setting,<br />or a clean cutout?</h2><p>These are different results. Choose the one your next edit needs.</p></div>
      <div className={[styles["route-options"]].join(" ")}><article className={[styles["route-option"]].join(" ")}><span className={[styles["route-kicker"]].join(" ")}>RECREATE THE SCENE</span><h3>Put your shot somewhere else.</h3><p>Modify generates a new video guided by your source. It can rework the setting, light and visual treatment; fine details can change too.</p><Link className={[styles["text-link"]].join(" ")} href="/app?engine=wan-3-prime&mode=v2v" prefetch={false}>Open Wan Prime Modify <span aria-hidden="true">↗</span></Link></article><article className={[styles["route-option"]].join(" ")}><span className={[styles["route-kicker"]].join(" ")}>ISOLATE THE SUBJECT</span><h3>Take the background out.</h3><p>Need transparency, green screen or a solid color for compositing? Use Video Background Remover to create a cutout.</p><Link className={[styles["text-link"]].join(" ")} href="/tools/background-removal" prefetch={false}>Explore Video Background Remover <span aria-hidden="true">↗</span></Link></article></div>
    </div></section>
    <section className={[styles["review-section"],styles["wrap"]].join(" ")} id="what-to-check" aria-labelledby="review-title">
      <div className={[styles["section-heading"]].join(" ")}><p className={[styles["eyebrow"]].join(" ")}>LOOK PAST THE FIRST FRAME</p><h2 id="review-title">Watch the whole change.</h2><p>A convincing backdrop is one part of the result. Check what happens while the subject moves and speaks.</p></div>
      <dl className={[styles["review-list"]].join(" ")}><div><dt>The person</dt><dd>Look at the face, hands and clothing throughout the clip. An instruction to preserve them is a request, rather than a guarantee.</dd></div><div><dt>The movement</dt><dd>Compare the timing, gestures and camera. Decide whether the differences work for your scene.</dd></div><div><dt>The sound</dt><dd>Wan 3 Prime offers optional audio. Listen for changed words, delivery or timing before using the result.</dd></div></dl>
      <div className={[styles["model-note"]].join(" ")}><p><b>Working with a product shot?</b> The <Link href="/tools/product-video-editor" prefetch={false}>Product Video Editor ↗</Link> has a dedicated workflow and example.</p><p><b>Want another visual route?</b> <Link href="/models/luma-ray-3-2" prefetch={false}>Luma Ray 3.2 Modify ↗</Link> supports guide frames and keyframes in MaxVideoAI. Its output is silent.</p></div>
    </section>
    <section className={[styles["faq"],styles["wrap"]].join(" ")} aria-labelledby="faq-title"><div className={[styles["section-heading"]].join(" ")}><p className={[styles["eyebrow"]].join(" ")}>BEFORE YOU START</p><h2 id="faq-title">A few useful answers.</h2></div><div className={[styles["faq-items"]].join(" ")}>
      <details><summary>Do I need to film against a green screen?</summary><p>No green screen is needed for this generative workflow. Start with an existing clip and describe the new setting. The output is a newly generated scene; it may change details you hoped to keep.</p></details>
      <details><summary>How long can my source clip be?</summary><p>Wan 3 Prime Modify accepts one MP4 or MOV source up to 15 seconds and 100 MB. Source duration plus output duration must stay within 30 seconds. Choose a complete, readable action and review the controls shown for your request.</p></details>
      <details><summary>Will it keep my face and voice exactly the same?</summary><p>Results vary. In the cockpit example, the spoken sentence is retained, while gestures, expressions and the sound of the voice differ. Compare the full result with your original before deciding to use it.</p></details>
      <details><summary>Can I get a transparent background?</summary><p>For an alpha, green screen or solid background, use <Link href="/tools/background-removal" prefetch={false}>Video Background Remover ↗</Link>. Modify creates a new scene; it does not provide a transparent cutout.</p></details>
      <details><summary>What will my edit cost?</summary><p>Your source duration and chosen settings affect the quote. Import the clip, choose the excerpt and review the current price before generation. The amount shown in a recorded tutorial is not a quote for your request.</p></details>
    </div></section>
    <section className={[styles["closing"],styles["wrap"]].join(" ")}><div><p className={[styles["eyebrow"]].join(" ")}>START WITH ONE SHOT</p><h2>Your next scene<br />starts with this take.</h2></div><div><Link className={[styles["button"],styles["primary"]].join(" ")} href="/app?engine=wan-3-prime&mode=v2v" prefetch={false}>Change my video background <span aria-hidden="true">↗</span></Link><Link className={[styles["text-link"],styles["secondary-link"]].join(" ")} href="/models/wan-3-prime" prefetch={false}>See Wan 3 Prime details ↗</Link></div></section>
  <div className={[styles["wrap"],styles["site-footer"]].join(" ")}><div><Link href="/studio" prefetch={false}>Shape a brief in Studio ↗</Link><Link href="/mcp" prefetch={false}>Assistant connections & host limits ↗</Link><Link href="/tools" prefetch={false}>All tools ↗</Link></div><p>Studio assistance and media generation have separate costs. Review the applicable quote and host requirements.</p></div></div>);
}
