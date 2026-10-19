export type GameSpec = {
  schemaVersion: 1;
  title: string;
  description: string;
  genre: "runner" | "dodge";
  theme: string;
  difficulty: "easy" | "normal" | "hard";
  objective: string;
  controls: string[];
  seed: number;
};

export function validateGameSpec(value: unknown): value is GameSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof v.title === "string" &&
    v.title.length <= 80 &&
    typeof v.description === "string" &&
    v.description.length <= 300 &&
    ["runner", "dodge"].includes(String(v.genre)) &&
    typeof v.theme === "string" &&
    v.theme.length <= 80 &&
    ["easy", "normal", "hard"].includes(String(v.difficulty)) &&
    typeof v.objective === "string" &&
    Array.isArray(v.controls) &&
    v.controls.length <= 8 &&
    typeof v.seed === "number"
  );
}

/** Fixed, reviewed game runtime. Specs are data only; no generated code runs. */
export function createGameHtml(spec: GameSpec): string {
  const data = JSON.stringify(spec).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>${escapeHtml(spec.title)}</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07111f;color:#eaf8ff;font:14px system-ui}canvas{display:block;width:100%;height:100%;touch-action:none}#hud{position:absolute;inset:12px 14px auto;display:flex;justify-content:space-between;pointer-events:none;text-shadow:0 2px 8px #000}#message{position:absolute;inset:0;display:grid;place-items:center;text-align:center;background:#07111fcc}#message[hidden]{display:none}button{border:1px solid #29dfff;background:#092638;color:white;border-radius:12px;padding:12px 18px;font-weight:700;font-size:16px}small{opacity:.75}</style></head><body><canvas id="game"></canvas><div id="hud"><b id="name"></b><b>Score <span id="score">0</span></b></div><div id="message"><div><h2 id="headline">Tap or press Space to play</h2><p id="help">Avoid obstacles and collect the glowing orbs.</p><button id="start">Play</button><p><small>Touch, Space, ↑ or tap to jump</small></p></div></div><script>const G=${data};const c=document.querySelector('#game'),x=c.getContext('2d'),m=document.querySelector('#message'),scoreEl=document.querySelector('#score');document.querySelector('#name').textContent=G.title;document.querySelector('#help').textContent=G.objective;let w,h,dpr,player,items,score,alive,running,last,spawn,speed;function resize(){dpr=Math.min(devicePixelRatio||1,2);w=c.clientWidth;h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0)}new ResizeObserver(resize).observe(c);resize();function reset(){player={y:h*.72,vy:0};items=[];score=0;alive=true;running=true;last=performance.now();spawn=0;speed=G.difficulty==='hard'?5:G.difficulty==='easy'?3:4;scoreEl.textContent='0';m.hidden=true;requestAnimationFrame(tick)}function jump(){if(!running){reset();return}if(alive&&player.y>=h*.70)player.vy=-Math.max(10,h*.022)}function end(){alive=false;running=false;m.hidden=false;document.querySelector('#headline').textContent='Game over · Score '+score;document.querySelector('#start').textContent='Play again'}document.querySelector('#start').onclick=reset;window.addEventListener('keydown',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();jump()}});c.addEventListener('pointerdown',jump);function tick(now){if(!running)return;let dt=Math.min((now-last)/16,2);last=now;score+=dt;scoreEl.textContent=Math.floor(score);speed+=.001*dt;x.fillStyle='#07111f';x.fillRect(0,0,w,h);let grad=x.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#092342');grad.addColorStop(1,'#160f36');x.fillStyle=grad;x.fillRect(0,0,w,h);x.fillStyle='#17324b';x.fillRect(0,h*.78,w,h*.22);x.fillStyle='#27dbff';x.fillRect(0,h*.78,w,3);spawn-=dt;if(spawn<=0){items.push({x:w+30,y:h*.78-30-(Math.random()>.65?35:0),coin:Math.random()>.65});spawn=Math.max(32,85-score/18)}player.vy+=.58*dt;player.y=Math.min(h*.70,player.y+player.vy*dt);if(player.y>=h*.70)player.vy=0;x.fillStyle='#54ecff';x.shadowColor='#54ecff';x.shadowBlur=18;x.fillRect(w*.18,player.y,30,35);x.shadowBlur=0;for(const o of items){o.x-=speed*dt;if(o.coin){x.fillStyle='#ffd56a';x.beginPath();x.arc(o.x,o.y,10,0,7);x.fill();if(Math.abs(o.x-w*.18-15)<24&&Math.abs(o.y-player.y)<35){o.x=-99;score+=40}}else{x.fillStyle='#ff5478';x.fillRect(o.x,o.y,24,30);if(o.x<w*.18+30&&o.x+24>w*.18&&player.y+35>o.y)end()}}items=items.filter(o=>o.x>-50);requestAnimationFrame(tick)}window.parent.postMessage({type:'lord-game-ready'},'*');</script></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
