import type {ApplicationSettingChange} from '@/lib/prompt-assistance/application-review';

const labels:Record<string,[string,string,string]>={
 aspectRatio:['Aspect ratio','Format','Formato'],durationSec:['Duration','Durée','Duración'],durationOption:['Duration selection','Choix de durée','Selección de duración'],numFrames:['Frames','Images','Fotogramas'],
 resolution:['Resolution','Résolution','Resolución'],fps:['Frame rate','Fréquence d’images','Frecuencia de fotogramas'],iterations:['Outputs','Résultats','Resultados'],
 seed:['Seed','Graine','Semilla'],seedLocked:['Fixed seed','Graine fixe','Semilla fija'],loop:['Loop','Boucle','Bucle'],audio:['Audio','Audio','Audio'],
 cameraFixed:['Fixed camera','Caméra fixe','Cámara fija'],safetyChecker:['Safety filter','Filtre de sécurité','Filtro de seguridad'],cfgScale:['Prompt guidance','Fidélité au prompt','Fidelidad al prompt'],shotType:['Shot planning','Découpage','Planificación de planos'],
};
export function promptSettingCopy(change:ApplicationSettingChange,locale:string){
 const language=locale.startsWith('fr')?1:locale.startsWith('es')?2:0;
 const value=(entry:unknown)=>entry===undefined||entry===null?['Not set','Non défini','Sin definir'][language]:entry===true?['On','Activé','Activado'][language]:entry===false?['Off','Désactivé','Desactivado'][language]:entry==='auto'?['Auto','Auto','Auto'][language]:String(entry);
 return {label:labels[change.key]?.[language]??change.key,before:value(change.before),current:value(change.current)};
}
