(()=>{"use strict";
const $=id=>document.getElementById(id),KEY="forge-motion-project-v1";
const lanes=[["video","VIDEO · V1"],["narration","NARRATION · A1"],["music","MUSIC · A2"],["sfx","SOUND FX · A3"],["captions","CAPTIONS · C1"],["graphics","GRAPHICS · G1"]];
let clips=[],assets=[],selected=null,head=0,playing=false,raf=0,last=0,urls=new Map(),audios=new Map(),videoId="",directorPlan=null;
const id=()=>"mt-"+Math.random().toString(36).slice(2,10),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const len=c=>Math.max(.1,Number(c.out??c.duration??5)-Number(c.in||0)),end=c=>Number(c.start||0)+len(c),maxTime=()=>directorPlan?.duration>0?directorPlan.duration:Math.max(60,...clips.map(end));
const stamp=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(Math.floor(n%60)).padStart(2,"0")+"."+Math.floor(n%1*10);
function exportData(){return {version:1,directorPlan,clips:clips.map(({url,file,...x})=>({...x})),assets:assets.map(({url,file,...x})=>({...x})),head};}
function importData(d){if(!d||d.version!==1)return;pause();directorPlan=d.directorPlan||null;clips=(d.clips||[]).map(x=>({...x,url:null,file:null}));assets=(d.assets||[]).map(x=>({...x,url:null,file:null}));selected=clips[0]?.id||null;head=Number(d.head)||0;render();}
function applyDirectorPlan(plan){
 if(!plan||plan.version!==1||!Number.isFinite(Number(plan.duration))||Number(plan.duration)<=0)throw Error("Director plan needs version 1 and a positive total duration.");
 if(!Array.isArray(plan.clips))throw Error("Director plan must include a clips array.");
 const allowed=new Set(lanes.map(x=>x[0]));
 const next=plan.clips.map((c,i)=>{if(!allowed.has(c.type))throw Error("Unsupported track type in clip "+(i+1));const start=Math.max(0,Number(c.start)||0),inside=Math.max(0,Number(c.in)||0),outside=Number(c.out);if(!Number.isFinite(outside)||outside<=inside)throw Error("Invalid trim range in clip "+(i+1));if(start+outside-inside>Number(plan.duration)+.05)throw Error("Clip exceeds director-approved runtime.");return {...c,id:c.id||id(),name:String(c.name||c.text||("Director clip "+(i+1))),start,in:inside,out:outside,duration:outside-inside,volume:Math.max(0,Math.min(1,Number(c.volume??1))),fadeIn:Math.max(0,Number(c.fadeIn)||0),fadeOut:Math.max(0,Number(c.fadeOut)||0),url:null,file:null};});
 directorPlan={version:1,duration:Number(plan.duration),fps:Number(plan.fps)||30,aspectRatio:plan.aspectRatio||"16:9",approvedBy:"claude",title:plan.title||"Claude-directed production",notes:plan.notes||"",updatedAt:new Date().toISOString()};
 clips=next;selected=clips[0]?.id||null;head=0;render();return {ok:true,duration:directorPlan.duration,clips:clips.length};
}
function clearDirectorPlan(){directorPlan=null;render();}
window.ForgeMotionMultitrack={exportData,importData,applyDirectorPlan,clearDirectorPlan};
function save(){try{const p=JSON.parse(localStorage.getItem(KEY)||"{}");p.multitrack=exportData();localStorage.setItem(KEY,JSON.stringify(p));$("saveStatus").textContent="SAVED LOCALLY";}catch(e){$("saveStatus").textContent="LOCAL SAVE UNAVAILABLE";}}
function render(){const t=maxTime();if($("directorRuntime"))$("directorRuntime").textContent=directorPlan?"RUNTIME · "+directorPlan.duration.toFixed(2)+" SEC":"RUNTIME · AUTO";if($("directorStatus"))$("directorStatus").textContent=directorPlan?directorPlan.title+" · "+clips.length+" director clips":"Awaiting Claude production plan";$("mtTimeline").innerHTML=lanes.map(([type,label])=>'<div class="mt-track"><div class="mt-track-name">'+label+'</div><div class="mt-track-lane">'+clips.filter(c=>c.type===type).map(c=>'<button class="mt-clip '+(c.id===selected?'selected':'')+'" data-clip="'+c.id+'" style="left:'+(Number(c.start||0)/t*100)+'%;width:'+Math.max(.7,len(c)/t*100)+'%" title="'+esc(c.name)+'">'+esc(c.name)+'<small>'+len(c).toFixed(1)+'s</small></button>').join("")+'</div></div>').join("");
$("mtPlayhead").max=t;$("mtPlayhead").value=head;$("mtClock").textContent=stamp(head);renderAssets();renderInspector();save();preview();}
function renderAssets(){$("mtAssets").innerHTML=assets.length?assets.map(a=>'<div class="mt-asset"><span>'+a.type.toUpperCase()+' · '+esc(a.name)+'</span><button data-asset="'+a.id+'">ADD TO TIMELINE</button><button data-relink="'+a.id+'">'+(a.url?"MEDIA READY":"RELINK FILE")+'</button><small>'+(a.duration?Number(a.duration).toFixed(1)+'s':'Still image')+'</small></div>').join(""):'<div class="empty">Imported media appears here.</div>';}
function renderInspector(){const c=clips.find(x=>x.id===selected),r=$("mtInspector");if(!c){r.innerHTML='<div class="empty">Select a clip to edit timing and audio.</div>';return;}const audio=["narration","music","sfx"].includes(c.type);r.innerHTML='<b>'+esc(c.name)+'</b><small class="mt-inspector-type">'+c.type.toUpperCase()+'</small><label>START · SEC</label><input data-p="start" type="number" min="0" step=".05" value="'+(c.start||0)+'"><div class="mt-two-fields"><div><label>TRIM IN · SEC</label><input data-p="in" type="number" min="0" step=".05" value="'+(c.in||0)+'"></div><div><label>TRIM OUT · SEC</label><input data-p="out" type="number" min=".1" step=".05" value="'+(c.out??c.duration??5)+'"></div></div><div class="hint">Clip length: '+len(c).toFixed(2)+' sec</div>'+(audio?'<label>VOLUME</label><input data-p="volume" type="range" min="0" max="1" step=".01" value="'+(c.volume??1)+'"><div class="mt-two-fields"><div><label>FADE IN · SEC</label><input data-p="fadeIn" type="number" min="0" step=".1" value="'+(c.fadeIn||0)+'"></div><div><label>FADE OUT · SEC</label><input data-p="fadeOut" type="number" min="0" step=".1" value="'+(c.fadeOut||0)+'"></div></div>':'')+(['captions','graphics'].includes(c.type)?'<label>TEXT</label><textarea data-p="text" rows="3">'+esc(c.text||"")+'</textarea>':'')+'<div class="row"><button class="quiet" id="mtGoto">GO TO CLIP</button><button class="quiet" id="mtDelete">DELETE</button></div>';}
function addFile(file,type){const url=URL.createObjectURL(file),a={id:id(),type,name:file.name,size:file.size,url,file,duration:0};urls.set(a.id,url);assets.push(a);const c={id:id(),assetId:a.id,type,name:file.name,start:head,in:0,out:5,duration:5,volume:1,fadeIn:0,fadeOut:0,url,file};clips.push(c);selected=c.id;if(["video","narration","music","sfx"].includes(type)){const p=document.createElement(type==="video"?"video":"audio");p.preload="metadata";p.src=url;p.onloadedmetadata=()=>{a.duration=c.duration=c.out=Number.isFinite(p.duration)?p.duration:5;render();};}else a.duration=5;render();}
document.querySelectorAll("[data-mt-import]").forEach(el=>el.addEventListener("change",e=>{Array.from(e.target.files).forEach(f=>addFile(f,e.target.dataset.mtImport));e.target.value="";}));
$("mtAssets").addEventListener("click",e=>{const rel=e.target.closest("[data-relink]");if(rel){const a=assets.find(x=>x.id===rel.dataset.relink);if(!a)return;const input=document.createElement("input");input.type="file";input.accept=a.type==="video"?"video/*":a.type==="graphics"?"image/*":"audio/*";input.onchange=()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);a.url=url;a.file=file;a.name=file.name;a.size=file.size;urls.set(a.id,url);clips.filter(x=>x.assetId===a.id).forEach(x=>{x.url=url;x.file=file;x.name=file.name;});audios.forEach((el,key)=>{if(clips.find(x=>x.id===key)?.assetId===a.id){el.pause();el.src=url;}});if(a.type!=="graphics"){const probe=document.createElement(a.type==="video"?"video":"audio");probe.preload="metadata";probe.src=url;probe.onloadedmetadata=()=>{a.duration=Number.isFinite(probe.duration)?probe.duration:a.duration;clips.filter(x=>x.assetId===a.id).forEach(x=>{x.in=0;x.out=x.duration=a.duration;});render();};}render();};input.click();return;}const b=e.target.closest("[data-asset]");if(!b)return;const a=assets.find(x=>x.id===b.dataset.asset);if(!a)return;const c={id:id(),assetId:a.id,type:a.type,name:a.name,start:head,in:0,out:a.duration||5,duration:a.duration||5,volume:1,fadeIn:0,fadeOut:0,url:a.url,file:a.file};clips.push(c);selected=c.id;render();});
$("mtTimeline").addEventListener("click",e=>{const b=e.target.closest("[data-clip]");if(!b)return;selected=b.dataset.clip;head=Number(clips.find(c=>c.id===selected)?.start)||0;render();});
$("mtInspector").addEventListener("change",e=>{const c=clips.find(x=>x.id===selected),k=e.target.dataset.p;if(!c||!k)return;c[k]=["start","in","out","volume","fadeIn","fadeOut"].includes(k)?Math.max(0,Number(e.target.value)||0):e.target.value;if(c.out!=null&&c.out<=Number(c.in||0))c.out=Number(c.in||0)+.1;render();});
$("mtInspector").addEventListener("input",e=>{if(e.target.dataset.p==="volume"){const c=clips.find(x=>x.id===selected);if(c){c.volume=Number(e.target.value);syncAudio();}}});
$("mtInspector").addEventListener("click",e=>{if(e.target.id==="mtDelete"){clips=clips.filter(c=>c.id!==selected);selected=null;render();}if(e.target.id==="mtGoto"){head=Number(clips.find(c=>c.id===selected)?.start)||0;render();}});
$("mtAddCaption").addEventListener("click",()=>{const c={id:id(),type:"captions",name:"Caption",text:"Your caption",start:head,in:0,out:3,duration:3};clips.push(c);selected=c.id;render();});
$("mtAddGraphic").addEventListener("click",()=>{const c={id:id(),type:"graphics",name:"Graphic title",text:"YOUR TITLE",start:head,in:0,out:5,duration:5};clips.push(c);selected=c.id;render();});
$("mtPlayhead").addEventListener("input",e=>{head=Number(e.target.value);$("mtClock").textContent=stamp(head);preview();});
function active(type){return clips.filter(c=>c.type===type&&head>=Number(c.start||0)&&head<end(c)).sort((a,b)=>Number(b.start)-Number(a.start))[0]||null;}
function syncAudio(){clips.filter(c=>["narration","music","sfx"].includes(c.type)).forEach(c=>{let a=audios.get(c.id);if(!a){a=new Audio();a.preload="auto";a.src=c.url||urls.get(c.assetId)||"";audios.set(c.id,a);}const start=Number(c.start)||0,inside=head>=start&&head<end(c),src=c.url||urls.get(c.assetId);if(!src||!inside){a.pause();return;}const pos=Number(c.in||0)+head-start;if(Math.abs(a.currentTime-pos)>.3)a.currentTime=pos;let vol=Number(c.volume??1);if(c.fadeIn>0)vol*=Math.min(1,(head-start)/c.fadeIn);if(c.fadeOut>0)vol*=Math.min(1,(end(c)-head)/c.fadeOut);a.volume=Math.max(0,Math.min(1,vol));if(playing&&a.paused)a.play().catch(()=>{});if(!playing)a.pause();});}
function preview(){const v=$("mtVideo"),c=active("video"),texts=clips.filter(x=>["captions","graphics"].includes(x.type)&&head>=Number(x.start||0)&&head<end(x));$("mtTextOverlay").innerHTML=texts.filter(x=>x.type==="graphics").map(x=>'<strong>'+esc(x.text)+'</strong>').join("")+texts.filter(x=>x.type==="captions").map(x=>'<span>'+esc(x.text)+'</span>').join("");$("mtPreviewEmpty").hidden=!!c||!!texts.length;if(c&&(c.url||urls.has(c.assetId))){const src=c.url||urls.get(c.assetId);if(videoId!==c.id){v.src=src;videoId=c.id;}const pos=Number(c.in||0)+head-Number(c.start||0);if(Math.abs(v.currentTime-pos)>.3)try{v.currentTime=pos;}catch(e){}if(playing&&v.paused)v.play().catch(()=>{});if(!playing)v.pause();}else{v.pause();if(videoId){v.removeAttribute("src");v.load();videoId="";}}$("mtPreviewStatus").textContent=c?"VIDEO PREVIEW · "+esc(c.name):"LOCAL TIMELINE OVERLAY PREVIEW";syncAudio();}
function tick(now){if(!playing)return;head+=Math.min(.12,(now-last)/1000);last=now;if(head>=maxTime()){head=maxTime();pause();}$("mtPlayhead").value=head;$("mtClock").textContent=stamp(head);preview();raf=requestAnimationFrame(tick);}
function play(){if(playing)return;playing=true;last=performance.now();$("mtPlay").textContent="Ⅱ PAUSE";preview();raf=requestAnimationFrame(tick);}
function pause(){playing=false;cancelAnimationFrame(raf);$("mtPlay").textContent="▶ PLAY";audios.forEach(a=>a.pause());$("mtVideo").pause();}
$("mtPlay").addEventListener("click",()=>playing?pause():play());
async function exportMixdown(){
 if(!clips.length){$("mtExportStatus").textContent="Add clips before exporting.";return;}
 if(!window.MediaRecorder||!$("mtExportCanvas").captureStream){$("mtExportStatus").textContent="This browser does not support WebM recording.";return;}
 const button=$("mtExport");button.disabled=true;pause();const duration=maxTime(),canvas=$("mtExportCanvas"),ctx=canvas.getContext("2d"),fps=30;
 const video=$("mtVideo"),audioCtx=new (window.AudioContext||window.webkitAudioContext)(),mix=audioCtx.createMediaStreamDestination(),sources=[];
 let recorder=null,rafId=0,stopped=false;
 const setStatus=s=>$("mtExportStatus").textContent=s;
 try{
  await audioCtx.resume();
  const audioClips=clips.filter(c=>["narration","music","sfx"].includes(c.type));
  for(const c of audioClips){
   const file=c.file||assets.find(a=>a.id===c.assetId)?.file;
   if(!file)continue;
   const buffer=await audioCtx.decodeAudioData(await file.arrayBuffer());
   const src=audioCtx.createBufferSource(),gain=audioCtx.createGain();src.buffer=buffer;src.connect(gain);gain.connect(mix);
   const start=Math.max(0,Number(c.start)||0),trimIn=Math.max(0,Number(c.in)||0),trimOut=Math.min(buffer.duration,Number(c.out??buffer.duration));
   const clipDuration=Math.max(.05,trimOut-trimIn),base=Math.max(0,Math.min(1,Number(c.volume??1)));
   gain.gain.setValueAtTime(0,audioCtx.currentTime+start);
   gain.gain.linearRampToValueAtTime(base,audioCtx.currentTime+start+Math.min(.08,clipDuration/4));
   if(Number(c.fadeIn)>0){gain.gain.setValueAtTime(0,audioCtx.currentTime+start);gain.gain.linearRampToValueAtTime(base,audioCtx.currentTime+start+Math.min(Number(c.fadeIn),clipDuration));}
   if(Number(c.fadeOut)>0){const fs=Math.max(start,start+clipDuration-Number(c.fadeOut));gain.gain.setValueAtTime(base,audioCtx.currentTime+fs);gain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+start+clipDuration);}
   else gain.gain.setValueAtTime(base,audioCtx.currentTime+start+clipDuration);
   src.start(audioCtx.currentTime+start,trimIn,clipDuration);sources.push(src);
  }
  const canvasStream=canvas.captureStream(fps),audioStream=mix.stream;
  audioStream.getAudioTracks().forEach(t=>canvasStream.addTrack(t));
  const mime=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"].find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime)throw new Error("No supported WebM codec found.");
  const chunks=[];recorder=new MediaRecorder(canvasStream,{mimeType:mime,videoBitsPerSecond:9000000,audioBitsPerSecond:192000});
  const imageCache=new Map();
  for(const a of assets.filter(a=>a.type==="graphics")){
   const file=a.file;if(!file)continue;const img=new Image(),url=a.url||urls.get(a.id);if(url){img.src=url;try{await img.decode();imageCache.set(a.id,img);}catch(e){}}
  }
  function frame(t){
   ctx.fillStyle="#10131b";ctx.fillRect(0,0,1280,720);
   const vc=clips.filter(c=>c.type==="video"&&t>=Number(c.start||0)&&t<end(c)).sort((a,b)=>Number(b.start)-Number(a.start))[0];
   if(vc&&videoId===vc.id&&video.readyState>=2){try{ctx.drawImage(video,0,0,1280,720);}catch(e){}}
   else if(vc){const src=vc.url||urls.get(vc.assetId);if(src&&videoId!==vc.id){video.src=src;videoId=vc.id;video.currentTime=Math.max(0,Number(vc.in||0)+t-Number(vc.start||0));}}
   const visible=clips.filter(c=>t>=Number(c.start||0)&&t<end(c));
   visible.filter(c=>c.type==="graphics").forEach(c=>{const img=imageCache.get(c.assetId);if(img){const scale=Math.min(1280/img.width,720/img.height);ctx.drawImage(img,(1280-img.width*scale)/2,(720-img.height*scale)/2,img.width*scale,img.height*scale);}else{ctx.fillStyle="rgba(10,14,24,.7)";ctx.fillRect(80,80,1120,140);ctx.fillStyle="#fff";ctx.font="bold 54px Arial";ctx.fillText(c.text||c.name,110,170);}});
   visible.filter(c=>c.type==="captions").forEach(c=>{ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.textBaseline="bottom";const txt=c.text||"";const w=Math.min(1120,ctx.measureText(txt).width+60);ctx.fillStyle="rgba(0,0,0,.68)";ctx.fillRect((1280-w)/2,620,w,66);ctx.fillStyle="#fff";ctx.fillText(txt,640,672,1080);});
   if(!vc&&!visible.some(c=>c.type==="graphics"||c.type==="captions")){ctx.fillStyle="#b6a0ff";ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.fillText("FORGE MOTION",640,370);}
  }
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
  recorder.onerror=()=>setStatus("Recording failed in this browser.");
  recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="forge-motion-mixed-edit.webm";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);canvasStream.getTracks().forEach(t=>t.stop());audioCtx.close();button.disabled=false;setStatus("Export complete · "+(blob.size/1048576).toFixed(1)+" MB · mixed WebM saved locally.");};
  recorder.start(250);const started=performance.now();let lastSeek=-1;
  function renderTick(now){const t=Math.min(duration,(now-started)/1000);const activeVideo=clips.filter(c=>c.type==="video"&&t>=Number(c.start||0)&&t<end(c)).sort((a,b)=>Number(b.start)-Number(a.start))[0];if(activeVideo){const pos=Number(activeVideo.in||0)+t-Number(activeVideo.start||0);if(videoId!==activeVideo.id){video.src=activeVideo.url||urls.get(activeVideo.assetId)||"";videoId=activeVideo.id;lastSeek=-1;}if(Math.abs(video.currentTime-pos)>.18&&video.readyState>=1){try{video.currentTime=pos;lastSeek=pos;}catch(e){}}if(video.paused)video.play().catch(()=>{});}else{video.pause();}frame(t);setStatus("Rendering "+t.toFixed(1)+" / "+duration.toFixed(1)+" sec");if(t<duration&&!stopped)rafId=requestAnimationFrame(renderTick);else if(recorder.state!=="inactive")recorder.stop();}
  renderTick(performance.now());
 }catch(err){if(recorder&&recorder.state!=="inactive")recorder.stop();else{audioCtx.close();button.disabled=false;}setStatus("Export error: "+err.message);}
}
$("mtExport").addEventListener("click",exportMixdown);
$("mtStop").addEventListener("click",()=>{pause();head=0;render();});
document.querySelectorAll(".nav").forEach(b=>{if(b.dataset.panel==="multitrack")b.addEventListener("click",render);});
try{const p=JSON.parse(localStorage.getItem(KEY)||"null");if(p?.multitrack)importData(p.multitrack);else render();}catch(e){render();}
})();