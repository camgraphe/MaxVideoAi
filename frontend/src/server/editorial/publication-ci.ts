type Check={name:string;status:string;conclusion:string|null};type Status={context:string;state:string};
export function publicationCiState(checks:Check[],statuses:Status[],wait?:{mergeable:boolean|null;polls:number}):'passed'|'pending'|'failed'{
 if(wait&&(wait.mergeable===false||wait.polls>36))return 'failed';
 if(checks.some(c=>c.status==='completed'&&c.conclusion!=='success')||statuses.some(s=>['failure','error'].includes(s.state)))return 'failed';
 if(!checks.some(c=>c.name==='Quality CI')||!statuses.some(s=>s.context==='Vercel'))return 'pending';
 if(wait?.mergeable===null)return 'pending';
 return checks.every(c=>c.status==='completed'&&c.conclusion==='success')&&statuses.every(s=>s.state==='success')?'passed':'pending';
}
