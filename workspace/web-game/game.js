(() => {
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const W=960,H=540,ground=476,keys={};let player,frames=[],echoes=[],recording=true,loops=0,won=false,started=performance.now(),toastTimer;
const platforms=[{x:0,y:ground,w:960,h:64},{x:160,y:390,w:150,h:16},{x:390,y:330,w:145,h:16},{x:650,y:390,w:135,h:16}];
const switchBox={x:590,y:456,w:38,h:20},door={x:842,y:356,w:54,h:120};
function reset(){player={x:70,y:ground-42,vx:0,vy:0,w:27,h:42,on:false};frames=[];echoes=[];recording=true;won=false;loops=0;started=performance.now();document.getElementById('loops').textContent='0';document.getElementById('hint').textContent='Reach the exit. Your echo can hold the switch.';say('A new timeline begins.');}
function say(s){const el=document.getElementById('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1900)}
function lockEcho(){if(!recording||frames.length<12)return;echoes.push({frames:frames.slice(),index:0});loops++;document.getElementById('loops').textContent=loops;frames=[];recording=true;say('Echo recorded. Your past self is back.');}
function keyDown(e){const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys[k]=true;if(k==='e')lockEcho();if(k==='r')reset();}
function keyUp(e){keys[e.key.toLowerCase()]=false}
window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);
document.getElementById('echoBtn').onclick=lockEcho;document.getElementById('resetBtn').onclick=reset;document.getElementById('touchEcho').onclick=lockEcho;
document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key==='left'?'arrowleft':b.dataset.key==='right'?'arrowright':' ';b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false));});
function update(){if(won)return;const left=keys.a||keys.arrowleft,right=keys.d||keys.arrowright,jump=keys[' ']||keys.w||keys.arrowup;player.vx=(right?3.5:0)-(left?3.5:0);if(jump&&player.on){player.vy=-10.8;player.on=false}player.vy=Math.min(player.vy+.48,12);player.x=Math.max(0,Math.min(W-player.w,player.x+player.vx));const oldY=player.y;player.y+=player.vy;player.on=false;for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&oldY+player.h<=p.y&&player.y+player.h>=p.y&&player.vy>=0){player.y=p.y-player.h;player.vy=0;player.on=true}}
if(player.y>H+50){player.x=70;player.y=ground-player.h;player.vy=0;say('Careful. Try that jump again.')}
if(recording)frames.push({x:player.x,y:player.y,flip:player.vx<0});
let active=player.x+player.w>switchBox.x&&player.x<switchBox.x+switchBox.w&&player.y+player.h>switchBox.y;
echoes.forEach(e=>{const f=e.frames[Math.min(e.index,e.frames.length-1)];if(f&&f.x+27>switchBox.x&&f.x<switchBox.x+switchBox.w&&f.y+42>switchBox.y)active=true;e.index=(e.index+1)%e.frames.length;});
if(active&&player.x>door.x-65&&player.y+player.h>door.y&&player.y<door.y+door.h){/* door opens */}if(active&&player.x+player.w>door.x+door.w-8&&player.y+player.h>door.y){won=true;say('LOOP COMPLETE — you trusted your past.');document.getElementById('hint').textContent='You made it. Press R to play again.'}
return active;}
function draw(active){ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#141d38');g.addColorStop(1,'#11162a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
ctx.strokeStyle='#ffffff0a';ctx.lineWidth=1;for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
for(let i=0;i<38;i++){const x=(i*173)%W,y=(i*97)%300;ctx.fillStyle=i%3?'#a8b8ff38':'#70e7e355';ctx.fillRect(x,y,2,2)}
platforms.forEach((p,i)=>{ctx.fillStyle=i?'#293653':'#202b45';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#70e7e3';ctx.fillRect(p.x,p.y,p.w,3);ctx.fillStyle='#ffffff0b';for(let x=p.x+12;x<p.x+p.w;x+=25)ctx.fillRect(x,p.y+9,9,2)});
ctx.fillStyle=active?'#70e7e3':'#5e6684';ctx.shadowBlur=active?22:0;ctx.shadowColor='#70e7e3';ctx.fillRect(switchBox.x,switchBox.y,switchBox.w,switchBox.h);ctx.shadowBlur=0;ctx.fillStyle='#0b1225';ctx.fillRect(switchBox.x+12,switchBox.y+6,14,3);
ctx.fillStyle=active?'#70e7e3':'#8e7fbb';ctx.fillRect(door.x,door.y,door.w,door.h);ctx.fillStyle='#11172a';ctx.fillRect(door.x+7,door.y+8,door.w-14,door.h-8);ctx.fillStyle=active?'#70e7e3':'#a78bfa';ctx.fillRect(door.x+door.w-5,door.y+53,4,13);
echoes.forEach(e=>{const f=e.frames[Math.min(e.index,e.frames.length-1)];if(!f)return;ctx.globalAlpha=.48;ctx.fillStyle='#a78bfa';ctx.shadowBlur=18;ctx.shadowColor='#a78bfa';ctx.fillRect(f.x,f.y,27,42);ctx.shadowBlur=0;ctx.globalAlpha=1;});
ctx.fillStyle='#70e7e3';ctx.shadowBlur=18;ctx.shadowColor='#70e7e3';ctx.fillRect(player.x,player.y,player.w,player.h);ctx.shadowBlur=0;ctx.fillStyle='#10172b';ctx.fillRect(player.x+(player.vx<0?5:16),player.y+11,5,5);
ctx.fillStyle='#9ba7c8';ctx.font='11px monospace';ctx.fillText('YOU',player.x-2,player.y-10);if(echoes.length)ctx.fillText('PAST YOU',Math.max(12,echoes[0].frames[Math.min(echoes[0].index,echoes[0].frames.length-1)].x-14),ground-65);
ctx.fillStyle='#aeb8d5';ctx.font='12px monospace';ctx.fillText('← START',25,ground+35);ctx.fillText('EXIT →',855,ground+35);
}
function loop(){const active=update();draw(active);const sec=Math.floor((performance.now()-started)/1000);document.getElementById('timer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');requestAnimationFrame(loop)}
reset();loop();
})();