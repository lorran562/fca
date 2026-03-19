'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xnuneowwpzbadftaqozy.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudW5lb3d3cHpiYWRmdGFxb3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzE3MjgsImV4cCI6MjA4OTQ0NzcyOH0.NP5ZZisvFNH3CRyc57yMatabEZnJvw6mK_FlNngP7y0';
const ENTRY_FEE = 100;
const SK = 'fca_v4';

// ─── PALETA DE CORES POR PERSONAGEM ────────────────────────────────────────
// [traje, raio/detalhe, capacete, bota]
const HERO_PALETTES = [
  { suit:'#CC0000', bolt:'#FFE600', helm:'#AA0000', boot:'#FFE600', name:'FLASH' },
  { suit:'#FFE600', bolt:'#CC0000', helm:'#CCBB00', boot:'#CC0000', name:'REVERSE' },
  { suit:'#111111', bolt:'#888888', helm:'#222222', boot:'#333333', name:'ZOOM' },
  { suit:'#0055CC', bolt:'#FFE600', helm:'#003399', boot:'#FFE600', name:'KID' },
];

// ─── SPRITES FLASH (16 × 20 pixels cada frame) ─────────────────────────────
// Símbolos: H=capacete, F=rosto/visor, S=traje, B=raio/detalhe, K=bota, L=perna, .=transparente
const FLASH_RUN1 = [
  '......HHHHHH......',
  '.....HHFHFHHHH....',
  '.....HHHHHHHHH....',
  '....HHHBBHHHHH....',
  '....SSSSSSSSS.....',
  '...SSSBBSSSSSS....',
  '...SSSSSSSSSSS....',
  '....SSSBBSSSSS....',
  '....SSSSSSSSS.....',
  '.....LLLSSLL......',
  '.....LLLLLLL......',
  '......LLLLLL......',
  '.....LLLKLL.......',
  '....KKKLKLLL......',
  '....KKKK.KKK......',
];
const FLASH_RUN2 = [
  '......HHHHHH......',
  '.....HHFHFHHHH....',
  '.....HHHHHHHHH....',
  '....HHHBBHHHHH....',
  '....SSSSSSSSS.....',
  '...SSSBBSSSSSS....',
  '...SSSSSSSSSSS....',
  '....SSSBBSSSSS....',
  '......SSSSSSS.....',
  '......LLLLLL......',
  '.....LLLLLLL......',
  '....LLLLLLLL......',
  '....LLLKKLL.......',
  '....KKKK.KKK......',
  '....KKKK..KK......',
];
const FLASH_WIN = [
  '......HHHHHH......',
  '.....HHFHFHHHH....',
  '.....HHHHHHHHH....',
  '....HHHBBHHHHH....',
  'SSSSSSSSSSSSSSSSSS',
  '.SSSSBBSSSSSSSSS..',
  '..SSSSSSSSSSSSS...',
  '...SSSBBSSSSSS....',
  '....SSSSSSSSS.....',
  '.....LLSSSLL......',
  '.....LLLLLLL......',
  '......LLLLL.......',
  '.....LLKKLL.......',
  '....KKKK.KKK......',
  '....KKKK..KK......',
];
const FLASH_DEAD = [
  '..................',
  '..................',
  '......HHHHHH......',
  '.....HHFHFHHHH....',
  '.....HHHHHHHHH....',
  '....HHHBBHHHHH....',
  '....SSSSSSSSS.....',
  '...SSSBBSSSSSS....',
  '.SSSSSSSSSSSSSS...',
  'LLLLLLLLLLLLLLLLL.',
  '.KKKK..KKKK.......',
  '..................',
  '..................',
  '..................',
  '..................',
];

function drawFlash(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  x: number, y: number,
  scale: number,
  pal: typeof HERO_PALETTES[0]
) {
  grid.forEach((row, ry) => {
    [...row].forEach((sym, rx) => {
      let color: string | null = null;
      if (sym === 'H') color = pal.helm;
      else if (sym === 'F') color = '#FFEECC';
      else if (sym === 'S') color = pal.suit;
      else if (sym === 'B') color = pal.bolt;
      else if (sym === 'L') color = darken(pal.suit, 40);
      else if (sym === 'K') color = pal.boot;
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      // Pixel highlight no topo dos blocos
      if (sym === 'S' || sym === 'H') {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + rx * scale, y + ry * scale, scale, 1);
      }
    });
  });
}

function darken(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, ((n>>16)&0xff)-amt);
  const g = Math.max(0, ((n>>8)&0xff)-amt);
  const b = Math.max(0, (n&0xff)-amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ─── LIGHTNING BOLT EFFECT ──────────────────────────────────────────────────
interface LightningParticle { x: number; y: number; vx: number; vy: number; life: number; color: string; }

function spawnLightning(x: number, y: number, color: string): LightningParticle[] {
  return Array.from({ length: 8 }, () => ({
    x, y: y + Math.random() * 20,
    vx: -(2 + Math.random() * 4),
    vy: (Math.random() - 0.5) * 3,
    life: 1,
    color,
  }));
}

function drawLightningTrail(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, progress: number) {
  if (progress < 1) return;
  // Rastro de velocidade — linhas horizontais com fade
  const trailLen = 20 + progress * 0.3;
  for (let i = 0; i < 5; i++) {
    const ty = y + 4 + i * 6 + Math.random() * 2;
    const tlen = trailLen * (0.4 + Math.random() * 0.6);
    ctx.globalAlpha = 0.6 - i * 0.1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 - i * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - 2, ty);
    ctx.lineTo(x - tlen, ty);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Raio em zigue-zague atrás do personagem
  if (Math.random() > 0.4) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    let bx = x - 4, by = y + 20;
    ctx.moveTo(bx, by);
    for (let i = 0; i < 5; i++) {
      bx -= 8 + Math.random() * 6;
      by += (Math.random() - 0.5) * 14;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ─── TRACK DRAWING ──────────────────────────────────────────────────────────
function drawTrack(ctx: CanvasRenderingContext2D, W: number, H: number, scroll: number) {
  // Gradiente de céu noturno com aurora
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.45);
  sky.addColorStop(0, '#020210');
  sky.addColorStop(0.6, '#0A0A2A');
  sky.addColorStop(1, '#111133');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.45);

  // Aurora borealis no fundo
  ctx.globalAlpha = 0.15;
  const aurora = ctx.createLinearGradient(0, 0, W, 0);
  aurora.addColorStop(0, '#00FF94');
  aurora.addColorStop(0.5, '#FFE600');
  aurora.addColorStop(1, '#FF2D55');
  ctx.fillStyle = aurora;
  ctx.fillRect(0, H * 0.05, W, H * 0.15);
  ctx.globalAlpha = 1;

  // Edifícios pixelados no horizonte (parallax lento)
  ctx.fillStyle = '#0D0D2A';
  const buildings = [
    { w:40, h:60, x:0.05 }, { w:25, h:80, x:0.12 }, { w:50, h:50, x:0.2 },
    { w:30, h:90, x:0.28 }, { w:45, h:65, x:0.38 }, { w:20, h:75, x:0.46 },
    { w:55, h:55, x:0.54 }, { w:35, h:85, x:0.63 }, { w:40, h:70, x:0.72 },
    { w:30, h:60, x:0.81 }, { w:50, h:80, x:0.9 }, { w:25, h:65, x:0.98 },
  ];
  buildings.forEach(b => {
    const bx = ((b.x * W - scroll * 0.2) % (W + 80)) - 40;
    ctx.fillRect(bx, H * 0.45 - b.h, b.w, b.h);
    // Janelas piscando
    ctx.fillStyle = Math.random() > 0.7 ? '#FFE60033' : '#FFFFFF11';
    for (let wy = 0; wy < b.h - 10; wy += 12) {
      for (let wx = 4; wx < b.w - 4; wx += 10) {
        ctx.fillRect(bx + wx, H * 0.45 - b.h + wy + 5, 5, 6);
      }
    }
    ctx.fillStyle = '#0D0D2A';
  });

  // Estrelas cintilantes
  ctx.fillStyle = '#FFFFFF';
  [[0.05,0.04,2],[0.15,0.12,1],[0.28,0.06,2],[0.42,0.18,1],[0.56,0.09,2],
   [0.68,0.15,1],[0.78,0.05,2],[0.88,0.2,1],[0.95,0.1,2]].forEach(([sx,sy,sz]) => {
    ctx.globalAlpha = 0.4 + Math.random() * 0.6;
    ctx.fillRect(sx*W, sy*H, sz, sz);
  });
  ctx.globalAlpha = 1;

  // Asfalto com gradiente
  const road = ctx.createLinearGradient(0, H*0.45, 0, H);
  road.addColorStop(0, '#1A1A2E');
  road.addColorStop(1, '#0D0D1A');
  ctx.fillStyle = road;
  ctx.fillRect(0, H*0.45, W, H*0.55);

  // Linha amarela sólida superior
  ctx.fillStyle = '#FFE600';
  ctx.fillRect(0, H*0.45, W, 3);

  // Marcações brancas laterais da pista
  ctx.fillStyle = '#FFFFFF22';
  ctx.fillRect(0, H*0.47, W, 2);
  ctx.fillRect(0, H*0.93, W, 2);

  // Linhas tracejadas centrais animadas
  ctx.fillStyle = '#FFFFFF55';
  for (let i = -1; i < Math.ceil(W/80)+2; i++) {
    const lx = (i*80 - scroll%80);
    ctx.fillRect(lx, H*0.7, 48, 3);
  }

  // Linhas de velocidade no asfalto (perspectiva)
  ctx.strokeStyle = '#FFFFFF08';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const lx = ((i*(W/5)) - scroll*0.5) % (W + 100);
    ctx.beginPath();
    ctx.moveTo(lx, H*0.45);
    ctx.lineTo(lx - 40, H);
    ctx.stroke();
  }

  // Calçada com borda neon
  ctx.fillStyle = '#252540';
  ctx.fillRect(0, H*0.95, W, H*0.05);
  ctx.fillStyle = '#FFE600';
  ctx.fillRect(0, H*0.95, W, 2);
}

// ─── SUPABASE ───────────────────────────────────────────────────────────────
async function sbFetch(path: string, opts: RequestInit = {}, token?: string) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type':'application/json', apikey:SB_KEY, Authorization:`Bearer ${token||SB_KEY}`, ...(opts.headers as any||{}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error_description||data.msg||data.message||`HTTP ${res.status}`);
  return data;
}
async function anonLogin()    { return sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({is_anonymous:true})}); }
async function emailSignin(e:string,p:string) { return sbFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:e,password:p})}); }
async function emailSignup(e:string,p:string) { return sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:e,password:p})}); }
async function getProfile(uid:string,tok:string) {
  const d = await sbFetch(`/rest/v1/users?id=eq.${uid}&select=id,display_name,coins,wins,losses`,{},tok);
  return Array.isArray(d)&&d.length>0?d[0]:null;
}
async function createProfile(uid:string,name:string,tok:string) {
  await sbFetch('/rest/v1/users',{method:'POST',headers:{Prefer:'return=minimal'} as any,body:JSON.stringify({id:uid,display_name:name,coins:1000,avatar_index:0})},tok);
  await sbFetch('/rest/v1/transactions',{method:'POST',headers:{Prefer:'return=minimal'} as any,body:JSON.stringify({user_id:uid,amount:1000,type:'initial'})},tok);
}
async function getRanking() {
  try { const d=await sbFetch('/rest/v1/ranking?select=display_name,wins,losses,coins,win_rate,position&order=position.asc&limit=10'); return Array.isArray(d)?d:[]; }
  catch { return []; }
}

// ─── TYPES ──────────────────────────────────────────────────────────────────
type Phase='login'|'lobby'|'ranking'|'queuing'|'countdown'|'racing'|'finished';
interface User   { id:string;name:string;coins:number;token:string;wins:number;losses:number; }
interface PState { id:string;name:string;progress:number;clicks:number;colorIdx:number; }
interface Result { isWinner:boolean;coinsChange:number;winnerName:string;players:PState[]; }
interface RankRow{ display_name:string;wins:number;losses:number;coins:number;win_rate:number;position:number; }

// ─── RACE CANVAS ─────────────────────────────────────────────────────────────
function RaceCanvas({ players, myId, phase }: { players:PState[];myId:string;phase:string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const scrollRef  = useRef(0);
  const frameRef   = useRef(0);
  const tickRef    = useRef(0);
  const rafRef     = useRef(0);
  const playersRef = useRef<PState[]>(players);
  const phaseRef   = useRef(phase);
  const myIdRef    = useRef(myId);
  const lightnings = useRef<LightningParticle[]>([]);

  useEffect(()=>{ playersRef.current=players; },[players]);
  useEffect(()=>{ phaseRef.current=phase; },[phase]);
  useEffect(()=>{ myIdRef.current=myId; },[myId]);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width, H=canvas.height;
    const SCALE=3;
    const SPRITE_W=18, SPRITE_H=15;
    const TRACK_TOP=H*0.42;
    let prevProgress: Record<string,number>={};

    const animate=()=>{
      const ps=playersRef.current;
      const ph=phaseRef.current;
      const me=myIdRef.current;
      tickRef.current++;
      if(tickRef.current%7===0) frameRef.current^=1;

      const avgProg=ps.reduce((s,p)=>s+p.progress,0)/Math.max(ps.length,1);
      if(ph==='racing') scrollRef.current+=1.5+avgProg*0.05;

      ctx.clearRect(0,0,W,H);
      drawTrack(ctx,W,H,scrollRef.current);

      // Linha de chegada
      ctx.fillStyle='#FFFFFF66';
      ctx.fillRect(W*0.89,TRACK_TOP,3,H*0.52);
      ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.fillStyle='#FFE600';
      ctx.fillText('🏁',W*0.895,TRACK_TOP+H*0.26);

      const LANE_H=(H*0.52)/Math.max(ps.length,1);
      const winnerId=ph==='finished'?[...ps].sort((a,b)=>b.progress-a.progress)[0]?.id:null;

      ps.forEach((p,i)=>{
        const pal=HERO_PALETTES[p.colorIdx%4];
        const laneY=TRACK_TOP+i*LANE_H+LANE_H*0.05;
        const isMe=p.id===me;
        const minX=W*0.03, maxX=W*0.84;
        const sprX=minX+(p.progress/100)*(maxX-minX);
        const sprY=laneY+(LANE_H*0.5)-(SPRITE_H*SCALE*0.5);

        // Spawn lightning quando avança rápido
        if(ph==='racing' && (prevProgress[p.id]||0)<p.progress) {
          if(Math.random()>0.7) {
            lightnings.current.push(...spawnLightning(sprX, sprY+SPRITE_H*SCALE*0.5, pal.bolt));
          }
        }
        prevProgress[p.id]=p.progress;

        // Rastro de velocidade e raios
        if(ph==='racing') {
          drawLightningTrail(ctx, sprX, sprY, pal.bolt, p.progress);
          // Glow aura ao redor do personagem
          const grd=ctx.createRadialGradient(sprX+SPRITE_W*SCALE/2,sprY+SPRITE_H*SCALE/2,2,sprX+SPRITE_W*SCALE/2,sprY+SPRITE_H*SCALE/2,SPRITE_W*SCALE);
          grd.addColorStop(0,pal.bolt+'44');
          grd.addColorStop(1,'transparent');
          ctx.fillStyle=grd;
          ctx.fillRect(sprX-10,sprY-5,SPRITE_W*SCALE+20,SPRITE_H*SCALE+10);
        }

        // Sombra no chão
        ctx.fillStyle='rgba(0,0,0,0.4)';
        ctx.ellipse(sprX+SPRITE_W*SCALE/2,sprY+SPRITE_H*SCALE+2,SPRITE_W*SCALE/2,4,0,0,Math.PI*2);
        ctx.fill();

        // Sprite do personagem
        const grid=ph==='finished'
          ?(p.id===winnerId?FLASH_WIN:FLASH_DEAD)
          :(frameRef.current===0?FLASH_RUN1:FLASH_RUN2);
        drawFlash(ctx,grid,sprX,sprY,SCALE,pal);

        // Nome + barra de progresso
        ctx.font=`bold ${isMe?10:9}px monospace`;
        ctx.fillStyle=isMe?pal.bolt:'#FFFFFF99';
        ctx.textAlign='center';
        ctx.fillText(p.name.slice(0,8),sprX+SPRITE_W*SCALE/2,sprY-5);

        // Barra mini
        const bw=50, bh=3, bx=sprX+SPRITE_W*SCALE/2-bw/2, by=sprY+SPRITE_H*SCALE+8;
        ctx.fillStyle='#FFFFFF22'; ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle=pal.bolt; ctx.fillRect(bx,by,bw*(p.progress/100),bh);
        if(isMe){
          ctx.fillStyle=pal.bolt+'88';
          ctx.fillRect(bx-1,by-1,bw*(p.progress/100)+2,bh+2);
        }
      });

      // Atualiza partículas de lightning
      lightnings.current=lightnings.current.filter(pt=>pt.life>0);
      lightnings.current.forEach(pt=>{
        ctx.globalAlpha=pt.life;
        ctx.fillStyle=pt.color;
        ctx.fillRect(pt.x,pt.y,3,3);
        pt.x+=pt.vx; pt.y+=pt.vy;
        pt.life-=0.08;
        ctx.globalAlpha=1;
      });

      rafRef.current=requestAnimationFrame(animate);
    };
    rafRef.current=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);

  return(
    <canvas ref={canvasRef} width={400} height={200}
      style={{width:'100%',maxWidth:400,imageRendering:'pixelated',borderRadius:0,border:'2px solid #FFE60033',boxShadow:'0 0 20px #FFE60011'}}
    />
  );
}

// ─── LOBBY PREVIEW (corrida animada sem interação) ───────────────────────────
function LobbyPreview() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rafRef=useRef(0);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width, H=canvas.height;
    let scroll=0, tick=0, frame=0;
    const positions=[0.08,0.22,0.4,0.6];
    const animate=()=>{
      tick++; if(tick%7===0) frame^=1;
      scroll+=1.5;
      positions.forEach((_,i)=>{ positions[i]+=0.003+i*0.001; if(positions[i]>1.05) positions[i]=-0.05; });
      ctx.clearRect(0,0,W,H);
      drawTrack(ctx,W,H,scroll);
      const SCALE=3, SPRITE_W=18, SPRITE_H=15;
      const TRACK_Y=H*0.42;
      const LANE_H=(H*0.52)/4;
      positions.forEach((pos,i)=>{
        const pal=HERO_PALETTES[i];
        const sprX=pos*W;
        const sprY=TRACK_Y+i*LANE_H+LANE_H*0.1;
        drawLightningTrail(ctx,sprX,sprY,pal.bolt,50);
        const grd=ctx.createRadialGradient(sprX+SPRITE_W*SCALE/2,sprY+SPRITE_H*SCALE/2,2,sprX+SPRITE_W*SCALE/2,sprY+SPRITE_H*SCALE/2,SPRITE_W*SCALE);
        grd.addColorStop(0,pal.bolt+'33'); grd.addColorStop(1,'transparent');
        ctx.fillStyle=grd; ctx.fillRect(sprX-8,sprY-4,SPRITE_W*SCALE+16,SPRITE_H*SCALE+8);
        drawFlash(ctx,frame===0?FLASH_RUN1:FLASH_RUN2,sprX,sprY,SCALE,pal);
      });
      rafRef.current=requestAnimationFrame(animate);
    };
    rafRef.current=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return(
    <canvas ref={canvasRef} width={400} height={160}
      style={{width:'100%',maxWidth:400,imageRendering:'pixelated',display:'block',boxShadow:'inset 0 -4px 20px #FFE60022'}}
    />
  );
}

// ─── HERO SELECTOR (mostra os 4 personagens no login) ────────────────────────
function HeroShowcase() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rafRef=useRef(0);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width, H=canvas.height;
    let tick=0, frame=0;
    const animate=()=>{
      tick++; if(tick%10===0) frame^=1;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle='#050510'; ctx.fillRect(0,0,W,H);
      const SCALE=5, SPRITE_W=18;
      const spacing=W/4;
      HERO_PALETTES.forEach((pal,i)=>{
        const cx=spacing*i+spacing/2;
        const grd=ctx.createRadialGradient(cx,H/2,2,cx,H/2,30);
        grd.addColorStop(0,pal.bolt+'66'); grd.addColorStop(1,'transparent');
        ctx.fillStyle=grd; ctx.fillRect(cx-35,0,70,H);
        const sprX=cx-SPRITE_W*SCALE/2;
        drawFlash(ctx,frame===0?FLASH_RUN1:FLASH_RUN2,sprX,6,SCALE,pal);
        ctx.font='bold 9px monospace'; ctx.textAlign='center'; ctx.fillStyle=pal.bolt;
        ctx.fillText(pal.name,cx,H-4);
      });
      rafRef.current=requestAnimationFrame(animate);
    };
    rafRef.current=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);
  return(
    <canvas ref={canvasRef} width={320} height={100}
      style={{imageRendering:'pixelated',display:'block',margin:'0 auto'}}
    />
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function Home() {
  const [phase,   setPhase]   = useState<Phase>('login');
  const [user,    setUser]    = useState<User|null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [email,   setEmail]   = useState('');
  const [password,setPass]    = useState('');
  const [showEmail,setSE]     = useState(false);
  const [countdown,setCD]     = useState(0);
  const [roomId,  setRoomId]  = useState('');
  const [players, setPlayers] = useState<PState[]>([]);
  const [myProg,  setMyProg]  = useState(0);
  const [result,  setResult]  = useState<Result|null>(null);
  const [qpos,    setQPos]    = useState(0);
  const [pressed, setPressed] = useState(false);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [clickCount,setCC]    = useState(0);
  const sock=useRef<any>(null);

  useEffect(()=>{ try{const s=localStorage.getItem(SK);if(s){setUser(JSON.parse(s));setPhase('lobby');}}catch{} },[]);

  const save=(u:User)=>{ localStorage.setItem(SK,JSON.stringify(u));setUser(u);setPhase('lobby'); };

  const handleAuth=async(authData:any,defaultName:string)=>{
    const token=authData.access_token, userId=authData.user?.id;
    if(!token||!userId) throw new Error('Falha na autenticação');
    let profile=await getProfile(userId,token);
    if(!profile){await createProfile(userId,defaultName,token);profile={id:userId,display_name:defaultName,coins:1000,wins:0,losses:0};}
    save({id:userId,name:profile.display_name,coins:profile.coins,token,wins:profile.wins||0,losses:profile.losses||0});
  };

  const loginAnon=async()=>{
    setLoading(true);setError('');
    try{const d=await anonLogin();await handleAuth(d,`Flash_${d.user?.id?.slice(0,5)||'anon'}`);}
    catch(e:any){setError(e.message||'Erro desconhecido');}
    setLoading(false);
  };
  const loginEmail=async()=>{
    if(!email||password.length<6){setError('Email e senha (mín 6 chars) obrigatórios');return;}
    setLoading(true);setError('');
    try{let d:any;try{d=await emailSignin(email,password);}catch{d=await emailSignup(email,password);}await handleAuth(d,email.split('@')[0]);}
    catch(e:any){setError(e.message||'Erro ao autenticar');}
    setLoading(false);
  };
  const logout=()=>{localStorage.removeItem(SK);setUser(null);setPhase('login');sock.current?.disconnect();};

  const openRanking=async()=>{setPhase('ranking');setRanking(await getRanking());};

  const joinQueue=useCallback(async()=>{
    if(!user) return;
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
    s.on('game:start',()=>{setPhase('racing');setCD(0);setCC(0);});
    s.on('game:progress',({playerId,progress,clicks}:any)=>{
      setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,progress,clicks}:p));
      if(playerId===user.id) setMyProg(progress);
    });
    s.on('game:finished',({result:r}:any)=>{
      setResult(r);setPhase('finished');
      const updated={...user,coins:user.coins+r.coinsChange};
      localStorage.setItem(SK,JSON.stringify(updated));setUser(updated);
      setTimeout(async()=>{try{const p=await getProfile(user.id,user.token);if(p){const u2={...updated,coins:p.coins,wins:p.wins||0,losses:p.losses||0};setUser(u2);localStorage.setItem(SK,JSON.stringify(u2));}}catch{}},2000);
    });
  },[user]);

  const click=useCallback(()=>{
    if(!sock.current||phase!=='racing'||!user||!roomId) return;
    setPressed(true);setTimeout(()=>setPressed(false),60);
    setCC(c=>c+1);
    sock.current.emit('game:click',{roomId,userId:user.id});
  },[phase,user,roomId]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();click();}};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[click]);

  const again=()=>{sock.current?.disconnect();sock.current=null;setPhase('lobby');setPlayers([]);setMyProg(0);setResult(null);setRoomId('');setQPos(0);setCC(0);};

  const myColorIdx=players.find(p=>p.id===user?.id)?.colorIdx??0;
  const myPal=HERO_PALETTES[myColorIdx%4];

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if(phase==='login') return(
    <div style={P}>
      <div style={B}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:44,fontWeight:900,color:'#FFE600',textShadow:'0 0 30px #FFE600,0 0 60px #FFE60044',letterSpacing:4,lineHeight:1}}>⚡ FLASH</div>
          <div style={{fontSize:24,fontWeight:900,color:'#fff',letterSpacing:6,marginTop:2}}>CLICK ARENA</div>
          <div style={{fontSize:10,color:'#555',marginTop:6,letterSpacing:3}}>MAY THE FASTEST FINGER WIN</div>
        </div>
        <HeroShowcase/>
        <div style={{height:12}}/>
        {!showEmail?<>
          <button style={{...BY,fontSize:18,padding:'18px 0',letterSpacing:3}} onClick={loginAnon} disabled={loading}>
            {loading?'ENTRANDO...':'⚡ JOGAR AGORA'}
          </button>
          <div style={{textAlign:'center',color:'#333',margin:'14px 0',fontSize:10,letterSpacing:2}}>── OU ──</div>
          <button style={BG} onClick={()=>setSE(true)}>LOGIN COM EMAIL</button>
        </>:<>
          <input style={IN} placeholder="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/>
          <input style={{...IN,marginTop:8}} placeholder="SENHA (mín 6)" type="password" value={password} onChange={e=>setPass(e.target.value)}/>
          <button style={{...BY,marginTop:10}} onClick={loginEmail} disabled={loading}>{loading?'...':'ENTRAR / CRIAR CONTA'}</button>
          <button style={{...BG,marginTop:8}} onClick={()=>setSE(false)}>← VOLTAR</button>
        </>}
        {error&&<div style={ER}>{error}</div>}
        <div style={{textAlign:'center',color:'#333',fontSize:10,marginTop:16,letterSpacing:1}}>🎁 <span style={{color:'#FFE600'}}>1.000 ₵</span> de bônus ao entrar</div>
      </div>
    </div>
  );

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if(phase==='lobby') return(
    <div style={{...P,justifyContent:'flex-start',paddingTop:0}}>
      <div style={{...B,gap:0}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0 10px'}}>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:'#FFE600',textShadow:'0 0 10px #FFE60066'}}>⚡ FLASH ARENA</div>
            <div style={{fontSize:10,color:'#555'}}>{user?.name}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#FFE600',fontWeight:900,fontSize:18}}>₵ {user?.coins?.toLocaleString('pt-BR')}</div>
            <div style={{color:'#555',fontSize:10}}>🏆{user?.wins||0}W  💀{user?.losses||0}L</div>
            <button style={{fontSize:10,color:'#444',background:'none',border:'none',cursor:'pointer',padding:0}} onClick={logout}>SAIR</button>
          </div>
        </div>

        {/* Pista animada no lobby */}
        <div style={{borderRadius:4,overflow:'hidden',border:'2px solid #1A1A3A',marginBottom:12}}>
          <LobbyPreview/>
        </div>

        {/* Stats cards */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
          {[['ENTRADA',`${ENTRY_FEE}₵`,'#FFE600'],['PLAYERS','2–4','#00C2FF'],['CLICKS','100','#00FF94']].map(([l,v,c])=>(
            <div key={l} style={{background:'#0D0D2B',border:`1px solid ${c}22`,borderRadius:4,padding:'10px 8px',textAlign:'center'}}>
              <div style={{color:c,fontWeight:900,fontSize:17,textShadow:`0 0 8px ${c}66`}}>{v}</div>
              <div style={{color:'#444',fontSize:9,marginTop:3,letterSpacing:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Prize pool */}
        <div style={{background:'#0D0D2B',border:'1px solid #00FF9433',borderRadius:4,padding:'10px 14px',textAlign:'center',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{color:'#555',fontSize:11}}>4 × {ENTRY_FEE}₵ = {4*ENTRY_FEE}₵</div>
          <div style={{color:'#00FF94',fontWeight:900,fontSize:13,textShadow:'0 0 8px #00FF9466'}}>PRÊMIO: {Math.floor(4*ENTRY_FEE*0.9)}₵</div>
        </div>

        {/* Play button */}
        {(user?.coins??0)>=ENTRY_FEE
          ?<button style={{...BY,fontSize:24,padding:'20px 0',letterSpacing:4,textShadow:'0 0 10px #000'}} onClick={joinQueue}>⚡ JOGAR</button>
          :<div style={ER}>Coins insuficientes ({ENTRY_FEE}₵ necessários)</div>
        }

        {/* Ranking button */}
        <button style={{...BG,marginTop:10,display:'flex',alignItems:'center',justifyContent:'center',gap:8}} onClick={openRanking}>
          🏆 <span>VER RANKING GLOBAL</span>
        </button>
      </div>
    </div>
  );

  // ── RANKING ────────────────────────────────────────────────────────────────
  if(phase==='ranking') return(
    <div style={P}>
      <div style={B}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:28,fontWeight:900,color:'#FFE600',textShadow:'0 0 20px #FFE60066'}}>🏆 RANKING GLOBAL</div>
          <div style={{fontSize:10,color:'#555',marginTop:4,letterSpacing:3}}>TOP VELOCISTAS</div>
        </div>
        {ranking.length===0
          ?<div style={{textAlign:'center',color:'#333',padding:40,fontSize:11,lineHeight:2}}>Nenhum jogador ainda.<br/>Seja o primeiro a vencer!</div>
          :<div style={{display:'flex',flexDirection:'column',gap:6}}>
            {ranking.map((r,i)=>{
              const pal=HERO_PALETTES[i%4];
              return(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,background:i===0?'#1A1500':'#0D0D2B',border:`1px solid ${i===0?'#FFE60044':'#1A1A3A'}`,borderRadius:4,padding:'10px 12px'}}>
                  <span style={{fontSize:18,width:24}}>{'🥇🥈🥉'[i]||`${i+1}`}</span>
                  <div style={{width:18*3,height:15*3,flexShrink:0}}>
                    <HeroThumb palIdx={i%4}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:i===0?'#FFE600':'#fff',fontSize:11,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.display_name}</div>
                    <div style={{color:'#555',fontSize:9,marginTop:2}}>W:{r.wins} L:{r.losses} WR:{r.win_rate}%</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:pal.bolt,fontSize:12,fontWeight:900}}>₵{r.coins?.toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        }
        <button style={{...BG,marginTop:20}} onClick={()=>setPhase('lobby')}>← VOLTAR</button>
      </div>
    </div>
  );

  // ── QUEUING ────────────────────────────────────────────────────────────────
  if(phase==='queuing') return(
    <div style={{...P,gap:16}}>
      <div style={{borderRadius:4,overflow:'hidden',width:'100%',maxWidth:400,border:'2px solid #1A1A3A'}}>
        <LobbyPreview/>
      </div>
      <div style={{color:'#FFE600',fontSize:16,fontWeight:900,letterSpacing:3,textShadow:'0 0 20px #FFE600'}}>BUSCANDO OPONENTES...</div>
      <div style={{color:'#555',fontSize:12}}>Posição na fila: #{qpos||'—'}</div>
      <div style={{color:'#333',fontSize:10,textAlign:'center',maxWidth:240,lineHeight:1.8,letterSpacing:1}}>A partida inicia automaticamente com 2 ou mais jogadores</div>
      <button style={{...BG,maxWidth:200}} onClick={()=>{sock.current?.emit('queue:leave');sock.current?.disconnect();setPhase('lobby');}}>CANCELAR</button>
    </div>
  );

  // ── COUNTDOWN ──────────────────────────────────────────────────────────────
  if(phase==='countdown') return(
    <div style={{...P,gap:16}}>
      <div style={{color:'#555',fontSize:10,letterSpacing:4}}>VELOCISTAS PRONTOS</div>
      <div style={{display:'flex',gap:20,justifyContent:'center',flexWrap:'wrap'}}>
        {players.map((p,i)=>(
          <div key={p.id} style={{textAlign:'center'}}>
            <HeroThumb palIdx={p.colorIdx%4} scale={5}/>
            <div style={{color:p.id===user?.id?HERO_PALETTES[p.colorIdx%4].bolt:'#444',fontSize:9,marginTop:4,letterSpacing:1}}>
              {p.name.slice(0,8).toUpperCase()}{p.id===user?.id?' ★':''}
            </div>
          </div>
        ))}
      </div>
      <div style={{fontSize:countdown<=1?80:96,fontWeight:900,color:countdown<=1?'#00FF94':'#FFE600',textShadow:`0 0 40px ${countdown<=1?'#00FF94':'#FFE600'},0 0 80px ${countdown<=1?'#00FF9444':'#FFE60044'}`,lineHeight:1,marginTop:8}}>
        {countdown===0?'VÁ!':countdown}
      </div>
    </div>
  );

  // ── RACING ─────────────────────────────────────────────────────────────────
  if(phase==='racing') return(
    <div style={{minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 12px 20px',fontFamily:'system-ui,sans-serif',gap:10}}>
      {/* Header da corrida */}
      <div style={{display:'flex',justifyContent:'space-between',width:'100%',maxWidth:400,alignItems:'center'}}>
        <div style={{color:myPal.bolt,fontWeight:900,fontSize:20,textShadow:`0 0 15px ${myPal.bolt}`}}>{Math.round(myProg)}%</div>
        <div style={{color:'#555',fontSize:10,letterSpacing:2}}>⚡ FLASH ARENA</div>
        <div style={{color:'#555',fontSize:10}}>{clickCount} clicks</div>
      </div>

      {/* Canvas principal */}
      <RaceCanvas players={players} myId={user?.id||''} phase={phase}/>

      {/* Mini placar */}
      <div style={{width:'100%',maxWidth:400,display:'flex',flexDirection:'column',gap:5}}>
        {players.map((p,i)=>{
          const pal=HERO_PALETTES[p.colorIdx%4];
          const isMe=p.id===user?.id;
          return(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:8,height:8,background:pal.bolt,borderRadius:1,boxShadow:`0 0 4px ${pal.bolt}`}}/>
              <span style={{fontSize:10,color:isMe?'#fff':'#444',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}{isMe?' ★':''}</span>
              <div style={{width:80,height:5,background:'#0D0D2B',borderRadius:2,overflow:'hidden',border:`1px solid ${isMe?pal.bolt+'44':'#111'}`}}>
                <div style={{height:'100%',width:`${p.progress}%`,background:pal.bolt,transition:'width 80ms',boxShadow:`0 0 6px ${pal.bolt}`}}/>
              </div>
              <span style={{fontSize:10,color:pal.bolt,width:28,textAlign:'right',fontWeight:700}}>{Math.round(p.progress)}%</span>
            </div>
          );
        })}
      </div>

      {/* Botão gigante */}
      <button
        onMouseDown={click}
        onTouchStart={e=>{e.preventDefault();click();}}
        style={{
          width:200,height:200,borderRadius:4,
          background:pressed?myPal.suit:myPal.bolt,
          border:`4px solid ${darken(myPal.bolt,40)}`,
          fontSize:24,fontWeight:900,color:'#050510',
          transform:pressed?'scale(0.88)':'scale(1)',
          transition:'transform 0.06s,box-shadow 0.06s',
          boxShadow:pressed?`0 0 8px ${myPal.bolt}44`:`0 0 30px ${myPal.bolt}99,0 0 60px ${myPal.bolt}33`,
          cursor:'pointer',userSelect:'none',touchAction:'manipulation',
          letterSpacing:2,
        } as any}
      >⚡ CLICK!</button>
      <div style={{color:'#222',fontSize:9,letterSpacing:3}}>ESPAÇO / ENTER TAMBÉM</div>
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if(phase==='finished'&&result) {
    const sortedPlayers=[...result.players].sort((a,b)=>b.progress-a.progress);
    return(
      <div style={{...P,padding:'20px 16px',gap:14}}>
        <RaceCanvas players={players} myId={user?.id||''} phase="finished"/>

        <div style={{fontSize:result.isWinner?40:30,fontWeight:900,color:result.isWinner?'#FFE600':'#FF2D55',textShadow:`0 0 30px ${result.isWinner?'#FFE600':'#FF2D55'},0 0 60px ${result.isWinner?'#FFE60044':'#FF2D5544'}`,letterSpacing:2,textAlign:'center',lineHeight:1}}>
          {result.isWinner?'⚡ VITÓRIA!':'💀 DERROTA'}
        </div>
        {!result.isWinner&&<div style={{color:'#666',fontSize:11,textAlign:'center'}}>{result.winnerName} foi o mais rápido!</div>}

        <div style={{background:'#0D0D2B',border:`2px solid ${result.isWinner?'#FFE60066':'#FF2D5544'}`,borderRadius:4,padding:16,textAlign:'center',width:'100%',maxWidth:360,boxShadow:result.isWinner?'0 0 20px #FFE60022':'none'}}>
          <div style={{color:'#444',fontSize:9,marginBottom:6,letterSpacing:3}}>{result.isWinner?'PRÊMIO GANHO':'ENTRADA PERDIDA'}</div>
          <div style={{color:result.isWinner?'#FFE600':'#FF2D55',fontSize:34,fontWeight:900,textShadow:`0 0 20px ${result.isWinner?'#FFE60066':'#FF2D5544'}`}}>{result.isWinner?'+':''}{result.coinsChange}₵</div>
          <div style={{color:'#444',fontSize:10,marginTop:6}}>SALDO ATUAL: <span style={{color:'#FFE600',fontWeight:700}}>₵ {user?.coins?.toLocaleString('pt-BR')}</span></div>
        </div>

        <div style={{width:'100%',maxWidth:360}}>
          {sortedPlayers.map((p,i)=>{
            const pal=HERO_PALETTES[p.colorIdx%4];
            return(
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #111'}}>
                <span style={{fontSize:16,width:24}}>{'🥇🥈🥉4️⃣'[i]}</span>
                <HeroThumb palIdx={p.colorIdx%4} scale={3}/>
                <div style={{flex:1}}>
                  <div style={{color:p.id===user?.id?'#fff':'#444',fontSize:11}}>{p.name}{p.id===user?.id?' ★':''}</div>
                  <div style={{color:'#555',fontSize:9}}>{p.clicks} clicks</div>
                </div>
                <div style={{color:pal.bolt,fontSize:12,fontWeight:900}}>{Math.round(p.progress)}%</div>
              </div>
            );
          })}
        </div>

        <button style={{...BY,fontSize:18,padding:'16px 0',maxWidth:360,width:'100%',letterSpacing:3}} onClick={again}>⚡ JOGAR NOVAMENTE</button>
      </div>
    );
  }

  return<div style={P}><div style={{color:'#555',fontSize:12}}>Carregando...</div></div>;
}

// ─── HERO THUMBNAIL (canvas estático de um personagem) ────────────────────────
function HeroThumb({palIdx=0,scale=3}:{palIdx?:number;scale?:number}) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rafRef=useRef(0);
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const pal=HERO_PALETTES[palIdx%4];
    let tick=0,frame=0;
    const animate=()=>{
      tick++; if(tick%10===0) frame^=1;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      drawFlash(ctx,frame===0?FLASH_RUN1:FLASH_RUN2,0,0,scale,pal);
      rafRef.current=requestAnimationFrame(animate);
    };
    rafRef.current=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(rafRef.current);
  },[palIdx,scale]);
  return<canvas ref={canvasRef} width={18*scale} height={15*scale} style={{imageRendering:'pixelated',display:'block'}}/>;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const P:React.CSSProperties={minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:16,color:'#fff'};
const B:React.CSSProperties={width:'100%',maxWidth:400,display:'flex',flexDirection:'column'};
const BY:React.CSSProperties={width:'100%',padding:'14px 0',background:'#FFE600',color:'#050510',border:'none',borderRadius:4,fontWeight:900,fontSize:15,cursor:'pointer',letterSpacing:2,boxShadow:'0 0 20px #FFE60055,0 0 40px #FFE60022',userSelect:'none',touchAction:'manipulation'};
const BG:React.CSSProperties={width:'100%',padding:'12px 0',background:'transparent',color:'#555',border:'1px solid #222',borderRadius:4,fontWeight:700,fontSize:12,cursor:'pointer',letterSpacing:2,userSelect:'none'};
const IN:React.CSSProperties={width:'100%',padding:'12px 16px',background:'#0D0D2B',color:'#fff',border:'1px solid #222',borderRadius:4,fontSize:13,boxSizing:'border-box',outline:'none'};
const ER:React.CSSProperties={background:'#FF2D5511',border:'1px solid #FF2D5533',borderRadius:4,padding:'10px 14px',color:'#FF2D55',fontSize:11,textAlign:'center',marginTop:8};
