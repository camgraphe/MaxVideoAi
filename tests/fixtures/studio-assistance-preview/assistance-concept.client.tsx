import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ChevronDown,MessageCircle,Sparkles,X} from 'lucide-react';
import './assistance-concept.css';

// Design-only policy proposal. No shared assistance hook, API, checkout or pricing logic.
export function AssistanceConcept({openSignal}:{openSignal:number}){
  const [open,setOpen]=useState(true),[model,setModel]=useState<'sol'|'luna'>('sol'),[pack,setPack]=useState(2),[review,setReview]=useState(false),[purchased,setPurchased]=useState(64),[receipt,setReceipt]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
  useEffect(()=>{setOpen(true);setReview(false);setReceipt(false);setPurchased(64);},[openSignal]);
  useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>{element?.close();trigger.current?.focus();};},[open]);
  useEffect(()=>{dialog.current?.scrollTo({top:0});},[model,review]);
  function close(){setOpen(false);setReview(false);}
  return <><button ref={trigger} className="concept-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><span/>{model==='sol'?'GPT‑6.1 Sol':'GPT‑6 Luna'}<ChevronDown size={12}/></button>{open&&<dialog ref={dialog} className="concept" aria-labelledby={id} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <header className="concept-heading"><div><span className="concept-eyebrow">STUDIO ASSISTANCE <span>CONCEPT</span></span><h2 id={id}>{review?'A little more Sol.':<>Keep your ideas <em>moving.</em></>}</h2></div><button className="concept-close" aria-label="Close concept" onClick={close}><X size={18}/></button></header>
    {review?<section className="concept-purchase">
      <button className="concept-back" onClick={()=>setReview(false)}><ArrowLeft size={13}/> Back to assistance</button>
      <div className="concept-purchase-summary"><div><Sparkles size={18}/><h3>GPT‑6.1 Sol pack</h3><p>Purchased tokens for creative direction and planning.</p></div><strong>${pack}<small>one-time</small></strong></div>
      <p>No subscription. No automatic refill.</p><p className="concept-demo-warning">Purchase simulation only. No money is charged or deducted.</p>
      <button className="concept-primary" onClick={()=>{setPurchased(100);setReceipt(true);setReview(false);}}>Confirm demo purchase · ${pack}<ArrowUpRight size={15}/></button>
    </section>:<>
      <p className="concept-intro">Choose the right partner for the work ahead.</p>
      <div className="concept-models" role="group" aria-label="Assistant model">
        <button aria-pressed={model==='sol'} onClick={()=>setModel('sol')}><div><Sparkles size={15}/><span>GPT‑6.1 Sol</span>{model==='sol'&&<Check size={14}/>}</div><small>Creative direction & detailed planning</small></button>
        <button aria-pressed={model==='luna'} onClick={()=>setModel('luna')}><div><MessageCircle size={15}/><span>GPT‑6 Luna</span>{model==='luna'&&<Check size={14}/>}</div><small>Everyday chat & simple edits</small></button>
      </div>
      {model==='sol'?<>
        <div className="concept-usage"><div className="concept-usage-title"><h3>Your Sol tokens</h3><span>Demo usage</span></div>
          <section><div><span>Included this month</span><strong>72% left</strong></div><progress max={100} value={72} aria-label="Monthly included Sol tokens remaining"/><small>A small free allowance, renewed each month.</small></section>
          <section><div><span>Purchased tokens</span><strong>{purchased}% left</strong></div><progress max={100} value={purchased} aria-label="Purchased Sol tokens remaining"/><small>Used after your included tokens.</small></section>
        </div>
        {receipt&&<p className="concept-receipt" role="status"><Check size={14}/> Demo pack added. No payment was made.</p>}
        <section className="concept-packs"><div><h3>A little more room to create.</h3><p>Get a Sol pack whenever you need it.</p></div><div className="concept-pack-options" role="group" aria-label="Sol pack price">{[2,5,10].map(price=><button key={price} aria-pressed={pack===price} onClick={()=>setPack(price)}>${price}</button>)}</div><button className="concept-primary" onClick={()=>setReview(true)}>Buy ${pack} Sol pack<ArrowUpRight size={15}/></button><small>One-time purchase · no automatic refill</small></section>
        <div className="concept-luna-nudge"><span>Keep going with Luna, free.</span><button onClick={()=>setModel('luna')}>Explore Luna<ArrowUpRight size={12}/></button></div>
      </>:<section className="concept-luna-view"><span className="concept-free">INCLUDED</span><h3>Unlimited everyday chat.</h3><p>Talk through an idea, refine a prompt, or make a simple edit. Luna keeps the conversation flowing.</p><div className="concept-fair-use"><strong>A little consideration goes a long way.</strong><p>Message pacing and request-size limits keep Luna available for everyone.</p></div><p className="concept-complex">For intricate creative direction or detailed plans, choose <strong>GPT‑6.1 Sol.</strong></p><button className="concept-primary" onClick={close}>Continue with GPT‑6 Luna<ArrowUpRight size={15}/></button><button className="concept-link" onClick={()=>setModel('sol')}>Explore GPT‑6.1 Sol</button></section>}
      <details className="concept-details"><summary>How tokens & pricing work<ChevronDown size={13}/></summary><p>Tokens measure the text and references read, plus the response produced, including reasoning. Longer conversations and complex requests use more.</p><p>This concept proposes a monthly included allowance and purchased packs. Pack quantities and usage conversion still need validation.</p><p>Luna’s unlimited everyday chat is subject to fair use. Complex requests may need GPT‑6.1 Sol.</p></details>
      <footer className="concept-footer">Images, videos & exports have separate prices.<br/>You review and confirm each one.</footer>
    </>}
  </dialog>}</>;
}
