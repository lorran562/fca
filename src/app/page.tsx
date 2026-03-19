'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════════════
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xnuneowwpzbadftaqozy.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudW5lb3d3cHpiYWRmdGFxb3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzE3MjgsImV4cCI6MjA4OTQ0NzcyOH0.NP5ZZisvFNH3CRyc57yMatabEZnJvw6mK_FlNngP7y0';
const ENTRY_FEE = 100;
const SK = 'fca_v5';

// ═══════════════════════════════════════════════════════════════
//  PALETAS — Flash, Reverse Flash, Zoom, Kid Flash
// ═══════════════════════════════════════════════════════════════
const PALETTES = [
  { suit:'#CC1100', bolt:'#FFE600', dark:'#880000', boot:'#FFE600', glow:'#FF4400', name:'FLASH'   },
  { suit:'#DDCC00', bolt:'#FF2200', dark:'#997700', boot:'#FF2200', glow:'#FFEE00', name:'REVERSE' },
  { suit:'#1A1A2E', bolt:'#6699FF', dark:'#0A0A1A', boot:'#334466', glow:'#4488FF', name:'ZOOM'    },
  { suit:'#1144CC', bolt:'#FFE600', dark:'#002299', boot:'#FFE600', glow:'#3366FF', name:'KID'     },
];

// ═══════════════════════════════════════════════════════════════
//  SPRITES PIXEL ART 16×20 — Flash hero correndo
// ═══════════════════════════════════════════════════════════════
// H=capacete S=traje B=raio/detalhe L=calça K=bota .=vazio
// Frame 1 — perna esquerda frente
const F1 = [
  '.....HHHHHH.....',
  '....HHHHHHHHH...',
  '....HBBHHHHHH...',
  '....HHHHHHHHH...',
  '...SSSSSSSSSS...',
  '..SSSBBBSSSSSS..',
  '..SSSSSSSSSSSS..',
  '...SSSBBBSSSSS..',
  '...SSSSSSSSS....',
  '....LLSSSSLL....',
  '....LLLLLLL.....',
  '.....LLLLL......',
  '....LLLKLL......',
  '...KKKK.KKKK....',
  '...KKK...KKK....',
];
// Frame 2 — perna direita frente
const F2 = [
  '.....HHHHHH.....',
  '....HHHHHHHHH...',
  '....HBBHHHHHH...',
  '....HHHHHHHHH...',
  '...SSSSSSSSSS...',
  '..SSSBBBSSSSSS..',
  '..SSSSSSSSSSSS..',
  '...SSSBBBSSSSS..',
  '.....SSSSSSS....',
  '.....LLLLL......',
  '....LLLLLLL.....',
  '...LLLLLLLL.....',
  '...LLKK.LLL.....',
  '...KKK...KKK....',
  '...KKK....KK....',
];
// Vitória — braços para cima
const WIN = [
  'SS...HHHHHH...SS',
  '.SS.HHHHHHHHH.S.',
  '..SSHHBBHHHHHSS.',
  '..SSHHHHHHHHHS..',
  '.SSSSSSSSSSSSSS.',
  'SSSSBBBSSSSSSSS.',
  'SSSSSSSSSSSSSSS.',
  '.SSSSBBBSSSSSS..',
  '...SSSSSSSS.....',
  '....LLSSLL......',
  '....LLLLLLL.....',
  '.....LLLLL......',
  '....LLKKLL......',
  '...KKKK.KKK.....',
  '...KKK...KKK....',
];
// Derrota — caído
const DEAD = [
  '................',
  '................',
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHHH...',
  '....HBBHHHHHH...',
  '...SSSSSSSSSS...',
  'SSSSBBSSSSSSSSSS',
  'LLLLLLLLLLLLLLLL',
  '.KKKK...KKKK....',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const SPR_W = 16, SPR_H = 15;

function drawHero(
  ctx: CanvasRenderingContext2D,
  grid: string[], x: number, y: number,
  sc: number, pal: typeof PALETTES[0], glow = false
) {
  if (glow) {
    try {
      const g = ctx.createRadialGradient(
        x + SPR_W * sc / 2, y + SPR_H * sc / 2, 2,
        x + SPR_W * sc / 2, y + SPR_H * sc / 2, SPR_W * sc * 1.2
      );
      g.addColorStop(0, pal.glow + '66');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(x - sc * 4, y - sc * 2, SPR_W * sc + sc * 8, SPR_H * sc + sc * 4);
    } catch { /**/ }
  }
  for (let ry = 0; ry < grid.length && ry < SPR_H; ry++) {
    const row = grid[ry];
    for (let rx = 0; rx < row.length && rx < SPR_W; rx++) {
      const s = row[rx];
      let c: string | null = null;
      if      (s === 'H') c = pal.suit;
      else if (s === 'B') c = pal.bolt;
      else if (s === 'S') c = pal.suit;
      else if (s === 'L') c = pal.dark;
      else if (s === 'K') c = pal.boot;
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + rx * sc, y + ry * sc, sc, sc);
      if (s === 'S' || s === 'H') {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x + rx * sc, y + ry * sc, sc, 1);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  PARTÍCULAS
// ═══════════════════════════════════════════════════════════════
interface Particle { x:number;y:number;vx:number;vy:number;life:number;maxLife:number;size:number;color:string;type:'spark'|'ring'|'bolt'; }

function spawnClickParticles(x: number, y: number, color: string, bolt: string): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (Math.random() * Math.PI * 2);
    const spd = 2 + Math.random() * 5;
    out.push({ x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 2,
      life:1, maxLife:1, size:2+Math.random()*3, color:Math.random()>0.4?bolt:color, type:'spark' });
  }
  out.push({ x, y, vx:0, vy:0, life:1, maxLife:1, size:1, color:bolt, type:'ring' });
  return out;
}

function spawnSpeedParticles(x: number, y: number, color: string): Particle[] {
  return Array.from({length:3},()=>({
    x: x - 4 + Math.random()*8,
    y: y + Math.random()*(SPR_H*3),
    vx: -(2+Math.random()*4),
    vy: (Math.random()-0.5)*1.5,
    life:1, maxLife:1, size:1+Math.random()*2,
    color, type:'spark' as const,
  }));
}

// ═══════════════════════════════════════════════════════════════
//  PARALLAX BG — 4 camadas
// ═══════════════════════════════════════════════════════════════
function drawBg(ctx: CanvasRenderingContext2D, W: number, H: number, scroll: number, speed: number) {
  // SKY gradient
  const sky = ctx.createLinearGradient(0,0,0,H*0.5);
  sky.addColorStop(0,'#010115'); sky.addColorStop(1,'#0C0C25');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*0.5);

  // LAYER 1 — aurora (very slow)
  ctx.globalAlpha=0.1;
  const aur=ctx.createLinearGradient(0,0,W,0);
  aur.addColorStop(0,'#FF000000'); aur.addColorStop(0.3,'#00FF9488');
  aur.addColorStop(0.6,'#FFE60066'); aur.addColorStop(1,'#FF000000');
  ctx.fillStyle=aur; ctx.fillRect(0,H*0.03,W,H*0.14);
  ctx.globalAlpha=1;

  // LAYER 2 — far city (slow)
  const farX = -(scroll*0.08)%(W*0.5);
  const farBuildings=[
    {w:55,h:90},{w:35,h:70},{w:70,h:110},{w:40,h:85},{w:60,h:95},{w:30,h:65},
    {w:80,h:120},{w:45,h:80},{w:50,h:100},{w:35,h:75},{w:65,h:115},
  ];
  let bx=farX;
  for(let rep=0;rep<3;rep++){
    farBuildings.forEach((b,i)=>{
      const fx=bx+i*(W/farBuildings.length);
      const fx2=((fx%W)+W)%W;
      ctx.fillStyle='#0D0D24';
      ctx.fillRect(fx2-W, H*0.5-b.h, b.w, b.h);
      ctx.fillRect(fx2,   H*0.5-b.h, b.w, b.h);
      // Janelas
      for(let wy=8;wy<b.h-8;wy+=14){
        for(let wx=5;wx<b.w-5;wx+=11){
          const lit=Math.sin((i+wy*0.1+scroll*0.001))>0.3;
          ctx.fillStyle=lit?'#FFE60028':'#FFFFFF08';
          ctx.fillRect(fx2-W+wx,H*0.5-b.h+wy,5,7);
          ctx.fillRect(fx2+wx, H*0.5-b.h+wy,5,7);
        }
      }
    });
  }

  // LAYER 3 — near buildings (faster)
  const nearX = -(scroll*0.25)%(W*0.6);
  const nearB=[{w:40,h:60},{w:25,h:80},{w:50,h:50},{w:30,h:90},{w:45,h:65}];
  let nx=nearX;
  for(let rep=0;rep<4;rep++){
    nearB.forEach((b,i)=>{
      const fx=((nx+i*(W/nearB.length))%W+W)%W;
      ctx.fillStyle='#0A0A1C';
      ctx.fillRect(fx-W,H*0.5-b.h,b.w,b.h);
      ctx.fillRect(fx,  H*0.5-b.h,b.w,b.h);
      // Neon sign no topo
      ctx.fillStyle=PALETTES[i%4].glow+'55';
      ctx.fillRect(fx-W+4,H*0.5-b.h-3,b.w-8,3);
      ctx.fillRect(fx+4,  H*0.5-b.h-3,b.w-8,3);
    });
  }

  // ESTRADAS
  const road=ctx.createLinearGradient(0,H*0.5,0,H);
  road.addColorStop(0,'#18182E'); road.addColorStop(1,'#0C0C1A');
  ctx.fillStyle=road; ctx.fillRect(0,H*0.5,W,H*0.5);

  // Borda neon da estrada
  ctx.fillStyle='#FFE600';
  ctx.fillRect(0,H*0.5,W,3);
  ctx.fillRect(0,H*0.94,W,2);
  ctx.fillStyle='#252540'; ctx.fillRect(0,H*0.94,W,H*0.06);

  // Linhas tracejadas animadas
  ctx.fillStyle='#FFFFFF55';
  const dash=scroll%80;
  for(let i=-1;i<Math.ceil(W/80)+2;i++){
    ctx.fillRect(i*80-dash, H*0.7, 46, 4);
  }

  // Speed lines — efeito de movimento horizontal
  ctx.strokeStyle='#FFFFFF06'; ctx.lineWidth=1;
  for(let i=0;i<12;i++){
    const ly=H*0.5+i*(H*0.44/12)+(scroll*0.3)%(H*0.44/12);
    ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(W,ly); ctx.stroke();
  }

  // Estrelas cintilantes
  const stars=[[.06,.05,1.5],[.18,.12,1],[.31,.06,1.5],[.44,.16,1],[.58,.08,1.5],[.72,.14,1],[.85,.04,2],[.93,.17,1]];
  stars.forEach(([sx,sy,sz])=>{
    ctx.globalAlpha=0.3+Math.sin(scroll*0.02+sx*10)*0.35;
    ctx.fillStyle='#FFFFFF'; ctx.fillRect(sx*W,sy*H,sz,sz);
  });
  ctx.globalAlpha=1;
}

// ═══════════════════════════════════════════════════════════════
//  SUPABASE
// ═══════════════════════════════════════════════════════════════
async function sbFetch(path:string,opts:RequestInit={},token?:string){
  const res=await fetch(`${SB_URL}${path}`,{
    ...opts,headers:{'Content-Type':'application/json',apikey:SB_KEY,Authorization:`Bearer ${token||SB_KEY}`,...(opts.headers as any||{})},
  });
  const text=await res.text();
  const data=text?JSON.parse(text):{};
  if(!res.ok) throw new Error(data.error_description||data.msg||data.message||`HTTP ${res.status}`);
  return data;
}
const sbAnon   = ()=>sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({is_anonymous:true})});
const sbLogin  = (e:string,p:string)=>sbFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:e,password:p})});
const sbSignup = (e:string,p:string)=>sbFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:e,password:p})});
const sbProfile= async(uid:string,tok:string)=>{
  const d=await sbFetch(`/rest/v1/users?id=eq.${uid}&select=id,display_name,coins,wins,losses`,{},tok);
  return Array.isArray(d)&&d.length?d[0]:null;
};
const sbCreate=async(uid:string,name:string,tok:string)=>{
  await sbFetch('/rest/v1/users',{method:'POST',headers:{Prefer:'return=minimal'}as any,body:JSON.stringify({id:uid,display_name:name,coins:1000,avatar_index:0})},tok);
  await sbFetch('/rest/v1/transactions',{method:'POST',headers:{Prefer:'return=minimal'}as any,body:JSON.stringify({user_id:uid,amount:1000,type:'initial'})},tok);
};
const sbRanking=async():Promise<any[]>=>{
  try{const d=await sbFetch('/rest/v1/ranking?select=display_name,wins,losses,coins,win_rate,position&order=position.asc&limit=10');return Array.isArray(d)?d:[];}
  catch{return[];}
};

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════
type Phase='login'|'lobby'|'ranking'|'queuing'|'countdown'|'racing'|'finished';
interface User   {id:string;name:string;coins:number;token:string;wins:number;losses:number;}
interface PState {id:string;name:string;progress:number;clicks:number;colorIdx:number;}
interface Result {isWinner:boolean;coinsChange:number;winnerName:string;players:PState[];}

// ═══════════════════════════════════════════════════════════════
//  RACE CANVAS — o motor do jogo
// ═══════════════════════════════════════════════════════════════
function RaceCanvas({players,myId,phase,onShake}:{players:PState[];myId:string;phase:string;onShake?:()=>void}) {
  const ref      = useRef<HTMLCanvasElement>(null);
  const pRef     = useRef(players);
  const phRef    = useRef(phase);
  const meRef    = useRef(myId);
  const scroll   = useRef(0);
  const frame    = useRef(0);
  const tick     = useRef(0);
  const raf      = useRef(0);
  const parts    = useRef<Particle[]>([]);
  const prevProg = useRef<Record<string,number>>({});
  const camX     = useRef(0); // câmera segue líder

  useEffect(()=>{pRef.current=players;},[players]);
  useEffect(()=>{phRef.current=phase;},[phase]);
  useEffect(()=>{meRef.current=myId;},[myId]);

  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width,H=canvas.height;
    const SC=3; // scale dos sprites
    const TRACK_TOP=H*0.44;
    const TRACK_H  =H*0.5;

    const loop=()=>{
      try{
        const ps=pRef.current,ph=phRef.current,me=meRef.current;
        tick.current++; if(tick.current%7===0) frame.current^=1;

        // Câmera suave seguindo o líder
        const leader=[...ps].sort((a,b)=>b.progress-a.progress)[0];
        const targetScroll=leader?(leader.progress/100)*W*2.5:scroll.current;
        scroll.current+=(targetScroll-scroll.current)*0.04;

        // Câmera X — suave
        const targetCamX=leader?(leader.progress/100)*(W*1.5):0;
        camX.current+=(targetCamX-camX.current)*0.05;

        ctx.clearRect(0,0,W,H);

        // Fundo parallax
        drawBg(ctx,W,H,scroll.current,1);

        // LANE separators
        const LANE_H=TRACK_H/Math.max(ps.length,1);
        ps.forEach((_,i)=>{
          if(i===0) return;
          ctx.fillStyle='#FFFFFF15';
          ctx.fillRect(0,TRACK_TOP+i*LANE_H,W,1);
        });

        // Linha de chegada
        const FINISH_X=W*0.88;
        ctx.fillStyle='#FFFFFF99'; ctx.fillRect(FINISH_X,TRACK_TOP,3,TRACK_H);
        // Xadrez preto/branco na linha
        for(let fy=0;fy<TRACK_H;fy+=8){
          ctx.fillStyle=(Math.floor(fy/8)%2===0)?'#000000':'#FFFFFF';
          ctx.fillRect(FINISH_X-3,TRACK_TOP+fy,6,8);
        }
        ctx.font='bold 14px sans-serif'; ctx.textAlign='center';
        ctx.fillText('🏁',FINISH_X+14,TRACK_TOP+TRACK_H/2+5);

        // Posições dos corredores
        const sorted=[...ps].sort((a,b)=>b.progress-a.progress);

        ps.forEach((p,i)=>{
          const pal=PALETTES[p.colorIdx%4];
          const isMe=p.id===me;
          const LANE_Y=TRACK_TOP+i*LANE_H;

          // Posição X na pista (0% = 8% da tela, 100% = 85%)
          const sprX=W*0.06+(p.progress/100)*(W*0.79);
          const sprY=LANE_Y+LANE_H/2-SPR_H*SC/2;

          // Spawn partículas de velocidade
          if(ph==='racing' && tick.current%3===0 && p.progress>0){
            parts.current.push(...spawnSpeedParticles(sprX,sprY,pal.glow+'CC'));
          }

          // Partículas extras ao clicar (detecta aumento de progresso)
          const prev=prevProg.current[p.id]||0;
          if(ph==='racing' && p.progress>prev+0.3){
            parts.current.push(...spawnSpeedParticles(sprX-8,sprY+SPR_H*SC*0.5,pal.bolt));
          }
          prevProg.current[p.id]=p.progress;

          // Rastro de velocidade
          const spd=p.progress/100;
          for(let li=1;li<=5;li++){
            const alpha=0.6-li*0.1;
            const len=(20+spd*40)*li*0.4;
            ctx.globalAlpha=alpha;
            ctx.fillStyle=li===1?'#FFFFFF':pal.glow;
            ctx.fillRect(sprX-len,sprY+li*SC*1.2,len*0.6,SC*0.8);
          }
          ctx.globalAlpha=1;

          // Raio zigue-zague (velocidade alta)
          if(ph==='racing' && p.progress>20 && Math.random()>0.6){
            ctx.strokeStyle=pal.bolt; ctx.lineWidth=1.5;
            ctx.globalAlpha=0.75;
            ctx.beginPath();
            let bx=sprX-4,by=sprY+SPR_H*SC*0.5;
            ctx.moveTo(bx,by);
            for(let zi=0;zi<5;zi++){
              bx-=5+Math.random()*6;
              by+=(Math.random()-0.5)*18;
              ctx.lineTo(bx,by);
            }
            ctx.stroke();
            ctx.globalAlpha=1;
          }

          // Sombra no asfalto
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(sprX+SPR_W*SC/2, LANE_Y+LANE_H-4, SPR_W*SC*0.4, 4, 0, 0, Math.PI*2);
          ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();
          ctx.restore();

          // Sprite
          const ph2=ph as string;
          const sortedWinnerId=ph2==='finished'?sorted[0]?.id:null;
          const grid=ph2==='finished'
            ?(p.id===sortedWinnerId?WIN:DEAD)
            :(frame.current===0?F1:F2);
          drawHero(ctx,grid,sprX,sprY,SC,pal,ph2==='racing'&&p.progress>15);

          // Posição (1º, 2º...)
          const pos=sorted.findIndex(s=>s.id===p.id)+1;
          const posLabel=['1ST','2ND','3RD','4TH'][pos-1]||`${pos}`;
          ctx.font=`bold ${isMe?9:8}px monospace`;
          ctx.textAlign='center';
          ctx.fillStyle=pos===1?'#FFE600':isMe?'#FFFFFF':'#AAAAAA';
          ctx.fillText(posLabel, sprX+SPR_W*SC/2, sprY-6);

          // Barra mini progress
          const bw=50,bh=3;
          const bx=sprX+SPR_W*SC/2-bw/2, by=LANE_Y+LANE_H-12;
          ctx.fillStyle='#FFFFFF15'; ctx.fillRect(bx,by,bw,bh);
          const barFill=bw*(p.progress/100);
          ctx.fillStyle=pal.bolt; ctx.fillRect(bx,by,barFill,bh);
          if(isMe){ctx.fillStyle=pal.bolt+'77';ctx.fillRect(bx-1,by-1,barFill+2,bh+2);}
        });

        // Render partículas
        parts.current=parts.current.filter(pt=>pt.life>0);
        parts.current.forEach(pt=>{
          pt.life-=0.06+Math.random()*0.04;
          pt.x+=pt.vx; pt.y+=pt.vy; pt.vy+=0.08;
          const a=Math.max(0,pt.life);
          ctx.globalAlpha=a;
          if(pt.type==='ring'){
            const r=(1-pt.life)*30;
            ctx.strokeStyle=pt.color; ctx.lineWidth=1.5;
            ctx.beginPath(); ctx.arc(pt.x,pt.y,r,0,Math.PI*2); ctx.stroke();
          } else {
            ctx.fillStyle=pt.color;
            ctx.fillRect(pt.x-pt.size/2,pt.y-pt.size/2,pt.size,pt.size);
          }
          ctx.globalAlpha=1;
        });

        // Vignette
        const vign=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.8);
        vign.addColorStop(0,'transparent'); vign.addColorStop(1,'rgba(0,0,0,0.5)');
        ctx.fillStyle=vign; ctx.fillRect(0,0,W,H);

      } catch {/* silencia crashes no canvas */}
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);

  return <canvas ref={ref} width={440} height={240}
    style={{width:'100%',maxWidth:440,imageRendering:'pixelated',display:'block',
      border:'none',boxShadow:'0 0 40px #FFE60011, 0 0 1px #FFE60044'}}
  />;
}

// ═══════════════════════════════════════════════════════════════
//  LOBBY PREVIEW (pista animada decorativa)
// ═══════════════════════════════════════════════════════════════
function LobbyPreview() {
  const ref=useRef<HTMLCanvasElement>(null);
  const raf=useRef(0);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width,H=canvas.height;
    let s=0,tick=0,fr=0;
    const px=[0.06,0.22,0.44,0.66];
    const loop=()=>{
      try{
        tick++;if(tick%8===0)fr^=1; s+=1.8;
        px.forEach((_,i)=>{px[i]+=0.003+i*0.0007;if(px[i]>1.1)px[i]=-0.1;});
        ctx.clearRect(0,0,W,H);
        drawBg(ctx,W,H,s,1);
        const SC=3,TRACK_TOP=H*0.44,LANE_H=(H*0.5)/4;
        px.forEach((p,i)=>{
          const pal=PALETTES[i];
          const sprX=p*W, sprY=TRACK_TOP+i*LANE_H+LANE_H*.1;
          for(let li=1;li<=4;li++){
            ctx.globalAlpha=0.5-li*0.1;
            ctx.fillStyle=pal.glow;
            ctx.fillRect(sprX-(15+li*8),sprY+li*SC,li*8,SC);
          }
          ctx.globalAlpha=1;
          drawHero(ctx,fr===0?F1:F2,sprX,sprY,SC,pal,true);
        });
      }catch{}
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);
  return <canvas ref={ref} width={440} height={160}
    style={{width:'100%',maxWidth:440,imageRendering:'pixelated',display:'block'}}/>;
}

// ═══════════════════════════════════════════════════════════════
//  MINI HERÓI (thumb animado)
// ═══════════════════════════════════════════════════════════════
function HeroThumb({palIdx=0,sc=3}:{palIdx?:number;sc?:number}) {
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
      drawHero(ctx,fr===0?F1:F2,0,0,sc,pal,true);
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[palIdx,sc]);
  return <canvas ref={ref} width={SPR_W*sc} height={SPR_H*sc} style={{imageRendering:'pixelated',display:'block'}}/>;
}

// ═══════════════════════════════════════════════════════════════
//  SHOWCASE LOGIN
// ═══════════════════════════════════════════════════════════════
function HeroShowcase() {
  const ref=useRef<HTMLCanvasElement>(null);
  const raf=useRef(0);
  useEffect(()=>{
    const canvas=ref.current; if(!canvas) return;
    const ctx=canvas.getContext('2d')!; ctx.imageSmoothingEnabled=false;
    const W=canvas.width,H=canvas.height;
    let tick=0,fr=0,s=0;
    const loop=()=>{
      tick++;if(tick%9===0)fr^=1;s+=0.5;
      ctx.clearRect(0,0,W,H);
      // Fundo minimal
      const g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,'#010115');g.addColorStop(1,'#0A0A20');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      // Linha de chão
      ctx.fillStyle='#FFE600';ctx.fillRect(0,H-14,W,2);
      const SC=5,spacing=W/4;
      PALETTES.forEach((pal,i)=>{
        const cx=spacing*i+spacing/2;
        try{
          const grd=ctx.createRadialGradient(cx,H*.6,2,cx,H*.6,36);
          grd.addColorStop(0,pal.glow+'55');grd.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=grd;ctx.fillRect(cx-40,0,80,H);
        }catch{}
        // Rastro
        for(let li=1;li<=3;li++){
          ctx.globalAlpha=0.4-li*0.12;
          ctx.fillStyle=pal.glow;
          ctx.fillRect(cx-SPR_W*SC/2-(li*12),H*.45+li*SC,li*10,SC*0.8);
        }
        ctx.globalAlpha=1;
        const sprX=cx-SPR_W*SC/2;
        drawHero(ctx,fr===0?F1:F2,sprX,Math.round(H*.1),SC,pal,true);
        ctx.font='bold 9px monospace';ctx.textAlign='center';
        ctx.fillStyle=pal.bolt;ctx.fillText(pal.name,cx,H-3);
      });
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);
  return <canvas ref={ref} width={360} height={SPR_H*5+22}
    style={{imageRendering:'pixelated',display:'block',margin:'0 auto'}}/>;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
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
  const [shake,   setShake]   = useState(false);
  const sock = useRef<any>(null);

  useEffect(()=>{try{const s=localStorage.getItem(SK);if(s){setUser(JSON.parse(s));setPhase('lobby');}}catch{}},[]);

  const save=(u:User)=>{localStorage.setItem(SK,JSON.stringify(u));setUser(u);setPhase('lobby');};

  const handleAuth=async(auth:any,name:string)=>{
    const{access_token:token,user:u}=auth;
    if(!token||!u?.id) throw new Error('Falha na autenticação');
    let profile=await sbProfile(u.id,token);
    if(!profile){await sbCreate(u.id,name,token);profile={id:u.id,display_name:name,coins:1000,wins:0,losses:0};}
    save({id:u.id,name:profile.display_name,coins:profile.coins,token,wins:profile.wins||0,losses:profile.losses||0});
  };

  const loginAnon=async()=>{
    setLoading(true);setError('');
    try{const d=await sbAnon();await handleAuth(d,`Flash_${d.user?.id?.slice(0,5)||'anon'}`);}
    catch(e:any){setError(e.message||'Erro');}
    setLoading(false);
  };
  const loginEmail=async()=>{
    if(!email||pass.length<6){setError('Email e senha (mín 6 chars) obrigatórios');return;}
    setLoading(true);setError('');
    try{let d:any;try{d=await sbLogin(email,pass);}catch{d=await sbSignup(email,pass);}await handleAuth(d,email.split('@')[0]);}
    catch(e:any){setError(e.message||'Erro');}
    setLoading(false);
  };
  const logout=()=>{localStorage.removeItem(SK);setUser(null);setPhase('login');sock.current?.disconnect();};
  const openRanking=async()=>{setPhase('ranking');setRanking(await sbRanking());};

  const joinQueue=useCallback(async()=>{
    if(!user)return;
    setPhase('queuing');
    const{io}=await import('socket.io-client');
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
    s.on('game:progress',({playerId,progress,clicks:cl}:any)=>{
      setPlayers(prev=>prev.map(p=>p.id===playerId?{...p,progress,clicks:cl}:p));
      if(playerId===user.id)setMyProg(progress);
    });
    s.on('game:finished',({result:r}:any)=>{
      const safe:Result={
        isWinner:!!r.isWinner,
        coinsChange:Number(r.coinsChange)||0,
        winnerName:String(r.winnerName||''),
        players:Array.isArray(r.players)?r.players.map((p:any)=>({...p})):[],
      };
      const updated={...user,coins:user.coins+safe.coinsChange};
      localStorage.setItem(SK,JSON.stringify(updated));
      setUser(updated);setResult(safe);setPhase('finished');
      setTimeout(async()=>{try{const p=await sbProfile(user.id,user.token);if(p){const u2={...updated,coins:p.coins,wins:p.wins||0,losses:p.losses||0};setUser(u2);localStorage.setItem(SK,JSON.stringify(u2));}}catch{}},2500);
    });
  },[user]);

  const triggerShake=useCallback(()=>{
    setShake(true);setTimeout(()=>setShake(false),300);
  },[]);

  const click=useCallback(()=>{
    if(!sock.current||phase!=='racing'||!user||!roomId)return;
    setPressed(true);setTimeout(()=>setPressed(false),55);
    setClicks(c=>c+1);
    if(clicks>0&&clicks%8===0)triggerShake();
    sock.current.emit('game:click',{roomId,userId:user.id});
  },[phase,user,roomId,clicks,triggerShake]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();click();}};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[click]);

  const again=()=>{sock.current?.disconnect();sock.current=null;setPhase('lobby');setPlayers([]);setMyProg(0);setResult(null);setRoomId('');setQPos(0);setClicks(0);};

  const myColorIdx=players.find(p=>p.id===user?.id)?.colorIdx??0;
  const myPal=PALETTES[myColorIdx%4];
  const myPos=(() => { const s=[...players].sort((a,b)=>b.progress-a.progress); return s.findIndex(p=>p.id===user?.id)+1; })();
  const posLabel=['1ST','2ND','3RD','4TH'][myPos-1]||`${myPos}`;

  // ── LOGIN ──────────────────────────────────────────────────────
  if(phase==='login')return(
    <div style={{...P}}>
      <div style={B}>
        <div style={{textAlign:'center',marginBottom:12}}>
          <div style={{fontSize:46,fontWeight:900,color:'#FFE600',
            textShadow:'0 0 20px #FFE600,0 0 40px #FFE60066,0 0 80px #FFE60022',
            letterSpacing:6,lineHeight:1}}>⚡ FLASH</div>
          <div style={{fontSize:22,fontWeight:900,color:'#fff',letterSpacing:8,marginTop:4}}>CLICK ARENA</div>
          <div style={{fontSize:9,color:'#444',marginTop:8,letterSpacing:4}}>MAY THE FASTEST FINGER WIN</div>
        </div>
        <HeroShowcase/>
        <div style={{height:16}}/>
        {!showEM?<>
          <button style={{...BY,fontSize:20,padding:'20px 0',letterSpacing:4,
            textShadow:'0 2px 4px rgba(0,0,0,0.5)'}} onClick={loginAnon} disabled={loading}>
            {loading?'CARREGANDO...':'⚡  JOGAR AGORA'}
          </button>
          <div style={{textAlign:'center',color:'#333',margin:'14px 0',fontSize:9,letterSpacing:3}}>───  OU  ───</div>
          <button style={BG} onClick={()=>setShowEM(true)}>LOGIN COM EMAIL</button>
        </>:<>
          <input style={IN} placeholder="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/>
          <input style={{...IN,marginTop:8}} placeholder="SENHA (mín 6 chars)" type="password" value={pass} onChange={e=>setPass(e.target.value)}/>
          <button style={{...BY,marginTop:12}} onClick={loginEmail} disabled={loading}>{loading?'...':'ENTRAR / CRIAR CONTA'}</button>
          <button style={{...BG,marginTop:8}} onClick={()=>setShowEM(false)}>← VOLTAR</button>
        </>}
        {error&&<div style={ER}>{error}</div>}
        <div style={{textAlign:'center',color:'#333',fontSize:9,marginTop:16,letterSpacing:2}}>
          🎁 <span style={{color:'#FFE600',fontWeight:700}}>1.000 ₵</span> de bônus ao entrar
        </div>
      </div>
    </div>
  );

  // ── LOBBY ──────────────────────────────────────────────────────
  if(phase==='lobby')return(
    <div style={{...P,justifyContent:'flex-start',paddingTop:0,paddingLeft:0,paddingRight:0}}>
      <div style={{...B,maxWidth:440}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px 10px'}}>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:'#FFE600',
              textShadow:'0 0 12px #FFE60077',letterSpacing:2}}>⚡ FLASH ARENA</div>
            <div style={{fontSize:9,color:'#555',letterSpacing:1}}>{user?.name}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#FFE600',fontWeight:900,fontSize:18,textShadow:'0 0 8px #FFE60055'}}>
              ₵ {user?.coins?.toLocaleString('pt-BR')}
            </div>
            <div style={{color:'#555',fontSize:9}}>🏆{user?.wins||0}W  💀{user?.losses||0}L</div>
            <button style={{fontSize:9,color:'#444',background:'none',border:'none',cursor:'pointer',padding:0,marginTop:2}} onClick={logout}>SAIR</button>
          </div>
        </div>

        {/* Pista animada */}
        <div style={{overflow:'hidden',borderTop:'2px solid #FFE60022',borderBottom:'2px solid #FFE60022',marginBottom:12}}>
          <LobbyPreview/>
        </div>

        <div style={{padding:'0 16px'}}>
          {/* Stats */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
            {[['ENTRADA',`${ENTRY_FEE}₵`,'#FFE600'],['PLAYERS','2–4','#00C2FF'],['CLIQUES','100','#00FF94']].map(([l,v,c])=>(
              <div key={l} style={{background:'#0D0D2B',border:`1px solid ${c}22`,borderRadius:4,padding:'10px 6px',textAlign:'center'}}>
                <div style={{color:c,fontWeight:900,fontSize:17,textShadow:`0 0 8px ${c}55`}}>{v}</div>
                <div style={{color:'#444',fontSize:8,marginTop:3,letterSpacing:2}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Pote */}
          <div style={{background:'#0D0D2B',border:'1px solid #00FF9422',borderRadius:4,padding:'10px 14px',
            marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:'#555',fontSize:10}}>4×{ENTRY_FEE}₵ = {4*ENTRY_FEE}₵</span>
            <span style={{color:'#00FF94',fontWeight:900,fontSize:13,textShadow:'0 0 8px #00FF9466'}}>
              PRÊMIO: {Math.floor(4*ENTRY_FEE*.9)}₵
            </span>
          </div>

          {(user?.coins??0)>=ENTRY_FEE
            ?<button style={{...BY,fontSize:24,padding:'20px 0',letterSpacing:4}} onClick={joinQueue}>⚡  JOGAR</button>
            :<div style={ER}>Coins insuficientes ({ENTRY_FEE}₵ necessários)</div>
          }
          <button style={{...BG,marginTop:10,fontSize:12}} onClick={openRanking}>🏆  RANKING GLOBAL</button>
        </div>
      </div>
    </div>
  );

  // ── RANKING ────────────────────────────────────────────────────
  if(phase==='ranking')return(
    <div style={P}>
      <div style={{...B,maxWidth:420}}>
        <div style={{textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:28,fontWeight:900,color:'#FFE600',textShadow:'0 0 20px #FFE60066'}}>🏆 RANKING</div>
          <div style={{fontSize:9,color:'#555',marginTop:4,letterSpacing:4}}>TOP VELOCISTAS</div>
        </div>
        {ranking.length===0
          ?<div style={{textAlign:'center',color:'#333',padding:48,fontSize:11,lineHeight:2.5}}>
            Ainda sem dados.<br/>Seja o primeiro a vencer!
          </div>
          :<div style={{display:'flex',flexDirection:'column',gap:6}}>
            {ranking.map((r:any,i:number)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,
                background:i===0?'#1A1400':'#0D0D2B',
                border:`1px solid ${i===0?'#FFE60055':'#1A1A3A'}`,borderRadius:4,padding:'10px 12px',
                boxShadow:i===0?'0 0 20px #FFE60011':undefined}}>
                <span style={{fontSize:18,width:24}}>{'🥇🥈🥉'[i]||`${i+1}`}</span>
                <HeroThumb palIdx={i%4} sc={3}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:i===0?'#FFE600':'#fff',fontSize:11,fontWeight:700,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.display_name}</div>
                  <div style={{color:'#555',fontSize:9,marginTop:2}}>W:{r.wins} L:{r.losses} WR:{r.win_rate}%</div>
                </div>
                <div style={{color:PALETTES[i%4].bolt,fontSize:12,fontWeight:900,textShadow:`0 0 8px ${PALETTES[i%4].glow}66`}}>
                  ₵{Number(r.coins||0).toLocaleString('pt-BR')}
                </div>
              </div>
            ))}
          </div>
        }
        <button style={{...BG,marginTop:20}} onClick={()=>setPhase('lobby')}>← VOLTAR</button>
      </div>
    </div>
  );

  // ── QUEUING ────────────────────────────────────────────────────
  if(phase==='queuing')return(
    <div style={{...P,gap:16,padding:0}}>
      <div style={{width:'100%',maxWidth:440,overflow:'hidden',borderBottom:'2px solid #FFE60022'}}>
        <LobbyPreview/>
      </div>
      <div style={{color:'#FFE600',fontSize:15,fontWeight:900,letterSpacing:3,
        textShadow:'0 0 20px #FFE600,0 0 40px #FFE60044',animation:'pulse 1s ease-in-out infinite'}}>
        BUSCANDO OPONENTES...
      </div>
      <div style={{color:'#555',fontSize:11,letterSpacing:2}}>Fila #{qpos||'—'}</div>
      <div style={{color:'#333',fontSize:9,textAlign:'center',maxWidth:240,lineHeight:2,letterSpacing:1}}>
        A partida inicia automaticamente<br/>com 2 ou mais jogadores
      </div>
      <button style={{...BG,maxWidth:200}} onClick={()=>{sock.current?.emit('queue:leave');sock.current?.disconnect();setPhase('lobby');}}>
        CANCELAR
      </button>
    </div>
  );

  // ── COUNTDOWN ──────────────────────────────────────────────────
  if(phase==='countdown')return(
    <div style={{...P,gap:16}}>
      <div style={{color:'#444',fontSize:9,letterSpacing:6}}>VELOCISTAS PRONTOS</div>
      <div style={{display:'flex',gap:20,justifyContent:'center',flexWrap:'wrap'}}>
        {players.map((p,i)=>(
          <div key={p.id} style={{textAlign:'center'}}>
            <HeroThumb palIdx={p.colorIdx%4} sc={5}/>
            <div style={{color:p.id===user?.id?PALETTES[p.colorIdx%4].bolt:'#444',
              fontSize:8,marginTop:6,letterSpacing:2,fontWeight:700}}>
              {p.name.slice(0,9).toUpperCase()}{p.id===user?.id?' ★':''}
            </div>
          </div>
        ))}
      </div>
      <div key={cd} style={{
        fontSize:cd<=1?88:104,fontWeight:900,
        color:cd===0?'#00FF94':cd===1?'#FFAA00':'#FFE600',
        textShadow:cd===0
          ?'0 0 40px #00FF94,0 0 80px #00FF9466,0 0 120px #00FF9422'
          :`0 0 40px #FFE600,0 0 80px #FFE60044`,
        lineHeight:1,marginTop:4,
        animation:'countIn 0.3s ease-out',
      }}>
        {cd===0?'VÁ!':cd}
      </div>
      <style>{`@keyframes countIn{from{transform:scale(1.6);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );

  // ── RACING ─────────────────────────────────────────────────────
  if(phase==='racing'){
    const shakeStyle=shake?{animation:'shake 0.3s ease-in-out'}:{};
    return(
      <div style={{minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',
        alignItems:'center',padding:'10px 0 16px',fontFamily:'system-ui,sans-serif',gap:8,
        overflow:'hidden',...shakeStyle}}>
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}`}</style>

        {/* HUD Superior — barra de progresso grande */}
        <div style={{width:'100%',maxWidth:440,padding:'0 12px',display:'flex',flexDirection:'column',gap:4}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{color:myPal.bolt,fontWeight:900,fontSize:22,
                textShadow:`0 0 12px ${myPal.glow}`}}>{Math.round(myProg)}%</span>
              <span style={{background:myPal.bolt,color:'#050510',fontSize:9,fontWeight:900,
                padding:'2px 6px',borderRadius:2}}>{posLabel}</span>
            </div>
            <span style={{color:'#333',fontSize:9,letterSpacing:2}}>⚡ {clicks} clicks</span>
          </div>
          {/* Barra de progresso principal */}
          <div style={{height:10,background:'#0D0D2B',borderRadius:2,overflow:'hidden',
            border:`1px solid ${myPal.bolt}33`,position:'relative'}}>
            <div style={{height:'100%',width:`${myProg}%`,
              background:`linear-gradient(90deg, ${myPal.dark}, ${myPal.bolt})`,
              transition:'width 80ms linear',boxShadow:`0 0 12px ${myPal.glow}`,
              borderRadius:2}}/>
            {/* Marcação de outros jogadores */}
            {players.filter(p=>p.id!==user?.id).map((p,i)=>(
              <div key={p.id} style={{position:'absolute',top:0,left:`${p.progress}%`,
                width:2,height:'100%',background:PALETTES[p.colorIdx%4].bolt+'AA'}}/>
            ))}
          </div>
          {/* Placar por jogador */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {[...players].sort((a,b)=>b.progress-a.progress).map((p,i)=>{
              const pal=PALETTES[p.colorIdx%4];
              const isMe=p.id===user?.id;
              return(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:4,
                  background:isMe?pal.bolt+'22':'#0D0D2B',
                  border:`1px solid ${isMe?pal.bolt+'55':'#1A1A3A'}`,
                  borderRadius:3,padding:'3px 7px'}}>
                  <span style={{fontSize:9,color:pal.bolt,fontWeight:900}}>
                    {['1ST','2ND','3RD','4TH'][i]}
                  </span>
                  <span style={{fontSize:9,color:isMe?'#fff':'#555'}}>
                    {p.name.slice(0,7)}{isMe?' ★':''}
                  </span>
                  <span style={{fontSize:9,color:pal.bolt,fontWeight:700}}>{Math.round(p.progress)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas da corrida */}
        <RaceCanvas players={players} myId={user?.id||''} phase={phase} onShake={triggerShake}/>

        {/* Botão CLICK */}
        <button
          onMouseDown={click}
          onTouchStart={e=>{e.preventDefault();click();}}
          style={{
            width:195,height:195,borderRadius:4,
            background:pressed
              ?`linear-gradient(135deg,${myPal.dark},${myPal.suit})`
              :`linear-gradient(135deg,${myPal.bolt},${myPal.suit})`,
            border:`3px solid ${pressed?myPal.dark:myPal.bolt}`,
            fontSize:22,fontWeight:900,color:pressed?myPal.bolt:'#050510',
            transform:pressed?'scale(0.86)':'scale(1)',
            transition:'transform 0.055s,box-shadow 0.055s,background 0.055s',
            boxShadow:pressed
              ?`0 0 8px ${myPal.glow}44,inset 0 2px 8px rgba(0,0,0,0.3)`
              :`0 0 30px ${myPal.glow}99,0 0 60px ${myPal.glow}33,0 4px 0 ${myPal.dark}`,
            cursor:'pointer',userSelect:'none',touchAction:'manipulation',
            letterSpacing:2,display:'flex',alignItems:'center',justifyContent:'center',
            flexDirection:'column',gap:4,
          } as any}
        >
          <span style={{fontSize:30}}>⚡</span>
          <span>CLICK!</span>
        </button>
        <div style={{color:'#222',fontSize:8,letterSpacing:4}}>ESPAÇO  /  ENTER</div>
      </div>
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────
  if(phase==='finished'&&result){
    const sorted=[...result.players].sort((a,b)=>b.progress-a.progress);
    return(
      <div style={{...P,padding:'16px 16px',gap:12}}>
        {/* Canvas de resultado */}
        <RaceCanvas players={players} myId={user?.id||''} phase="finished"/>

        {/* Badge resultado */}
        <div style={{textAlign:'center'}}>
          <div style={{
            fontSize:result.isWinner?42:30,fontWeight:900,
            color:result.isWinner?'#FFE600':'#FF2D55',
            textShadow:result.isWinner
              ?'0 0 30px #FFE600,0 0 60px #FFE60055,0 0 100px #FFE60022'
              :'0 0 30px #FF2D55,0 0 60px #FF2D5544',
            letterSpacing:2,lineHeight:1,
          }}>
            {result.isWinner?'⚡ VITÓRIA!':'💀 DERROTA'}
          </div>
          {!result.isWinner&&(
            <div style={{color:'#555',fontSize:10,marginTop:6}}>
              {result.winnerName} foi mais rápido!
            </div>
          )}
        </div>

        {/* Coins */}
        <div style={{
          background:'#0D0D2B',
          border:`2px solid ${result.isWinner?'#FFE60066':'#FF2D5544'}`,
          borderRadius:4,padding:'14px 20px',textAlign:'center',
          width:'100%',maxWidth:380,
          boxShadow:result.isWinner?'0 0 30px #FFE60011':undefined,
        }}>
          <div style={{color:'#444',fontSize:8,marginBottom:5,letterSpacing:4}}>
            {result.isWinner?'PRÊMIO GANHO':'ENTRADA PERDIDA'}
          </div>
          <div style={{color:result.isWinner?'#FFE600':'#FF2D55',fontSize:36,fontWeight:900,
            textShadow:`0 0 20px ${result.isWinner?'#FFE60066':'#FF2D5544'}`}}>
            {result.isWinner?'+':''}{result.coinsChange}₵
          </div>
          <div style={{color:'#444',fontSize:9,marginTop:6}}>
            SALDO: <span style={{color:'#FFE600',fontWeight:700}}>₵ {user?.coins?.toLocaleString('pt-BR')}</span>
          </div>
        </div>

        {/* Placar final */}
        <div style={{width:'100%',maxWidth:380}}>
          {sorted.map((p,i)=>{
            const pal=PALETTES[p.colorIdx%4];
            const isMe=p.id===user?.id;
            return(
              <div key={`r-${p.id}-${i}`} style={{
                display:'flex',alignItems:'center',gap:10,
                padding:'10px 0',borderBottom:'1px solid #111',
              }}>
                <span style={{fontSize:16,width:22}}>{'🥇🥈🥉4️⃣'[i]}</span>
                <HeroThumb palIdx={p.colorIdx%4} sc={3}/>
                <div style={{flex:1}}>
                  <div style={{color:isMe?'#fff':'#444',fontSize:11,fontWeight:isMe?700:400}}>
                    {p.name}{isMe?' ★':''}
                  </div>
                  <div style={{color:'#555',fontSize:9,marginTop:2}}>{p.clicks} clicks</div>
                </div>
                <div>
                  <div style={{color:pal.bolt,fontSize:12,fontWeight:900,textAlign:'right'}}>
                    {Math.round(p.progress)}%
                  </div>
                  {i===0&&<div style={{color:'#FFE600',fontSize:8,textAlign:'right'}}>VENCEDOR</div>}
                </div>
              </div>
            );
          })}
        </div>

        <button style={{...BY,fontSize:18,padding:'18px 0',maxWidth:380,width:'100%',letterSpacing:4}}
          onClick={again}>
          ⚡  JOGAR NOVAMENTE
        </button>
      </div>
    );
  }

  return<div style={P}><div style={{color:'#555',fontSize:12}}>Carregando...</div></div>;
}

// ═══════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════
const P:React.CSSProperties={
  minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',
  alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',
  padding:16,color:'#fff',
};
const B:React.CSSProperties={width:'100%',maxWidth:440,display:'flex',flexDirection:'column'};
const BY:React.CSSProperties={
  width:'100%',padding:'14px 0',background:'#FFE600',color:'#050510',
  border:'none',borderRadius:4,fontWeight:900,fontSize:16,cursor:'pointer',
  letterSpacing:2,boxShadow:'0 0 24px #FFE60066,0 0 48px #FFE60022,0 4px 0 #AA9900',
  userSelect:'none',touchAction:'manipulation',
};
const BG:React.CSSProperties={
  width:'100%',padding:'12px 0',background:'transparent',color:'#555',
  border:'1px solid #222',borderRadius:4,fontWeight:700,fontSize:12,
  cursor:'pointer',letterSpacing:2,userSelect:'none',
};
const IN:React.CSSProperties={
  width:'100%',padding:'12px 16px',background:'#0D0D2B',color:'#fff',
  border:'1px solid #222',borderRadius:4,fontSize:13,
  boxSizing:'border-box',outline:'none',
};
const ER:React.CSSProperties={
  background:'#FF2D5511',border:'1px solid #FF2D5533',borderRadius:4,
  padding:'10px 14px',color:'#FF2D55',fontSize:11,textAlign:'center',marginTop:8,
};
