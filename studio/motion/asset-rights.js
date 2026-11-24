(()=>{
"use strict";
const KEY="forge-motion-asset-rights-v1", $=id=>document.getElementById(id);
const labels={created_by_user:"Created by user/team",generated:"Generated for project",licensed:"Licensed / permission granted",public_domain:"Claimed public domain"};
let records=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const makeId=()=>"asset-"+Math.random().toString(36).slice(2,11);
function render(){
 const host=$("arItems");if(!host)return;
 $("arStatus").textContent=records.length+" assets registered · stored locally in this browser";
 host.innerHTML=records.map(r=>'<article class="rights-item"><div class="rights-item-head"><b>'+esc(r.name)+'</b><small>'+esc(r.type)+' · '+esc(labels[r.origin]||r.origin)+'</small></div><small>CREATOR / RIGHTS HOLDER · '+esc(r.creator||"Not supplied")+'</small><small>LICENSE / PERMISSION · '+esc(r.license||"Not supplied")+'</small><small>ATTRIBUTION · '+esc(r.attribution||"Not supplied")+'</small><p>'+esc(r.evidence||"No evidence note supplied")+'</p><p>'+esc(r.notes||"")+'</p>'+(r.sourceUrl?'<a href="'+esc(r.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Open recorded source</a>':"")+'<small>REGISTERED · '+esc(r.createdAt)+'</small><button class="quiet" data-ar-remove="'+esc(r.id)+'">REMOVE RECORD</button></article>').join("")||'<div class="empty">No assets registered yet.</div>';
}
function persist(){localStorage.setItem(KEY,JSON.stringify({version:1,records}));render();}
function add(){
 const name=$("arName").value.trim();if(!name){alert("Enter an asset name.");return;}
 const sourceUrl=$("arUrl").value.trim();if(sourceUrl){try{const u=new URL(sourceUrl);if(!["http:","https:"].includes(u.protocol))throw Error();}catch(e){alert("Source URL must be a valid http or https URL.");return;}}
 const rec={id:makeId(),name,type:$("arType").value,origin:$("arOrigin").value,creator:$("arCreator").value.trim(),sourceUrl,license:$("arLicense").value.trim(),attribution:$("arAttribution").value.trim(),evidence:$("arEvidence").value.trim(),notes:$("arNotes").value.trim(),createdAt:new Date().toISOString()};
 records.push(rec);["arName","arCreator","arUrl","arLicense","arAttribution","arEvidence","arNotes"].forEach(k=>$(k).value="");persist();
}
function download(){const data={version:1,policy:"original-or-user-authorized-assets-only",records};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="forge-asset-rights-ledger.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function validate(x){if(!x||x.version!==1||!Array.isArray(x.records)||x.records.length>500)throw Error("Invalid ledger schema or record count.");const fields=["name","type","origin","creator","sourceUrl","license","attribution","evidence","notes","createdAt"];for(const r of x.records){if(!r||typeof r.id!=="string"||typeof r.name!=="string"||!r.name.trim()||r.name.length>120)throw Error("Invalid asset identity.");for(const f of fields)if(r[f]!==undefined&&(typeof r[f]!=="string"||r[f].length>(f==="sourceUrl"?1000:f==="evidence"||f==="notes"?1200:300)))throw Error("Invalid field: "+f);if(!Object.hasOwn(labels,r.origin))throw Error("Unsupported origin value.");if(r.sourceUrl){const u=new URL(r.sourceUrl);if(!["http:","https:"].includes(u.protocol))throw Error("Unsupported source URL.");}}}
$("arAdd")?.addEventListener("click",add);$("arExport")?.addEventListener("click",download);
$("arItems")?.addEventListener("click",e=>{const b=e.target.closest("[data-ar-remove]");if(b){records=records.filter(r=>r.id!==b.dataset.arRemove);persist();}});
$("arClear")?.addEventListener("click",()=>{if(confirm("Clear the local asset rights ledger? Export a backup first if needed.")){records=[];persist();}});
$("arImport")?.addEventListener("change",async e=>{const f=e.target.files?.[0];e.target.value="";if(!f)return;try{if(f.size>1024*1024)throw Error("Ledger file exceeds 1 MiB.");const x=JSON.parse(await f.text());validate(x);records=x.records;persist();}catch(err){alert("Import rejected: "+err.message);}});
try{const x=JSON.parse(localStorage.getItem(KEY)||"null");if(x){validate(x);records=x.records;}}catch(e){records=[];}
window.ForgeMotionAssetRights={exportData:()=>JSON.parse(JSON.stringify({version:1,policy:"original-or-user-authorized-assets-only",records}))};
render();
})();