// ============================================================
// NIGHTFALL SURVIVAL — AIML + DAA
// Pure HTML/CSS/Vanilla JS. No libraries.
// ============================================================

const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const game = {
  running:false, elapsed:0, duration:180, wave:1,
  level:1, difficulty:"EASY", levelTransition:false, paused:false,
  kills:0, aiDecisions:0, bfsSearches:0, dfsSearches:0,
  player:{x:620,y:370,r:14,hp:100,maxHp:100,ammo:12,maxAmmo:30,energy:100,speed:235,dash:0},
  bullets:[], zombies:[], pickups:[],
  keys:new Set(), mouse:{x:0,y:0,down:false},
  last:0, aiClock:0, spawnClock:0, medkits:0,
  extraction:{x:1050,y:260,r:42,active:false},
  camera:{x:0,y:0},
  obstacles:[
    {x:220,y:150,w:190,h:75},{x:700,y:120,w:190,h:70},{x:1040,y:390,w:190,h:75},
    {x:330,y:500,w:170,h:60},{x:780,y:500,w:140,h:70},{x:120,y:350,w:110,h:55}
  ],
  graph:null
};

const LEVELS = [
  {level:1,name:"EASY",zombies:5,hp:60,speed:58},
  {level:2,name:"MEDIUM",zombies:7,hp:75,speed:72},
  {level:3,name:"HARD",zombies:10,hp:95,speed:88}
];

const canvas=$("worldCanvas"), ctx=canvas.getContext("2d"), mini=$("miniMap"), mctx=mini.getContext("2d");

function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
addEventListener("resize",resize); resize();

function show(id){$(id).classList.add("open")}
function hide(id){$(id).classList.remove("open")}
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>hide(b.dataset.close)));
document.querySelectorAll(".widget-toggle[data-widget]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const widget=$(btn.dataset.widget);
    widget.classList.toggle("collapsed");
    const icon=btn.querySelector("b");
    if(icon) icon.textContent=widget.classList.contains("collapsed")?"+":"−";
  });
});
$("aiWidgetToggle").addEventListener("click",()=>{
  const widget=$("aiWidget");
  widget.classList.toggle("collapsed");
  const icon=$("aiWidgetToggle").querySelector("b");
  if(icon) icon.textContent=widget.classList.contains("collapsed")?"+":"−";
});

$("openHow").onclick=()=>show("howModal");
$("openAI").onclick=()=>show("aiModal");
$("startGame").onclick=()=>startGame();
$("playAgain").onclick=()=>startGame();
$("backMenu").onclick=()=>{$("result").classList.remove("active");$("menu").classList.add("active")};

function startGame(){
  $("menu").classList.remove("active");
  $("result").classList.remove("active");
  $("gameScreen").classList.add("active");
  game.running=true;
  game.kills=0;
  game.aiDecisions=0;
  game.bfsSearches=0;
  game.dfsSearches=0;
  startLevel(1,true);
}

function startLevel(level,first=false){
  const cfg=LEVELS[level-1];
  game.level=level;
  game.difficulty=cfg.name;
  game.duration=180;
  game.elapsed=0;
  game.wave=1;
  game.levelTransition=false;
  game.paused=false;
  $("pauseOverlay").classList.remove("show");
  game.player={x:620,y:370,r:14,hp:100,maxHp:100,ammo:12,maxAmmo:30,energy:100,speed:235,dash:0};
  game.bullets=[];
  game.zombies=[];
  game.pickups=[];
  game.aiClock=0;
  game.spawnClock=0;
  game.medkits=0;
  game.extraction.active=false;
  makeGraph();

  const spots=[[180,105],[1110,135],[1040,610],[260,640],[1190,490],[1300,170],[90,700],[760,90],[1220,700],[650,740]];
  for(let i=0;i<cfg.zombies;i++){
    const p=spots[i%spots.length];
    spawnZombie(p[0],p[1],i,cfg.hp,cfg.speed);
  }
  [[510,190,"med"],[900,280,"med"],[830,650,"energy"],[380,360,"ammo"],[1150,700,"energy"]].forEach(p=>spawnPickup(...p));

  $("level").textContent=level;
  $("difficulty").textContent=cfg.name;
  $("wave").textContent="01";
  $("objSurvive").checked=false;
  $("objReach").checked=false;
  $("objMed").checked=false;
  $("medCount").textContent="0";
  $("levelCompleteOverlay").classList.remove("show");
  $("aiWidget").classList.remove("collapsed");
  $("aiWidget").style.display="block";

  addEvent("LEVEL",`Level ${level} — ${cfg.name}. Eliminate all infected.`);
  if(first){
    addEvent("System","Kill every zombie, then enter the yellow extraction zone.");
    addEvent("AI","Intelligent zombie agents are online.");
  }else{
    addEvent("System",`Entering Level ${level}: ${cfg.name}.`);
    toast(`LEVEL ${level} — ${cfg.name}`);
  }

  game.last=performance.now();
  requestAnimationFrame(loop);
}

function spawnInitial(){
}

function spawnZombie(x,y,i=0,hp=60,speed=60){
  game.zombies.push({x,y,r:15,hp,maxHp:hp,speed:speed+Math.random()*8,state:"SEARCHING",decision:0,route:[],targetNode:null,attackCd:0,id:i+1,lastSeen:{x,y}});
}

function spawnPickup(x,y,type){game.pickups.push({x,y,type,r:13,pulse:Math.random()*6})}

function makeGraph(){
  // Navigation graph: a real adjacency list over walkable landmark nodes.
  const pts=[
    [100,100],[300,100],[520,100],[760,100],[1000,100],[1220,100],
    [180,260],[380,240],[600,250],[840,230],[1080,250],[1220,300],
    [100,430],[300,400],[520,410],[760,390],[980,430],[1180,450],
    [180,620],[420,590],[650,610],[880,600],[1080,610],[1220,700]
  ];
  const adj={};pts.forEach((_,i)=>adj[i]=[]);
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
    const d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]);
    if(d<280 && !segmentBlocked(pts[i][0],pts[i][1],pts[j][0],pts[j][1])){adj[i].push(j);adj[j].push(i)}
  }
  game.graph={pts,adj};
}

function segmentBlocked(x1,y1,x2,y2){
  for(let t=0;t<=1;t+=.1){const x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;if(game.obstacles.some(o=>x>o.x-8&&x<o.x+o.w+8&&y>o.y-8&&y<o.y+o.h+8))return true}
  return false;
}

function nearestNode(p){
  let best=0,bd=Infinity;
  game.graph.pts.forEach((q,i)=>{const d=Math.hypot(p.x-q[0],p.y-q[1]);if(d<bd){bd=d;best=i}});
  return best;
}

// ------------------------- DAA: BFS -------------------------
function bfs(start,target){
  game.bfsSearches++;
  const q=[start],vis=new Set([start]),parent={};
  while(q.length){const u=q.shift();if(u===target)break;for(const v of game.graph.adj[u])if(!vis.has(v)){vis.add(v);parent[v]=u;q.push(v)}}
  const path=[];if(vis.has(target)){let u=target;while(u!==undefined){path.unshift(u);if(u===start)break;u=parent[u]}}
  return {path,visited:[...vis],distance:path.length?path.length-1:Infinity};
}

// ------------------------- DAA: DFS -------------------------
function dfs(start){
  game.dfsSearches++;
  const stack=[start],vis=new Set(),order=[];
  while(stack.length){const u=stack.pop();if(vis.has(u))continue;vis.add(u);order.push(u);for(const v of game.graph.adj[u])if(!vis.has(v))stack.push(v)}
  return order;
}

// ------------------------- DAA: Best-First Search -------------------------
function bestFirst(start,target){
  const open=[start],vis=new Set(),parent={},order=[];
  const h=n=>Math.hypot(game.graph.pts[n][0]-game.graph.pts[target][0],game.graph.pts[n][1]-game.graph.pts[target][1]);
  while(open.length){open.sort((a,b)=>h(a)-h(b));const u=open.shift();if(vis.has(u))continue;vis.add(u);order.push(u);if(u===target)break;for(const v of game.graph.adj[u])if(!vis.has(v)&&parent[v]===undefined){parent[v]=u;open.push(v)}}
  const path=[];if(vis.has(target)){let u=target;while(u!==undefined){path.unshift(u);if(u===start)break;u=parent[u]}}
  return {path,expanded:order.length};
}

// ------------------------- AIML: state + heuristic + rules -------------------------
function zombieState(z){
  return {zombie:{x:z.x,y:z.y,hp:z.hp},player:{x:game.player.x,y:game.player.y,hp:game.player.hp,energy:game.player.energy},resources:game.pickups.map(p=>({x:p.x,y:p.y,type:p.type})),wave:game.wave};
}
function heuristic(z,node){
  const p=game.graph.pts[node], d=Math.hypot(p[0]-game.player.x,p[1]-game.player.y);
  const danger=Math.max(0,game.player.hp-z.hp)*.5;
  const resource=game.pickups.reduce((s,x)=>s+Math.max(0,120-Math.hypot(p[0]-x.x,p[1]-x.y))/40,0);
  return Math.round(120-d*.08-danger+resource);
}
function rules(z){
  const d=dist(z,game.player);
  if(z.hp<20)return {text:"Zombie health low → retreat and search for a safer route",mode:"RETREAT"};
  if(d<70)return {text:"Player detected within attack range → ATTACK",mode:"ATTACK"};
  if(d<430)return {text:"Player detected → CHASE using shortest safe route",mode:"CHASE"};
  return {text:"Player not detected → SEARCH last known region",mode:"SEARCH"};
}
function chooseZombieAction(z){
  const r=rules(z); const zn=nearestNode(z),pn=nearestNode(game.player);
  const route=bfs(zn,pn); const best=bestFirst(zn,pn);
  let target=route.path[1] ?? zn;
  let scores=[];
  if(r.mode==="RETREAT"){
    const candidates=game.graph.adj[zn];
    target=candidates.sort((a,b)=>heuristic(z,b)-heuristic(z,a))[0]??zn;
  }else{
    const candidates=game.graph.adj[zn];
    scores=candidates.map(n=>({n,s:heuristic(z,n)})).sort((a,b)=>b.s-a.s);
    // Best-first influences movement; BFS supplies shortest pursuit distance.
    target=best.path[1] ?? route.path[1] ?? (scores[0]?.n??zn);
  }
  return {rule:r,route,best,target,scores,state:zombieState(z)};
}

function aiUpdate(z,dt){
  z.attackCd=Math.max(0,z.attackCd-dt);
  z.decision-=dt;
  if(z.decision<=0){
    const a=chooseZombieAction(z);z.route=a.route.path;z.targetNode=a.target;z.state=a.rule.mode;z.decision=.45;
    z.lastSeen={x:game.player.x,y:game.player.y};game.aiDecisions++;
    if(z===game.zombies[0])updateAIPanel(z,a);
  }
  const target=game.graph.pts[z.targetNode]||[game.player.x,game.player.y];
  let tx=target[0],ty=target[1];
  if(z.state==="ATTACK"){tx=game.player.x;ty=game.player.y}
  if(z.state==="SEARCH" && dist(z,game.player)>500){tx=z.lastSeen.x;ty=z.lastSeen.y}
  const dx=tx-z.x,dy=ty-z.y,d=Math.hypot(dx,dy)||1;
  const speed=z.speed*(z.state==="RETREAT"?1.1:1);
  if(d>20){const nx=z.x+dx/d*speed*dt,ny=z.y+dy/d*speed*dt;if(!collides(nx,z.r,ny)) {z.x=nx;z.y=ny}}
  const pd=dist(z,game.player);
  if(pd<38 && z.attackCd<=0){damagePlayer(7);z.attackCd=.9}
}

function updateAIPanel(z,a){
  $("aiState").textContent=z.state;
  $("aiDistance").textContent=`${Math.round(a.route.distance)} nodes`;
  $("aiBfs").textContent=a.route.path.length?`Node ${a.route.path.slice(0,4).join(" → ")}`:"No route";
  $("aiBest").textContent=`${a.best.expanded} expanded`;
  $("aiRule").textContent=a.rule.text;
  $("aiDecision").textContent=`MOVE TO NODE ${a.target}`;
  $("aiScores").innerHTML=(a.scores.length?a.scores.slice(0,4):[{n:a.target,s:heuristic(z,a.target)}]).map(x=>`<div class="score"><span>NODE ${x.n}</span><b>${x.s}</b></div>`).join("");
}

// ------------------------- PLAYER -------------------------
function updatePlayer(dt){
  let x=0,y=0;if(game.keys.has("w"))y--;if(game.keys.has("s"))y++;if(game.keys.has("a"))x--;if(game.keys.has("d"))x++;
  if(x||y){const l=Math.hypot(x,y);x/=l;y/=l;const speed=game.player.speed*(game.player.dash>0?2.5:1);const nx=game.player.x+x*speed*dt,ny=game.player.y+y*speed*dt;if(!collides(nx,game.player.r,ny)){game.player.x=nx;game.player.y=ny}}
  game.player.dash=Math.max(0,game.player.dash-dt);
  game.player.energy=Math.min(100,game.player.energy+3*dt);
}
function shoot(){
  if(!game.running||game.paused||game.levelTransition)return;
  if(game.player.ammo<=0){if(game.player.ammo<=0)toast("OUT OF AMMO — PRESS R");return}
  const rect=canvas.getBoundingClientRect(),mx=game.mouse.x,my=game.mouse.y;
  const wx=mx+game.camera.x,wy=my+game.camera.y,dx=wx-game.player.x,dy=wy-game.player.y,l=Math.hypot(dx,dy)||1;
  game.bullets.push({x:game.player.x,y:game.player.y,vx:dx/l*650,vy:dy/l*650,life:1.2});
  game.player.ammo--; updateHUD();
}
function reload(){if(game.paused)return;game.player.ammo=game.player.maxAmmo;toast("WEAPON RELOADED");updateHUD()}
function dash(){if(!game.running||game.paused||game.levelTransition)return;if(game.player.energy<25)return;game.player.energy-=25;game.player.dash=.25;toast("DASH")}
function damagePlayer(n){if(game.levelTransition)return;game.player.hp=clamp(game.player.hp-n,0,100);$("damageFlash").classList.remove("hit");void $("damageFlash").offsetWidth;$("damageFlash").classList.add("hit");if(game.player.hp<=0)finish(false,"The infected reached you.");updateHUD()}
function updateBullets(dt){
  for(let i=game.bullets.length-1;i>=0;i--){const b=game.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0){game.bullets.splice(i,1);continue}
    let hit=false;for(const z of game.zombies){if(Math.hypot(b.x-z.x,b.y-z.y)<z.r+4){z.hp-=34;hit=true;if(z.hp<=0){game.kills++;addEvent("Combat","Zombie defeated.");}break}}
    game.zombies=game.zombies.filter(z=>z.hp>0);if(hit)game.bullets.splice(i,1);
  }
}
function collect(){
  for(let i=game.pickups.length-1;i>=0;i--){const p=game.pickups[i];if(Math.hypot(p.x-game.player.x,p.y-game.player.y)<30){
    if(p.type==="med"){game.player.hp=clamp(game.player.hp+28,0,100);game.medkits++;toast("+ HEALTH");addEvent("Pickup","Medkit collected.");}
    if(p.type==="ammo"){game.player.ammo=game.player.maxAmmo;toast("AMMO REFILLED");addEvent("Pickup","Ammo cache collected.");}
    if(p.type==="energy"){game.player.energy=100;toast("ENERGY RESTORED");addEvent("Pickup","Energy restored.");}
    game.pickups.splice(i,1);
  }}
}

// ------------------------- COLLISION / EXTRACTION -------------------------
function collides(x,r,y){
  if(x<r||y<r||x>1400-r||y>820-r)return true;
  return game.obstacles.some(o=>x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r);
}
function updateExtraction(){
  const allDead=game.zombies.length===0;
  if(allDead && game.elapsed>=5 && !game.extraction.active){
    game.extraction.active=true;
    $("objSurvive").checked=true;
    toast("EXTRACTION UNLOCKED");
    addEvent("Mission","All infected eliminated. Enter the yellow extraction zone.");
  }
  if(game.extraction.active && allDead && dist(game.player,game.extraction)<game.extraction.r){
    completeLevel();
  }
}

function completeLevel(){
  if(game.levelTransition || !game.running)return;
  game.levelTransition=true;
  $("objReach").checked=true;

  const lastLevel=game.level===LEVELS.length;
  $("completeText").textContent=lastLevel
    ? "CONGRATULATIONS — YOU SURVIVED ALL 3 LEVELS!"
    : `CONGRATULATIONS — YOU SURVIVED LEVEL ${game.level}`;
  $("completeNext").textContent=lastLevel
    ? "ALL LEVELS CLEARED"
    : `LOADING LEVEL ${game.level+1} — ${LEVELS[game.level].name}`;

  $("levelCompleteOverlay").classList.add("show");
  addEvent("AI","Congratulations! You survived the level.");

  if(lastLevel){
    setTimeout(()=>finish(true,"You survived all three levels and reached extraction."),2600);
  }else{
    setTimeout(()=>startLevel(game.level+1),2300);
  }
}

function formatTime(t){
  return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(Math.floor(t%60)).padStart(2,"0")}`;
}

function finish(win,reason){
  game.running=false;
  $("levelCompleteOverlay").classList.remove("show");
  $("pauseOverlay").classList.remove("show");
  $("gameScreen").classList.remove("active");
  $("result").classList.add("active");
  $("resultIcon").textContent=win?"🎉":"💀";
  $("resultTitle").textContent=win?"YOU SURVIVED":"YOU WERE OVERRUN";
  $("resultReason").textContent=reason;
  $("statTime").textContent=formatTime(game.elapsed);
  $("statKills").textContent=game.kills;
  $("statAI").textContent=game.aiDecisions;
  $("statBFS").textContent=game.bfsSearches;
}

// ------------------------- RENDER -------------------------
function cameraUpdate(){game.camera.x=clamp(game.player.x-innerWidth/2,0,1400-innerWidth);game.camera.y=clamp(game.player.y-innerHeight/2,0,820-innerHeight)}
function worldToScreen(x,y){return [x-game.camera.x,y-game.camera.y]}
function draw(){
  cameraUpdate();ctx.clearRect(0,0,innerWidth,innerHeight);ctx.save();ctx.translate(-game.camera.x,-game.camera.y);
  // Ground
  ctx.fillStyle="#08120e";ctx.fillRect(0,0,1400,820);
  // tile/grid
  ctx.strokeStyle="#173020";ctx.lineWidth=1;for(let x=0;x<1400;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,820);ctx.stroke()}for(let y=0;y<820;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1400,y);ctx.stroke()}
  // roads
  ctx.fillStyle="#11191a";[[0,290,1400,115],[550,0,130,820],[960,0,115,820]].forEach(r=>ctx.fillRect(...r));
  // obstacles
  for(const o of game.obstacles){ctx.fillStyle="#111b1d";ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle="#294047";ctx.strokeRect(o.x,o.y,o.w,o.h);for(let x=o.x+15;x<o.x+o.w-10;x+=35){ctx.fillStyle="#18272a";ctx.fillRect(x,o.y+8,25,14)}}
  // props
  for(let i=0;i<18;i++){const x=(i*173)%1320+30,y=(i*97)%760+30;ctx.fillStyle="#182d22";ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle="#24442e";ctx.beginPath();ctx.arc(x-4,y-5,9,0,Math.PI*2);ctx.fill()}
  // extraction
  if(game.extraction.active){const e=game.extraction;ctx.strokeStyle="#ffd329";ctx.lineWidth=3;ctx.shadowBlur=22;ctx.shadowColor="#ffd329";ctx.beginPath();ctx.arc(e.x,e.y,e.r+Math.sin(game.elapsed*5)*4,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle="#ffe15c";ctx.font="bold 12px Arial";ctx.textAlign="center";ctx.fillText("EXTRACTION",e.x,e.y-55)}
  // pickups
  for(const p of game.pickups){ctx.shadowBlur=16;ctx.shadowColor=p.type==="med"?"#55ef8b":p.type==="ammo"?"#44baff":"#ffd329";ctx.fillStyle=p.type==="med"?"#1dbd63":p.type==="ammo"?"#1679bf":"#d5a900";ctx.fillRect(p.x-12,p.y-12,24,24);ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="bold 16px Arial";ctx.textAlign="center";ctx.fillText(p.type==="med"?"✚":p.type==="ammo"?"▣":"⚡",p.x,p.y+6)}
  // bullets
  ctx.fillStyle="#ffe89b";for(const b of game.bullets){ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill()}
  // zombies
  for(const z of game.zombies)drawZombie(z);
  drawPlayer();
  ctx.restore();drawMiniMap();
}
function drawZombie(z){
  ctx.save();ctx.translate(z.x,z.y);ctx.shadowBlur=18;ctx.shadowColor="#ff243f";ctx.fillStyle="#ff273f";ctx.beginPath();ctx.arc(0,0,z.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#151b1c";ctx.beginPath();ctx.arc(-5,-3,2.5,0,Math.PI*2);ctx.arc(5,-3,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#5d141e";ctx.fillRect(-z.r,-z.r-10,z.r*2,4);ctx.fillStyle="#ff4154";ctx.fillRect(-z.r,-z.r-10,z.r*2*(z.hp/z.maxHp),4);ctx.restore();
}
function drawPlayer(){
  const p=game.player;ctx.save();ctx.translate(p.x,p.y);ctx.shadowBlur=25;ctx.shadowColor="#32dfff";ctx.fillStyle="#25bfe0";ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#06131a";ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawMiniMap(){
  const sx=180/1400,sy=125/820;mctx.clearRect(0,0,180,125);mctx.fillStyle="#061019";mctx.fillRect(0,0,180,125);
  mctx.fillStyle="#14252c";for(const o of game.obstacles)mctx.fillRect(o.x*sx,o.y*sy,o.w*sx,o.h*sy);
  mctx.fillStyle="#28dfff";mctx.beginPath();mctx.arc(game.player.x*sx,game.player.y*sy,4,0,7);mctx.fill();
  mctx.fillStyle="#ff334d";for(const z of game.zombies){mctx.beginPath();mctx.arc(z.x*sx,z.y*sy,3,0,7);mctx.fill()}
  if(game.extraction.active){mctx.fillStyle="#ffd329";mctx.beginPath();mctx.arc(game.extraction.x*sx,game.extraction.y*sy,4,0,7);mctx.fill()}
}
function updateHUD(){
  $("hpText").textContent=`${Math.ceil(game.player.hp)} / 100`;$("hpBar").style.width=game.player.hp+"%";
  $("ammoText").textContent=`${game.player.ammo} / ${game.player.maxAmmo}`;$("ammoBar").style.width=(game.player.ammo/game.player.maxAmmo*100)+"%";
  $("energyText").textContent=Math.ceil(game.player.energy)+"%";$("energyBar").style.width=game.player.energy+"%";
  $("medCount").textContent=Math.min(game.medkits,2);$("objMed").checked=game.medkits>=2;
  $("objSurvive").checked=game.extraction.active;
  $("objReach").checked=game.extraction.active&&dist(game.player,game.extraction)<game.extraction.r;
  $("wave").textContent=String(game.wave).padStart(2,"0");
  $("level").textContent=game.level;
  $("difficulty").textContent=game.difficulty;
  const remain=Math.max(0,game.duration-game.elapsed);$("timer").textContent=`${String(Math.floor(remain/60)).padStart(2,"0")}:${String(Math.floor(remain%60)).padStart(2,"0")}`;
}
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>$("toast").classList.remove("show"),1200)}
function addEvent(who,msg){const e=document.createElement("div");e.className="event";e.innerHTML=`<strong>${who}:</strong> ${msg}`;$("eventFeed").prepend(e);while($("eventFeed").children.length>7)$("eventFeed").lastChild.remove()}

// ------------------------- LOOP -------------------------
function loop(now){
  if(!game.running)return;
  const dt=Math.min(.033,(now-game.last)/1000);
  game.last=now;

  if(game.paused){
    draw();
    updateHUD();
    requestAnimationFrame(loop);
    return;
  }

  if(!game.levelTransition)game.elapsed+=dt;

  // Waves change the pressure without adding new zombies after the player
  // has cleared the level, so "kill all → extraction" remains predictable.
  if(game.elapsed>90&&game.wave===1){
    game.wave=2;
    game.zombies.forEach(z=>z.speed+=10);
    addEvent("Wave","Wave 02 — infected movement increased.");
  }
  if(game.elapsed>150&&game.wave===2){
    game.wave=3;
    game.zombies.forEach(z=>z.speed+=10);
    addEvent("Wave","Wave 03 — extraction is close.");
  }

  updatePlayer(dt);
  collect();
  updateExtraction();
  updateBullets(dt);
  game.zombies.forEach(z=>aiUpdate(z,dt));
  draw();
  updateHUD();
  requestAnimationFrame(loop);
}

function togglePause(){
  if(!game.running || game.levelTransition)return;
  game.paused=!game.paused;
  $("pauseOverlay").classList.toggle("show",game.paused);
  if(game.paused)game.keys.clear();
  game.last=performance.now();
}
$("resumeBtn").onclick=()=>togglePause();

// ------------------------- INPUT -------------------------
const movementKey={w:"w",a:"a",s:"s",d:"d",arrowup:"w",arrowleft:"a",arrowdown:"s",arrowright:"d"};
addEventListener("keydown",e=>{
  const raw=e.key.toLowerCase();
  const k=movementKey[raw];
  if(k){e.preventDefault();game.keys.add(k)}
  if(raw==="r")reload();
  if(e.code==="Space"){
    e.preventDefault();
    togglePause();
  }
});
addEventListener("keyup",e=>{
  const k=movementKey[e.key.toLowerCase()];
  if(k)game.keys.delete(k);
});

document.querySelectorAll(".move-btn").forEach(btn=>{
  const key={up:"w",left:"a",down:"s",right:"d"}[btn.dataset.move];
  const press=e=>{e.preventDefault();game.keys.add(key)};
  const release=e=>{e.preventDefault();game.keys.delete(key)};
  btn.addEventListener("pointerdown",press,{passive:false});
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>btn.addEventListener(ev,release,{passive:false}));
});
$("dashBtn").addEventListener("pointerdown",e=>{e.preventDefault();dash()});
canvas.addEventListener("mousemove",e=>{game.mouse.x=e.clientX;game.mouse.y=e.clientY});
canvas.addEventListener("mousedown",e=>{if(e.button===0)shoot()});
$("shootBtn").onclick=shoot;$("reloadBtn").onclick=reload;

// Initial render background
function idleRender(){if(!game.running){ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle="#050a0e";ctx.fillRect(0,0,innerWidth,innerHeight)}}
idleRender();
