/* SUPER NIKOLIO — offline 2D platformer for TCL Android TV. All music and SFX are original WebAudio synthesis. */
(()=>{'use strict';
const W=1280,H=720,GROUND=561,TAU=Math.PI*2;
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d',{alpha:false});
const stage=document.querySelector('#stage'),overlay=document.querySelector('#overlay'),toastEl=document.querySelector('#toast');
const mobile=document.querySelector('#mobile');
function resize(){let k=Math.min(window.innerWidth/W,window.innerHeight/H);stage.style.transform=`scale(${k})`}
addEventListener('resize',resize);resize();
const names=['Площадь Республики','Северный проспект','Каскад','Парламентский парк','Старый Ереван','Дорога к Арарату','Финальный путь'];
const palettes=[
 ['#70b6ef','#fac59c','#db987f','#966478','#dda980'],
 ['#6bacdf','#f3cead','#c98c8e','#785b78','#e5ad7f'],
 ['#73aee4','#f6d9a8','#dcb18f','#a17c8b','#d8b78b'],
 ['#72b2e4','#e4d4ac','#cda395','#777998','#e0b48f'],
 ['#72b4d5','#ffd0a3','#c89177','#92636d','#dfa58b'],
 ['#91b5d4','#ffe0bc','#a1a4b5','#85788c','#c69b8b'],
 ['#b0a8d9','#ffb9a0','#9a8eb1','#866789','#dfa68d'],
];
const img={};
const sprites=['idle0','idle1','walk0','walk1','walk2','walk3','walk4','walk5','run0','run1','run2','run3','jump0','jump1','jump2','hurt','win0','win1','enemy_a','enemy_b','finish_flags'];
for(const s of sprites){let i=new Image();i.src=((window.NIKOLIO_ASSETS||{})[s]||'img/'+s+'.png');img[s]=i}
const STORE='super_nikolio_save_v1';let save={unlocked:1,lastLevel:1,best:[0,0,0,0,0,0,0],music:true,sfx:true,seen:false};
try{let j=JSON.parse(localStorage.getItem(STORE)||'null');if(j && typeof j==='object')save={...save,...j}}catch(_){ }
function store(){try{localStorage.setItem(STORE,JSON.stringify(save))}catch(_){ }}
const key={ArrowLeft:false,ArrowRight:false,ArrowDown:false,ArrowUp:false,Enter:false,Escape:false};
let scene='menu',menuItems=[],focus=0,world=null,player=null,camera=0,t=0,total=0,screenShake=0,particles=[],shots=[],popTexts=[],score=0,collected=0,beaten=0,level=1,checkpoint=160,toastTimeout=0,hitTick=0,gameSeed=1;
let last=performance.now(),elapsed=.0,accumulator=0;
let canShootIn=0,levelClearLock=false;
const randomSeeded=(seed)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let u=Math.imul(seed^seed>>>15,1|seed);u=u+Math.imul(u^u>>>7,61|u)^u;return ((u^u>>>14)>>>0)/4294967296;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,r)=>a+(b-a)*r;
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function toast(msg,duration=1900){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toastEl.classList.remove('show'),duration)}
function drawImg(name,x,y,w,h,flip=false,alpha=1){const im=img[name];if(!im||!im.complete||!im.naturalWidth)return;ctx.save();ctx.globalAlpha=alpha;if(flip){ctx.translate(x+w,y);ctx.scale(-1,1);ctx.drawImage(im,0,0,w,h)}else ctx.drawImage(im,x,y,w,h);ctx.restore()}
function keyName(k){if(k===' '||k==='Spacebar')return 'Enter';if(k==='OK')return 'Enter';if(k==='Backspace')return 'Escape';return k}
function keyboardDown(e){let k=keyName(e.key);if(!(k in key)&&k!=='MediaPlayPause')return;e.preventDefault();if(k==='MediaPlayPause')k='Escape';const fresh=!key[k];key[k]=true;if(!fresh)return;if(k==='Escape')togglePause();else if(scene==='playing'){audio.ensure();if(k==='ArrowUp')player.jumpBuffer=.15;if(k==='Enter')shoot()}else if(scene!=='intro'){if(k==='ArrowUp')select(-1);else if(k==='ArrowDown')select(1);else if(k==='Enter')activate()}}
function keyboardUp(e){let k=keyName(e.key);if(k in key){e.preventDefault();key[k]=false}}
addEventListener('keydown',keyboardDown,{passive:false});addEventListener('keyup',keyboardUp,{passive:false});
addEventListener('blur',()=>{Object.keys(key).forEach(k=>key[k]=false);if(scene==='playing')showPause(true)});
for(const b of mobile.querySelectorAll('button')){const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keyboardDown({key:k,preventDefault(){}})});for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,e=>{e.preventDefault();keyboardUp({key:k,preventDefault(){}})})}
function menu(html,buttons,extra=''){overlay.classList.remove('hidden');mobile.classList.remove('active');overlay.innerHTML=`<div class="panel">${html}<div class="menu">${buttons.map((it,i)=>`<button data-index="${i}" ${it.disabled?'disabled':''}>${it.label}</button>`).join('')}</div>${extra?`<p class="muted">${extra}</p>`:''}</div><span class="hint">↑ ↓ выбор &nbsp;·&nbsp; OK подтвердить &nbsp;·&nbsp; Назад пауза</span>`;
menuItems=buttons;focus=buttons.findIndex(x=>!x.disabled);if(focus<0)focus=0;for(const b of overlay.querySelectorAll('button')){b.addEventListener('click',()=>{focus=+b.dataset.index;updateFocus();activate()});b.addEventListener('mouseenter',()=>{focus=+b.dataset.index;updateFocus()})}updateFocus()}
function updateFocus(){overlay.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('selected',i===focus))}
function select(delta){if(!menuItems.length)return;let n=focus;for(let i=0;i<menuItems.length;i++){n=(n+delta+menuItems.length)%menuItems.length;if(!menuItems[n].disabled){focus=n;updateFocus();audio.ui();break}}}
function activate(){if(menuItems[focus]&&!menuItems[focus].disabled){audio.ensure();audio.ui();menuItems[focus].action()}}
function showMenu(){scene='menu';player=null;shots=[];world=null;let buttons=[
 {label:'▶ НОВАЯ ИГРА',action:()=>newGame()},
 {label:'↪ ПРОДОЛЖИТЬ С УРОВНЯ '+save.lastLevel,disabled:!save.seen,action:()=>startLevel(save.lastLevel)},
 {label:'▤ ВЫБОР УРОВНЯ',action:()=>levelSelect()},
 {label:`♫ МУЗЫКА: ${save.music?'ВКЛ':'ВЫКЛ'}`,action:()=>{save.music=!save.music;store();audio.updateMusic();showMenu()}},
 {label:`♪ ЗВУКИ: ${save.sfx?'ВКЛ':'ВЫКЛ'}`,action:()=>{save.sfx=!save.sfx;store();audio.updateSfx();showMenu()}},
 {label:'? ПРАВИЛА И УПРАВЛЕНИЕ',action:()=>showHelp()}];
menu('<div class="brand">АРКАДА · 7 УРОВНЕЙ · ARMENIA</div><h1 class="hero-title">SUPER<br>NIKOLIO</h1><p class="sub">Ереванские приключения</p>',buttons,'Играй с пульта TCL: ← → идти, ↑ прыгать, OK бросать гранат.');
audio.updateMusic()}
function showHelp(){scene='help';menu('<div class="brand">КАК ИГРАТЬ</div><h2 class="level-title">Пульт управляет всем</h2><p class="sub">← / → — движение<br>↑ — прыжок (можно прыгнуть на врага сверху)<br>OK — бросить фрукт-гранат<br>↓ — присесть<br>Назад — пауза и продолжение<br><br>🥟 пирожок +100 · 🌽 кукуруза +150 · 🍢 шашлык +250<br>3 сердца, контрольные точки, 7 локаций.</p>',[{label:'← НАЗАД',action:()=>showMenu()}],'Врагов можно обойти, перепрыгнуть или победить. Уровни всегда имеют проходимый маршрут.')}
function levelSelect(){scene='levels';let b=names.map((n,i)=>({label:`${i+1}. ${n} ${i+1>save.unlocked?'🔒':''}`,disabled:i+1>save.unlocked,action:()=>startLevel(i+1)}));b.push({label:'← НАЗАД',action:()=>showMenu()});menu('<div class="brand">КАРТА ПУТЕШЕСТВИЯ</div><h2 class="level-title">Выбери район</h2>',b,'Новые районы открываются после прохождения предыдущих.');}
function togglePause(){if(scene==='playing'){showPause(true)}else if(scene==='pause'){resume()}
else if(scene==='help'||scene==='levels')showMenu();else if(scene==='gameover'||scene==='levelclear'||scene==='final')showMenu()}
function showPause(playSound=false){if(scene!=='playing')return;scene='pause';if(playSound)audio.sfx('pause');menu('<div class="brand">SUPER NIKOLIO</div><h2 class="level-title">ПАУЗА</h2><p class="sub">Всё остановлено. Можно продолжить с этого же места.</p>',[
 {label:'▶ ПРОДОЛЖИТЬ',action:()=>resume()},
 {label:'↻ НАЧАТЬ УРОВЕНЬ ЗАНОВО',action:()=>startLevel(level)},
 {label:`♫ МУЗЫКА: ${save.music?'ВКЛ':'ВЫКЛ'}`,action:()=>{save.music=!save.music;store();audio.updateMusic();scene='playing';showPause(false)}},
 {label:`♪ ЗВУКИ: ${save.sfx?'ВКЛ':'ВЫКЛ'}`,action:()=>{save.sfx=!save.sfx;store();audio.updateSfx();scene='playing';showPause(false)}},
 {label:'⌂ ГЛАВНОЕ МЕНЮ',action:()=>showMenu()}],`Уровень ${level}/7 · ${names[level-1]}`)}
function resume(){scene='playing';overlay.classList.add('hidden');mobile.classList.add('active');audio.ensure();audio.updateMusic();last=performance.now()}
function newGame(){score=0;startLevel(1)}
function makeWorld(level,seed){const rng=randomSeeded(seed);const modules=16+level*2,side=710,width=modules*side+260;
const grounds=[],solid=[],platforms=[],enemies=[],pickups=[],checkpoints=[];let n=0;
for(let c=0;c<modules;c++){
 const sx=c*side;let gap=0,gx=0;
 if(c>1&&c<modules-2&&rng()<(.11+.035*level)){
  gap=86+Math.floor(rng()*49);gx=sx+298+Math.floor(rng()*95);
  grounds.push({x:sx,y:GROUND,w:gx-sx,h:H-GROUND,type:'ground'});
  grounds.push({x:gx+gap,y:GROUND,w:side-(gx-sx)-gap,h:H-GROUND,type:'ground'});
 }else grounds.push({x:sx,y:GROUND,w:side,h:H-GROUND,type:'ground'});
 if(c>0&&c<modules-1&&rng()<.52){let xx=sx+125+Math.floor(rng()*300);if(!(gap&&xx>gx-75&&xx<gx+gap+70)){
  let h=38+Math.floor(rng()*24);solid.push({x:xx,y:GROUND-h,w:38+Math.floor(rng()*34),h,type:['crate','stone','flowerpot'][Math.floor(rng()*3)]});
 }}
 if(c>0&&rng()<(.34+.025*level)){
  let xx=sx+70+Math.floor(rng()*300),yy=GROUND-(78+Math.floor(rng()*24));
  platforms.push({x:xx,y:yy,w:135+Math.floor(rng()*80),h:18,type:'platform'});
  if(rng()<.75)pickups.push({x:xx+55,y:yy-42,r:20,type:Math.floor(rng()*3),taken:false,bob:rng()*TAU});
 }
 // Accessible ground pickups; never over a gap.
 for(let k=0;k<(c===0?3:2+Math.floor(rng()*2));k++){
  let xx=sx+116+k*159+rng()*25;
  if(gap&&xx>gx-44&&xx<gx+gap+44)continue;
  pickups.push({x:xx,y:GROUND-61-(rng()<.18?38:0),r:19,type:Math.floor(rng()*3),taken:false,bob:rng()*TAU});
 }
 // Avoid unavoidable enemies at start and near gaps.
 if(c>1&&c<modules-1&&rng()<(0.41+level*.034)){
   let ex=sx+460+Math.floor(rng()*105);
   if(!(gap&&ex>gx-60&&ex<gx+gap+85))enemies.push({x:ex,y:GROUND-76,w:58,h:76,kind:rng()<.5?0:1,origin:ex,range:65+Math.floor(rng()*55),vx:(rng()<.5?-1:1)*(36+level*2),alive:true,timer:rng()*3});
 }
 if((c===Math.floor(modules/3)||c===Math.floor(modules*2/3))&&c>0)checkpoints.push({x:sx+90,y:GROUND-98,active:false});
 n++;
}
grounds.push({x:modules*side,y:GROUND,w:260,h:H-GROUND,type:'ground'});
return {width,grounds,solid,platforms,enemies,pickups,checkpoints,finishX:width-175,seed,level,modules};}
function startLevel(num){level=clamp(num,1,7);save.lastLevel=level;save.seen=true;store();gameSeed=Math.floor(Math.random()*0xFFFFFFF);
world=makeWorld(level,gameSeed);player={x:130,y:GROUND-111,w:51,h:111,vx:0,vy:0,grounded:true,coyote:.1,jumpBuffer:0,dir:1,health:3,invincible:0,anim:0,checkpoint:130,pose:'idle'};
score=score||0;collected=0;beaten=0;checkpoint=130;shots=[];particles=[];popTexts=[];camera=0;levelClearLock=false;screenShake=0;canShootIn=0;resume();toast(`УРОВЕНЬ ${level} · ${names[level-1]}`,2800);audio.sfx('start')}
function restartLevel(){startLevel(level)}
function showGameOver(){scene='gameover';audio.sfx('fail');menu('<div class="brand">ЗДЕСЬ ЕЩЁ НЕ КОНЕЦ</div><h2 class="level-title">ПОПРОБУЙ ЕЩЁ!</h2><p class="sub">SUPER NIKOLIO возвращается к началу уровня. Не сдавайся — победа рядом!</p>',[
 {label:'↻ ПОВТОРИТЬ УРОВЕНЬ',action:()=>restartLevel()},
 {label:'⌂ ГЛАВНОЕ МЕНЮ',action:()=>showMenu()}])}
function clearLevel(){if(levelClearLock)return;levelClearLock=true;audio.sfx('victory');save.best[level-1]=Math.max(save.best[level-1]||0,score);save.unlocked=Math.max(save.unlocked,Math.min(level+1,7));save.lastLevel=Math.min(level+1,7);save.seen=true;store();scene=level===7?'final':'levelclear';
const finale=level===7;
menu(`<div class="brand">${finale?'ФИНАЛЬНАЯ ПОБЕДА!':`УРОВЕНЬ ${level} ПРОЙДЕН!`}</div><h2 class="level-title">SUPER NIKOLIO<br>${finale?'ПОБЕДИТЕЛЬ!':'МОЛОДЕЦ!'}</h2><p class="sub">SUPER NIKOLIO ${finale?'прошёл все 7 уровней':'прошёл уровень'} и <b>почти вступил в ЕВРОСОЮЗ!</b><br>Собрано угощений: ${collected} · Побеждено врагов: ${beaten}<br>Очки: ${score.toLocaleString('ru-RU')}</p>`,[
 {label:finale?'↻ НОВОЕ ПРИКЛЮЧЕНИЕ':'▶ СЛЕДУЮЩИЙ УРОВЕНЬ',action:()=>finale?newGame():startLevel(level+1)},
 {label:'⌂ ГЛАВНОЕ МЕНЮ',action:()=>showMenu()}],finale?'Поздравляем с путешествием по Армении!':'К следующему району на пути к большой мечте!');
overlay.insertAdjacentHTML('beforeend','<img class="flag-preview" alt="Финишные флаги">');overlay.querySelector('.flag-preview').src=img.finish_flags.src;
for(let i=0;i<65;i++)spawnParticle(710+Math.random()*560,90+Math.random()*130,['#f2c15b','#d92c46','#4ca6e7','#e8eeff'][i%4],4+Math.random()*3,(Math.random()-.5)*250,Math.random()*100-90,2.6)}
function movePlayer(dt){const p=player;if(!p)return;p.invincible=Math.max(0,p.invincible-dt);p.coyote=Math.max(0,p.coyote-dt);p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);canShootIn=Math.max(0,canShootIn-dt);
const dir=(key.ArrowRight?1:0)-(key.ArrowLeft?1:0);const crouch=key.ArrowDown&&!dir&&p.grounded;const speed=crouch?0:256;
if(dir){p.vx+=dir*1730*dt;p.vx=clamp(p.vx,-speed,speed);p.dir=dir}else{p.vx*=Math.pow(.016,dt);if(Math.abs(p.vx)<2)p.vx=0}
if(p.jumpBuffer>0&&(p.grounded||p.coyote>0)){p.vy=-632;p.grounded=false;p.coyote=0;p.jumpBuffer=0;audio.sfx('jump');spawnParticle(p.x+p.w/2,p.y+p.h,'#e9bd92',3,0,30,.5)}
let oldY=p.y,pBottom=p.y+p.h;let oldVX=p.vx;p.x+=p.vx*dt;p.x=clamp(p.x,0,world.width-p.w);
// Solid box side collisions. Platforms are one-way to keep TV controls simple.
for(const obj of world.solid){if(overlap(p,obj)){if(oldVX>0)p.x=obj.x-p.w;else if(oldVX<0)p.x=obj.x+obj.w;p.vx=0}}
p.vy=Math.min(810,p.vy+1450*dt);p.y+=p.vy*dt;p.grounded=false;
if(p.vy>=0){let best=Infinity;for(const obj of world.grounds.concat(world.solid,world.platforms)){
 if(p.x+p.w>obj.x+5&&p.x<obj.x+obj.w-5&&pBottom<=obj.y+11&&p.y+p.h>=obj.y&&obj.y<best)best=obj.y;
 }if(best!==Infinity){let impact=p.vy;p.y=best-p.h;p.vy=0;p.grounded=true;p.coyote=.12;if(impact>180&&oldY<best-p.h-2){audio.sfx('land');spawnParticle(p.x+p.w/2,p.y+p.h,'#e5b493',2,0,15,.3)}}}
// side collision if falling into top of crate; less sticky than full AABB resolution
for(const obj of world.solid){if(overlap(p,obj)&&p.y+p.h>obj.y+16&&p.y<obj.y+obj.h-5){if(oldVX>0)p.x=obj.x-p.w;else if(oldVX<0)p.x=obj.x+obj.w}}
if(p.y>H+75){hurt(true);return}
for(const q of world.pickups){if(q.taken)continue;const a={x:q.x-17,y:q.y-23,w:34,h:44};if(overlap(p,a)){q.taken=true;const pts=[100,150,250][q.type];score+=pts;collected++;audio.sfx('pickup');popup(q.x,q.y-32,'+'+pts,'#fff1ab');spawnParticle(q.x,q.y,'#ffdb8b',9,0,-55,.55)}}
for(const cp of world.checkpoints){if(!cp.active&&p.x>=cp.x){cp.active=true;p.checkpoint=cp.x;audio.sfx('checkpoint');toast('✓ КОНТРОЛЬНАЯ ТОЧКА',1400)}}
for(const e of world.enemies){if(!e.alive||!overlap(p,e))continue;
 if(p.vy>88&&pBottom<=e.y+31){destroyEnemy(e);p.vy=-425;p.y=e.y-p.h-3;audio.sfx('stomp')}else if(p.invincible<=0)hurt(false)}
if(p.x+p.w>=world.finishX){clearLevel()}
p.anim+=dt*(Math.abs(p.vx)>160?11:7);
p.pose=!p.grounded?(p.vy<0?'jump':'fall'):(crouch?'crouch':Math.abs(p.vx)<15?'idle':'walk');}
function hurt(fall){const p=player;if(p.invincible>0&&!fall)return;p.health--;audio.sfx('hurt');screenShake=10;spawnParticle(p.x+p.w/2,p.y+40,'#d83b52',12,0,-30,.7);
if(p.health<=0){showGameOver();return}p.invincible=1.9;if(fall){p.x=p.checkpoint;p.y=GROUND-p.h;p.vx=0;p.vy=0;toast('ОСТОРОЖНО! МИНУС ОДНО СЕРДЦЕ',1600)}else{p.vy=-295;p.vx=-p.dir*180;toast('АЙ! БУДЬ ОСТОРОЖЕН',1200)}}
function shoot(){if(!player||canShootIn>0)return;canShootIn=.31;let p=player;if(key.ArrowDown&&p.grounded){/* Allows throwing while crouching as well */}
shots.push({x:p.x+p.w/2+p.dir*25,y:p.y+48,vx:p.dir*575,vy:-120,r:12,age:0,dead:false});audio.sfx('shoot');spawnParticle(p.x+p.w/2+p.dir*31,p.y+48,'#f3c690',4,p.dir*80,-30,.3)}
function destroyEnemy(e){if(!e.alive)return;e.alive=false;beaten++;score+=200;audio.sfx('enemy');popup(e.x+e.w/2,e.y-15,'+200','#fff0aa');for(let i=0;i<14;i++)spawnParticle(e.x+e.w/2,e.y+e.h/2,['#f9d57b','#d94252','#b88f77'][i%3],3+Math.random()*4,(Math.random()-.5)*280,-Math.random()*200,.5+Math.random()*.5)}
function updateShots(dt){for(const s of shots){s.age+=dt;s.vy+=480*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;
 if(s.age>1.7||s.y>GROUND+20){s.dead=true;explode(s.x,s.y,false);continue}
 for(const e of world.enemies){if(!e.alive)continue;if(s.x+s.r>e.x&&s.x-s.r<e.x+e.w&&s.y+s.r>e.y&&s.y-s.r<e.y+e.h){destroyEnemy(e);explode(s.x,s.y,true);s.dead=true;break}}
 if(!s.dead){for(const b of world.solid.concat(world.grounds)){if(s.x>b.x&&s.x<b.x+b.w&&s.y+s.r>b.y&&s.y-s.r<b.y+b.h){explode(s.x,s.y,false);s.dead=true;break}}}
 }shots=shots.filter(s=>!s.dead)}
function explode(x,y,hit){audio.sfx(hit?'blast':'pop');for(let i=0;i<9;i++)spawnParticle(x,y,['#dd3942','#ffc06a','#e9d699'][i%3],2+Math.random()*4,(Math.random()-.5)*190,(Math.random()-.5)*190,.44)}
function spawnParticle(x,y,color,r,vx,vy,life){particles.push({x,y,vx,vy,color,r,life,max:life})}
function popup(x,y,text,color){popTexts.push({x,y,text,color,life:1})}
function updateEffects(dt){for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=250*dt}
for(let i=popTexts.length-1;i>=0;i--){let p=popTexts[i];p.life-=dt;p.y-=50*dt;if(p.life<=0)popTexts.splice(i,1)}}
function updateEnemies(dt){for(const e of world.enemies){if(!e.alive)continue;e.timer+=dt;e.x+=e.vx*dt;if(Math.abs(e.x-e.origin)>=e.range){e.vx*=-1;e.x=clamp(e.x,e.origin-e.range,e.origin+e.range)}
 // Enemy never walks into a pit: turn around before unsupported terrain.
 const look=e.x+e.w/2+(e.vx>0?e.w/2+9:-e.w/2-9);const support=world.grounds.some(g=>look>g.x+7&&look<g.x+g.w-7);
 if(!support){e.vx*=-1;e.x+=e.vx*dt*2}}
}
function step(dt){t+=dt;total+=dt;if(scene==='playing'){movePlayer(dt);if(scene==='playing'){updateShots(dt);updateEnemies(dt);camera+=((clamp(player.x-390,0,world.width-W)-camera)*Math.min(1,dt*5.6));}}updateEffects(dt);screenShake=Math.max(0,screenShake-35*dt)}
// ----------- Drawing primitives, Armenia scenery -----------
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function rounded(x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();r=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
function circle(x,y,r,fill,stroke,lw=1){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
function poly(points,fill,stroke){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function arch(x,y,w,h,col){rounded(x,y,w,h,3,col);rounded(x+w*.19,y+h*.27,w*.62,h*.73,[w*.31,w*.31,0,0],'#514967')}
function sceneBack(lev,offset){let pal=palettes[lev-1],gr=ctx.createLinearGradient(0,0,0,H);gr.addColorStop(0,pal[0]);gr.addColorStop(.83,pal[1]);gr.addColorStop(1,'#fff1d1');rect(0,0,W,H,gr);
let sunX=1070-(lev-1)*29;circle(sunX,160,70,'rgba(255,236,167,.46)');circle(sunX,160,49,'rgba(255,245,197,.79)');
// Volumetric parallax clouds
for(let i=-2;i<9;i++){let sx=((i*315-(offset*.10)%315)+3150)%3150-310;let sy=91+(i%3)*43+Math.sin(i+lev)*10;ctx.fillStyle='rgba(255,248,239,.34)';circle(sx,sy,33,'rgba(255,248,239,.27)');circle(sx+38,sy-10,43,'rgba(255,248,239,.31)');circle(sx+80,sy,30,'rgba(255,248,239,.27)')}
// Mount Ararat, with snow cap, dramatic but behind foreground.
let mx=470-offset*.11%550;for(let b=-1;b<=2;b++){
 let shift=b*950;poly([[mx+shift-520,437],[mx+shift+24,174+(lev<5?45:0)],[mx+shift+550,437]],lev<5?'#aac4d5':'#8f9cba');
 poly([[mx+shift-106,310],[mx+shift+24,174+(lev<5?45:0)],[mx+shift+144,317],[mx+shift+94,288],[mx+shift+68,296],[mx+shift+22,242],[mx+shift-22,294],[mx+shift-59,279]],'#f5f4ed');
 poly([[mx+shift+165,437],[mx+shift+350,265],[mx+shift+530,437]],'#a6adc0');
 poly([[mx+shift+305,321],[mx+shift+350,265],[mx+shift+395,323]],'#f7f5ee');
}
rect(0,428,W,132,'rgba(139,146,151,.10)');
// Scrolling architecture: each area picks an identifiable silhouette motif.
for(let j=-1;j<9;j++){
let x=j*248-(offset*.30%248),y=367+(j%2)*14;const col=pal[2],dark=pal[3];
if(lev===1){rect(x,y,218,157,col);for(let k=0;k<5;k++)arch(x+9+k*41,y+28,29,91,dark);rect(x-12,y-16,242,16,'#f2c5a7');if(j%3===0){rect(x+83,y-62,46,61,col);rect(x+79,y-65,54,10,'#ffd6ab')}}
else if(lev===2){rect(x,y-68,207,208,col);for(let k=0;k<4;k++)for(let r=0;r<4;r++){rounded(x+16+k*47,y-49+r*48,28,35,5,'#5b789b','#f9d6a7',2)}rect(x-7,y-77,221,13,dark);if(j%2===0){rect(x+40,y+89,130,31,'#d77e61');rect(x+40,y+99,130,6,'#f9d3a9')}}
else if(lev===3){rect(x,y+12,222,132,col);for(let k=0;k<5;k++){rect(x+32+k*9,y-16+k*8,169-k*21,7,'#f1e2c8')}for(let k=0;k<4;k++)arch(x+22+k*49,y+62,34,65,dark)}
else if(lev===4){rect(x,y+30,230,115,col);for(let k=0;k<6;k++){rect(x+15+k*35,y-18,15,96,'#f4d7b4');rect(x+14+k*35,y-27,18,11,dark)}rect(x-4,y-33,238,19,'#dab9a7')}
else if(lev===5){rect(x,y+8,220,141,col);rect(x+20,y-18,178,36,'#9c6270');for(let k=0;k<3;k++)arch(x+18+k*72,y+64,54,68,dark);rect(x,y+7,218,9,'#f4bd8f');for(let g=0;g<4;g++){circle(x+18+g*57,y+2,14,'#607f4e');circle(x+18+g*57,y+16,11,'#6b9a56')}}
else if(lev===6){rect(x,y+47,217,105,col);rect(x+68,y-26,79,80,col);poly([[x+59,y-26],[x+108,y-113],[x+156,y-26]],col);rect(x+101,y-128,9,21,'#e2cfaf');rect(x+93,y-139,25,6,'#e2cfaf');arch(x+91,y+37,29,67,dark)}
else{rect(x,y,212,145,col);rect(x+35,y-31,143,32,'#b47792');for(let k=0;k<3;k++)arch(x+26+k*61,y+38,42,89,dark)}
}
// Nearer parallax: rhythmic street wall and arches
for(let j=-1;j<13;j++){let x=j*176-(offset*.51%176);rect(x,490,165,72,pal[4]);rect(x,488,165,7,'#eaceb2');for(let k=0;k<3;k++)rect(x+14+k*50,517,41,28,'rgba(88,75,89,.22)')}
}
function drawGround(g){let sx=g.x-camera;if(sx>W+30||sx+g.w<-30)return;rect(sx,g.y,g.w,g.h,'#a97871');rect(sx,g.y,g.w,12,'#e6b48e');rect(sx,g.y+12,g.w,10,'#cb9479');ctx.save();ctx.beginPath();ctx.rect(sx,g.y+22,g.w,g.h-22);ctx.clip();for(let xx=Math.floor(g.x/61)*61;xx<g.x+g.w+70;xx+=61){let px=xx-camera;ctx.strokeStyle='rgba(74,52,76,.23)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(px,g.y+27);ctx.lineTo(px,g.y+155);ctx.stroke()}for(let y=g.y+28;y<H;y+=42){ctx.strokeStyle='rgba(245,199,157,.20)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo(sx+g.w,y);ctx.stroke()}ctx.restore()}
function drawSolid(o){let x=o.x-camera;if(x<-130||x>W+130)return;let y=o.y;
if(o.type==='crate'){rounded(x,y,o.w,o.h,6,'#a96d46','#684132',3);rect(x+8,y+8,o.w-16,o.h-16,'#d99b62');ctx.strokeStyle='#87583b';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(x+9,y+8);ctx.lineTo(x+o.w-10,y+o.h-9);ctx.moveTo(x+o.w-10,y+8);ctx.lineTo(x+9,y+o.h-9);ctx.stroke()}
else if(o.type==='stone'){rounded(x,y,o.w,o.h,4,'#c89b8f','#9b737c',3);rect(x,y+9,o.w,6,'#e7bdaa');rect(x+6,y+o.h/2,o.w-12,2,'#a77b83')}
else{rounded(x+8,y+20,o.w-14,o.h-20,8,'#c86c68','#83495a',3);circle(x+o.w/2,y+12,22,'#57854b');circle(x+o.w/2-11,y+2,14,'#6e9f58');circle(x+o.w/2+12,y+3,13,'#6f9b59')}}
function drawPlatform(o){let x=o.x-camera;if(x<-o.w||x>W)return;rounded(x,o.y,o.w,o.h+5,7,'#c99177','#885875',3);rect(x+6,o.y+6,o.w-12,5,'#f7d9ac');for(let b=16;b<o.w;b+=38)rect(x+b,o.y+16,3,7,'rgba(95,68,77,.35)')}
function drawPickup(q){let x=q.x-camera;if(x<-60||x>W+60)return;let y=q.y+Math.sin(t*3.1+q.bob)*6;
ctx.save();ctx.shadowColor='#ffe2a1';ctx.shadowBlur=15;circle(x,y,25,'rgba(255,246,198,.16)');ctx.restore();
if(q.type===0){ctx.save();ctx.translate(x,y);ctx.rotate(-.13);rounded(-21,-11,42,24,12,'#e8ae5a','#9b642e',2.5);ctx.strokeStyle='#fff0a5';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,0);ctx.quadraticCurveTo(0,-10,15,0);ctx.stroke();ctx.restore()}
else if(q.type===1){rounded(x-12,y-23,24,46,11,'#f3cc3b','#b58a22',2);for(let k=-1;k<=1;k++)for(let z=-2;z<=2;z++)circle(x+k*6,y+z*8,3,'#f7e86e');poly([[x-12,y+17],[x-22,y+4],[x-21,y+24],[x,y+32]],'#4d8d57');poly([[x+12,y+17],[x+21,y+3],[x+23,y+25],[x,y+32]],'#67a367')}
else{ctx.save();ctx.translate(x,y);ctx.rotate(-.65);rect(-3,-31,6,62,'#ae825a');for(let k=-1;k<=1;k++)rounded(-13,k*16-8,25,17,8,'#9d5038','#e4a86e',2);ctx.restore()}}
function drawEnemy(e){if(!e.alive)return;let x=e.x-camera;if(x<-100||x>W+100)return;let wiggle=Math.sin(e.timer*6)*2;let suit=e.kind===0?'#242c44':'#323146';
ctx.save();if(e.vx<0){ctx.translate(x+e.w,0);ctx.scale(-1,1);x=0}
rounded(x+10,e.y+29,e.w-16,e.h-37,11,suit,'#161b2f',2);rect(x+18,e.y+58,9,18,'#272c33');rect(x+37,e.y+58,9,18,'#272c33');rounded(x+12,e.y+68,18,7,3,'#161926');rounded(x+35,e.y+68,18,7,3,'#161926');
if(e.kind===0)drawImg('enemy_a',x+1,e.y-10+wiggle,64,59);
else drawImg('enemy_b',x+4,e.y-13+wiggle,50,61);
ctx.restore()}
function drawHero(){if(!player)return;const p=player;let sprite;if(p.invincible>0&&Math.floor(t*13)%2===0)return;
if(p.pose==='jump')sprite='jump'+(p.vy<-340?0:p.vy<-100?1:2);
else if(p.pose==='fall')sprite='jump2';
else if(p.pose==='walk')sprite=(Math.abs(p.vx)>190?'run':'walk')+Math.floor(p.anim)%(Math.abs(p.vx)>190?4:6);
else if(p.pose==='crouch')sprite='jump0';else sprite='idle'+(Math.floor(t*1.8)%2);
// Sprites cropped from original provided concept atlas; game hitbox is deliberately narrower.
const px=p.x-camera;let sh=p.pose==='crouch'?106:135,sw=sh*.57;
if(p.pose==='walk'){sh=137;sw=85}
if(p.pose==='jump'||p.pose==='fall'){sh=128;sw=84}
ctx.save();let flip=p.dir<0;drawImg(sprite,px+p.w/2-sw/2-2,p.y+p.h-sh+4,sw,sh,flip);
ctx.restore()}
function drawFlags(){let x=world.finishX-camera;if(x<-140||x>W+270)return;rounded(x,GROUND-180,8,180,3,'#e9d39f','#986b65',2);drawImg('finish_flags',x-122,GROUND-243,255,150);rounded(x-55,GROUND-26,115,26,5,'#f2c27c','#b27f61',2);ctx.fillStyle='#654364';ctx.font='bold 17px Arial';ctx.fillText('ФИНИШ',x-40,GROUND-8)}
function drawDecor(){if(!world)return;for(let j=-1;j<Math.ceil(world.width/340)+1;j++){let pos=j*340+79;let x=pos-camera;if(x<-100||x>W+100)continue;let grounded=world.grounds.some(g=>pos>g.x+10&&pos<g.x+g.w-10);if(!grounded)continue;
if(j%4===0){rect(x,GROUND-104,8,103,'#4c5563');circle(x+4,GROUND-109,15,'#ffe8ad','#a78761',3);circle(x+4,GROUND-109,24,'rgba(255,228,151,.15)')}
else if(j%4===2){rounded(x,GROUND-37,38,39,8,'#b46f72','#8f6063',2);circle(x+20,GROUND-47,23,'#639050');circle(x+6,GROUND-45,18,'#52894f');circle(x+32,GROUND-57,18,'#669858');circle(x+20,GROUND-77,12,'#79a55c')}
}for(const cp of world.checkpoints){let x=cp.x-camera;if(x<-80||x>W+80)continue;rect(x,GROUND-90,7,90,'#f7e0b1');poly([[x+7,GROUND-90],[x+65,GROUND-76],[x+7,GROUND-57]],cp.active?'#5dc3a3':'#ffd48e');circle(x+4,GROUND-92,7,'#fff4c6')}
}
function drawBullets(){for(const s of shots){let x=s.x-camera;if(x<-30||x>W+30)continue;circle(x,s.y,s.r,'#d52c4b','#f6a4a3',2);for(let i=0;i<6;i++){let a=i*TAU/6;circle(x+Math.cos(a)*6,s.y+Math.sin(a)*6,1.6,'#f6b1a6')}poly([[x-5,s.y-11],[x,s.y-17],[x+4,s.y-10]],'#5c9852')}}
function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);circle(p.x-camera,p.y,p.r,p.color)}ctx.globalAlpha=1;for(const b of popTexts){ctx.globalAlpha=b.life;ctx.font='bold 23px Arial';ctx.textAlign='center';ctx.fillStyle='#233148';ctx.fillText(b.text,b.x-camera+2,b.y+2);ctx.fillStyle=b.color;ctx.fillText(b.text,b.x-camera,b.y)}ctx.textAlign='left';ctx.globalAlpha=1}
function drawHUD(){if(!world||!player||scene==='menu'||scene==='levels'||scene==='help')return;
rounded(18,16,1244,78,17,'rgba(16,35,63,.82)','rgba(255,230,174,.27)',2);
ctx.fillStyle='#fff5d9';ctx.font='900 23px Arial';ctx.fillText('SUPER NIKOLIO',37,47);
ctx.font='bold 17px Arial';ctx.fillStyle='#ffda9b';ctx.fillText(`УРОВЕНЬ ${level} / 7 · ${names[level-1]}`,37,77);
for(let h=0;h<3;h++){let x=456+h*47;ctx.font='36px Arial';ctx.fillText(h<player.health?'♥':'♡',x,62)}
ctx.font='bold 19px Arial';ctx.fillStyle='#ffedc7';ctx.fillText(`БОНУСЫ: ${collected}`,641,48);ctx.fillText(`ОЧКИ: ${score.toLocaleString('ru-RU')}`,641,76);
rounded(975,33,246,19,9,'rgba(255,255,255,.16)');rounded(979,37,Math.max(2,238*(player.x/world.finishX)),11,6,'#f8c57c');ctx.fillStyle='#d5e2eb';ctx.font='15px Arial';ctx.fillText('ПРОГРЕСС',975,75);
}
function render(){ctx.save();if(screenShake>0&&scene==='playing')ctx.translate((Math.random()-.5)*screenShake,(Math.random()-.5)*screenShake);
let lev=world?level:1;sceneBack(lev,world?camera:((t*16)%1300));
if(world){for(const g of world.grounds)drawGround(g);for(const pp of world.platforms)drawPlatform(pp);drawDecor();for(const q of world.pickups)if(!q.taken)drawPickup(q);for(const o of world.solid)drawSolid(o);for(const e of world.enemies)drawEnemy(e);drawFlags();drawBullets();drawHero()}
else{rect(0,561,1280,159,'#ab797a');rect(0,561,1280,14,'#e9bd9e');drawImg('win0',885,335,170,233);}
drawParticles();drawHUD();ctx.restore()}
function frame(now){let dt=Math.min(.05,(now-last)/1000);last=now;accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps<5){step(1/60);accumulator-=1/60;steps++}render();requestAnimationFrame(frame)}
// ------------- WebAudio original evolving lounge / Armenian-style ambient soundtrack -------------
const audio={ctx:null,musicGain:null,fxGain:null,timer:null,next:0,beat:0,noise:null,
 ensure(){if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});return}let AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;try{this.ctx=new AC();this.musicGain=this.ctx.createGain();this.fxGain=this.ctx.createGain();this.musicGain.gain.value=save.music?.17:0;this.fxGain.gain.value=save.sfx?.32:0;this.musicGain.connect(this.ctx.destination);this.fxGain.connect(this.ctx.destination);this.noise=this.ctx.createBuffer(1,Math.round(this.ctx.sampleRate*.4),this.ctx.sampleRate);let data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;this.next=this.ctx.currentTime+.06;this.timer=setInterval(()=>this.schedule(),170)}catch(err){console.warn('Audio unavailable',err)}},
 updateMusic(){if(!this.ctx)return;this.musicGain.gain.setTargetAtTime(save.music?.17:0,this.ctx.currentTime,.12)},
 updateSfx(){if(!this.ctx)return;this.fxGain.gain.setTargetAtTime(save.sfx?.32:0,this.ctx.currentTime,.09)},
 tone(freq,duration=.3,vol=.1,type='sine',target='fx',start=null,pan=0){if(!this.ctx)return;let ac=this.ctx,tt=start??ac.currentTime+0.005;if(!Number.isFinite(freq)||freq<=0)return;
let osc=ac.createOscillator(),env=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,tt);env.gain.setValueAtTime(.0001,tt);env.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),tt+.016);env.gain.exponentialRampToValueAtTime(.0001,tt+Math.max(.05,duration));
let targetNode=target==='music'?this.musicGain:this.fxGain;let flt=ac.createBiquadFilter();flt.type='lowpass';flt.frequency.value=target==='music'?1900:4300;osc.connect(flt);flt.connect(env);env.connect(targetNode);osc.start(tt);osc.stop(tt+Math.max(.07,duration)+.02)},
 slide(from,to,dur,vol=.14,type='sine'){if(!this.ctx||!save.sfx)return;let ac=this.ctx,tt=ac.currentTime+.002,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(from,tt);o.frequency.exponentialRampToValueAtTime(to,tt+dur);g.gain.setValueAtTime(.0001,tt);g.gain.exponentialRampToValueAtTime(vol,tt+.012);g.gain.exponentialRampToValueAtTime(.0001,tt+dur);o.connect(g);g.connect(this.fxGain);o.start(tt);o.stop(tt+dur+.01)},
 noiseBeat(vol=.05,dur=.09){if(!this.ctx||!save.sfx)return;let ac=this.ctx,src=ac.createBufferSource(),g=ac.createGain(),flt=ac.createBiquadFilter();src.buffer=this.noise;flt.type='bandpass';flt.frequency.value=2400;g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur);src.connect(flt);flt.connect(g);g.connect(this.fxGain);src.start();src.stop(ac.currentTime+dur+.01)},
 ui(){this.ensure();if(save.sfx)this.tone(580,.09,.07,'sine')},
 sfx(name){this.ensure();if(!save.sfx)return;switch(name){
 case 'start':this.tone(493,.14,.09);this.tone(740,.22,.07,'sine','fx',this.ctx.currentTime+.11);break;
 case 'jump':this.slide(290,670,.23,.18,'triangle');break;
 case 'land':this.slide(190,95,.11,.095);this.noiseBeat(.024,.08);break;
 case 'shoot':this.slide(620,230,.2,.17,'triangle');this.noiseBeat(.038,.08);break;
 case 'blast':this.slide(250,82,.2,.19,'sawtooth');this.noiseBeat(.12,.23);break;
 case 'pop':this.slide(410,165,.13,.085,'sine');break;
 case 'pickup':this.tone(659,.11,.13,'sine');this.tone(988,.19,.09,'sine','fx',this.ctx.currentTime+.09);break;
 case 'enemy':this.slide(620,180,.24,.17,'square');this.tone(785,.18,.095,'sine','fx',this.ctx.currentTime+.11);break;
 case 'stomp':this.slide(280,125,.21,.16,'triangle');break;
 case 'hurt':this.slide(420,138,.38,.18,'sawtooth');break;
 case 'checkpoint':this.tone(440,.15,.10);this.tone(554,.22,.09,'sine','fx',this.ctx.currentTime+.12);this.tone(659,.28,.09,'sine','fx',this.ctx.currentTime+.23);break;
 case 'victory':{let n=[523,659,784,1047];n.forEach((f,i)=>this.tone(f,.36,.13,'sine','fx',this.ctx.currentTime+i*.14));break}
 case 'fail':this.slide(370,160,.5,.15,'triangle');break;
 case 'pause':this.tone(320,.09,.055);break;
 }},
 schedule(){if(!this.ctx||!save.music||this.ctx.state!=='running')return;const ac=this.ctx;let limit=ac.currentTime+.65;if(this.next<ac.currentTime-.3)this.next=ac.currentTime+.05;
 const bpm=92,beatSec=60/bpm/2;
 // Four 8-beat chord loops and a rotating 32-step melody: varied, low-key and unhurried.
 const bass=[146.83,130.81,174.61,146.83,164.81,130.81,196.00,146.83];
 const tones=[293.66,329.63,349.23,392,440,493.88,523.25,587.33,659.25,698.46,783.99];
 const phrase=[0,2,5,3,4,1,2,7,5,3,2,0,4,6,7,3,1,4,3,5,8,7,5,3,0,4,5,7,6,4,2,1];
 while(this.next<limit){let k=this.beat%64,bar=Math.floor(this.beat/8),base=bass[bar%8],tt=this.next;
  if(k%8===0){this.tone(base,.95,.22,'sine','music',tt);this.tone(base*2,1.4,.035,'triangle','music',tt)}
  if(k%8===4)this.tone(base*1.5,.8,.10,'sine','music',tt);
  if(k%2===0){let idx=phrase[(k/2+bar*3)%phrase.length];let note=tones[(idx+bar%3)%tones.length];this.tone(note,.23,.055,'triangle','music',tt);if(k%8===6)this.tone(note*1.5,.17,.022,'sine','music',tt+.06)}
  if(k%8===2&&bar%2===0)this.tone(base*4,.35,.018,'sine','music',tt);
  this.beat++;this.next+=beatSec;
 }
 }};
// Initial view and animation.
showMenu();requestAnimationFrame(frame);
// Small, read-only test handle used by browser smoke tests; no debug UI shown to players.
Object.defineProperty(window,'__nikolio',{get:()=>({scene,level,score,health:player?.health,x:player?.x,worldWidth:world?.width,unlocked:save.unlocked,music:save.music})});
})();
