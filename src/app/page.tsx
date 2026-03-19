'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Supabase chamado via fetch puro — sem nenhuma lib que quebre no build
const SB_URL  = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY  = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function sbFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SB_URL()}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY(),
      'Authorization': `Bearer ${SB_KEY()}`,
      ...((opts as any).headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function sbAuthAnon(): Promise<{ id: string; token: string } | null> {
  const r = await sbFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'x-ueno-client': 'supabase-js/2.0.0' },
  });
  if (!r.ok) return null;
  return { id: r.data.user?.id, token: r.data.access_token };
}

async function sbAuthEmail(email: string, password: string, signup = false): Promise<{ id: string; token: string } | null> {
  const path = signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
  const r = await sbFetch(path, { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!r.ok) return null;
  return { id: r.data.user?.id, token: r.data.access_token };
}

async function sbGetUser(userId: string, token: string) {
  const r = await sbFetch(`/rest/v1/users?id=eq.${userId}&select=id,display_name,coins`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.ok && r.data?.length > 0 ? r.data[0] : null;
}

async function sbCreateUser(userId: string, name: string, token: string) {
  await sbFetch('/rest/v1/users', {
    method: 'POST',
    body: JSON.stringify({ id: userId, display_name: name, coins: 1000, avatar_index: 0 }),
    headers: { Authorization: `Bearer ${token}`, Prefer: 'return=minimal' },
  });
  await sbFetch('/rest/v1/transactions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, amount: 1000, type: 'initial' }),
    headers: { Authorization: `Bearer ${token}`, Prefer: 'return=minimal' },
  });
}

// ─── TYPES ─────────────────────────────────────────────────────
type Phase = 'login' | 'lobby' | 'queuing' | 'countdown' | 'racing' | 'finished';
interface User   { id: string; name: string; coins: number; token: string; }
interface PState { id: string; name: string; progress: number; clicks: number; }
interface Result { isWinner: boolean; coinsChange: number; winnerName: string; players: PState[]; }

const ENTRY_FEE = 100;
const CLICKS    = 100;
const COLORS    = ['#FFE600','#00FF94','#00C2FF','#FF2D55'];

// ─── COMPONENT ─────────────────────────────────────────────────
export default function Home() {
  const [phase,      setPhase]      = useState<Phase>('login');
  const [user,       setUser]       = useState<User | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showEmail,  setShowEmail]  = useState(false);
  const [countdown,  setCountdown]  = useState(0);
  const [roomId,     setRoomId]     = useState('');
  const [players,    setPlayers]    = useState<PState[]>([]);
  const [myProg,     setMyProg]     = useState(0);
  const [result,     setResult]     = useState<Result | null>(null);
  const [queuePos,   setQueuePos]   = useState(0);
  const [pressed,    setPressed]    = useState(false);
  const sock = useRef<any>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem('fca_v3');
      if (s) { const u = JSON.parse(s); setUser(u); setPhase('lobby'); }
    } catch {}
  }, []);

  const save = (u: User) => {
    localStorage.setItem('fca_v3', JSON.stringify(u));
    setUser(u); setPhase('lobby');
  };

  const loginAnon = async () => {
    setLoading(true); setError('');
    try {
      const auth = await sbAuthAnon();
      if (!auth?.id) throw new Error('Erro no login anônimo. Verifique se Anonymous sign-ins está ativo no Supabase.');
      let profile = await sbGetUser(auth.id, auth.token);
      if (!profile) { await sbCreateUser(auth.id, `Player_${auth.id.slice(0,6)}`, auth.token); profile = { id: auth.id, display_name: `Player_${auth.id.slice(0,6)}`, coins: 1000 }; }
      save({ id: auth.id, name: profile.display_name, coins: profile.coins, token: auth.token });
    } catch(e: any) { setError(e.message); }
    setLoading(false);
  };

  const loginEmail = async () => {
    if (!email || password.length < 6) { setError('Email e senha (mín 6 chars) obrigatórios'); return; }
    setLoading(true); setError('');
    try {
      let auth = await sbAuthEmail(email, password, false);
      if (!auth?.id) auth = await sbAuthEmail(email, password, true);
      if (!auth?.id) throw new Error('Erro ao autenticar. Tente novamente.');
      let profile = await sbGetUser(auth.id, auth.token);
      if (!profile) { await sbCreateUser(auth.id, email.split('@')[0], auth.token); profile = { id: auth.id, display_name: email.split('@')[0], coins: 1000 }; }
      save({ id: auth.id, name: profile.display_name, coins: profile.coins, token: auth.token });
    } catch(e: any) { setError(e.message); }
    setLoading(false);
  };

  const logout = () => { localStorage.removeItem('fca_v3'); setUser(null); setPhase('login'); sock.current?.disconnect(); };

  const joinQueue = useCallback(async () => {
    if (!user) return;
    setPhase('queuing');
    const { io } = await import('socket.io-client');
    const s = io(window.location.origin, { path: '/api/socketio', transports: ['websocket','polling'] });
    sock.current = s;
    s.on('connect',        ()           => s.emit('queue:join', { userId: user.id, displayName: user.name, avatarIndex: 0 }));
    s.on('queue:position', ({position}: any) => setQueuePos(position));
    s.on('room:joined',    ({room}: any)     => { setRoomId(room.id); setPlayers(room.players.map((p: any) => ({ id: p.id, name: p.displayName, progress: 0, clicks: 0 }))); setPhase('countdown'); });
    s.on('game:countdown', ({count}: any)    => setCountdown(count));
    s.on('game:start',     ()                => { setPhase('racing'); setCountdown(0); });
    s.on('game:progress',  ({playerId, progress, clicks}: any) => { setPlayers(prev => prev.map(p => p.id === playerId ? {...p, progress, clicks} : p)); if (playerId === user.id) setMyProg(progress); });
    s.on('game:finished',  ({result: r}: any) => {
      setResult(r); setPhase('finished');
      const newCoins = user.coins + r.coinsChange;
      const updated = {...user, coins: newCoins};
      localStorage.setItem('fca_v3', JSON.stringify(updated));
      setUser(updated);
    });
  }, [user]);

  const click = useCallback(() => {
    if (!sock.current || phase !== 'racing' || !user || !roomId) return;
    setPressed(true); setTimeout(() => setPressed(false), 80);
    sock.current.emit('game:click', { roomId, userId: user.id });
  }, [phase, user, roomId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); click(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [click]);

  const again = () => { sock.current?.disconnect(); sock.current = null; setPhase('lobby'); setPlayers([]); setMyProg(0); setResult(null); setRoomId(''); setQueuePos(0); };

  // ─── TELAS ─────────────────────────────────────────────────────
  if (phase === 'login') return (
    <div style={P}>
      <div style={BOX}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:48,fontWeight:900,color:'#FFE600',textShadow:'0 0 30px #FFE600',letterSpacing:4}}>⚡ FLASH</div>
          <div style={{fontSize:28,fontWeight:900,color:'#fff',letterSpacing:6}}>CLICK ARENA</div>
          <div style={{fontSize:11,color:'#555',marginTop:8,letterSpacing:2}}>MAY THE FASTEST FINGER WIN</div>
        </div>
        {!showEmail ? <>
          <button style={{...BY,fontSize:18,padding:'18px 0'}} onClick={loginAnon} disabled={loading}>{loading?'ENTRANDO...':'⚡ JOGAR AGORA'}</button>
          <div style={{textAlign:'center',color:'#333',margin:'16px 0',fontSize:11}}>── OU ──</div>
          <button style={BG} onClick={()=>setShowEmail(true)}>LOGIN COM EMAIL</button>
        </> : <>
          <input style={IN} placeholder="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none" />
          <input style={{...IN,marginTop:8}} placeholder="SENHA (mín 6)" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button style={{...BY,marginTop:12}} onClick={loginEmail} disabled={loading}>{loading?'...':'ENTRAR / CRIAR CONTA'}</button>
          <button style={{...BG,marginTop:8}} onClick={()=>setShowEmail(false)}>← VOLTAR</button>
        </>}
        {error&&<div style={ER}>{error}</div>}
        <div style={{textAlign:'center',color:'#333',fontSize:11,marginTop:20}}>Ganhe <span style={{color:'#FFE600'}}>1.000 ₵</span> de bônus ao entrar</div>
      </div>
    </div>
  );

  if (phase === 'lobby') return (
    <div style={P}>
      <div style={BOX}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
          <div><div style={{fontSize:20,fontWeight:900,color:'#FFE600'}}>⚡ FLASH ARENA</div><div style={{fontSize:11,color:'#555'}}>{user?.name}</div></div>
          <div style={{textAlign:'right'}}>
            <div style={{color:'#FFE600',fontWeight:900,fontSize:16}}>₵ {user?.coins?.toLocaleString('pt-BR')}</div>
            <button style={{fontSize:10,color:'#444',background:'none',border:'none',cursor:'pointer'}} onClick={logout}>SAIR</button>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:16}}>
          {[['ENTRADA',`${ENTRY_FEE} ₵`,'#FFE600'],['PLAYERS','2–4','#00C2FF'],['CLICKS',`${CLICKS}`,'#00FF94']].map(([l,v,c])=>(
            <div key={l} style={{background:'#0D0D2B',border:'1px solid #1A1A3A',borderRadius:4,padding:12,textAlign:'center'}}>
              <div style={{color:c,fontWeight:900,fontSize:18}}>{v}</div>
              <div style={{color:'#444',fontSize:10,marginTop:4}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#0D0D2B',border:'1px solid #00FF9433',borderRadius:4,padding:12,textAlign:'center',marginBottom:16}}>
          <div style={{color:'#aaa',fontSize:12}}>4 players × {ENTRY_FEE}₵ = {4*ENTRY_FEE}₵</div>
          <div style={{color:'#00FF94',fontWeight:900,fontSize:14,marginTop:4}}>VENCEDOR: {Math.floor(4*ENTRY_FEE*0.9)}₵</div>
        </div>
        {(user?.coins??0)>=ENTRY_FEE
          ?<button style={{...BY,fontSize:22,padding:'20px 0'}} onClick={joinQueue}>⚡ JOGAR</button>
          :<div style={ER}>Coins insuficientes ({ENTRY_FEE}₵ necessários)</div>
        }
      </div>
    </div>
  );

  if (phase === 'queuing') return (
    <div style={{...P,gap:20}}>
      <div style={{fontSize:56}}>⚡</div>
      <div style={{color:'#FFE600',fontSize:18,fontWeight:900,letterSpacing:2}}>BUSCANDO OPONENTES...</div>
      <div style={{color:'#555',fontSize:13}}>Fila: #{queuePos||'—'}</div>
      <div style={{color:'#333',fontSize:11,textAlign:'center',maxWidth:260,lineHeight:1.6}}>Partida inicia com 2+ jogadores na fila</div>
      <button style={{...BG,maxWidth:200}} onClick={()=>{sock.current?.emit('queue:leave');sock.current?.disconnect();setPhase('lobby');}}>CANCELAR</button>
    </div>
  );

  if (phase === 'countdown') return (
    <div style={{...P,gap:14}}>
      <div style={{color:'#555',fontSize:11,letterSpacing:4}}>JOGADORES PRONTOS</div>
      {players.map((p,i)=><div key={p.id} style={{color:p.id===user?.id?'#fff':'#444',fontSize:13}}>{['🟡','🟢','🔵','🔴'][i]} {p.name}{p.id===user?.id?' (você)':''}</div>)}
      <div style={{fontSize:countdown<=1?80:96,fontWeight:900,color:countdown<=1?'#00FF94':'#FFE600',textShadow:`0 0 40px ${countdown<=1?'#00FF94':'#FFE600'}`,marginTop:16}}>
        {countdown===0?'VÁ!':countdown}
      </div>
    </div>
  );

  if (phase === 'racing') return (
    <div style={{minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'20px 16px 32px',fontFamily:'system-ui,sans-serif'}}>
      <div style={{width:'100%',maxWidth:400,display:'flex',flexDirection:'column',gap:10}}>
        {players.map((p,i)=>{
          const c=COLORS[i%4]; const isMe=p.id===user?.id;
          return(<div key={p.id}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:11,color:isMe?'#fff':'#444'}}>{p.name}{isMe?' ★':''}</span>
              <span style={{fontSize:11,color:c}}>{Math.round(p.progress)}%</span>
            </div>
            <div style={{height:16,background:'#0D0D2B',borderRadius:2,overflow:'hidden',border:`1px solid ${isMe?c+'44':'#111'}`}}>
              <div style={{height:'100%',width:`${p.progress}%`,background:c,transition:'width 80ms',boxShadow:isMe?`0 0 10px ${c}`:'none'}}/>
            </div>
          </div>);
        })}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div style={{color:'#FFE600',fontWeight:900,fontSize:32,textShadow:'0 0 20px #FFE600'}}>{Math.round(myProg)}%</div>
        <button onMouseDown={click} onTouchStart={(e)=>{e.preventDefault();click();}} style={{width:240,height:240,borderRadius:8,background:pressed?'#FFB300':'#FFE600',border:'4px solid #AA9900',fontSize:32,fontWeight:900,color:'#050510',transform:pressed?'scale(0.91)':'scale(1)',transition:'transform 0.07s,box-shadow 0.07s',boxShadow:pressed?'0 0 8px #FFE60044':'0 0 30px #FFE60099,0 0 60px #FFE60033',cursor:'pointer',userSelect:'none',touchAction:'manipulation'} as any}>⚡ CLICK!</button>
        <div style={{color:'#222',fontSize:10,letterSpacing:2}}>ESPAÇO / ENTER TAMBÉM</div>
      </div>
    </div>
  );

  if (phase==='finished'&&result) return (
    <div style={{...P,padding:'32px 16px',gap:20}}>
      <div style={{fontSize:56}}>{result.isWinner?'🏆':'💀'}</div>
      <div style={{fontSize:36,fontWeight:900,color:result.isWinner?'#FFE600':'#FF2D55',textShadow:`0 0 30px ${result.isWinner?'#FFE600':'#FF2D55'}`,letterSpacing:2}}>{result.isWinner?'VITÓRIA!':'DERROTA'}</div>
      <div style={{background:'#0D0D2B',border:`1px solid ${result.isWinner?'#FFE60044':'#FF2D5544'}`,borderRadius:4,padding:20,textAlign:'center',width:'100%',maxWidth:360}}>
        <div style={{color:'#444',fontSize:10,marginBottom:8,letterSpacing:2}}>{result.isWinner?'PRÊMIO':'PERDIDO'}</div>
        <div style={{color:result.isWinner?'#FFE600':'#FF2D55',fontSize:36,fontWeight:900}}>{result.isWinner?'+':''}{result.coinsChange}₵</div>
        <div style={{color:'#444',fontSize:11,marginTop:8}}>SALDO: <span style={{color:'#FFE600'}}>₵ {user?.coins?.toLocaleString('pt-BR')}</span></div>
      </div>
      <div style={{width:'100%',maxWidth:360}}>
        {result.players.map((p,i)=>(
          <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid #111'}}>
            <span style={{fontSize:18,width:28}}>{'🥇🥈🥉4️⃣'[i]}</span>
            <span style={{flex:1,color:p.id===user?.id?'#fff':'#444',fontSize:12}}>{p.name}{p.id===user?.id?' (você)':''}</span>
            <span style={{color:['#FFE600','#aaa','#cd7f32','#555'][i],fontSize:12,fontWeight:900}}>{p.progress}%</span>
          </div>
        ))}
      </div>
      <button style={{...BY,fontSize:18,padding:'18px 0',maxWidth:360,width:'100%'}} onClick={again}>⚡ JOGAR NOVAMENTE</button>
    </div>
  );

  return <div style={P}><div style={{color:'#555'}}>Carregando...</div></div>;
}

// ─── STYLES ────────────────────────────────────────────────────
const P:  React.CSSProperties = {minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:16,color:'#fff'};
const BOX:React.CSSProperties = {width:'100%',maxWidth:380,display:'flex',flexDirection:'column'};
const BY: React.CSSProperties = {width:'100%',padding:'14px 0',background:'#FFE600',color:'#050510',border:'none',borderRadius:4,fontWeight:900,fontSize:15,cursor:'pointer',letterSpacing:2,boxShadow:'0 0 20px #FFE60055',userSelect:'none',touchAction:'manipulation'};
const BG: React.CSSProperties = {width:'100%',padding:'12px 0',background:'transparent',color:'#555',border:'1px solid #222',borderRadius:4,fontWeight:700,fontSize:12,cursor:'pointer',letterSpacing:2,userSelect:'none'};
const IN: React.CSSProperties = {width:'100%',padding:'12px 16px',background:'#0D0D2B',color:'#fff',border:'1px solid #222',borderRadius:4,fontSize:13,boxSizing:'border-box',outline:'none'};
const ER: React.CSSProperties = {background:'#FF2D5511',border:'1px solid #FF2D5533',borderRadius:4,padding:'10px 14px',color:'#FF2D55',fontSize:11,textAlign:'center',marginTop:8};
