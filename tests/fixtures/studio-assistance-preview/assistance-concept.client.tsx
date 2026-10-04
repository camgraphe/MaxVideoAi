import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,ChevronDown,MessageCircle,Sparkles,X} from 'lucide-react';
import './assistance-concept.css';
import {addDemoCreditPack,consumeDemoCredits,createDemoCreditWallet,DEMO_CREDITS_PER_DOLLAR,DEMO_PACK_PRICES,demoPurchasedBalance} from './demo-credit-wallet';

const quantity=(value:number)=>new Intl.NumberFormat('en-US').format(value);

// Design-only policy proposal. No shared assistance hook, API, checkout or pricing logic.
export function AssistanceConcept({openSignal}:{openSignal:number}){
  const [open,setOpen]=useState(true),[model,setModel]=useState<'sol'|'luna'>('sol'),[pack,setPack]=useState(2),[review,setReview]=useState(false),[wallet,setWallet]=useState(createDemoCreditWallet),[receipt,setReceipt]=useState(''),[usageNotice,setUsageNotice]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
  const purchased=demoPurchasedBalance(wallet),packCredits=pack*DEMO_CREDITS_PER_DOLLAR;
  useEffect(()=>{setOpen(true);setReview(false);setReceipt('');setUsageNotice('');setWallet(createDemoCreditWallet());},[openSignal]);
  useEffect(()=>{if(!open)return;const element=dialog.current;element?.showModal();return()=>{element?.close();trigger.current?.focus();};},[open]);
  useEffect(()=>{dialog.current?.scrollTo({top:0});},[model,review]);
  function close(){setOpen(false);setReview(false);}
  function addPack(){setWallet(previous=>addDemoCreditPack(previous,pack));setReceipt(`Added ${quantity(packCredits)} credits. Demo purchase only.`);setReview(false);}
  function simulateUsage(){const result=consumeDemoCredits(wallet,100);setWallet(result.wallet);setUsageNotice(`${result.includedUsed} free + ${result.purchasedUsed} purchased credits used.${result.unfulfilled?' Demo balance exhausted.':''}`);}
  return <><button ref={trigger} className="concept-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><span/>{model==='sol'?'GPT‑6.1 Sol':'GPT‑6 Luna'}<ChevronDown size={12}/></button>{open&&<dialog ref={dialog} className="concept" aria-labelledby={id} onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <header className="concept-heading"><div><span className="concept-eyebrow">STUDIO ASSISTANCE <span>CONCEPT</span></span><h2 id={id}>{review?'A little more Sol.':<>Keep your ideas <em>moving.</em></>}</h2></div><button className="concept-close" aria-label="Close concept" onClick={close}><X size={18}/></button></header>
    {review?<section className="concept-purchase">
      <button className="concept-back" onClick={()=>setReview(false)}><ArrowLeft size={13}/> Back to assistance</button>
      <div className="concept-purchase-summary"><div><Sparkles size={18}/><h3>{quantity(packCredits)} Sol credits</h3><p>For GPT‑6.1 Sol creative direction and planning.</p></div><strong>${pack}<small>one-time</small></strong></div>
      <dl className="concept-purchase-totals"><div><dt>Purchased credits left</dt><dd>{quantity(purchased.remaining)}</dd></div><div><dt>This pack adds</dt><dd>+{quantity(packCredits)}</dd></div><div><dt>New purchased balance</dt><dd>{quantity(purchased.remaining+packCredits)} credits</dd></div></dl>
      <p>Your free credits are always used first. Every pack adds to your existing balance.</p>
      <p>No subscription. No automatic refill.</p><p className="concept-demo-warning">Purchase simulation only. No money is charged or deducted.</p>
      <button className="concept-primary" onClick={addPack}>Confirm demo purchase · ${pack}<ArrowUpRight size={15}/></button>
    </section>:<>
      <p className="concept-intro">Choose the right partner for the work ahead.</p>
      <div className="concept-models" role="group" aria-label="Assistant model">
        <button aria-pressed={model==='sol'} onClick={()=>setModel('sol')}><div><Sparkles size={15}/><span>GPT‑6.1 Sol</span>{model==='sol'&&<Check size={14}/>}</div><small>Creative direction & detailed planning</small></button>
        <button aria-pressed={model==='luna'} onClick={()=>setModel('luna')}><div><MessageCircle size={15}/><span>GPT‑6 Luna</span>{model==='luna'&&<Check size={14}/>}</div><small>Everyday chat & simple edits</small></button>
      </div>
      {model==='sol'?<>
        <div className="concept-usage"><div className="concept-usage-title"><h3>Your Sol credits</h3><span>1,000 credits = $1 · demo rate</span></div>
          <section><div><span>Included this month</span></div><p className="concept-credit-count"><strong>{quantity(wallet.included.remaining)}</strong><span>/ {quantity(wallet.included.total)} credits left</span></p><progress max={wallet.included.total} value={wallet.included.remaining} aria-label="Monthly included Sol credits remaining" aria-valuetext={`${wallet.included.remaining} of ${wallet.included.total} credits left`}/><small>Used first · renews monthly</small></section>
          <section><div><span>Purchased balance</span></div><p className="concept-credit-count"><strong>{quantity(purchased.remaining)}</strong><span>/ {quantity(purchased.total)} credits left</span></p><progress max={purchased.total||1} value={purchased.remaining} aria-label="Purchased Sol credits remaining" aria-valuetext={`${purchased.remaining} of ${purchased.total} credits left`}/><small>{quantity(purchased.total)} bought · {quantity(purchased.total-purchased.remaining)} used</small></section>
        </div>
        <details className="concept-details concept-pack-history"><summary>Purchased packs · {wallet.packs.length}<ChevronDown size={13}/></summary><ol>{wallet.packs.map(item=><li key={item.id}><div><span>Pack {item.id} · ${item.dollars}</span><span>{quantity(item.remaining)} / {quantity(item.total)} left · {Math.round(item.remaining/item.total*100)}%</span></div><progress max={item.total} value={item.remaining} aria-label={`Sol pack ${item.id} credits remaining`}/></li>)}</ol><p>Free credits are used first, then purchased packs in purchase order.</p></details>
        {receipt&&<p className="concept-receipt" role="status"><Check size={14}/>{receipt}</p>}
        <section className="concept-packs"><div><h3>A little more room to create.</h3></div><div className="concept-pack-options" role="group" aria-label="Sol pack price">{DEMO_PACK_PRICES.map(price=><button key={price} aria-pressed={pack===price} onClick={()=>setPack(price)}>${price}<small>{quantity(price*DEMO_CREDITS_PER_DOLLAR)} credits</small></button>)}</div><button className="concept-primary" onClick={()=>setReview(true)}>Buy ${pack} Sol pack<ArrowUpRight size={15}/></button><small>Packs add up · no automatic refill</small></section>
        <div className="concept-luna-nudge"><span>Keep going with Luna, free.</span><button onClick={()=>setModel('luna')}>Explore Luna<ArrowUpRight size={12}/></button></div>
      </>:<section className="concept-luna-view"><span className="concept-free">INCLUDED</span><h3>Unlimited everyday chat.</h3><p>Talk through an idea, refine a prompt, or make a simple edit. Luna keeps the conversation flowing.</p><div className="concept-fair-use"><strong>A little consideration goes a long way.</strong><p>Message pacing and request-size limits keep Luna available for everyone.</p></div><p className="concept-complex">For intricate creative direction or detailed plans, choose <strong>GPT‑6.1 Sol.</strong></p><button className="concept-primary" onClick={close}>Continue with GPT‑6 Luna<ArrowUpRight size={15}/></button><button className="concept-link" onClick={()=>setModel('sol')}>Explore GPT‑6.1 Sol</button></section>}
      <details className="concept-details"><summary>How credits & pricing work<ChevronDown size={13}/></summary><p>Sol credits give every pack the same unit. The proposed demo value is 1,000 credits = $1; a $2 pack plus a $10 pack adds 12,000 purchased credits in total.</p><p>Your remaining balance keeps all unused purchased credits. Free monthly credits are always used first.</p><p>Input, cached input and output tokens have different costs. Sol credits represent that metered usage in one unit. The final conversion, allowance and pricing still need validation.</p><p>Luna’s unlimited everyday chat is subject to fair use. Complex requests may need GPT‑6.1 Sol.</p>{model==='sol'&&<div className="concept-demo-controls"><small>LOCAL SIMULATION · no assistant call</small><button onClick={simulateUsage} disabled={wallet.included.remaining+purchased.remaining===0}>Simulate 100 credits of usage</button>{usageNotice&&<p role="status">{usageNotice}</p>}</div>}</details>
      <footer className="concept-footer">Images, videos & exports are priced and confirmed separately.</footer>
    </>}
  </dialog>}</>;
}
