'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xnuneowwpzbadftaqozy.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudW5lb3d3cHpiYWRmdGFxb3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzE3MjgsImV4cCI6MjA4OTQ0NzcyOH0.NP5ZZisvFNH3CRyc57yMatabEZnJvw6mK_FlNngP7y0';
const ENTRY_FEE = 100;
const SK = 'fca_v4';

// ── PALETAS DOS HERÓIS ────────────────────────────────────────────────────────
const PALETTES = [
  { suit:'#CC0000', bolt:'#FFE600', dark:'#880000', skin:'#FFCC88', boot:'#FFE600', name:'FLASH'   },
  { suit:'#FFE600', bolt:'#CC0000', dark:'#AA9900', skin:'#FFCC88', boot:'#CC0000', name:'REVERSE' },
  { suit:'#222233', bolt:'#88AACC', dark:'#111122', skin:'#FFCC88', boot:'#445566', name:'ZOOM'    },
  { suit:'#0044BB', bolt:'#FFE600', dark:'#002288', skin:'#FFCC88', boot:'#FFE600', name:'KID'     },
];

// ── SPRITES 12×18 pixels: letras = partes do corpo ───────────────────────────
// H=capacete  V=visor  S=traje  B=raio  K=bota  L=calça  N=pele  .=vazio
const R1 = [ // correndo frame 1
  '....HHHHHH....',
  '...HHVVVHHH...',
  '...HHHHHHHH...',
  '...HHBBHHHH...',
  '..SSSSSSSSSS..',
  '.SSSBBSSSSSSS.',
  '.SSSSSSSSSSS..',
  '..SSBBSSSSS...',
  '..SSSSSSSS....',
  '...LLSSLL.....',
  '...LLLLLLL....',
  '....LLLLL.....',
  '...LLKKLL.....',
  '..KKKK.KKK....',
  '..KKKK..KK....',
];
const R2 = [ // correndo frame 2
  '....HHHHHH....',
  '...HHVVVHHH...',
  '...HHHHHHHH...',
  '...HHBBHHHH...',
  '..SSSSSSSSSS..',
  '.SSSBBSSSSSSS.',
  '.SSSSSSSSSSS..',
  '..SSBBSSSSS...',
  '....SSSSSS....',
  '....LLLLLL....',
  '...LLLLLLL....',
  '..LLLLLLLL....',
  '..LLKKLL......',
  '..KKKK.KKK....',
  '..KKKK..KK....',
];
const WIN = [ // vencedor - braços levantados
  '....HHHHHH....',
  '...HHVVVHHH...',
  '...HHHHHHHH...',
  '...HHBBHHHH...',
  'SSSSSSSSSSSSSS',
  'SSSSBBSSSSSSSS',
  '.SSSSSSSSSSS..',
  '..SSBBSSSSS...',
  '..SSSSSSSS....',
  '...LLSSLL.....',
  '...LLLLLLL....',
  '....LLLLL.....',
  '...LLKKLL.....',
  '..KKKK.KKK....',
  '..KKKK..KK....',
];
const DEAD = [ // caído
  '...............',
  '...............',
  '...............',
  '....HHHHHH....',
  '...HHVVVHHH...',
  '...HHHHHHHH...',
  '...HHBBHHHH...',
  '..SSSSSSSSSS..',
  'SSSBBSSSSSSSSS',
  'LLLLLLLLLLLLLL',
  '.KKKK..KKKK...',
  '...............',
  '...............',
  '...............',
  '...............',
];
const SPR_W = 14, SPR_H = 15;

function drawHero(
  ctx: CanvasRenderingContext2D,
  grid: string[], x: number, y: number,
  scale: number, pal: typeof PALETTES[0]
) {
  for (let ry = 0; ry < grid.length; ry++) {
    const row = grid[ry];
    for (let rx = 0; rx < row.length; rx++) {
      const sym = row[rx];
      let c: string | null = null;
      if      (sym === 'H') c = pal.suit;
      else if (sym === 'V') c = '#88DDFF';
      else if (sym === 'S') c = pal.suit;
      else if (sym === 'B') c = pal.bolt;
      else if (sym === 'L') c = pal.dark;
      else if (sym === 'K') c = pal.boot;
      else if (sym === 'N') c = pal.skin;
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      // highlight topo
      if (sym === 'S' || sym === 'H') {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + rx * scale, y + ry * scale, scale, 1);
      }
    }
  }
}

function darken(hex: string, a: number) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0,((n>>16)&255)-a), g = Math.max(0,((n>>8)&255)-a), b = Math.max(0,(n&255)-a);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ── LIGHTNING TRAIL ───────────────────────────────────────────────────────────
function drawTrail(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, prog: number) {
  if (prog < 2) return;
  const speed = 1 + prog * 0.015;
  // linhas de rastro
  for (let i = 0; i < 4; i++) {
    const ty = y + 20 + i * 10 + (Math.random() - 0.5) * 3;
    const len = (15 + prog * 0.25 + Math.random() * 10) * speed;
    ctx.globalAlpha = 0.5 - i * 0.1;
    ctx.strokeStyle = i === 0 ? '#FFFFFF' : color;
    ctx.lineWidth = i === 0 ? 2 : 1.5 - i * 0.3;
    ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x - len, ty); ctx.stroke();
  }
  // raio em zigue-zague
  if (Math.random() > 0.45) {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let bx = x - 2, by = y + SPR_H * 2 + 8;
    ctx.moveTo(bx, by);
    for (let i = 0; i < 5; i++) {
      bx -= 6 + Math.random() * 5;
      by += (Math.random() - 0.5) * 16;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── FUNDO DA PISTA ────────────────────────────────────────────────────────────
function drawTrack(ctx: CanvasRenderingContext2D, W: number, H: number, scroll: number) {
  // Céu
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.44);
  sky.addColorStop(0, '#010115'); sky.addColorStop(1, '#0D0D2A');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.44);

  // Aurora sutil
  ctx.globalAlpha = 0.12;
  const aur = ctx.createLinearGradient(0, 0, W, 0);
  aur.addColorStop(0,'#00FF94'); aur.addColorStop(0.5,'#FFE600'); aur.addColorStop(1,'#FF2D55');
  ctx.fillStyle = aur; ctx.fillRect(0, H * 0.04, W, H * 0.12);
  ctx.globalAlpha = 1;

  // Prédios pixel art
  const BLDS = [{w:38,h:55,x:.04},{w:22,h:75,x:.11},{w:48,h:48,x:.19},{w:28,h:85,x:.27},
                {w:42,h:60,x:.36},{w:18,h:72,x:.44},{w:52,h:52,x:.52},{w:32,h:80,x:.61},
                {w:38,h:66,x:.70},{w:28,h:58,x:.79},{w:48,h:76,x:.88},{w:22,h:62,x:.97}];
  BLDS.forEach(b => {
    const bx = ((b.x * W - scroll * 0.18) % (W + 80)) - 40;
    ctx.fillStyle = '#0C0C22'; ctx.fillRect(bx, H*0.44 - b.h, b.w, b.h);
    // janelas
    for (let wy = 6; wy < b.h - 6; wy += 11)
      for (let wx = 4; wx < b.w - 4; wx += 9) {
        ctx.fillStyle = Math.random() > 0.65 ? '#FFE60030' : '#FFFFFF0A';
        ctx.fillRect(bx + wx, H*0.44 - b.h + wy, 4, 5);
      }
  });

  // Estrelas
  [[.05,.04,2],[.16,.11,1],[.3,.07,2],[.43,.17,1],[.57,.08,2],[.69,.14,1],[.8,.05,2],[.91,.19,1]].forEach(([sx,sy,sz]) => {
    ctx.globalAlpha = 0.35 + Math.random() * 0.55;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx*W, sy*H, sz, sz);
  });
  ctx.globalAlpha = 1;

  // Asfalto
  const road = ctx.createLinearGradient(0, H*.44, 0, H);
  road.addColorStop(0,'#191928'); road.addColorStop(1,'#0C0C18');
  ctx.fillStyle = road; ctx.fillRect(0, H*.44, W, H*.56);

  // Borda neon superior
  ctx.fillStyle = '#FFE600'; ctx.fillRect(0, H*.44, W, 3);

  // Linhas de velocidade em perspectiva
  ctx.strokeStyle = '#FFFFFF06'; ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const lx = ((i*(W/6)) - scroll * 0.4) % (W + 120) - 60;
    ctx.beginPath(); ctx.moveTo(lx, H*.44); ctx.lineTo(lx - 50, H); ctx.stroke();
  }

  // Tracejado central
  ctx.fillStyle = '#FFFFFF44';
  for (let i = -1; i < Math.ceil(W/80)+2; i++) {
    const lx = i*80 - scroll%80;
    ctx.fillRect(lx, H*.69, 46, 3);
  }

  // Borda inferior
  ctx.fillStyle = '#FFE600'; ctx.fillRect(0, H*.94, W, 2);
  ctx.fillStyle = '#1C1C30'; ctx.fillRect(0, H*.94, W, H*.06);
}

// ── SUPABASE ──────────────────────────────────────────────────────────────────
async function sbFetch(path:string, opts:RequestInit={}, token?:string) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers:{'Content-Type':'application/json',apikey:SB_KEY,Authorization:`Bearer ${token||SB_KEY}`,...(opts.headers as any||{})},
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error_description||data.msg||data.message||`HTTP ${res.status}`);
  return data;
}
const anonLogin  = ()       => sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({is_anonymous:true})});
const emailLogin = (e:string,p:string) => sbFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:e,password:p})});
const emailSign  = (e:string,p:string) => sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:e,password:p})});
const getProfile = async(uid:string,tok:string) => {
  const d=await sbFetch(`/rest/v1/users?id=eq.${uid}&select=id,display_name,coins,wins,losses`,{},tok);
  return Array.isArray(d)&&d.length>0?d[0]:null;
};
const createProfile = async(uid:string,name:string,tok:string) => {
  await sbFetch('/rest/v1/users',{method:'POST',headers:{Prefer:'return=minimal'}as any,body:JSON.stringify({id:uid,display_name:name,coins:1000,avatar_index:0})},tok);
  await sbFetch('/rest/v1/transactions',{method:'POST',headers:{Prefer:'return=minimal'}as any,body:JSON.stringify({user_id:uid,amount:1000,type:'initial'})},tok);
};
const getRanking = async():Promise<any[]> => {
  try{const d=await sbFetch('/rest/v1/ranking?select=display_name,wins,losses,coins,win_rate,position&order=position.asc&limit=10');return Array.isArray(d)?d:[];}
  catch{return[];}
};

// ── TYPES ──────────────────────────────────────────────────────────────────────
type Phase='login'|'lobby'|'ranking'|'queuing'|'countdown'|'racing'|'finished';
interface User   {id:string;name:string;coins:number;token:string;wins:number;losses:number;}
interface PState {id:string;name:string;progress:number;clicks:number;colorIdx:number;}
interface Result {isWinner:boolean;coinsChange:number;winnerName:string;players:PState[];}

// ── CANVAS DA CORRIDA ─────────────────────────────────────────────────────────
function RaceCanvas({players,myId,phase}:{players:PState[];myId:string;phase:string}) {
  const ref    = useRef<HTMLCanvasElement>(null);
  const pRef   = useRef(players);
  const phRef  = useRef(phase);
  const meRef  = useRef(myId);
  const scroll = useRef(0);
  const frame  = useRef(0);
  const tick   = useRef(0);
  const raf    = useRef(0);

  useEffect(()=>{pRef.current=players;},[players]);
  useEffect(()=>{phRef.current=phase;},[phase]);
  useEffect(()=>{meRef.current=myId;},[myId]);

  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled=false;
    const W=canvas.width, H=canvas.height;
    const SCALE=3;
    const TRACK_TOP=H*0.43;

    const loop=()=>{
      try {
        const ps=pRef.current, ph=phRef.current, me=meRef.current;
        tick.current++; if(tick.current%8===0) frame.current^=1;
        const avg=ps.reduce((s,p)=>s+p.progress,0)/Math.max(ps.length,1);
        if(ph==='racing') scroll.current+=1.5+avg*0.04;
        ctx.clearRect(0,0,W,H);
        drawTrack(ctx,W,H,scroll.current);

        // Linha de chegada
        ctx.fillStyle='#FFFFFF55'; ctx.fillRect(W*.88,TRACK_TOP,2,H*.51);
        ctx.font='11px sans-serif'; ctx.textAlign='center';
        ctx.fillText('🏁',W*.89,TRACK_TOP+H*.25);

        const LANE_H=(H*.51)/Math.max(ps.length,1);
        // Calcula vencedor UMA vez fora do loop de players
        const sortedForWinner=ph==='finished'?[...ps].sort((a,b)=>b.progress-a.progress):[];
        const winnerId=sortedForWinner[0]?.id||null;

        ps.forEach((p,i)=>{
          const pal=PALETTES[p.colorIdx%4];
          const laneY=TRACK_TOP+i*LANE_H+LANE_H*0.08;
          const isMe=p.id===me;
          const sprX=W*0.03+(p.progress/100)*(W*0.83);
          const sprY=laneY+(LANE_H*.5)-(SPR_H*SCALE*.5);

          // Rastro + raios
          if(ph==='racing') {
            drawTrail(ctx,sprX,sprY,pal.bolt,p.progress);
            // glow aura
            try {
              const grd=ctx.createRadialGradient(
                sprX+SPR_W*SCALE/2,sprY+SPR_H*SCALE/2,1,
                sprX+SPR_W*SCALE/2,sprY+SPR_H*SCALE/2,SPR_W*SCALE
              );
              grd.addColorStop(0,pal.bolt+'55'); grd.addColorStop(1,'rgba(0,0,0,0)');
              ctx.fillStyle=grd;
              ctx.fillRect(sprX-8,sprY-4,SPR_W*SCALE+16,SPR_H*SCALE+8);
            } catch {}
          }

          // Sombra elipse (sem crash)
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            sprX+SPR_W*SCALE/2, sprY+SPR_H*SCALE+3,
            SPR_W*SCALE/2, 4, 0, 0, Math.PI*2
          );
          ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();
          ctx.restore();

          // Sprite
          const grid=ph==='finished'
            ?(p.id===winnerId?WIN:DEAD)
            :(frame.current===0?R1:R2);
          drawHero(ctx,grid,sprX,sprY,SCALE,pal);

          // Nome
          ctx.font=`bold ${isMe?10:9}px monospace`;
          ctx.fillStyle=isMe?pal.bolt:'#FFFFFF99';
          ctx.textAlign='center';
          ctx.fillText(p.name.slice(0,9),sprX+SPR_W*SCALE/2,sprY-5);

          // Barra de progresso mini
          const bw=52,bh=4,bx=sprX+SPR_W*SCALE/2-bw/2,by=sprY+SPR_H*SCALE+10;
          ctx.fillStyle='#FFFFFF15'; ctx.fillRect(bx,by,bw,bh);
          ctx.fillStyle=pal.bolt; ctx.fillRect(bx,by,bw*(p.progress/100),bh);
          if(isMe){ctx.fillStyle=pal.bolt+'66';ctx.fillRect(bx-1,by-1,bw*(p.progress/100)+2,bh+2);}
        });
      } catch(e) { /* silencia erros de canvas */ }
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);

  return <canvas ref={ref} width={400} height={210}
    style={{width:'100%',maxWidth:400,imageRendering:'pixelated',display:'block',border:'2px solid #FFE60022',boxShadow:'0 0 20px #FFE60008'}}
  />;
}

// ── PREVIEW DO LOBBY ──────────────────────────────────────────────────────────
function LobbyPreview() {
  const ref=useRef<HTMLCanvasElement>(null);
  const raf=useRef(0);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width,H=canvas.height;
    let s=0,tick=0,fr=0;
    const pos=[0.06,0.22,0.44,0.66];
    const loop=()=>{
      tick++;if(tick%8===0)fr^=1;s+=1.4;
      pos.forEach((_,i)=>{pos[i]+=0.0025+i*0.0008;if(pos[i]>1.08)pos[i]=-0.08;});
      ctx.clearRect(0,0,W,H);
      drawTrack(ctx,W,H,s);
      const SCALE=3,LANE_H=(H*.51)/4,TRACK_TOP=H*.43;
      pos.forEach((px,i)=>{
        const pal=PALETTES[i];
        const sprX=px*W,sprY=TRACK_TOP+i*LANE_H+LANE_H*.15;
        drawTrail(ctx,sprX,sprY,pal.bolt,55);
        try{
          const g=ctx.createRadialGradient(sprX+SPR_W*SCALE/2,sprY+SPR_H*SCALE/2,1,sprX+SPR_W*SCALE/2,sprY+SPR_H*SCALE/2,SPR_W*SCALE);
          g.addColorStop(0,pal.bolt+'44');g.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=g;ctx.fillRect(sprX-6,sprY-3,SPR_W*SCALE+12,SPR_H*SCALE+6);
        }catch{}
        drawHero(ctx,fr===0?R1:R2,sprX,sprY,SCALE,pal);
      });
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);
  return <canvas ref={ref} width={400} height={155}
    style={{width:'100%',maxWidth:400,imageRendering:'pixelated',display:'block'}}
  />;
}

// ── MINI HERÓI (thumbnail estático animado) ────────────────────────────────────
function HeroThumb({palIdx=0,scale=3}:{palIdx?:number;scale?:number}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const raf=useRef(0);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const pal=PALETTES[palIdx%4];
    let tick=0,fr=0;
    const loop=()=>{
      tick++;if(tick%10===0)fr^=1;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      drawHero(ctx,fr===0?R1:R2,0,0,scale,pal);
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[palIdx,scale]);
  return <canvas ref={ref} width={SPR_W*scale} height={SPR_H*scale} style={{imageRendering:'pixelated',display:'block'}}/>;
}

// ── SHOWCASE 4 HERÓIS ─────────────────────────────────────────────────────────
function HeroShowcase() {
  const ref=useRef<HTMLCanvasElement>(null);
  const raf=useRef(0);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width,H=canvas.height;
    let tick=0,fr=0;
    const loop=()=>{
      tick++;if(tick%10===0)fr^=1;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#050510';ctx.fillRect(0,0,W,H);
      const SCALE=5,spacing=W/4;
      PALETTES.forEach((pal,i)=>{
        const cx=spacing*i+spacing/2;
        try{
          const g=ctx.createRadialGradient(cx,H/2,2,cx,H/2,32);
          g.addColorStop(0,pal.bolt+'55');g.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=g;ctx.fillRect(cx-36,0,72,H);
        }catch{}
        const sprX=cx-SPR_W*SCALE/2;
        drawHero(ctx,fr===0?R1:R2,sprX,4,SCALE,pal);
        ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillStyle=pal.bolt;
        ctx.fillText(pal.name,cx,H-3);
      });
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);
  return <canvas ref={ref} width={320} height={SPR_H*5+20}
    style={{imageRendering:'pixelated',display:'block',margin:'0 auto'}}/>;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [phase,   setPhase]   = useState<Phase>('login');
  const [user,    setUser]    = useState<User|null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [showEM,  setShowEM]  = useState(false);
  const [cd,      setCD]      = useState(0);
  const [roomId,  setRoomId]  = useState('');
  const [players, setPlayers] = useState<PState[]>([]);
  const [myProg,  setMyProg]  = useState(0);
  const [result,  setResult]  = useState<Result|null>(null);
  const [qpos,    setQPos]    = useState(0);
  const [pressed, setPressed] = useState(false);
  const [clicks,  setClicks]  = useState(0);
  const [ranking, setRanking] = useState<any[]>([]);
  const sock = useRef<any>(null);

  useEffect(()=>{try{const s=localStorage.getItem(SK);if(s){setUser(JSON.parse(s));setPhase('lobby');}}catch{}},[]);

  const save=(u:User)=>{localStorage.setItem(SK,JSON.stringify(u));setUser(u);setPhase('lobby');};

  const handleAuth=async(auth:any,name:string)=>{
    const {access_token:token,user:u}=auth;
    if(!token||!u?.id) throw new Error('Falha na autenticação');
    let profile=await getProfile(u.id,token);
    if(!profile){await createProfile(u.id,name,token);profile={id:u.id,display_name:name,coins:1000,wins:0,losses:0};}
    save({id:u.id,name:profile.display_name,coins:profile.coins,token,wins:profile.wins||0,losses:profile.losses||0});
  };

  const loginAnon=async()=>{
    setLoading(true);setError('');
    try{const d=await anonLogin();await handleAuth(d,`Flash_${d.user?.id?.slice(0,5)||'anon'}`);}
    catch(e:any){setError(e.message||'Erro');}
    setLoading(false);
  };
  const loginEmail=async()=>{
    if(!email||pass.length<6){setError('Email e senha (mín 6 chars) obrigatórios');return;}
    setLoading(true);setError('');
    try{let d:any;try{d=await emailLogin(email,pass);}catch{d=await emailSign(email,pass);}await handleAuth(d,email.split('@')[0]);}
    catch(e:any){setError(e.message||'Erro ao autenticar');}
    setLoading(false);
  };
  const logout=()=>{localStorage.removeItem(SK);setUser(null);setPhase('login');sock.current?.disconnect();};

  const openRanking=async()=>{setPhase('ranking');setRanking(await getRanking());};

  const joinQueue=useCallback(async()=>{
    if(!user)return;
    setPhase('queuing');
    const {io}=await import('socket.io-client');
    const s=io(window.location.origin,{path:'/api/socketio',transports:['websocket','polling']});
    sock.current=s;
    s.on('connect',()=>s.emit('queue:join',{userId:user.id,displayName:user.name,avatarIndex:0}));
    s.on('queue:position',({position}:any)=>setQPos(position));
    s.on('room:joined',({room}:any)=>{
      setRoomId(room.id);
      setPlayers(room.players.map((p:any,i:number)=>({id:p.id,name:p.displayName,progress:0,clicks:0,colorIdx:i})));
      setPhase('countdown');
    });
    s.on('game:countdown',({count}:any)=>setCD(count));
    s.on('game:start',()=>{setPhase('racing');setCD(0);setClicks(0);setMyProg(0);});
    s.on('game:progress',({playerId,progress,clicks}:any)=>{
      setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,progress,clicks}:p));
      if(playerId===user.id)setMyProg(progress);
    });
    s.on('game:finished',({result:r}:any)=>{
      // Captura result antes de qualquer setState
      const safeResult:Result={
        isWinner:!!r.isWinner,
        coinsChange:Number(r.coinsChange)||0,
        winnerName:r.winnerName||'',
        players:Array.isArray(r.players)?r.players:[],
      };
      const updated={...user,coins:user.coins+safeResult.coinsChange};
      localStorage.setItem(SK,JSON.stringify(updated));
      setUser(updated);
      setResult(safeResult);
      setPhase('finished');
      // Revalida coins depois
      setTimeout(async()=>{try{const p=await getProfile(user.id,user.token);if(p){const u2={...updated,coins:p.coins,wins:p.wins||0,losses:p.losses||0};setUser(u2);localStorage.setItem(SK,JSON.stringify(u2));}}catch{}},2500);
    });
  },[user]);

  const click=useCallback(()=>{
    if(!sock.current||phase!=='racing'||!user||!roomId)return;
    setPressed(true);setTimeout(()=>setPressed(false),55);
    setClicks(c=>c+1);
    sock.current.emit('game:click',{roomId,userId:user.id});
  },[phase,user,roomId]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();click();}};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[click]);

  const again=()=>{sock.current?.disconnect();sock.current=null;setPhase('lobby');setPlayers([]);setMyProg(0);setResult(null);setRoomId('');setQPos(0);setClicks(0);};

  const myColorIdx=players.find(p=>p.id===user?.id)?.colorIdx??0;
  const myPal=PALETTES[myColorIdx%4];

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if(phase==='login')return(
    <div style={P}>
      <div style={B}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <div style={{fontSize:44,fontWeight:900,color:'#FFE600',textShadow:'0 0 30px #FFE600,0 0 60px #FFE60044',letterSpacing:4,lineHeight:1}}>⚡ FLASH</div>
          <div style={{fontSize:24,fontWeight:900,color:'#fff',letterSpacing:6,marginTop:2}}>CLICK ARENA</div>
          <div style={{fontSize:9,color:'#555',marginTop:6,letterSpacing:3}}>MAY THE FASTEST FINGER WIN</div>
        </div>
        <HeroShowcase/>
        <div style={{height:14}}/>
        {!showEM?<>
          <button style={{...BY,fontSize:18,padding:'18px 0',letterSpacing:3}} onClick={loginAnon} disabled={loading}>{loading?'ENTRANDO...':'⚡ JOGAR AGORA'}</button>
          <div style={{textAlign:'center',color:'#333',margin:'12px 0',fontSize:9,letterSpacing:2}}>── OU ──</div>
          <button style={BG} onClick={()=>setShowEM(true)}>LOGIN COM EMAIL</button>
        </>:<>
          <input style={IN} placeholder="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/>
          <input style={{...IN,marginTop:8}} placeholder="SENHA (mín 6)" type="password" value={pass} onChange={e=>setPass(e.target.value)}/>
          <button style={{...BY,marginTop:10}} onClick={loginEmail} disabled={loading}>{loading?'...':'ENTRAR / CRIAR CONTA'}</button>
          <button style={{...BG,marginTop:8}} onClick={()=>setShowEM(false)}>← VOLTAR</button>
        </>}
        {error&&<div style={ER}>{error}</div>}
        <div style={{textAlign:'center',color:'#333',fontSize:9,marginTop:14,letterSpacing:1}}>🎁 <span style={{color:'#FFE600'}}>1.000 ₵</span> de bônus ao entrar</div>
      </div>
    </div>
  );

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if(phase==='lobby')return(
    <div style={{...P,justifyContent:'flex-start',paddingTop:0}}>
      <div style={{...B}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0 8px'}}>
          <div>
            <div style={{fontSize:17,fontWeight:900,color:'#FFE600',textShadow:'0 0 10px #FFE60066'}}>⚡ FLASH ARENA</div>
            <div style={{fontSize:9,color:'#555'}}>{user?.name}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#FFE600',fontWeight:900,fontSize:16}}>₵ {user?.coins?.toLocaleString('pt-BR')}</div>
            <div style={{color:'#555',fontSize:9}}>🏆{user?.wins||0}W 💀{user?.losses||0}L</div>
            <button style={{fontSize:9,color:'#444',background:'none',border:'none',cursor:'pointer',padding:0}} onClick={logout}>SAIR</button>
          </div>
        </div>
        <div style={{borderRadius:4,overflow:'hidden',border:'2px solid #1A1A3A',marginBottom:10}}><LobbyPreview/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
          {[['ENTRADA',`${ENTRY_FEE}₵`,'#FFE600'],['PLAYERS','2–4','#00C2FF'],['CLICKS','100','#00FF94']].map(([l,v,c])=>(
            <div key={l} style={{background:'#0D0D2B',border:`1px solid ${c}22`,borderRadius:4,padding:'9px 6px',textAlign:'center'}}>
              <div style={{color:c,fontWeight:900,fontSize:15,textShadow:`0 0 8px ${c}55`}}>{v}</div>
              <div style={{color:'#444',fontSize:8,marginTop:3,letterSpacing:2}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#0D0D2B',border:'1px solid #00FF9433',borderRadius:4,padding:'9px 14px',textAlign:'center',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{color:'#555',fontSize:10}}>4×{ENTRY_FEE}₵={4*ENTRY_FEE}₵</span>
          <span style={{color:'#00FF94',fontWeight:900,fontSize:12,textShadow:'0 0 8px #00FF9466'}}>PRÊMIO: {Math.floor(4*ENTRY_FEE*.9)}₵</span>
        </div>
        {(user?.coins??0)>=ENTRY_FEE
          ?<button style={{...BY,fontSize:22,padding:'18px 0',letterSpacing:4}} onClick={joinQueue}>⚡ JOGAR</button>
          :<div style={ER}>Coins insuficientes ({ENTRY_FEE}₵ necessários)</div>
        }
        <button style={{...BG,marginTop:10}} onClick={openRanking}>🏆 VER RANKING GLOBAL</button>
      </div>
    </div>
  );

  // ── RANKING ────────────────────────────────────────────────────────────────
  if(phase==='ranking')return(
    <div style={P}>
      <div style={B}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:26,fontWeight:900,color:'#FFE600',textShadow:'0 0 20px #FFE60066'}}>🏆 RANKING</div>
          <div style={{fontSize:9,color:'#555',marginTop:4,letterSpacing:3}}>TOP VELOCISTAS</div>
        </div>
        {ranking.length===0
          ?<div style={{textAlign:'center',color:'#333',padding:40,fontSize:11,lineHeight:2}}>Nenhum jogador ainda.<br/>Seja o primeiro!</div>
          :<div style={{display:'flex',flexDirection:'column',gap:6}}>
            {ranking.map((r:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:i===0?'#1A1500':'#0D0D2B',border:`1px solid ${i===0?'#FFE60044':'#1A1A3A'}`,borderRadius:4,padding:'10px 12px'}}>
                <span style={{fontSize:18,width:24}}>{'🥇🥈🥉'[i]||`${i+1}`}</span>
                <HeroThumb palIdx={i%4} scale={3}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:i===0?'#FFE600':'#fff',fontSize:11,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.display_name}</div>
                  <div style={{color:'#555',fontSize:9,marginTop:2}}>W:{r.wins} L:{r.losses} WR:{r.win_rate}%</div>
                </div>
                <div style={{color:PALETTES[i%4].bolt,fontSize:12,fontWeight:900}}>₵{Number(r.coins||0).toLocaleString('pt-BR')}</div>
              </div>
            ))}
          </div>
        }
        <button style={{...BG,marginTop:20}} onClick={()=>setPhase('lobby')}>← VOLTAR</button>
      </div>
    </div>
  );

  // ── QUEUING ────────────────────────────────────────────────────────────────
  if(phase==='queuing')return(
    <div style={{...P,gap:14}}>
      <div style={{borderRadius:4,overflow:'hidden',width:'100%',maxWidth:400,border:'2px solid #1A1A3A'}}><LobbyPreview/></div>
      <div style={{color:'#FFE600',fontSize:15,fontWeight:900,letterSpacing:3,textShadow:'0 0 20px #FFE600'}}>BUSCANDO OPONENTES...</div>
      <div style={{color:'#555',fontSize:11}}>Fila: #{qpos||'—'}</div>
      <div style={{color:'#333',fontSize:9,textAlign:'center',maxWidth:240,lineHeight:2,letterSpacing:1}}>Partida inicia com 2+ jogadores</div>
      <button style={{...BG,maxWidth:200}} onClick={()=>{sock.current?.emit('queue:leave');sock.current?.disconnect();setPhase('lobby');}}>CANCELAR</button>
    </div>
  );

  // ── COUNTDOWN ──────────────────────────────────────────────────────────────
  if(phase==='countdown')return(
    <div style={{...P,gap:14}}>
      <div style={{color:'#555',fontSize:9,letterSpacing:4}}>VELOCISTAS PRONTOS</div>
      <div style={{display:'flex',gap:18,justifyContent:'center',flexWrap:'wrap'}}>
        {players.map((p,i)=>(
          <div key={p.id} style={{textAlign:'center'}}>
            <HeroThumb palIdx={p.colorIdx%4} scale={5}/>
            <div style={{color:p.id===user?.id?PALETTES[p.colorIdx%4].bolt:'#444',fontSize:8,marginTop:4,letterSpacing:1}}>
              {p.name.slice(0,8).toUpperCase()}{p.id===user?.id?' ★':''}
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize:cd<=1?80:96,fontWeight:900,color:cd<=1?'#00FF94':'#FFE600',textShadow:`0 0 40px ${cd<=1?'#00FF94':'#FFE600'},0 0 80px ${cd<=1?'#00FF9444':'#FFE60044'}`,lineHeight:1,marginTop:8}}>
        {cd===0?'VÁ!':cd}
      </div>
    </div>
  );

  // ── RACING ─────────────────────────────────────────────────────────────────
  if(phase==='racing')return(
    <div style={{minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 12px 16px',fontFamily:'system-ui,sans-serif',gap:8}}>
      <div style={{display:'flex',justifyContent:'space-between',width:'100%',maxWidth:400,alignItems:'center'}}>
        <div style={{color:myPal.bolt,fontWeight:900,fontSize:20,textShadow:`0 0 15px ${myPal.bolt}`}}>{Math.round(myProg)}%</div>
        <div style={{color:'#444',fontSize:9,letterSpacing:2}}>⚡ FLASH ARENA</div>
        <div style={{color:'#555',fontSize:9}}>{clicks} clicks</div>
      </div>
      <RaceCanvas players={players} myId={user?.id||''} phase={phase}/>
      <div style={{width:'100%',maxWidth:400,display:'flex',flexDirection:'column',gap:5}}>
        {players.map((p,i)=>{
          const pal=PALETTES[p.colorIdx%4],isMe=p.id===user?.id;
          return(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:7,height:7,background:pal.bolt,borderRadius:1,boxShadow:`0 0 4px ${pal.bolt}`}}/>
              <span style={{fontSize:9,color:isMe?'#fff':'#444',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}{isMe?' ★':''}</span>
              <div style={{width:80,height:5,background:'#0D0D2B',borderRadius:2,overflow:'hidden',border:`1px solid ${isMe?pal.bolt+'44':'#111'}`}}>
                <div style={{height:'100%',width:`${p.progress}%`,background:pal.bolt,transition:'width 80ms',boxShadow:`0 0 6px ${pal.bolt}`}}/>
              </div>
              <span style={{fontSize:9,color:pal.bolt,width:26,textAlign:'right',fontWeight:700}}>{Math.round(p.progress)}%</span>
            </div>
          );
        })}
      </div>
      <button
        onMouseDown={click} onTouchStart={e=>{e.preventDefault();click();}}
        style={{width:195,height:195,borderRadius:4,background:pressed?myPal.suit:myPal.bolt,border:`4px solid ${darken(myPal.bolt,40)}`,fontSize:22,fontWeight:900,color:'#050510',transform:pressed?'scale(0.87)':'scale(1)',transition:'transform 0.06s,box-shadow 0.06s',boxShadow:pressed?`0 0 8px ${myPal.bolt}44`:`0 0 30px ${myPal.bolt}99,0 0 60px ${myPal.bolt}33`,cursor:'pointer',userSelect:'none',touchAction:'manipulation',letterSpacing:2} as any}
      >⚡ CLICK!</button>
      <div style={{color:'#222',fontSize:8,letterSpacing:3}}>ESPAÇO / ENTER TAMBÉM</div>
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if(phase==='finished'&&result){
    // Ordena fora do render
    const sorted=[...result.players].sort((a,b)=>b.progress-a.progress);
    return(
      <div style={{...P,padding:'16px',gap:12}}>
        <RaceCanvas players={players} myId={user?.id||''} phase="finished"/>
        <div style={{fontSize:result.isWinner?38:28,fontWeight:900,color:result.isWinner?'#FFE600':'#FF2D55',textShadow:`0 0 30px ${result.isWinner?'#FFE600':'#FF2D55'}`,letterSpacing:2,textAlign:'center',lineHeight:1}}>
          {result.isWinner?'⚡ VITÓRIA!':'💀 DERROTA'}
        </div>
        {!result.isWinner&&<div style={{color:'#555',fontSize:10,textAlign:'center'}}>{result.winnerName} foi mais rápido!</div>}
        <div style={{background:'#0D0D2B',border:`2px solid ${result.isWinner?'#FFE60066':'#FF2D5544'}`,borderRadius:4,padding:14,textAlign:'center',width:'100%',maxWidth:360}}>
          <div style={{color:'#444',fontSize:8,marginBottom:5,letterSpacing:3}}>{result.isWinner?'PRÊMIO GANHO':'ENTRADA PERDIDA'}</div>
          <div style={{color:result.isWinner?'#FFE600':'#FF2D55',fontSize:32,fontWeight:900}}>{result.isWinner?'+':''}{result.coinsChange}₵</div>
          <div style={{color:'#444',fontSize:9,marginTop:5}}>SALDO: <span style={{color:'#FFE600',fontWeight:700}}>₵ {user?.coins?.toLocaleString('pt-BR')}</span></div>
        </div>
        <div style={{width:'100%',maxWidth:360}}>
          {sorted.map((p,i)=>{
            const pal=PALETTES[p.colorIdx%4];
            return(
              <div key={`${p.id}-${i}`} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #111'}}>
                <span style={{fontSize:15,width:22}}>{'🥇🥈🥉4️⃣'[i]}</span>
                <HeroThumb palIdx={p.colorIdx%4} scale={3}/>
                <div style={{flex:1}}>
                  <div style={{color:p.id===user?.id?'#fff':'#444',fontSize:11}}>{p.name}{p.id===user?.id?' ★':''}</div>
                  <div style={{color:'#555',fontSize:9}}>{p.clicks} clicks</div>
                </div>
                <div style={{color:pal.bolt,fontSize:11,fontWeight:900}}>{Math.round(p.progress)}%</div>
              </div>
            );
          })}
        </div>
        <button style={{...BY,fontSize:16,padding:'15px 0',maxWidth:360,width:'100%',letterSpacing:3}} onClick={again}>⚡ JOGAR NOVAMENTE</button>
      </div>
    );
  }

  return<div style={P}><div style={{color:'#555',fontSize:12}}>Carregando...</div></div>;
}

const P:React.CSSProperties={minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:16,color:'#fff'};
const B:React.CSSProperties={width:'100%',maxWidth:400,display:'flex',flexDirection:'column'};
const BY:React.CSSProperties={width:'100%',padding:'14px 0',background:'#FFE600',color:'#050510',border:'none',borderRadius:4,fontWeight:900,fontSize:15,cursor:'pointer',letterSpacing:2,boxShadow:'0 0 20px #FFE60055,0 0 40px #FFE60022',userSelect:'none',touchAction:'manipulation'};
const BG:React.CSSProperties={width:'100%',padding:'12px 0',background:'transparent',color:'#555',border:'1px solid #222',borderRadius:4,fontWeight:700,fontSize:12,cursor:'pointer',letterSpacing:2,userSelect:'none'};
const IN:React.CSSProperties={width:'100%',padding:'12px 16px',background:'#0D0D2B',color:'#fff',border:'1px solid #222',borderRadius:4,fontSize:13,boxSizing:'border-box',outline:'none'};
const ER:React.CSSProperties={background:'#FF2D5511',border:'1px solid #FF2D5533',borderRadius:4,padding:'10px 14px',color:'#FF2D55',fontSize:11,textAlign:'center',marginTop:8};
