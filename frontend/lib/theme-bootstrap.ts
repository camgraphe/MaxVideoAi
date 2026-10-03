import { APP_PATHS } from './app-experience-path';

// Inline before paint; do not read request cookies or make marketing HTML user-specific.
export const THEME_BOOTSTRAP = `(function(){
  var p=window.location.pathname;
  var app=${JSON.stringify(APP_PATHS)}.some(function(s){return p===s||p.indexOf(s+'/')===0;});
  var theme='light';
  if(app){
    var saved=null;
    try{saved=window.localStorage.getItem('mv-app-theme');}catch(e){}
    if(saved!=='light'&&saved!=='dark'&&saved!=='system'){
      try{
        var legacy=window.localStorage.getItem('maxvideoai.studio.theme.v1');
        if(window.localStorage.getItem('maxvideoai.studio.theme.userOverride.v1')==='true'&&(legacy==='light'||legacy==='dark'||legacy==='system')){
          saved=legacy;
          try{window.localStorage.setItem('mv-app-theme',saved);}catch(e){}
        }
      }catch(e){}
    }
    if(saved==='light'||saved==='dark')theme=saved;
    else{try{theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){theme='light';}}
  }
  if(theme==='dark')document.documentElement.setAttribute('data-theme','dark');
  else document.documentElement.removeAttribute('data-theme');
})();`;
