'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── CONFIG ────────────────────────────────────────────────────
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xnuneowwpzbadftaqozy.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudW5lb3d3cHpiYWRmdGFxb3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzE3MjgsImV4cCI6MjA4OTQ0NzcyOH0.NP5ZZisvFNH3CRyc57yMatabEZnJvw6mK_FlNngP7y0';
const ENTRY_FEE = 100;
const COLORS = ['#FFE600','#00FF94','#00C2FF','#FF2D55'];
const SK = 'fca_v4';

// ─── PIXEL ART SPRITES ─────────────────────────────────────────
// Cada sprite é uma grade de pixels 8x10, . = transparente
// F1 e F2 = dois frames de animação de corrida

const SPRITE_F1 = [
  '..XXX...',
  '.XXXXX..',
  '..HHH...',
  '.HHHHH..',
  '..HHH...',
  '..CCC...',
  '.CCCCC..',
  '..C.C...',
  '.LL.LL..',
  '.SS.SS..',
];
const SPRITE_F2 = [
  '..XXX...',
  '.XXXXX..',
  '..HHH...',
  '.HHHHH..',
  '..HHH...',
  '..CCC...',
  '.CCCCC..',
  '...CC...',
  '..LL.LL.',
  '..SS.SS.',
];
const SPRITE_WIN = [
  '..XXX...',
  '.XXXXX..',
  '..HHH...',
  '.HHHHH..',
  '..HHH...',
  'XCCCCCX.',
  '.CCCCC..',
  '..CCC...',
  '..L.L...',
  '..S.S...',
];
const SPRITE_DEAD = [
  '........',
  '..XXX...',
  '.XXXXX..',
  '..HHH...',
  '.HHHHH..',
  '..HHH...',
  '.CCCCC..',
  'LLLLLLL.',
  '........',
  '........',
];

// Mapeia símbolo → cor relativa ao player
function getColor(sym: string, playerColor: string): string | null {
  if (!playerColor) return null;
  switch(sym) {
    case 'X': return playerColor;       // cabelo
    case 'H': return '#FFCC88';          // pele
    case 'C': return darken(playerColor, 40); // roupa
    case 'L': return '#334';             // calça
    case 'S': return '#111';             // sapato
    case '.': return null;
    default:  return null;
  }
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, ((n>>16)&0xff) - amount);
  const g = Math.max(0, ((n>>8)&0xff)  - amount);
  const b = Math.max(0, (n&0xff)        - amount);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Renderiza sprite no canvas
function drawSprite(
  ctx: CanvasRenderingContext2D,
  grid: string[],
  x: number, y: number,
  scale: number,
  color: string
) {
  if (!grid || !grid.length) return;
  grid.forEach((row, ry) => {
    [...row].forEach((sym, rx) => {
      const c = getColor(sym, color);
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
    });
  });
}

// Fundo de pista pixel art
function drawTrack(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number) {
  // Céu
  ctx.fillStyle = '#0A0A1A';
  ctx.fillRect(0, 0, w, h * 0.4);

  // Montanhas pixel ao fundo
  ctx.fillStyle = '#1A1A3A';
  const mts = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0];
  mts.forEach((mx, i) => {
    const bx = ((mx * w - scroll * 0.3) % (w + 60)) - 30;
    const bh = (i % 2 === 0 ? 0.22 : 0.16) * h;
    ctx.beginPath();
    ctx.moveTo(bx, h * 0.4);
    ctx.lineTo(bx + 30, h * 0.4 - bh);
    ctx.lineTo(bx + 60, h * 0.4);
    ctx.fill();
  });

  // Asfalto
  ctx.fillStyle = '#1C1C2E';
  ctx.fillRect(0, h * 0.4, w, h * 0.6);

  // Linha lateral superior
  ctx.fillStyle = '#FFE600';
  ctx.fillRect(0, h * 0.4, w, 3);

  // Linhas centrais tracejadas animadas
  ctx.fillStyle = '#FFFFFF33';
  for (let i = -1; i < Math.ceil(w / 80) + 1; i++) {
    const lx = ((i * 80) - (scroll % 80));
    ctx.fillRect(lx, h * 0.7 - 2, 48, 4);
  }

  // Linha lateral inferior
  ctx.fillStyle = '#FFE600';
  ctx.fillRect(0, h * 0.95, w, 3);

  // Calçada inferior
  ctx.fillStyle = '#2A2A4A';
  ctx.fillRect(0, h * 0.95, w, h * 0.05);

  // Estrelas no céu
  ctx.fillStyle = '#FFFFFF';
  [[0.05,0.05],[0.2,0.15],[0.35,0.08],[0.5,0.18],[0.65,0.06],[0.8,0.12],[0.92,0.2]].forEach(([sx,sy]) => {
    ctx.fillRect(sx*w, sy*h, 2, 2);
  });
}

// ─── SUPABASE FETCH ────────────────────────────────────────────
async function sbFetch(path: string, opts: RequestInit = {}, token?: string) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${token || SB_KEY}`,
      ...(opts.headers as any || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || `HTTP ${res.status}`);
  return data;
}

async function anonLogin() {
  return sbFetch('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ is_anonymous: true }) });
}
async function emailSignin(e: string, p: string) {
  return sbFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: e, password: p }) });
}
async function emailSignup(e: string, p: string) {
  return sbFetch('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: e, password: p }) });
}
async function getProfile(uid: string, tok: string) {
  const d = await sbFetch(`/rest/v1/users?id=eq.${uid}&select=id,display_name,coins,wins,losses`, {}, tok);
  return Array.isArray(d) && d.length > 0 ? d[0] : null;
}
async function createProfile(uid: string, name: string, tok: string) {
  await sbFetch('/rest/v1/users', { method: 'POST', headers: { Prefer: 'return=minimal' } as any, body: JSON.stringify({ id: uid, display_name: name, coins: 1000, avatar_index: 0 }) }, tok);
  await sbFetch('/rest/v1/transactions', { method: 'POST', headers: { Prefer: 'return=minimal' } as any, body: JSON.stringify({ user_id: uid, amount: 1000, type: 'initial' }) }, tok);
}
async function getRanking() {
  try {
    const d = await sbFetch('/rest/v1/ranking?select=display_name,wins,losses,coins,win_rate,position&order=position.asc&limit=10');
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

// ─── TYPES ─────────────────────────────────────────────────────
type Phase = 'login' | 'lobby' | 'ranking' | 'queuing' | 'countdown' | 'racing' | 'finished';
interface User   { id: string; name: string; coins: number; token: string; wins: number; losses: number; }
interface PState { id: string; name: string; progress: number; clicks: number; colorIdx: number; }
interface Result { isWinner: boolean; coinsChange: number; winnerName: string; players: PState[]; }
interface RankRow { display_name: string; wins: number; losses: number; coins: number; win_rate: number; position: number; }

// ─── RACE CANVAS ───────────────────────────────────────────────
function RaceCanvas({ players, myId, phase }: { players: PState[]; myId: string; phase: string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const scrollRef  = useRef(0);
  const frameRef   = useRef(0);
  const tickRef    = useRef(0);
  const rafRef     = useRef(0);
  const playersRef = useRef<PState[]>(players);
  const phaseRef   = useRef(phase);
  const myIdRef    = useRef(myId);

  // Atualiza refs sem reiniciar o loop de animação
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { myIdRef.current = myId; }, [myId]);

  // Loop de animação — só inicia UMA vez
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width;
    const H = canvas.height;
    const SCALE = 4;
    const TRACK_Y = H * 0.42;

    const animate = () => {
      const ps    = playersRef.current;
      const ph    = phaseRef.current;
      const me    = myIdRef.current;
      const LANE_H = (H * 0.52) / Math.max(ps.length, 1);

      tickRef.current++;
      if (tickRef.current % 8 === 0) frameRef.current ^= 1;

      const avgProg = ps.reduce((s, p) => s + p.progress, 0) / Math.max(ps.length, 1);
      if (ph === 'racing') scrollRef.current += 2 + avgProg * 0.04;

      ctx.clearRect(0, 0, W, H);
      drawTrack(ctx, W, H, scrollRef.current);

      const winnerId = ph === 'finished'
        ? [...ps].sort((a,b) => b.progress - a.progress)[0]?.id
        : null;

      ps.forEach((p, i) => {
        const laneY = TRACK_Y + i * LANE_H + LANE_H * 0.1;
        const isMe  = p.id === me;
        const color = COLORS[p.colorIdx % COLORS.length];
        const minX  = W * 0.05;
        const maxX  = W * 0.82;
        const sprX  = minX + (p.progress / 100) * (maxX - minX);

        ctx.fillStyle = `${color}33`;
        ctx.fillRect(sprX + SCALE, laneY + SCALE * 10, SCALE * 6, SCALE);

        const grid = ph === 'finished'
          ? (p.id === winnerId ? SPRITE_WIN : SPRITE_DEAD)
          : (frameRef.current === 0 ? SPRITE_F1 : SPRITE_F2);

        drawSprite(ctx, grid, sprX, laneY, SCALE, color);

        ctx.font = `bold ${isMe ? 11 : 9}px monospace`;
        ctx.fillStyle = isMe ? color : '#FFFFFF88';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.slice(0, 8), sprX + SCALE * 4, laneY - 4);

        const barW = 60, barH = 4;
        const barX = sprX - 22, barY = laneY + SCALE * 11 + 4;
        ctx.fillStyle = '#FFFFFF22';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barW * (p.progress / 100), barH);

        if (p.progress > 70) {
          ctx.fillStyle = '#FFFFFF44';
          ctx.fillRect(W * 0.88, TRACK_Y, 3, H * 0.52);
          ctx.font = '10px monospace';
          ctx.fillStyle = '#FFE600';
          ctx.textAlign = 'center';
          ctx.fillText('🏁', W * 0.89, TRACK_Y + H * 0.26);
        }
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // <-- array vazio: loop inicia só UMA vez

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={220}
      style={{ width: '100%', maxWidth: 400, imageRendering: 'pixelated', borderRadius: 4, border: '2px solid #1A1A3A' }}
    />
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────
export default function Home() {
  const [phase,    setPhase]    = useState<Phase>('login');
  const [user,     setUser]     = useState<User | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPass]     = useState('');
  const [showEmail,setSE]       = useState(false);
  const [countdown,setCD]       = useState(0);
  const [roomId,   setRoomId]   = useState('');
  const [players,  setPlayers]  = useState<PState[]>([]);
  const [myProg,   setMyProg]   = useState(0);
  const [result,   setResult]   = useState<Result | null>(null);
  const [qpos,     setQPos]     = useState(0);
  const [pressed,  setPressed]  = useState(false);
  const [ranking,  setRanking]  = useState<RankRow[]>([]);
  const sock = useRef<any>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(SK); if (s) { setUser(JSON.parse(s)); setPhase('lobby'); } } catch {}
  }, []);

  const save = (u: User) => { localStorage.setItem(SK, JSON.stringify(u)); setUser(u); setPhase('lobby'); };

  const handleAuth = async (authData: any, defaultName: string) => {
    const token = authData.access_token;
    const userId = authData.user?.id;
    if (!token || !userId) throw new Error('Falha na autenticação');
    let profile = await getProfile(userId, token);
    if (!profile) {
      await createProfile(userId, defaultName, token);
      profile = { id: userId, display_name: defaultName, coins: 1000, wins: 0, losses: 0 };
    }
    save({ id: userId, name: profile.display_name, coins: profile.coins, token, wins: profile.wins || 0, losses: profile.losses || 0 });
  };

  const loginAnon = async () => {
    setLoading(true); setError('');
    try {
      const data = await anonLogin();
      await handleAuth(data, `Player_${data.user?.id?.slice(0,6) || 'anon'}`);
    } catch(e: any) { setError(e.message || 'Erro desconhecido'); }
    setLoading(false);
  };

  const loginEmail = async () => {
    if (!email || password.length < 6) { setError('Email e senha (mín 6 chars) obrigatórios'); return; }
    setLoading(true); setError('');
    try {
      let data: any;
      try { data = await emailSignin(email, password); }
      catch { data = await emailSignup(email, password); }
      await handleAuth(data, email.split('@')[0]);
    } catch(e: any) { setError(e.message || 'Erro ao autenticar'); }
    setLoading(false);
  };

  const logout = () => { localStorage.removeItem(SK); setUser(null); setPhase('login'); sock.current?.disconnect(); };

  const openRanking = async () => {
    setPhase('ranking');
    const rows = await getRanking();
    setRanking(rows);
  };

  const joinQueue = useCallback(async () => {
    if (!user) return;
    setPhase('queuing');
    const { io } = await import('socket.io-client');
    const s = io(window.location.origin, { path: '/api/socketio', transports: ['websocket','polling'] });
    sock.current = s;
    s.on('connect', () => s.emit('queue:join', { userId: user.id, displayName: user.name, avatarIndex: 0 }));
    s.on('queue:position', ({ position }: any) => setQPos(position));
    s.on('room:joined', ({ room }: any) => {
      setRoomId(room.id);
      setPlayers(room.players.map((p: any, i: number) => ({ id: p.id, name: p.displayName, progress: 0, clicks: 0, colorIdx: i })));
      setPhase('countdown');
    });
    s.on('game:countdown', ({ count }: any) => setCD(count));
    s.on('game:start',     ()              => { setPhase('racing'); setCD(0); });
    s.on('game:progress',  ({ playerId, progress, clicks }: any) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, progress, clicks } : p));
      if (playerId === user.id) setMyProg(progress);
    });
    s.on('game:finished', ({ result: r }: any) => {
      setResult(r); setPhase('finished');
      const updated = { ...user, coins: user.coins + r.coinsChange };
      localStorage.setItem(SK, JSON.stringify(updated)); setUser(updated);
      // Revalida do banco em background
      setTimeout(async () => {
        try {
          const p = await getProfile(user.id, user.token);
          if (p) { const u2 = { ...updated, coins: p.coins, wins: p.wins || 0, losses: p.losses || 0 }; setUser(u2); localStorage.setItem(SK, JSON.stringify(u2)); }
        } catch {}
      }, 2000);
    });
  }, [user]);

  const click = useCallback(() => {
    if (!sock.current || phase !== 'racing' || !user || !roomId) return;
    setPressed(true); setTimeout(() => setPressed(false), 80);
    sock.current.emit('game:click', { roomId, userId: user.id });
  }, [phase, user, roomId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); click(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [click]);

  const again = () => {
    sock.current?.disconnect(); sock.current = null;
    setPhase('lobby'); setPlayers([]); setMyProg(0); setResult(null); setRoomId(''); setQPos(0);
  };

  // ── LOGIN ────────────────────────────────────────────────────
  if (phase === 'login') return (
    <div style={P}>
      <div style={B}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:48, fontWeight:900, color:'#FFE600', textShadow:'0 0 30px #FFE600', letterSpacing:4 }}>⚡ FLASH</div>
          <div style={{ fontSize:28, fontWeight:900, color:'#fff', letterSpacing:6 }}>CLICK ARENA</div>
          <div style={{ fontSize:11, color:'#555', marginTop:8, letterSpacing:2 }}>MAY THE FASTEST FINGER WIN</div>
        </div>
        {/* Mini preview pixel art na splash */}
        <div style={{ display:'flex', justifyContent:'center', gap:16, marginBottom:24 }}>
          {COLORS.map((c, i) => (
            <MiniSprite key={i} color={c} frame={i % 2} />
          ))}
        </div>
        {!showEmail ? <>
          <button style={{ ...BY, fontSize:18, padding:'18px 0' }} onClick={loginAnon} disabled={loading}>{loading ? 'ENTRANDO...' : '⚡ JOGAR AGORA'}</button>
          <div style={{ textAlign:'center', color:'#333', margin:'16px 0', fontSize:11 }}>── OU ──</div>
          <button style={BG} onClick={() => setSE(true)}>LOGIN COM EMAIL</button>
        </> : <>
          <input style={IN} placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" />
          <input style={{ ...IN, marginTop:8 }} placeholder="SENHA (mín 6)" type="password" value={password} onChange={e => setPass(e.target.value)} />
          <button style={{ ...BY, marginTop:12 }} onClick={loginEmail} disabled={loading}>{loading ? '...' : 'ENTRAR / CRIAR CONTA'}</button>
          <button style={{ ...BG, marginTop:8 }} onClick={() => setSE(false)}>← VOLTAR</button>
        </>}
        {error && <div style={ER}>{error}</div>}
        <div style={{ textAlign:'center', color:'#333', fontSize:11, marginTop:20 }}>Ganhe <span style={{ color:'#FFE600' }}>1.000 ₵</span> de bônus ao entrar</div>
      </div>
    </div>
  );

  // ── LOBBY ────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div style={P}>
      <div style={B}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:'#FFE600' }}>⚡ FLASH ARENA</div>
            <div style={{ fontSize:11, color:'#555' }}>{user?.name}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ color:'#FFE600', fontWeight:900, fontSize:16 }}>₵ {user?.coins?.toLocaleString('pt-BR')}</div>
            <div style={{ color:'#555', fontSize:10 }}>🏆 {user?.wins || 0}W  💀 {user?.losses || 0}L</div>
            <button style={{ fontSize:10, color:'#444', background:'none', border:'none', cursor:'pointer' }} onClick={logout}>SAIR</button>
          </div>
        </div>

        {/* Preview dos personagens correndo */}
        <div style={{ background:'#0A0A1A', border:'2px solid #1A1A3A', borderRadius:4, overflow:'hidden', marginBottom:16 }}>
          <RunnerPreview />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
          {[['ENTRADA',`${ENTRY_FEE} ₵`,'#FFE600'],['PLAYERS','2–4','#00C2FF'],['CLICKS','100','#00FF94']].map(([l,v,c]) => (
            <div key={l} style={{ background:'#0D0D2B', border:'1px solid #1A1A3A', borderRadius:4, padding:10, textAlign:'center' }}>
              <div style={{ color:c, fontWeight:900, fontSize:16 }}>{v}</div>
              <div style={{ color:'#444', fontSize:10, marginTop:4 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#0D0D2B', border:'1px solid #00FF9433', borderRadius:4, padding:10, textAlign:'center', marginBottom:12 }}>
          <div style={{ color:'#aaa', fontSize:11 }}>4 players × {ENTRY_FEE}₵ = {4*ENTRY_FEE}₵</div>
          <div style={{ color:'#00FF94', fontWeight:900, marginTop:4 }}>VENCEDOR: {Math.floor(4*ENTRY_FEE*0.9)}₵</div>
        </div>

        {(user?.coins ?? 0) >= ENTRY_FEE
          ? <button style={{ ...BY, fontSize:22, padding:'18px 0' }} onClick={joinQueue}>⚡ JOGAR</button>
          : <div style={ER}>Coins insuficientes ({ENTRY_FEE}₵ necessários)</div>
        }

        <button style={{ ...BG, marginTop:10 }} onClick={openRanking}>🏆 VER RANKING</button>
      </div>
    </div>
  );

  // ── RANKING ──────────────────────────────────────────────────
  if (phase === 'ranking') return (
    <div style={P}>
      <div style={B}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:24, fontWeight:900, color:'#FFE600' }}>🏆 RANKING GLOBAL</div>
          <div style={{ fontSize:11, color:'#555', marginTop:4 }}>TOP JOGADORES</div>
        </div>
        {ranking.length === 0 ? (
          <div style={{ textAlign:'center', color:'#444', padding:40, fontSize:12 }}>Nenhum jogador ainda.<br/>Seja o primeiro a vencer!</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {ranking.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'#0D0D2B', border:`1px solid ${i === 0 ? '#FFE60044' : '#1A1A3A'}`, borderRadius:4, padding:'10px 12px' }}>
                <span style={{ fontSize:20, width:28 }}>{'🥇🥈🥉'[i] || `${i+1}.`}</span>
                <MiniSprite color={COLORS[i % 4]} frame={0} />
                <div style={{ flex:1 }}>
                  <div style={{ color: i === 0 ? '#FFE600' : '#fff', fontSize:12, fontWeight:700 }}>{r.display_name}</div>
                  <div style={{ color:'#555', fontSize:10 }}>W:{r.wins} L:{r.losses} WR:{r.win_rate}%</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color:'#FFE600', fontSize:12, fontWeight:900 }}>₵{r.coins?.toLocaleString('pt-BR')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <button style={{ ...BG, marginTop:20 }} onClick={() => setPhase('lobby')}>← VOLTAR</button>
      </div>
    </div>
  );

  // ── QUEUING ──────────────────────────────────────────────────
  if (phase === 'queuing') return (
    <div style={{ ...P, gap:20 }}>
      <RunnerPreview compact />
      <div style={{ color:'#FFE600', fontSize:18, fontWeight:900, letterSpacing:2 }}>BUSCANDO OPONENTES...</div>
      <div style={{ color:'#555', fontSize:13 }}>Fila: #{qpos || '—'}</div>
      <div style={{ color:'#333', fontSize:11, textAlign:'center', maxWidth:260, lineHeight:1.6 }}>Partida inicia com 2+ jogadores</div>
      <button style={{ ...BG, maxWidth:200 }} onClick={() => { sock.current?.emit('queue:leave'); sock.current?.disconnect(); setPhase('lobby'); }}>CANCELAR</button>
    </div>
  );

  // ── COUNTDOWN ────────────────────────────────────────────────
  if (phase === 'countdown') return (
    <div style={{ ...P, gap:14 }}>
      <div style={{ color:'#555', fontSize:11, letterSpacing:4 }}>JOGADORES PRONTOS</div>
      <div style={{ display:'flex', gap:16, justifyContent:'center' }}>
        {players.map((p, i) => (
          <div key={p.id} style={{ textAlign:'center' }}>
            <MiniSprite color={COLORS[i % 4]} frame={0} scale={5} />
            <div style={{ color: p.id === user?.id ? COLORS[i%4] : '#444', fontSize:9, marginTop:4 }}>
              {p.name.slice(0,8)}{p.id === user?.id ? ' ★' : ''}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:countdown<=1?80:96, fontWeight:900, color:countdown<=1?'#00FF94':'#FFE600', textShadow:`0 0 40px ${countdown<=1?'#00FF94':'#FFE600'}`, marginTop:8, lineHeight:1 }}>
        {countdown === 0 ? 'VÁ!' : countdown}
      </div>
    </div>
  );

  // ── RACING ───────────────────────────────────────────────────
  if (phase === 'racing') return (
    <div style={{ minHeight:'100dvh', background:'#050510', display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 16px 24px', fontFamily:'system-ui,sans-serif', gap:12 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth:400 }}>
        <span style={{ color:'#555', fontSize:11 }}>⚡ FLASH ARENA</span>
        <span style={{ color:'#FFE600', fontWeight:900, fontSize:14 }}>{Math.round(myProg)}%</span>
      </div>

      {/* CANVAS da corrida */}
      <RaceCanvas players={players} myId={user?.id || ''} phase={phase} />

      {/* Placar lateral */}
      <div style={{ width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:6 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, background:COLORS[p.colorIdx%4], borderRadius:1 }} />
            <span style={{ fontSize:10, color: p.id === user?.id ? '#fff' : '#555', flex:1 }}>{p.name.slice(0,10)}{p.id === user?.id ? ' ★':''}</span>
            <div style={{ width:80, height:6, background:'#0D0D2B', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${p.progress}%`, background:COLORS[p.colorIdx%4], transition:'width 80ms', boxShadow:`0 0 4px ${COLORS[p.colorIdx%4]}` }} />
            </div>
            <span style={{ fontSize:10, color:COLORS[p.colorIdx%4], width:28, textAlign:'right' }}>{Math.round(p.progress)}%</span>
          </div>
        ))}
      </div>

      {/* Botão click */}
      <button
        onMouseDown={click}
        onTouchStart={e => { e.preventDefault(); click(); }}
        style={{ width:220, height:220, borderRadius:8, background:pressed?'#FFB300':'#FFE600', border:'4px solid #AA9900', fontSize:28, fontWeight:900, color:'#050510', transform:pressed?'scale(0.91)':'scale(1)', transition:'transform 0.07s,box-shadow 0.07s', boxShadow:pressed?'0 0 8px #FFE60044':'0 0 30px #FFE60099,0 0 60px #FFE60033', cursor:'pointer', userSelect:'none', touchAction:'manipulation' } as any}
      >⚡ CLICK!</button>
      <div style={{ color:'#222', fontSize:10, letterSpacing:2 }}>ESPAÇO / ENTER TAMBÉM</div>
    </div>
  );

  // ── RESULT ───────────────────────────────────────────────────
  if (phase === 'finished' && result) {
    const sortedByProgress = [...players].sort((a,b) => b.progress - a.progress);
    const winner = sortedByProgress[0];
    return (
      <div style={{ ...P, padding:'24px 16px', gap:16 }}>
        {/* Canvas de resultado */}
        <RaceCanvas players={players} myId={user?.id || ''} phase="finished" />

        <div style={{ fontSize:result.isWinner?40:32, fontWeight:900, color:result.isWinner?'#FFE600':'#FF2D55', textShadow:`0 0 30px ${result.isWinner?'#FFE600':'#FF2D55'}`, letterSpacing:2, textAlign:'center' }}>
          {result.isWinner ? '🏆 VITÓRIA!' : '💀 DERROTA'}
        </div>

        {!result.isWinner && (
          <div style={{ color:'#aaa', fontSize:12, textAlign:'center' }}>
            {result.winnerName} foi o mais rápido!
          </div>
        )}

        <div style={{ background:'#0D0D2B', border:`1px solid ${result.isWinner?'#FFE60044':'#FF2D5544'}`, borderRadius:4, padding:16, textAlign:'center', width:'100%', maxWidth:360 }}>
          <div style={{ color:'#444', fontSize:10, marginBottom:6, letterSpacing:2 }}>{result.isWinner?'PRÊMIO GANHO':'ENTRADA PERDIDA'}</div>
          <div style={{ color:result.isWinner?'#FFE600':'#FF2D55', fontSize:32, fontWeight:900 }}>{result.isWinner?'+':''}{result.coinsChange}₵</div>
          <div style={{ color:'#444', fontSize:11, marginTop:6 }}>SALDO: <span style={{ color:'#FFE600' }}>₵ {user?.coins?.toLocaleString('pt-BR')}</span></div>
        </div>

        <div style={{ width:'100%', maxWidth:360 }}>
          {[...result.players].sort((a,b)=>b.progress-a.progress).map((p, i) => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid #111' }}>
              <span style={{ fontSize:16, width:24 }}>{'🥇🥈🥉4️⃣'[i]}</span>
              <MiniSprite color={COLORS[p.colorIdx%4]} frame={0} />
              <span style={{ flex:1, color:p.id===user?.id?'#fff':'#444', fontSize:11 }}>{p.name}{p.id===user?.id?' ★':''}</span>
              <span style={{ color:COLORS[p.colorIdx%4], fontSize:11, fontWeight:900 }}>{Math.round(p.progress)}%</span>
            </div>
          ))}
        </div>

        <button style={{ ...BY, fontSize:18, padding:'16px 0', maxWidth:360, width:'100%' }} onClick={again}>⚡ JOGAR NOVAMENTE</button>
      </div>
    );
  }

  return <div style={P}><div style={{ color:'#555' }}>Carregando...</div></div>;
}

// ─── MINI SPRITE COMPONENT ─────────────────────────────────────
function MiniSprite({ color, frame, scale = 3 }: { color: string; frame: number; scale?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSprite(ctx, frame === 0 ? SPRITE_F1 : SPRITE_F2, 0, 0, scale, color);
  }, [color, frame, scale]);
  return <canvas ref={canvasRef} width={8*scale} height={10*scale} style={{ imageRendering:'pixelated' }} />;
}

// ─── RUNNER PREVIEW ────────────────────────────────────────────
function RunnerPreview({ compact }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tickRef   = useRef(0);
  const frameRef  = useRef(0);
  const posRef    = useRef([0.1, 0.25, 0.45, 0.65]);
  const rafRef    = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const W = canvas.width, H = canvas.height;
    let scroll = 0;

    const animate = () => {
      tickRef.current++;
      if (tickRef.current % 6 === 0) frameRef.current ^= 1;
      scroll += 1.5;
      posRef.current = posRef.current.map(p => p > 1.1 ? -0.1 : p + 0.004);

      ctx.clearRect(0, 0, W, H);
      drawTrack(ctx, W, H, scroll);

      posRef.current.forEach((pos, i) => {
        const x = pos * W;
        const y = H * 0.45;
        drawSprite(ctx, frameRef.current === 0 ? SPRITE_F1 : SPRITE_F2, x, y, 3, COLORS[i]);
      });

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const h = compact ? 80 : 120;
  return (
    <canvas
      ref={canvasRef}
      width={400} height={h}
      style={{ width:'100%', maxWidth:400, imageRendering:'pixelated' }}
    />
  );
}

// ─── STYLES ────────────────────────────────────────────────────
const P: React.CSSProperties  = { minHeight:'100dvh', background:'#050510', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif', padding:16, color:'#fff' };
const B: React.CSSProperties  = { width:'100%', maxWidth:400, display:'flex', flexDirection:'column' };
const BY: React.CSSProperties = { width:'100%', padding:'14px 0', background:'#FFE600', color:'#050510', border:'none', borderRadius:4, fontWeight:900, fontSize:15, cursor:'pointer', letterSpacing:2, boxShadow:'0 0 20px #FFE60055', userSelect:'none', touchAction:'manipulation' };
const BG: React.CSSProperties = { width:'100%', padding:'12px 0', background:'transparent', color:'#555', border:'1px solid #222', borderRadius:4, fontWeight:700, fontSize:12, cursor:'pointer', letterSpacing:2, userSelect:'none' };
const IN: React.CSSProperties = { width:'100%', padding:'12px 16px', background:'#0D0D2B', color:'#fff', border:'1px solid #222', borderRadius:4, fontSize:13, boxSizing:'border-box', outline:'none' };
const ER: React.CSSProperties = { background:'#FF2D5511', border:'1px solid #FF2D5533', borderRadius:4, padding:'10px 14px', color:'#FF2D55', fontSize:11, textAlign:'center', marginTop:8 };
