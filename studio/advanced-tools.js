(() => {
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const download = (name, data, type) => { const url=URL.createObjectURL(new Blob([data],{type:type||"application/json"})); const a=document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); };
function design(root) {
 let items=[{id:1,type:"hero",title:"Build something remarkable",body:"A clear message that explains your product.",color:"#72e4db"},{id:2,type:"button",title:"Get started",body:"",color:"#14252b"},{id:3,type:"card",title:"Designed for focus",body:"A reusable content card with a concise description.",color:"#202a3a"}], selected=1, next=4;
 root.innerHTML='<p class="feature-lead">مصمم واجهات مرئي: أضف مكونات وعدّل النصوص والألوان ثم حوّل التصميم إلى HTML وCSS حقيقيين داخل المحرر.</p><div class="feature-toolbar"><button class="feature-btn" data-add="hero">+ Hero</button><button class="feature-btn" data-add="text">+ نص</button><button class="feature-btn" data-add="button">+ زر</button><button class="feature-btn" data-add="card">+ بطاقة</button><button class="feature-btn secondary" id="dRemove">حذف المحدد</button></div><div class="design-layout"><div id="dCanvas" class="design-canvas"></div><div class="feature-report" id="dProps"></div></div><div class="feature-toolbar"><button class="feature-btn" id="dApply">تطبيق في محرر FORGE</button><button class="feature-btn secondary" id="dHtml">تصدير HTML</button><button class="feature-btn secondary" id="dJson">تصدير Design JSON</button></div><p class="feature-note">التطبيق يستبدل ملفات مساحة العمل الحالية. احفظها في فرع مشروعك قبل البناء.</p>';
 const canvas=$("dCanvas"),props=$("dProps");
 function render(){
  canvas.innerHTML=items.map(x=>'<section class="design-node '+(x.id===selected?"selected":"")+'" data-id="'+x.id+'" style="--node-color:'+esc(x.color)+'">'+(x.type==="hero"?"<small>HERO</small>":x.type==="card"?"<small>CARD</small>":"")+(x.type==="button"?'<span class="design-button">'+esc(x.title)+'</span>':(x.type==="text"?"<p>":"<h2>")+esc(x.title)+(x.type==="text"?"</p>":"</h2>"))+(x.body?'<p>'+esc(x.body)+'</p>':"")+'</section>').join("");
  canvas.querySelectorAll("[data-id]").forEach(n=>n.onclick=()=>{selected=Number(n.dataset.id);render()});
  const x=items.find(v=>v.id===selected);
  props.innerHTML=x?'<b>خصائص العنصر #'+x.id+'</b><label>النص<input id="dTitle" maxlength="120" value="'+esc(x.title)+'"></label><label>الوصف<textarea id="dBody" maxlength="500">'+esc(x.body)+'</textarea></label><label>اللون<input id="dColor" type="color" value="'+esc(x.color)+'"></label><button class="feature-btn" id="dUpdate">تحديث</button>':"اختر عنصرًا.";
  if(x)$("dUpdate").onclick=()=>{x.title=$("dTitle").value;x.body=$("dBody").value;x.color=$("dColor").value;render()};
 }
 function output(){
  const blocks=items.map(x=>x.type==="hero"?'<header class="hero"><small>INTRODUCING</small><h1>'+esc(x.title)+'</h1><p>'+esc(x.body)+'</p></header>':x.type==="text"?'<p class="copy">'+esc(x.title)+'</p>':x.type==="button"?'<a class="cta" href="#">'+esc(x.title)+'</a>':'<article class="card"><h2>'+esc(x.title)+'</h2><p>'+esc(x.body)+'</p></article>').join("\n");
  const css='*{box-sizing:border-box}body{margin:0;padding:40px 20px;background:#101722;color:#edf4ff;font:16px/1.6 system-ui,sans-serif}.page{max-width:920px;margin:auto}.hero{padding:54px 32px;border-radius:20px;background:#202a3a;border-left:5px solid #72e4db}.hero small{color:#72e4db;letter-spacing:.15em}.hero h1{font-size:clamp(32px,6vw,64px);line-height:1.05}.hero p,.card p{color:#b9c7da}.cta{display:inline-block;margin:22px 0;padding:12px 22px;border-radius:9px;background:#72e4db;color:#102024;text-decoration:none;font-weight:700}.card{margin-top:20px;padding:24px;border:1px solid #35445b;border-radius:16px;background:#1a2432}.copy{font-size:20px}@media(max-width:600px){body{padding:18px}.hero{padding:28px 18px}}';
  return {html:'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FORGE Design</title></head><body><main class="page">'+blocks+'</main></body></html>',css:css,js:"// Add interactions here.\n"};
 }
 root.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>{const t=b.dataset.add;items.push({id:next++,type:t,title:t==="hero"?"Your headline":t==="button"?"Explore now":t==="card"?"New feature":"Write your text",body:"Describe this section.",color:"#72e4db"});selected=items[items.length-1].id;render()});
 $("dRemove").onclick=()=>{items=items.filter(x=>x.id!==selected);selected=items[0]?.id||0;render()};
 $("dApply").onclick=()=>{if(!window.forgeApplyFiles){alert("أعد تحميل الاستوديو لتفعيل ربط المحرر.");return}window.forgeApplyFiles(output())};
 $("dHtml").onclick=()=>{const f=output();download("forge-design.html",f.html.replace("</head>","<style>"+f.css+"</style></head>"),"text/html")};
 $("dJson").onclick=()=>download("forge-design.json",JSON.stringify({format:"forge-design-v1",items},null,2));
 render();
}
function games(root) {
 const W=12,H=8,tiles=[["empty","فراغ","#17202d"],["ground","أرض","#8c6745"],["wall","جدار","#64748b"],["water","ماء","#2879b8"],["start","بداية","#36a875"],["goal","نهاية","#d7a63c"],["enemy","عدو","#c45c68"],["coin","عملة","#e8c95d"]];
 let selected="ground",map=Array.from({length:H},()=>Array(W).fill("empty")),name="Untitled Level";
 root.innerHTML='<p class="feature-lead">محرر مراحل شبكي 2D: ارسم الأرض والعوائق والماء ونقاط البداية والنهاية والأعداء والعملات، وصدّر خريطة منظمة لـGodot أو Unity أو محرك آخر.</p><label>اسم المرحلة<input id="lName" maxlength="80" value="Untitled Level"></label><div class="feature-toolbar" id="lPalette">'+tiles.map(t=>'<button class="feature-btn secondary" data-tile="'+t[0]+'" style="border-color:'+t[2]+'">'+t[1]+'</button>').join("")+'</div><div class="level-grid" id="lGrid" role="grid" aria-label="شبكة تصميم المرحلة"></div><div class="feature-toolbar"><button class="feature-btn" id="lExport">تصدير Level JSON</button><button class="feature-btn secondary" id="lCopy">نسخ JSON</button><button class="feature-btn secondary" id="lClear">مسح</button><button class="feature-btn secondary" id="lSample">مثال جاهز</button></div><div class="feature-report" id="lReport"></div><p class="feature-note">هذا محرر بيانات مراحل وليس محرك تشغيل أو محرر Godot/Unity كاملًا.</p>';
 const grid=$("lGrid"),report=$("lReport");
 function draw(){
  grid.innerHTML=map.map((row,y)=>row.map((v,x)=>{const t=tiles.find(z=>z[0]===v);const symbol={start:"S",goal:"G",enemy:"E",coin:"●",wall:"■",water:"≈",ground:"▪"}[v]||"";return '<button class="level-cell" role="gridcell" aria-label="صف '+(y+1)+' عمود '+(x+1)+': '+t[1]+'" data-x="'+x+'" data-y="'+y+'" style="background:'+t[2]+'">'+symbol+'</button>'}).join("")).join("");
  grid.querySelectorAll("button").forEach(b=>b.onclick=()=>{map[+b.dataset.y][+b.dataset.x]=selected;draw()});
  const count=id=>map.flat().filter(v=>v===id).length;
  report.textContent=name+" · "+W+"×"+H+"\nStart: "+count("start")+" · Goal: "+count("goal")+" · Enemies: "+count("enemy")+" · Coins: "+count("coin")+"\n"+(count("start")===1&&count("goal")===1?"✓ نقطة بداية ونهاية واحدة.":"⚠ حدّد نقطة بداية واحدة ونقطة نهاية واحدة.");
 }
 $("lPalette").querySelectorAll("button").forEach(b=>b.onclick=()=>{selected=b.dataset.tile;$("lPalette").querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b))});
 $("lName").oninput=e=>{name=e.target.value;draw()};
 const payload=()=>({format:"forge-level-v1",name,width:W,height:H,tileSize:32,legend:Object.fromEntries(tiles.map(t=>[t[0],t[1]])),map});
 $("lExport").onclick=()=>download("forge-level.json",JSON.stringify(payload(),null,2));
 $("lCopy").onclick=()=>{const value=JSON.stringify(payload(),null,2);if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>report.textContent="تم نسخ بيانات المرحلة.").catch(()=>download("forge-level.json",value));else download("forge-level.json",value)};
 $("lClear").onclick=()=>{map=Array.from({length:H},()=>Array(W).fill("empty"));draw()};
 $("lSample").onclick=()=>{map=Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>y===7?"ground":y===0||x===0||x===W-1?"wall":"empty"));map[6][1]="start";map[6][10]="goal";map[6][5]="enemy";map[5][3]="coin";map[6][7]="water";draw()};
 draw();
}
function qa(root) {
 root.innerHTML='<p class="feature-lead">فحوصات جودة للملفات المفتوحة: تحليل HTML، والتحقق من تركيب JavaScript دون تشغيله، وتحليل CSS، وفحوصات وصول وأمان أولية.</p><div class="feature-toolbar"><button class="feature-btn" id="qRun">تشغيل جميع الفحوصات</button><button class="feature-btn secondary" id="qExport">تصدير التقرير</button></div><div class="feature-report" id="qSummary">لم يتم تشغيل الفحوصات بعد.</div><div class="feature-report" id="qDetails">ستظهر النتائج هنا.</div><p class="feature-note">الفحص ساكن ولا يشغّل كود المشروع. لا يغني عن اختبارات المتصفح والأجهزة الحقيقية أو مراجعة أمنية متخصصة.</p>';
 let last=[];
 $("qRun").onclick=()=>{
  const f=window.forgeModels||{},html=String(f.html||""),css=String(f.css||""),js=String(f.js||""),out=[];
  const add=(name,status,detail)=>out.push({name,status,detail});
  let doc=null;
  try{doc=new DOMParser().parseFromString(html,"text/html");const bad=doc.querySelector("parsererror");add("HTML parsing",bad?"fail":"pass",bad?bad.textContent.slice(0,200):"HTML parsed by browser DOM parser.");}catch(e){add("HTML parsing","fail",e.message)}
  try{new Function(js);add("JavaScript syntax","pass","Compilation succeeded; source was not executed.");}catch(e){add("JavaScript syntax","fail",e.message)}
  try{if(!window.CSSStyleSheet)throw Error("CSS parser API unavailable.");const sheet=new CSSStyleSheet();sheet.replaceSync(css);add("CSS parsing","pass",sheet.cssRules.length+" CSS rules parsed.");}catch(e){add("CSS parsing","fail",e.message)}
  if(doc){
   const ids=[...doc.querySelectorAll("[id]")].map(x=>x.id),dupes=ids.filter((v,i)=>ids.indexOf(v)!==i);
   add("Duplicate IDs",dupes.length?"warn":"pass",dupes.length?"Repeated: "+[...new Set(dupes)].join(", "):"No duplicate IDs.");
   const alt=doc.querySelectorAll("img:not([alt])").length;add("Image alt text",alt?"warn":"pass",alt+" image(s) missing alt text.");
   const unlabeled=[...doc.querySelectorAll("input,select,textarea")].filter(x=>!x.labels?.length&&!x.hasAttribute("aria-label")&&!x.hasAttribute("aria-labelledby")).length;
   add("Form labels",unlabeled?"warn":"pass",unlabeled+" control(s) need accessible labels.");
   const buttons=[...doc.querySelectorAll("button")].filter(x=>!x.textContent.trim()&&!x.getAttribute("aria-label")).length;add("Button names",buttons?"warn":"pass",buttons+" button(s) lack accessible names.");
   const viewport=!!doc.querySelector('meta[name="viewport"]');add("Mobile viewport",viewport?"pass":"warn",viewport?"Viewport meta found.":"Add a viewport meta tag.");
   const broken=[...doc.querySelectorAll('a[href^="#"]')].filter(a=>!doc.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)))).length;add("Internal anchors",broken?"warn":"pass",broken+" broken internal link(s).");
   const http=[...doc.querySelectorAll("script[src],iframe[src]")].filter(x=>x.getAttribute("src")?.startsWith("http://")).length;add("HTTP external resources",http?"warn":"pass",http+" insecure HTTP resource(s).");
  }
  last=out;const fail=out.filter(x=>x.status==="fail").length,warn=out.filter(x=>x.status==="warn").length;
  $("qSummary").innerHTML="<b>"+out.length+" checks · "+fail+" failed · "+warn+" warnings</b><br>"+(fail?"Resolve failed checks before building.":warn?"Review warnings before release.":"No issues detected by these checks.");
  $("qDetails").innerHTML=out.map(x=>'<div class="asset-row"><b>'+(x.status==="pass"?"✓":x.status==="warn"?"⚠":"✕")+' '+esc(x.name)+'</b><small>'+esc(x.detail)+'</small></div>').join("");
 };
 $("qExport").onclick=()=>download("forge-qa-report.json",JSON.stringify({format:"forge-qa-v1",createdAt:new Date().toISOString(),results:last},null,2));
}
window.ForgeAdvancedTools={design:design,games:games,qa:qa};
})();