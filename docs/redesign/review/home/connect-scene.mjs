import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const mix=(a,b,t)=>a+(b-a)*t;
const image=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});

function texture(draw,width=1024,height=640){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const c=canvas.getContext('2d');c.beginPath();c.roundRect(0,0,width,height,24);c.clip();
 draw(c,width,height);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
const text=(c,value,x,y,size=24,color='#202630',weight=450)=>{
 c.fillStyle=color;c.font=weight+' '+size+'px Geist, Arial, sans-serif';c.fillText(value,x,y);
};
const rule=(c,x,y,w,color='#e0e4eb')=>{c.fillStyle=color;c.fillRect(x,y,w,1);};
const dot=(c,x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};

export async function createConnectScene(canvas,{compact=false}={}){
 const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'default'});
 renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 renderer.shadowMap.enabled=!compact;renderer.shadowMap.type=T.VSMShadowMap;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,50);
 const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer);
 const environment=pmrem.fromScene(room,.03);scene.environment=environment.texture;
 scene.environmentIntensity=.9;room.dispose();pmrem.dispose();
 const key=new T.DirectionalLight('#fffbf5',4);key.position.set(-3,7,6);key.castShadow=!compact;
 key.shadow.mapSize.set(512,512);key.shadow.radius=7;key.shadow.blurSamples=8;Object.assign(key.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.5,far:25});
 key.shadow.bias=-.0003;key.shadow.normalBias=.025;scene.add(key);
 const rim=new T.DirectionalLight('#bbc6ff',3.3);rim.position.set(5,3,-4);scene.add(rim);
 scene.add(new T.HemisphereLight('#ffffff','#c3cbdc',1.6));
 const floor=new T.Mesh(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.065}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-1.85;floor.receiveShadow=true;scene.add(floor);
 const assembly=new T.Group();scene.add(assembly);
 const materials=[],textures=[];
 const mat=(color,metalness=.2,roughness=.32)=>{
  const m=new T.MeshPhysicalMaterial({color,metalness,roughness,clearcoat:.9,clearcoatRoughness:.18});
  materials.push(m);return m;
 };
 const silver=mat('#a6b0c2',.64,.38),pearl=mat('#f5f5f6',.35,.25),ink=mat('#232934',.7,.23);
 const lilac=mat('#8d94da',.65,.22);
 const box=(parent,w,h,d,m,r=.08)=>{
  const mesh=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(r,d/2)),m);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const frame=(w,h,tex)=>{
  textures.push(tex);
  const g=new T.Group();assembly.add(g);
  box(g,w+.1,h+.1,.10,silver,.05);
  const body=box(g,w,h,.16,pearl,.07);body.position.z=.035;
  const display=new T.Mesh(new T.PlaneGeometry(w-.06,h-.06),new T.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false}));
  display.position.z=.122;g.add(display);return g;
 };
 let media;
 try{
  media=await Promise.all([
   image('/frontend/public/assets/branding/logo-mark.svg'),
   image('/frontend/public/brand/partners/bytedance/bytedance-mark-light.svg'),
   image('/frontend/public/brand/partners/kling/kling-mark-light.png'),
   image('/frontend/public/media/mcp/claude-inline-video-proof.jpg')
  ]);
 }catch(error){floor.geometry.dispose();floor.material.dispose();materials.forEach(m=>m.dispose());key.shadow.dispose();renderer.dispose();environment.dispose();throw error;}
 const sourceTexture=texture(c=>{
  c.fillStyle='#fff';c.fillRect(0,0,1024,640);
  c.fillStyle='#f4f5f8';c.fillRect(0,0,1024,62);
  ['#d4d9e2','#d4d9e2','#d4d9e2'].forEach((v,i)=>dot(c,31+i*22,31,5,v));
  text(c,'your-site.com',422,39,19,'#748091');
  text(c,'YOUR PROJECT',58,119,20,'#59677d',550);
  text(c,'Made to',56,268,76,'#202630',500);text(c,'move.',56,350,76,'#202630',500);
  text(c,'A website. A brief. A starting point.',59,429,23,'#727d8f');
  c.fillStyle='#252c3a';c.beginPath();c.roundRect(58,475,180,48,24);c.fill();text(c,'Explore  ↗',86,507,19,'#fff');
  const grad=c.createLinearGradient(560,180,980,550);grad.addColorStop(0,'#939dd4');grad.addColorStop(.5,'#cad5ed');grad.addColorStop(1,'#eef0f9');
  c.fillStyle=grad;c.beginPath();c.roundRect(605,171,302,355,145);c.fill();
  c.save();c.translate(756,337);c.rotate(-.48);c.fillStyle='#48577c';c.beginPath();c.roundRect(-160,-27,320,54,27);c.fill();c.fillStyle='#ffffff90';c.beginPath();c.roundRect(-145,-18,290,11,6);c.fill();c.restore();
  text(c,'ILLUSTRATIVE PROJECT',59,602,15,'#8790a0');
 });
 const source=frame(4.75,2.97,sourceTexture);
 const brief=frame(2.0,1.45,texture(c=>{
  c.fillStyle='#fdfdfc';c.fillRect(0,0,640,464);
  text(c,'THE BRIEF',42,71,22,'#697792',550);
  text(c,'Launch video',42,141,39,'#202630',500);
  text(c,'Brand, story, references.',42,193,23,'#728095');
  rule(c,42,231,553);text(c,'YOUR CONTEXT, CONNECTED',42,302,18,'#6a7292',500);
  for(let i=0;i<3;i++){c.fillStyle=['#d4dbe8','#a6b4d0','#374860'][i];c.beginPath();c.roundRect(42+i*88,342,70,50,8);c.fill();}
 },640,464));
 const plan=frame(4.35,2.8,texture(c=>{
  c.fillStyle='#fff';c.fillRect(0,0,1024,660);
  text(c,'MAXVIDEOAI / CREATIVE PLAN',53,67,21,'#748094',500);
  text(c,'A clear next step.',51,156,57,'#202630',500);
  const rows=[['01','Prompt & references','The scene you want to make.'],['02','Model & settings','The right fit for your shot.'],['03','Your quote','Review before generating.']];
  rows.forEach((r,i)=>{const y=239+i*106;rule(c,52,y-35,920);text(c,r[0],56,y+8,18,'#8c95a5');text(c,r[1],117,y+8,29,'#242c3b',500);text(c,r[2],117,y+46,21,'#7b8494');});
  c.fillStyle='#eceff9';c.beginPath();c.roundRect(53,565,919,58,29);c.fill();text(c,'YOU APPROVE. THEN WE CREATE.',306,602,20,'#525e90',550);
 },1024,660));
 const result=frame(4.65,3.10,texture(c=>{c.drawImage(media[3],0,0,1152,768);},1152,768));
 const core=new T.Group();assembly.add(core);
 box(core,1.04,1.04,.48,ink,.18);
 const inset=box(core,.95,.95,.025,lilac,.012);inset.position.z=.244;
 const logoTexture=texture(c=>{c.clearRect(0,0,256,256);c.drawImage(media[0],16,16,224,224);},256,256);textures.push(logoTexture);
 const face=new T.Mesh(new T.PlaneGeometry(.78,.78),new T.MeshBasicMaterial({map:logoTexture,transparent:true,toneMapped:false}));face.position.z=.263;core.add(face);
 const token=img=>{
  const group=new T.Group();assembly.add(group);
  const disc=new T.Mesh(new T.CylinderGeometry(.38,.38,.16,48),pearl);disc.rotation.x=Math.PI/2;disc.castShadow=true;group.add(disc);
  const t=texture(c=>{c.fillStyle='#fff';c.fillRect(0,0,256,256);c.drawImage(img,47,47,162,162);},256,256);textures.push(t);
  const mark=new T.Mesh(new T.CircleGeometry(.326,48),new T.MeshBasicMaterial({map:t,toneMapped:false}));mark.position.z=.085;group.add(mark);return group;
 };
 const modelA=token(media[1]),modelB=token(media[2]);
 // The same objects travel through all three poses. No cross-fading screenshots.
 const objects=[source,brief,plan,core,result,modelA,modelB];
 const poses=[
  [[-.95,.27,.1,-.08,.26,-.065,1],[-2.55,-.72,1.15,-.04,.15,-.10,1],[2.55,.28,-.7,.03,-.42,.065,.58],[2.55,-.77,1.0,-.25,-.38,-.07,1],[2.6,.8,-2,.04,-.5,.03,.02],[.77,1.5,-.4,-.03,-.18,.06,.8],[2.7,1.34,-.7,.03,-.28,.1,.7]],
  [[-2.9,.4,-1.4,.02,.52,-.12,.53],[-2.8,-.85,-.3,.02,.25,-.1,.60],[.48,.2,.48,-.065,-.14,.025,1],[-1.93,-.75,1.23,-.23,.12,-.05,.85],[2.3,.63,-1.7,.04,-.42,.055,.32],[-2.9,1.32,-.4,-.08,.22,-.06,.75],[2.77,-.97,.67,-.06,-.18,.05,.88]],
  [[-2.95,.5,-1.8,.03,.80,-.1,.47],[-3.1,-.83,-1.0,.03,.32,-.1,.45],[-1.9,.15,-1.2,-.05,.62,-.05,.63],[-2.10,-.72,1,-.17,.25,-.08,.8],[.65,.21,.55,-.065,-.12,.027,1],[2.85,1.3,-.3,-.04,-.24,.10,.7],[2.95,-1.05,-.4,-.08,-.22,-.06,.74]]
 ];
 let disposed=false,mobile=compact;
 function render(progress,pointer={x:0,y:0}){
  if(disposed)return;
  const p=clamp(progress),index=p<.5?0:1,t=smooth(index===0?p*2:(p-.5)*2);
  objects.forEach((o,i)=>{
   const values=poses[index][i].map((v,k)=>mix(v,poses[index+1][i][k],t));
   o.position.set(values[0]*(mobile?.48:1),values[1]*(mobile?.85:1),values[2]);
   o.rotation.set(values[3],values[4],values[5]);o.scale.setScalar(values[6]*(mobile?.88:1));
  });
  assembly.rotation.set(pointer.y*.025,pointer.x*.04,0);
  camera.position.set(mix(.12,-.17,p)+pointer.x*.09,mobile?1.05:1.38,mobile?9.8:8.1);
  camera.lookAt(0,mobile?.10:0,0);renderer.render(scene,camera);
 }
 return{
  render,
  resize(w,h,dpr){mobile=w<650;renderer.setPixelRatio(Math.min(dpr,mobile?1.15:1.5));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();},
  dispose(){
   if(disposed)return;disposed=true;
   const geometries=new Set(),mats=new Set(materials);
   scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});
   geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());key.shadow.dispose();environment.dispose();renderer.dispose();
  }
 };
}
