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
 directorPlan={version:1,duration:Number(plan.duration),fps:Number(plan.fps)||30,aspectRatio:plan.aspectRatio||"16:9",approvedBy:"claude",title:plan.title||"Claude-directed production",notes:plan.notes||"",voiceSegments:Array.isArray(plan.voiceSegments)?plan.voiceSegments:[],audioAnalysis:Array.isArray(plan.audioAnalysis)?plan.audioAnalysis:[],scenes:Array.isArray(plan.scenes)?plan.scenes:[],updatedAt:new Date().toISOString()};
 clips=next;selected=clips[0]?.id||null;head=0;render();return {ok:true,duration:directorPlan.duration,clips:clips.length};
}
function clearDirectorPlan(){directorPlan=null;render();}
window.ForgeMotionMultitrack={exportData,importData,applyDirectorPlan,clearDirectorPlan};
function save(){try{const p=JSON.parse(localStorage.getItem(KEY)||"{}");p.multitrack=exportData();localStorage.setItem(KEY,JSON.stringify(p));$("saveStatus").textContent="SAVED LOCALLY";}catch(e){$("saveStatus").textContent="LOCAL SAVE UNAVAILABLE";}}
function render(){const t=maxTime();if($("directorRuntime"))$("directorRuntime").textContent=directorPlan?"RUNTIME · "+directorPlan.duration.toFixed(2)+" SEC":"RUNTIME · AUTO";if($("directorStatus"))$("directorStatus").textContent=directorPlan?directorPlan.title+" · "+clips.length+" director clips":"Awaiting Claude production plan";$("mtTimeline").innerHTML=lanes.map(([type,label])=>'<div class="mt-track"><div class="mt-track-name">'+label+'</div><div class="mt-track-lane">'+clips.filter(c=>c.type===type).map(c=>'<button class="mt-clip '+(c.id===selected?'selected':'')+'" data-clip="'+c.id+'" style="left:'+(Number(c.start||0)/t*100)+'%;width:'+Math.max(.7,len(c)/t*100)+'%" title="'+esc(c.name)+'">'+esc(c.name)+'<small>'+len(c).toFixed(1)+'s</small></button>').join("")+'</div></div>').join("");
$("mtPlayhead").max=t;$("mtPlayhead").value=head;$("mtClock").textContent=stamp(head);renderAssets();renderInspector();save();preview();}
function renderAssets(){$("mtAssets").innerHTML=assets.length?assets.map(a=>'<div class="mt-asset"><span>'+a.type.toUpperCase()+' · '+esc(a.name)+'</span><button data-asset="'+a.id+'">ADD TO TIMELINE</button><button data-relink="'+a.id+'">'+(a.url?"MEDIA READY":"RELINK FILE")+'</button><small>'+(a.duration?Number(a.duration).toFixed(1)+'s':'Still image')+'</small></div>').join(""):'<div class="empty">Imported media appears here.</div>';}
function renderInspector(){const c=clips.find(x=>x.id===selected),r=$("mtInspector");if(!c){r.innerHTML='<div class="empty">Select a clip to edit timing and audio.</div>';return;}const audio=["narration","music","sfx"].includes(c.type);r.innerHTML='<b>'+esc(c.name)+'</b><small class="mt-inspector-type">'+c.type.toUpperCase()+'</small><label>START · SEC</label><input data-p="start" type="number" min="0" step=".05" value="'+(c.start||0)+'"><div class="mt-two-fields"><div><label>TRIM IN · SEC</label><input data-p="in" type="number" min="0" step=".05" value="'+(c.in||0)+'"></div><div><label>TRIM OUT · SEC</label><input data-p="out" type="number" min=".1" step=".05" value="'+(c.out??c.duration??5)+'"></div></div><div class="hint">Clip length: '+len(c).toFixed(2)+' sec</div>'+(audio?'<label>VOLUME</label><input data-p="volume" type="range" min="0" max="1" step=".01" value="'+(c.volume??1)+'"><div class="mt-two-fields"><div><label>FADE IN · SEC</label><input data-p="fadeIn" type="number" min="0" step=".1" value="'+(c.fadeIn||0)+'"></div><div><label>FADE OUT · SEC</label><input data-p="fadeOut" type="number" min="0" step=".1" value="'+(c.fadeOut||0)+'"></div></div>':c.type==="video"?'<div class="mt-two-fields"><div><label>VIDEO FADE IN · SEC</label><input data-p="fadeIn" type="number" min="0" step=".1" value="'+(c.fadeIn||0)+'"></div><div><label>VIDEO FADE OUT · SEC</label><input data-p="fadeOut" type="number" min="0" step=".1" value="'+(c.fadeOut||0)+'"></div></div><div class="hint">Video fades blend to the background in preview and export.</div>':'')+(['captions','graphics'].includes(c.type)?'<label>TEXT</label><textarea data-p="text" rows="3">'+esc(c.text||"")+'</textarea>':'')+'<div class="row"><button class="quiet" id="mtGoto">GO TO CLIP</button><button class="quiet" id="mtDelete">DELETE</button></div>';}
function addFile(file,type){const url=URL.createObjectURL(file),a={id:id(),type,name:file.name,size:file.size,url,file,duration:0};urls.set(a.id,url);assets.push(a);const c={id:id(),assetId:a.id,type,name:file.name,start:head,in:0,out:5,duration:5,volume:1,fadeIn:0,fadeOut:0,url,file};clips.push(c);selected=c.id;if(["video","narration","music","sfx"].includes(type)){const p=document.createElement(type==="video"?"video":"audio");p.preload="metadata";p.src=url;p.onloadedmetadata=()=>{a.duration=c.duration=c.out=Number.isFinite(p.duration)?p.duration:5;render();};}else a.duration=5;render();}
document.querySelectorAll("[data-mt-import]").forEach(el=>el.addEventListener("change",e=>{Array.from(e.target.files).forEach(f=>addFile(f,e.target.dataset.mtImport));e.target.value="";}));
$("mtAssets").addEventListener("click",e=>{const rel=e.target.closest("[data-relink]");if(rel){const a=assets.find(x=>x.id===rel.dataset.relink);if(!a)return;const input=document.createElement("input");input.type="file";input.accept=a.type==="video"?"video/*":a.type==="graphics"?"image/*":"audio/*";input.onchange=()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);a.url=url;a.file=file;a.name=file.name;a.size=file.size;urls.set(a.id,url);clips.filter(x=>x.assetId===a.id).forEach(x=>{x.url=url;x.file=file;x.name=file.name;});audios.forEach((el,key)=>{if(clips.find(x=>x.id===key)?.assetId===a.id){el.pause();el.src=url;}});if(a.type!=="graphics"){const probe=document.createElement(a.type==="video"?"video":"audio");probe.preload="metadata";probe.src=url;probe.onloadedmetadata=()=>{a.duration=Number.isFinite(probe.duration)?probe.duration:a.duration;clips.filter(x=>x.assetId===a.id).forEach(x=>{x.in=0;x.out=x.duration=a.duration;});render();};}render();};input.click();return;}const b=e.target.closest("[data-asset]");if(!b)return;const a=assets.find(x=>x.id===b.dataset.asset);if(!a)return;const c={id:id(),assetId:a.id,type:a.type,name:a.name,start:head,in:0,out:a.duration||5,duration:a.duration||5,volume:1,fadeIn:0,fadeOut:0,url:a.url,file:a.file};clips.push(c);selected=c.id;render();});
$("mtTimeline").addEventListener("click",e=>{const b=e.target.closest("[data-clip]");if(!b)return;selected=b.dataset.clip;head=Number(clips.find(c=>c.id===selected)?.start)||0;render();});
$("mtInspector").addEventListener("change",e=>{const c=clips.find(x=>x.id===selected),k=e.target.dataset.p;if(!c||!k)return;c[k]=["start","in","out","volume","fadeIn","fadeOut"].includes(k)?Math.max(0,Number(e.target.value)||0):e.target.value;if(c.out!=null&&c.out<=Number(c.in||0))c.out=Number(c.in||0)+.1;render();});
$("mtInspector").addEventListener("input",e=>{if(e.target.dataset.p==="volume"){const c=clips.find(x=>x.id===selected);if(c){c.volume=Number(e.target.value);syncAudio();}}});
$("mtInspector").addEventListener("click",e=>{if(e.target.id==="mtDelete"){clips=clips.filter(c=>c.id!==selected);selected=null;render();}if(e.target.id==="mtGoto"){head=Number(clips.find(c=>c.id===selected)?.start)||0;render();}});
$("mtAddCaption").addEventListener("click",()=>{const c={id:id(),type:"captions",name:"Caption",text:"Your caption",start:head,in:0,out:3,duration:3};clips.push(c);selected=c.id;render();});
$("mtAddGraphic").addEventListener("click",()=>{const c={id:id(),type:"graphics",name:"Graphic title",text:"YOUR TITLE",start:head,in:0,out:5,duration:5};clips.push(c);selected=c.id;render();});

function selectedClip(){return clips.find(c=>c.id===selected)||null;}
function splitSelectedAtPlayhead(){
 const c=selectedClip();if(!c){$("mtExportStatus").textContent="Select a clip before splitting.";return;}
 const start=Number(c.start)||0,cut=head-start,clipLength=len(c);
 if(cut<.05||cut>clipLength-.05){$("mtExportStatus").textContent="Move the playhead inside the selected clip to split it.";return;}
 const sourceCut=Number(c.in||0)+cut,oldOut=Number(c.out??c.duration??5);
 const right={...c,id:id(),name:(c.name||"Clip")+" · B",start:head,in:sourceCut,out:oldOut,duration:oldOut-sourceCut,url:c.url||null,file:c.file||null};
 c.out=sourceCut;c.duration=sourceCut-Number(c.in||0);c.name=(c.name||"Clip")+" · A";
 if(Array.isArray(c.words)){
  const elapsed=cut,leftWords=c.words.filter(w=>Number(w.end)<=elapsed),rightWords=c.words.filter(w=>Number(w.end)>elapsed).map(w=>({...w,start:Math.max(0,Number(w.start)-elapsed),end:Number(w.end)-elapsed}));
  c.words=leftWords;right.words=rightWords;
 }
 clips.push(right);selected=right.id;render();$("mtExportStatus").textContent="Clip split at "+stamp(head)+".";
}
function duplicateSelected(){
 const c=selectedClip();if(!c){$("mtExportStatus").textContent="Select a clip to duplicate.";return;}
 const copy={...c,id:id(),name:(c.name||"Clip")+" · COPY",start:end(c),words:Array.isArray(c.words)?c.words.map(w=>({...w})):c.words};
 clips.push(copy);selected=copy.id;head=Number(copy.start)||0;render();$("mtExportStatus").textContent="Duplicate created after the original clip.";
}
function nudgeSelected(delta){
 const c=selectedClip();if(!c){$("mtExportStatus").textContent="Select a clip to move.";return;}
 c.start=Math.max(0,(Number(c.start)||0)+delta);head=c.start;render();$("mtExportStatus").textContent="Clip moved "+(delta>0?"forward":"back")+" by "+Math.abs(delta).toFixed(1)+" sec.";
}
$("mtSplit").addEventListener("click",splitSelectedAtPlayhead);
$("mtDuplicate").addEventListener("click",duplicateSelected);
$("mtNudgeBack").addEventListener("click",()=>nudgeSelected(-.5));
$("mtNudgeForward").addEventListener("click",()=>nudgeSelected(.5));

$("mtPlayhead").addEventListener("input",e=>{head=Number(e.target.value);$("mtClock").textContent=stamp(head);preview();});
function active(type){return clips.filter(c=>c.type===type&&head>=Number(c.start||0)&&head<end(c)).sort((a,b)=>Number(b.start)-Number(a.start))[0]||null;}
function syncAudio(){clips.filter(c=>["narration","music","sfx"].includes(c.type)).forEach(c=>{let a=audios.get(c.id);if(!a){a=new Audio();a.preload="auto";a.src=c.url||urls.get(c.assetId)||"";audios.set(c.id,a);}const start=Number(c.start)||0,inside=head>=start&&head<end(c),src=c.url||urls.get(c.assetId);if(!src||!inside){a.pause();return;}const pos=Number(c.in||0)+head-start;if(Math.abs(a.currentTime-pos)>.3)a.currentTime=pos;let vol=Number(c.volume??1);if(c.fadeIn>0)vol*=Math.min(1,(head-start)/c.fadeIn);if(c.fadeOut>0)vol*=Math.min(1,(end(c)-head)/c.fadeOut);a.volume=Math.max(0,Math.min(1,vol));if(playing&&a.paused)a.play().catch(()=>{});if(!playing)a.pause();});}
function preview(){const v=$("mtVideo"),c=active("video"),texts=clips.filter(x=>["captions","graphics"].includes(x.type)&&head>=Number(x.start||0)&&head<end(x));$("mtTextOverlay").innerHTML=texts.filter(x=>x.type==="graphics").map(x=>'<strong>'+esc(x.text)+'</strong>').join("")+texts.filter(x=>x.type==="captions").map(x=>{const elapsed=head-Number(x.start||0),words=Array.isArray(x.words)?x.words:null;if(!words?.length)return '<span>'+esc(x.text)+'</span>';return '<span class="mt-word-cue">'+words.map(w=>'<i class="'+(elapsed>=Number(w.start)&&elapsed<Number(w.end)?'active':'')+'">'+esc(w.text)+'</i>').join(' ')+'</span>';}).join("");$("mtPreviewEmpty").hidden=!!c||!!texts.length;if(c&&(c.url||urls.has(c.assetId))){const src=c.url||urls.get(c.assetId);if(videoId!==c.id){v.src=src;videoId=c.id;}const pos=Number(c.in||0)+head-Number(c.start||0),elapsed=head-Number(c.start||0),remaining=end(c)-head;let alpha=1;if(Number(c.fadeIn)>0)alpha=Math.min(alpha,Math.max(0,elapsed/Number(c.fadeIn)));if(Number(c.fadeOut)>0)alpha=Math.min(alpha,Math.max(0,remaining/Number(c.fadeOut)));v.style.opacity=String(Math.max(0,Math.min(1,alpha)));if(Math.abs(v.currentTime-pos)>.3)try{v.currentTime=pos;}catch(e){}if(playing&&v.paused)v.play().catch(()=>{});if(!playing)v.pause();}else{v.pause();if(videoId){v.removeAttribute("src");v.load();videoId="";}}$("mtPreviewStatus").textContent=c?"VIDEO PREVIEW · "+esc(c.name):"LOCAL TIMELINE OVERLAY PREVIEW";syncAudio();}
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
  const mp4Types=["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4;codecs=avc1.4D401E,mp4a.40.2","video/mp4"];const webmTypes=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];const mime=mp4Types.find(x=>MediaRecorder.isTypeSupported(x))||webmTypes.find(x=>MediaRecorder.isTypeSupported(x));
  if(!mime)throw new Error("This browser cannot record MP4 or WebM.");const isMp4=mime.startsWith("video/mp4");
  const chunks=[];recorder=new MediaRecorder(canvasStream,{mimeType:mime,videoBitsPerSecond:9000000,audioBitsPerSecond:192000});
  const imageCache=new Map();
  for(const a of assets.filter(a=>a.type==="graphics")){
   const file=a.file;if(!file)continue;const img=new Image(),url=a.url||urls.get(a.id);if(url){img.src=url;try{await img.decode();imageCache.set(a.id,img);}catch(e){}}
  }
  function frame(t){
   ctx.fillStyle="#10131b";ctx.fillRect(0,0,1280,720);
   const vc=clips.filter(c=>c.type==="video"&&t>=Number(c.start||0)&&t<end(c)).sort((a,b)=>Number(b.start)-Number(a.start))[0];
   if(vc&&videoId===vc.id&&video.readyState>=2){try{const elapsed=t-Number(vc.start||0),remaining=end(vc)-t;let alpha=1;if(Number(vc.fadeIn)>0)alpha=Math.min(alpha,Math.max(0,elapsed/Number(vc.fadeIn)));if(Number(vc.fadeOut)>0)alpha=Math.min(alpha,Math.max(0,remaining/Number(vc.fadeOut)));ctx.globalAlpha=Math.max(0,Math.min(1,alpha));ctx.drawImage(video,0,0,1280,720);ctx.globalAlpha=1;}catch(e){ctx.globalAlpha=1;}}
   else if(vc){const src=vc.url||urls.get(vc.assetId);if(src&&videoId!==vc.id){video.src=src;videoId=vc.id;video.currentTime=Math.max(0,Number(vc.in||0)+t-Number(vc.start||0));}}
   const visible=clips.filter(c=>t>=Number(c.start||0)&&t<end(c));
   visible.filter(c=>c.type==="graphics").forEach(c=>{const img=imageCache.get(c.assetId);if(img){const scale=Math.min(1280/img.width,720/img.height);ctx.drawImage(img,(1280-img.width*scale)/2,(720-img.height*scale)/2,img.width*scale,img.height*scale);}else{ctx.fillStyle="rgba(10,14,24,.7)";ctx.fillRect(80,80,1120,140);ctx.fillStyle="#fff";ctx.font="bold 54px Arial";ctx.fillText(c.text||c.name,110,170);}});
   visible.filter(c=>c.type==="captions").forEach(c=>{ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.textBaseline="bottom";const elapsed=t-Number(c.start||0),words=Array.isArray(c.words)?c.words:null,activeWord=words?.find(w=>elapsed>=Number(w.start)&&elapsed<Number(w.end));const txt=c.text||"";const w=Math.min(1120,ctx.measureText(txt).width+60);ctx.fillStyle="rgba(0,0,0,.68)";ctx.fillRect((1280-w)/2,620,w,66);if(words?.length){const full=words.map(x=>x.text).join(" "),fullWidth=ctx.measureText(full).width;let x=640-fullWidth/2;ctx.textAlign="left";for(const token of words){const tokenWidth=ctx.measureText(token.text).width;ctx.fillStyle=activeWord===token?"#ffe36e":"#fff";ctx.fillText(token.text,x,672);x+=tokenWidth+ctx.measureText(" ").width;}ctx.textAlign="center";}else{ctx.fillStyle="#fff";ctx.fillText(txt,640,672,1080);}});
   if(!vc&&!visible.some(c=>c.type==="graphics"||c.type==="captions")){ctx.fillStyle="#b6a0ff";ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.fillText("FORGE MOTION",640,370);}
  }
  recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
  recorder.onerror=()=>setStatus("Recording failed in this browser.");
  recorder.onstop=async()=>{try{const blob=new Blob(chunks,{type:mime});if(isMp4){const sig=new Uint8Array(await blob.slice(0,16).arrayBuffer());const box=String.fromCharCode(...sig.slice(4,8));if(box!=="ftyp"&&box!=="styp")throw new Error("The browser did not produce a valid MP4 container; no file was downloaded.");}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=isMp4?"forge-motion-mixed-edit.mp4":"forge-motion-mixed-edit.webm";a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);setStatus("Export complete · "+(blob.size/1048576).toFixed(1)+" MB · "+(isMp4?"MP4 / H.264 when provided by browser":"WebM fallback")+" saved locally.");}catch(err){setStatus("Export validation failed: "+err.message);}finally{canvasStream.getTracks().forEach(t=>t.stop());await audioCtx.close();button.disabled=false;}};
  recorder.start(250);const started=performance.now();let lastSeek=-1;
  function renderTick(now){const t=Math.min(duration,(now-started)/1000);const activeVideo=clips.filter(c=>c.type==="video"&&t>=Number(c.start||0)&&t<end(c)).sort((a,b)=>Number(b.start)-Number(a.start))[0];if(activeVideo){const pos=Number(activeVideo.in||0)+t-Number(activeVideo.start||0);if(videoId!==activeVideo.id){video.src=activeVideo.url||urls.get(activeVideo.assetId)||"";videoId=activeVideo.id;lastSeek=-1;}if(Math.abs(video.currentTime-pos)>.18&&video.readyState>=1){try{video.currentTime=pos;lastSeek=pos;}catch(e){}}if(video.paused)video.play().catch(()=>{});}else{video.pause();}frame(t);setStatus("Rendering "+t.toFixed(1)+" / "+duration.toFixed(1)+" sec");if(t<duration&&!stopped)rafId=requestAnimationFrame(renderTick);else if(recorder.state!=="inactive")recorder.stop();}
  renderTick(performance.now());
 }catch(err){if(recorder&&recorder.state!=="inactive")recorder.stop();else{audioCtx.close();button.disabled=false;}setStatus("Export error: "+err.message);}
}
async function analyzeSelectedAudio(){
 const status=$("mtAnalysisStatus"),canvas=$("mtWaveform"),panel=$("mtAudioAnalysis"),button=$("mtAnalyzeAudio");
 const clip=clips.find(c=>c.id===selected),asset=clip?assets.find(a=>a.id===clip.assetId):null;
 const file=clip?.file||asset?.file;
 if(!clip||!["narration","music","sfx"].includes(clip.type)||!file){status.textContent="SELECT AN AUDIO CLIP";panel.textContent="Choose a narration, music or SFX clip with its media linked in this browser.";return;}
 button.disabled=true;status.textContent="DECODING AUDIO…";
 try{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw Error("Web Audio is unavailable in this browser.");
  const ctx=new AudioContextClass();let buffer;
  try{buffer=await ctx.decodeAudioData(await file.arrayBuffer());}finally{await ctx.close();}
  const channelCount=buffer.numberOfChannels,samples=buffer.length,sampleRate=buffer.sampleRate,duration=buffer.duration;
  const mono=new Float32Array(samples);for(let ch=0;ch<channelCount;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<samples;i++)mono[i]+=data[i]/channelCount;}
  const bins=240,wave=new Array(bins);for(let b=0;b<bins;b++){const start=Math.floor(b*samples/bins),end=Math.max(start+1,Math.floor((b+1)*samples/bins));let peak=0,sum=0;for(let i=start;i<end;i++){const v=Math.abs(mono[i]);if(v>peak)peak=v;sum+=mono[i]*mono[i];}wave[b]={peak,rms:Math.sqrt(sum/Math.max(1,end-start))};}
  const frameSize=1024,hop=512,energy=[];for(let start=0;start+frameSize<samples;start+=hop){let sum=0;for(let j=0;j<frameSize;j++){const v=mono[start+j];sum+=v*v;}energy.push(Math.sqrt(sum/frameSize));}
  const flux=energy.map((v,i)=>Math.max(0,v-(energy[i-1]||0))),mean=flux.reduce((a,b)=>a+b,0)/Math.max(1,flux.length),variance=flux.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,flux.length),sd=Math.sqrt(variance),threshold=mean+sd*.8;
  const minGap=Math.max(1,Math.round(.22*sampleRate/hop)),peaks=[];let lastPeak=-minGap;
  for(let i=1;i<flux.length-1;i++){if(flux[i]>threshold&&flux[i]>=flux[i-1]&&flux[i]>flux[i+1]&&i-lastPeak>=minGap){peaks.push(i*hop/sampleRate);lastPeak=i;}}
  const onsetRate=sampleRate/hop;let bestLag=0,bestScore=0,secondScore=0;
  for(let bpm=60;bpm<=180;bpm++){const lag=Math.round(onsetRate*60/bpm);if(lag<1||lag>=flux.length/2)continue;let score=0,n=0;for(let i=lag;i<flux.length;i++){score+=flux[i]*flux[i-lag];n++;}score/=Math.max(1,n);if(score>bestScore){secondScore=bestScore;bestScore=score;bestLag=lag;}else if(score>secondScore)secondScore=score;}
  const bpm=bestLag?Math.round(onsetRate*60/bestLag):null,confidence=bestScore>0?Math.max(0,Math.min(1,(bestScore-secondScore)/bestScore)):0;
  const maxEnergy=energy.reduce((m,v)=>Math.max(m,v),0),silenceThreshold=Math.max(.003,maxEnergy*.12),segments=[];let activeStart=null;
  for(let i=0;i<energy.length;i++){const t=i*hop/sampleRate,active=energy[i]>silenceThreshold;if(active&&activeStart===null)activeStart=t;if((!active||i===energy.length-1)&&activeStart!==null){const endTime=active?t:Math.min(duration,t);if(endTime-activeStart>=.18)segments.push({start:Number(activeStart.toFixed(3)),end:Number(endTime.toFixed(3))});activeStart=null;}}
  const analysis={version:1,kind:"local-audio-signal-analysis",duration:Number(duration.toFixed(3)),sampleRate,channels:channelCount,peak:Number(Math.max(...wave.map(x=>x.peak)).toFixed(4)),rms:Number(Math.sqrt(wave.reduce((a,x)=>a+x.rms*x.rms,0)/wave.length).toFixed(4)),estimatedBpm:bpm,bpmConfidence:Number(confidence.toFixed(3)),onsets:peaks.slice(0,500).map(x=>Number(x.toFixed(3))),activeSegments:segments.slice(0,500),waveform:wave.map(x=>Number(x.peak.toFixed(3))),method:"mono RMS envelope + positive spectral-free energy flux; BPM is heuristic, not beat tracking"};
  asset.analysis=analysis;clip.analysis=analysis;
  const c=canvas.getContext("2d");c.clearRect(0,0,canvas.width,canvas.height);c.strokeStyle="#8d7cff";c.lineWidth=2;c.beginPath();for(let i=0;i<wave.length;i++){const x=i/(wave.length-1)*canvas.width,h=wave[i].peak*72;c.moveTo(x,85-h);c.lineTo(x,85+h);}c.stroke();c.strokeStyle="rgba(255,255,255,.16)";c.beginPath();c.moveTo(0,85);c.lineTo(canvas.width,85);c.stroke();c.fillStyle="#9ea6b7";c.font="12px sans-serif";c.fillText("0:00",8,160);c.fillText(duration.toFixed(1)+" sec",canvas.width-90,160);
  panel.innerHTML='<div><b>'+duration.toFixed(2)+' sec</b><small>DURATION</small></div><div><b>'+(bpm?bpm+" BPM":"Not detected")+'</b><small>ESTIMATED TEMPO · '+Math.round(confidence*100)+'% RELATIVE CONFIDENCE</small></div><div><b>'+peaks.length+'</b><small>ONSET CANDIDATES</small></div><div><b>'+segments.length+'</b><small>ACTIVE REGIONS</small></div><div><b>'+analysis.rms+'</b><small>AVERAGE RMS</small></div>';
  status.textContent="ANALYSIS READY";save();
 }catch(err){status.textContent="ANALYSIS FAILED";panel.textContent=err.message;}finally{button.disabled=false;}
}
$("mtExport").addEventListener("click",exportMixdown);
$("mtAnalyzeAudio").addEventListener("click",analyzeSelectedAudio);
$("mtStop").addEventListener("click",()=>{pause();head=0;render();});
document.querySelectorAll(".nav").forEach(b=>{if(b.dataset.panel==="multitrack")b.addEventListener("click",render);});
try{const p=JSON.parse(localStorage.getItem(KEY)||"null");if(p?.multitrack)importData(p.multitrack);else render();}catch(e){render();}
})();