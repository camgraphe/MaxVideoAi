import { listFalEngines } from '../../frontend/src/config/falEngines';
import { workspaceReferenceFixtureSource } from './workspace-reference-browser-fixture';

export function dictationFixtureOptions() {
  const engine = listFalEngines().find(item => item.id === 'kling-o3-pro')!.engine;
  const field = [...engine.inputSchema!.required, ...engine.inputSchema!.optional].find(item => item.id === 'image_urls')!;
  const source = workspaceReferenceFixtureSource.replace('  function Fixture()', `
    import {ImageConversationComposer} from './app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageConversationComposer.client';
    config.locale = new URLSearchParams(location.search).get('lang') || 'en';
    function Studio() {
      const [message,setMessage] = useState('@Image1');
      return <ImageConversationComposer text={message} onTextChange={setMessage} blocked={false} compact locale={config.locale}
        libraryTrigger={()=>{}} onOpenLibrary={()=>{}} onSend={()=>{globalThis.submissions++;setMessage('');}} />;
    }
    function Fixture()`).replace('<Fixture />', "location.pathname === '/studio' ? <Studio /> : <Fixture />");
  return { source, assistancePreview:true, config:{
    engine, fields:[{field,required:false,role:'reference'}], prompt:'Existing prompt @Image1.',
    assets:{image_urls:[{id:'first',kind:'image',name:'first.png',size:1,type:'image/png',url:'/first.svg',previewUrl:'/first.svg',status:'ready'}]},
    assistance:{scopeKey:'owner:video',contextKey:'create'},
  }};
}
