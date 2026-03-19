'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xnuneowwpzbadftaqozy.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudW5lb3d3cHpiYWRmdGFxb3p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzE3MjgsImV4cCI6MjA4OTQ0NzcyOH0.NP5ZZisvFNH3CRyc57yMatabEZnJvw6mK_FlNngP7y0';

// Chama o Supabase REST/Auth via fetch puro
async function sbFetch(path: string, opts: RequestInit = {}, token?: string) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY!,
      'Authorization': `Bearer ${token || SB_KEY}`,
      ...(opts.headers as any || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || `HTTP ${res.status}`);
  return data;
}

// Login anônimo — endpoint correto do Supabase GoTrue
async function anonLogin() {
  // Supabase anon usa POST /auth/v1/signup com is_anonymous: true
  return sbFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ is_anonymous: true }),
  });
}

async function emailSignin(email: string, password: string) {
  return sbFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function emailSignup(email: string, password: string) {
  return sbFetch('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function getProfile(userId: string, token: string) {
  const data = await sbFetch(`/rest/v1/users?id=eq.${userId}&select=id,display_name,coins`, {}, token);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function createProfile(userId: string, name: string, token: string) {
  await sbFetch('/rest/v1/users', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' } as any,
    body: JSON.stringify({ id: userId, display_name: name, coins: 1000, avatar_index: 0 }),
  }, token);
  await sbFetch('/rest/v1/transactions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' } as any,
    body: JSON.stringify({ user_id: userId, amount: 1000, type: 'initial' }),
  }, token);
}

// Types
type Phase = 'login' | 'lobby' | 'queuing' | 'countdown' | 'racing' | 'finished';
interface User   { id: string; name: string; coins: number; token: string; }
interface PState { id: string; name: string; progress: number; clicks: number; }
interface Result { isWinner: boolean; coinsChange: number; winnerName: string; players: PState[]; }

const ENTRY_FEE = 100;
const CLICKS    = 100;
const COLORS    = ['#FFE600','#00FF94','#00C2FF','#FF2D55'];
const SK        = 'fca_v4';

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
  const sock = useRef<any>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(SK); if (s) { setUser(JSON.parse(s)); setPhase('lobby'); } } catch {}
  }, []);

  const save = (u: User) => { localStorage.setItem(SK, JSON.stringify(u)); setUser(u); setPhase('lobby'); };

  const handleAuth = async (authData: any, defaultName: string) => {
    const token = authData.access_token;
    const userId = authData.user?.id;
    if (!token || !userId) throw new Error('Resposta inválida do servidor de autenticação');
    let profile = await getProfile(userId, token);
    if (!profile) {
      await createProfile(userId, defaultName, token);
      profile = { id: userId, display_name: defaultName, coins: 1000 };
    }
    save({ id: userId, name: profile.display_name, coins: profile.coins, token });
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

  const joinQueue = useCallback(async () => {
    if (!user) return;
    setPhase('queuing');
    const { io } = await import('socket.io-client');
    const s = io(window.location.origin, { path: '/api/socketio', transports: ['websocket','polling'] });
    sock.current = s;
    s.on('connect',        ()              => s.emit('queue:join', { userId: user.id, displayName: user.name, avatarIndex: 0 }));
    s.on('queue:position', ({position}: any) => setQPos(position));
    s.on('room:joined',    ({room}: any)   => { setRoomId(room.id); setPlayers(room.players.map((p: any) => ({ id: p.id, name: p.displayName, progress: 0, clicks: 0 }))); setPhase('countdown'); });
    s.on('game:countdown', ({count}: any)  => setCD(count));
    s.on('game:start',     ()              => { setPhase('racing'); setCD(0); });
    s.on('game:progress',  ({playerId, progress, clicks}: any) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? {...p, progress, clicks} : p));
      if (playerId === user.id) setMyProg(progress);
    });
    s.on('game:finished',  ({result: r}: any) => {
      setResult(r); setPhase('finished');
      const updated = {...user, coins: user.coins + r.coinsChange};
      localStorage.setItem(SK, JSON.stringify(updated)); setUser(updated);
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

  // LOGIN
  if (phase === 'login') return (
    <div style={P}>
      <div style={B}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:48,fontWeight:900,color:'#FFE600',textShadow:'0 0 30px #FFE600',letterSpacing:4}}>⚡ FLASH</div>
          <div style={{fontSize:28,fontWeight:900,color:'#fff',letterSpacing:6}}>CLICK ARENA</div>
          <div style={{fontSize:11,color:'#555',marginTop:8,letterSpacing:2}}>MAY THE FASTEST FINGER WIN</div>
        </div>
        {!showEmail ? <>
          <button style={{...BY,fontSize:18,padding:'18px 0'}} onClick={loginAnon} disabled={loading}>{loading?'ENTRANDO...':'⚡ JOGAR AGORA'}</button>
          <div style={{textAlign:'center',color:'#333',margin:'16px 0',fontSize:11}}>── OU ──</div>
          <button style={BG} onClick={()=>setSE(true)}>LOGIN COM EMAIL</button>
        </> : <>
          <input style={IN} placeholder="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} autoCapitalize="none"/>
          <input style={{...IN,marginTop:8}} placeholder="SENHA (mín 6)" type="password" value={password} onChange={e=>setPass(e.target.value)}/>
          <button style={{...BY,marginTop:12}} onClick={loginEmail} disabled={loading}>{loading?'...':'ENTRAR / CRIAR CONTA'}</button>
          <button style={{...BG,marginTop:8}} onClick={()=>setSE(false)}>← VOLTAR</button>
        </>}
        {error && <div style={ER}>{error}</div>}
        <div style={{textAlign:'center',color:'#333',fontSize:11,marginTop:20}}>Ganhe <span style={{color:'#FFE600'}}>1.000 ₵</span> de bônus ao entrar</div>
      </div>
    </div>
  );

  // LOBBY
  if (phase === 'lobby') return (
    <div style={P}>
      <div style={B}>
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
        <div style={{marginTop:20,background:'#0D0D2B',border:'1px solid #1A1A3A',borderRadius:4,padding:14}}>
          <div style={{color:'#333',fontSize:10,marginBottom:8,letterSpacing:2}}>COMO JOGAR</div>
          {['1. Clique JOGAR','2. Aguarde 2+ players','3. Clique o mais rápido possível','4. Primeiro a 100% vence!'].map(t=>(
            <div key={t} style={{color:'#444',fontSize:11,marginBottom:4}}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // QUEUING
  if (phase === 'queuing') return (
    <div style={{...P,gap:20}}>
      <div style={{fontSize:56}}>⚡</div>
      <div style={{color:'#FFE600',fontSize:18,fontWeight:900,letterSpacing:2}}>BUSCANDO OPONENTES...</div>
      <div style={{color:'#555',fontSize:13}}>Fila: #{qpos||'—'}</div>
      <div style={{color:'#333',fontSize:11,textAlign:'center',maxWidth:260,lineHeight:1.6}}>Partida inicia com 2+ jogadores na fila</div>
      <button style={{...BG,maxWidth:200}} onClick={()=>{sock.current?.emit('queue:leave');sock.current?.disconnect();setPhase('lobby');}}>CANCELAR</button>
    </div>
  );

  // COUNTDOWN
  if (phase === 'countdown') return (
    <div style={{...P,gap:14}}>
      <div style={{color:'#555',fontSize:11,letterSpacing:4}}>JOGADORES PRONTOS</div>
      {players.map((p,i)=><div key={p.id} style={{color:p.id===user?.id?'#fff':'#444',fontSize:13}}>{['🟡','🟢','🔵','🔴'][i]} {p.name}{p.id===user?.id?' (você)':''}</div>)}
      <div style={{fontSize:countdown<=1?80:96,fontWeight:900,color:countdown<=1?'#00FF94':'#FFE600',textShadow:`0 0 40px ${countdown<=1?'#00FF94':'#FFE600'}`,marginTop:16}}>
        {countdown===0?'VÁ!':countdown}
      </div>
    </div>
  );

  // RACING
  if (phase === 'racing') return (
    <div style={{minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',padding:'20px 16px 32px',fontFamily:'system-ui,sans-serif'}}>
      <div style={{width:'100%',maxWidth:400,display:'flex',flexDirection:'column',gap:10}}>
        {players.map((p,i)=>{const c=COLORS[i%4],isMe=p.id===user?.id;return(
          <div key={p.id}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:11,color:isMe?'#fff':'#444'}}>{p.name}{isMe?' ★':''}</span>
              <span style={{fontSize:11,color:c}}>{Math.round(p.progress)}%</span>
            </div>
            <div style={{height:16,background:'#0D0D2B',borderRadius:2,overflow:'hidden',border:`1px solid ${isMe?c+'44':'#111'}`}}>
              <div style={{height:'100%',width:`${p.progress}%`,background:c,transition:'width 80ms',boxShadow:isMe?`0 0 10px ${c}`:'none'}}/>
            </div>
          </div>
        );})}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div style={{color:'#FFE600',fontWeight:900,fontSize:32,textShadow:'0 0 20px #FFE600'}}>{Math.round(myProg)}%</div>
        <button onMouseDown={click} onTouchStart={(e)=>{e.preventDefault();click();}} style={{width:240,height:240,borderRadius:8,background:pressed?'#FFB300':'#FFE600',border:'4px solid #AA9900',fontSize:32,fontWeight:900,color:'#050510',transform:pressed?'scale(0.91)':'scale(1)',transition:'transform 0.07s,box-shadow 0.07s',boxShadow:pressed?'0 0 8px #FFE60044':'0 0 30px #FFE60099,0 0 60px #FFE60033',cursor:'pointer',userSelect:'none',touchAction:'manipulation'} as any}>⚡ CLICK!</button>
        <div style={{color:'#222',fontSize:10,letterSpacing:2}}>ESPAÇO / ENTER TAMBÉM</div>
      </div>
    </div>
  );

  // RESULT
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

const P: React.CSSProperties  = {minHeight:'100dvh',background:'#050510',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:'system-ui,sans-serif',padding:16,color:'#fff'};
const B: React.CSSProperties  = {width:'100%',maxWidth:380,display:'flex',flexDirection:'column'};
const BY: React.CSSProperties = {width:'100%',padding:'14px 0',background:'#FFE600',color:'#050510',border:'none',borderRadius:4,fontWeight:900,fontSize:15,cursor:'pointer',letterSpacing:2,boxShadow:'0 0 20px #FFE60055',userSelect:'none',touchAction:'manipulation'};
const BG: React.CSSProperties = {width:'100%',padding:'12px 0',background:'transparent',color:'#555',border:'1px solid #222',borderRadius:4,fontWeight:700,fontSize:12,cursor:'pointer',letterSpacing:2,userSelect:'none'};
const IN: React.CSSProperties = {width:'100%',padding:'12px 16px',background:'#0D0D2B',color:'#fff',border:'1px solid #222',borderRadius:4,fontSize:13,boxSizing:'border-box',outline:'none'};
const ER: React.CSSProperties = {background:'#FF2D5511',border:'1px solid #FF2D5533',borderRadius:4,padding:'10px 14px',color:'#FF2D55',fontSize:11,textAlign:'center',marginTop:8};
