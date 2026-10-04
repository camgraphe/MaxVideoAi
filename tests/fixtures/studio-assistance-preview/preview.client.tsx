import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {StudioAssistance} from '../../../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistance.client';
import {STUDIO_ASSISTANCE_TARIFF,type StudioAssistanceStatus,type StudioAssistanceChoice} from '../../../frontend/src/lib/studio/assistance-contract';
import studio from '../../../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/image-conversation.module.css';
import './preview.css';
import {AssistanceConcept} from './assistance-concept.client';

const demo:StudioAssistanceStatus={enabled:true,policyVersion:'DEMO ONLY',revision:3,selectedModel:'gpt-6.1-sol',mode:'paid_sol',tariff:STUDIO_ASSISTANCE_TARIFF,includedSol:{remainingPercent:72,renewal:'one_time'},sponsoredLuna:{remainingPercent:100,renewal:'one_time'},paid:{enabled:true,authorizedCents:500,spentCents:27,reservedCents:0,remainingCents:473,maxAdditionalBudgetCents:1527},unresolvedCalls:0,canContinue:true,blockedReason:null};
function Preview(){
  const concept=location.pathname==='/concept';
  const [status,setStatus]=useState(demo),[signal,setSignal]=useState(1),[last,setLast]=useState('No choice made.'),[locale,setLocale]=useState<'en'|'fr'>('en');
  async function choose(choice:StudioAssistanceChoice){
    setLast('Demo choice: '+JSON.stringify(choice));
    setStatus(previous=>{
      const next={...previous,revision:previous.revision+1};
      if(choice.action==='authorize_paid')return {...next,mode:'paid_sol',selectedModel:'gpt-6.1-sol',paid:{...next.paid,enabled:true,authorizedCents:choice.budgetCents,remainingCents:choice.budgetCents-next.paid.spentCents-next.paid.reservedCents,maxAdditionalBudgetCents:Math.max(0,2000-(choice.budgetCents-next.paid.spentCents))}};
      if(choice.action==='select_luna')return {...next,mode:'sponsored_luna',selectedModel:'gpt-6-luna'};
      if(choice.action==='select_sol')return {...next,mode:next.paid.enabled?'paid_sol':'included_sol',selectedModel:'gpt-6.1-sol'};
      return {...next,mode:'included_sol',selectedModel:'gpt-6.1-sol',paid:{...next.paid,enabled:false}};
    });return true;
  }
  return <main className={studio.studio}>
    <div className="review-bar"><span>{concept?'POLICY CONCEPT · NOT ACTIVE':'LOCAL REVIEW · DEMO DATA'}</span><div><a href="/">Current component</a><a href="/concept">Pack concept</a><button onClick={()=>{setStatus(demo);setSignal(value=>value+1);}}>Reset & open</button><button onClick={()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';}}>Light / Dark</button>{!concept&&<button onClick={()=>setLocale(value=>value==='en'?'fr':'en')}>EN / FR</button>}</div></div>
    <header className="preview-header"><span>MaxVideoAI <i>Studio</i></span>{concept?<AssistanceConcept openSignal={signal}/>:<StudioAssistance openSignal={signal} status={status} busy={false} error={null} locale={locale} conversationBusy={false} choose={choose} refresh={async()=>{}} onChoice={()=>{}}/>}</header>
    <section className="preview-canvas"><small>DEMONSTRATION CONVERSATION</small><h1>A little room for<br/><em>something unexpected.</em></h1><p>Shape a story. Find its rhythm. Make it yours.</p></section>
    <p className="demo-note">{concept?'Proposed commercial policy, not active. Monthly allowance, packs and Luna fair use need separate validation. Token percentages are illustrative; token quantities, margin and expiry are not yet defined.':'The dialog is the real Studio component. All amounts and usage here are demonstration data. Buttons only update this browser’s memory.'}</p><output className="choice-note">{last}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
