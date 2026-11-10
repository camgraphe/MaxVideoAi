import type { DemoAsset } from './fixtures';

export type ActivityOrigin = 'create' | 'tools' | 'studio' | 'mcp';
export type DemoActivity = {
  id: string;
  status: 'completed' | 'pending' | 'failed';
  origin: ActivityOrigin;
  originLabel: string;
  model: string;
  prompt: string;
  createdAt: string;
  kind: DemoAsset['kind'];
  outputIds: string[];
  tool?: string;
  project?: string;
};
export const activityOrigins = {all:'Toutes les origines',create:'Créer',tools:'Outils',studio:'Studio',mcp:'MCP'};
export const activityStatuses = {all:'Tous les états',pending:'En cours',completed:'Terminée',failed:'Échec'};

/** Synthetic lineage only: an execution is distinct from its zero/one/many outputs. */
export function makeActivity(assets: DemoAsset[]): DemoActivity[] {
  const used = new Set<string>();
  const second=assets.find(candidate=>candidate.id==='demo-17');
  const events = assets.flatMap((asset):DemoActivity[]=>{
    if(asset.source==='upload'||used.has(asset.id))return [];
    const index=Number(asset.id.replace('demo-',''))-1;
    const tool = ({character:'Character Studio',storyboard:'Storyboard',angle:'Angle',upscale:'Upscale'} as Record<string,string>)[asset.source??''];
    const origin:ActivityOrigin = index%7===0?'mcp':index%5===0?'studio':tool?'tools':'create';
    const outputs=[asset.id];
    // One storyboard run produces two images, without duplicating either file in Media.
    if(index===3 && second){outputs.push(second.id);used.add(second.id);}
    used.add(asset.id);
    return [{id:`activity-${asset.id}`,status:'completed',origin,
      originLabel:origin==='mcp'?'MCP · Application connectée':origin==='studio'?'Studio · Film de démonstration':tool?`Outils · ${tool}`:'Créer',
      model:asset.model||'Modèle non renseigné',prompt:asset.prompt||'Aucun prompt disponible',createdAt:asset.createdAt!,kind:asset.kind,
      outputIds:outputs,tool,project:origin==='studio'?'Film de démonstration':undefined}];
  });
  const base=events[0];
  if(!base)return [];
  return [
    {...base,id:'activity-pending',status:'pending',origin:'studio',originLabel:'Studio · Film de démonstration',project:'Film de démonstration',outputIds:[],prompt:'Plan de transition au coucher du soleil.'},
    {...base,id:'activity-failed',status:'failed',origin:'create',originLabel:'Créer',outputIds:[],prompt:'Travelling lent dans une ville au petit matin.'},
    ...events,
  ];
}
