import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StudioAssistance} from '../../../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistance.client';
import {STUDIO_ASSISTANCE_CREDIT_TARIFF,type StudioAssistanceStatus,type StudioAssistanceChoice} from '../../../frontend/src/lib/studio/assistance-contract';
import studio from '../../../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/image-conversation.module.css';
import './preview.css';
import {consumeDemoCredits} from './demo-credit-wallet';
import {AssistanceConcept} from './assistance-concept.client';

const demo:StudioAssistanceStatus={enabled:true,policyVersion:'DEMO ONLY',revision:3,selectedModel:'gpt-6.1-sol',mode:'paid_sol',tariff:STUDIO_ASSISTANCE_CREDIT_TARIFF,includedSol:{remainingPercent:72,renewal:'monthly'},sponsoredLuna:{remainingPercent:100,renewal:'unlimited'},paid:{enabled:true,authorizedCents:200,spentCents:72,reservedCents:0,remainingCents:128,maxAdditionalBudgetCents:1000},unresolvedCalls:0,canContinue:true,blockedReason:null,credits:{creditsPerDollar:1000,included:{total:500,remaining:360,reserved:0,period:'2026-10-01',renewsAt:'2026-11-01T00:00:00Z'},purchased:{total:2000,remaining:1280,reserved:0,packs:[{id:'first',amountCents:200,total:2000,remaining:1280,reserved:0,purchasedAt:'2026-10-05T00:00:00Z'}]}}};
function Preview(){
  const concept=location.pathname==='/concept';
  const [status,setStatus]=useState(demo),[signal,setSignal]=useState(1),[last,setLast]=useState('No choice made.'),[locale,setLocale]=useState<'en'|'fr'>('en');
  async function choose(choice:StudioAssistanceChoice){
    setLast('Demo choice: '+JSON.stringify(choice));
    setStatus(previous=>{
      const next={...previous,revision:previous.revision+1};
      if(choice.action==='purchase_pack'){const credits=next.credits!,added=choice.amountCents*10;return {...next,selectedModel:'gpt-6.1-sol',mode:'paid_sol',credits:{...credits,purchased:{...credits.purchased,total:credits.purchased.total+added,remaining:credits.purchased.remaining+added,packs:[...credits.purchased.packs,{id:choice.purchaseKey,amountCents:choice.amountCents,total:added,remaining:added,reserved:0,purchasedAt:new Date().toISOString()}]}},paid:{...next.paid,enabled:true,authorizedCents:next.paid.authorizedCents+choice.amountCents,remainingCents:next.paid.remainingCents+choice.amountCents}};}
      if(choice.action==='resume_paid')return {...next,selectedModel:'gpt-6.1-sol',mode:'paid_sol',paid:{...next.paid,enabled:true}};
      if(choice.action==='authorize_paid')return {...next,mode:'paid_sol',selectedModel:'gpt-6.1-sol',paid:{...next.paid,enabled:true,authorizedCents:choice.budgetCents,remainingCents:choice.budgetCents-next.paid.spentCents-next.paid.reservedCents,maxAdditionalBudgetCents:Math.max(0,2000-(choice.budgetCents-next.paid.spentCents))}};
      if(choice.action==='select_luna')return {...next,mode:'sponsored_luna',selectedModel:'gpt-6-luna'};
      if(choice.action==='select_sol')return {...next,mode:next.paid.enabled?'paid_sol':'included_sol',selectedModel:'gpt-6.1-sol'};
      return {...next,mode:'included_sol',selectedModel:'gpt-6.1-sol',paid:{...next.paid,enabled:false}};
    });return true;
  }
  function simulateUsage(){setStatus(previous=>{const credits=previous.credits!,result=consumeDemoCredits({included:credits.included,packs:credits.purchased.packs.map((item,index)=>({id:index+1,dollars:item.amountCents/100,total:item.total,remaining:item.remaining}))},100);return {...previous,includedSol:{...previous.includedSol,remainingPercent:result.wallet.included.remaining/500*100},credits:{...credits,included:{...credits.included,remaining:result.wallet.included.remaining},purchased:{...credits.purchased,remaining:credits.purchased.remaining-result.purchasedUsed,packs:credits.purchased.packs.map((item,index)=>({...item,remaining:result.wallet.packs[index].remaining}))}},paid:{...previous.paid,spentCents:previous.paid.spentCents+result.purchasedUsed/10,remainingCents:previous.paid.remainingCents-result.purchasedUsed/10}};});}
  return <main className={studio.studio}>
    <div className="review-bar"><span>{concept?'POLICY CONCEPT · NOT ACTIVE':'LOCAL REVIEW · DEMO DATA'}</span><div><a href="/">Product component</a><a href="/concept">Pack concept</a><button onClick={()=>{setStatus(demo);setSignal(value=>value+1);}}>Reset & open</button><button onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>Light / Dark</button>{!concept&&<><button onClick={()=>setLocale(value=>value==='en'?'fr':'en')}>EN / FR</button><button onClick={simulateUsage}>Simulate 100 credits</button></>}</div></div>
    <header className="preview-header"><span>MaxVideoAI <i>Studio</i></span>{concept?<AssistanceConcept openSignal={signal}/>:<StudioAssistance openSignal={signal} status={status} busy={false} error={null} locale={locale} conversationBusy={false} choose={choose} refresh={async()=>{}} onChoice={()=>{}}/>}</header>
    <section className="preview-canvas"><small>DEMONSTRATION CONVERSATION</small><h1>A little room for<br/><em>something unexpected.</em></h1><p>Shape a story. Find its rhythm. Make it yours.</p></section>
    <p className="demo-note">{concept?'Proposed commercial policy, not active. Pricing direction: +100% supplier markup (cost × 2), or 50% theoretical gross margin before other costs. The implemented policy grants 500 monthly free credits and uses free credits first. Packs add up. This concept page only simulates purchases and usage; the product component is available in the other tab.':'The dialog is the implemented Studio component: 500 free monthly credits, cumulative packs and free-first usage. This page uses demonstration data; purchase and usage buttons only update browser memory. No payment or assistant call.'}</p><output className="choice-note">{last}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
