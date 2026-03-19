'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const ENTRY_FEE     = 100;
const CLICKS_TO_WIN = 100;

type Phase = 'login' | 'lobby' | 'queuing' | 'countdown' | 'racing' | 'finished';
interface User { id: string; name: string; coins: number; }
interface PlayerState { id: string; name: string; progress: number; clicks: number; }
interface Result { winnerId: string; winnerName: string; isWinner: boolean; coinsChange: number; prize: number; players: PlayerState[]; }

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function Home() {
  const [phase, setPhase]           = useState<Phase>('login');
  const [user, setUser]             = useState<User | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showEmail, setShowEmail]   = useState(false);
  const [countdown, setCountdown]   = useState(0);
  const [roomId, setRoomId]         = useState('');
  const [players, setPlayers]       = useState<PlayerState[]>([]);
  const [myProgress, setMyProgress] = useState(0);
  const [result, setResult]         = useState<Result | null>(null);
  const [queuePos, setQueuePos]     = useState(0);
  const [isPressed, setIsPressed]   = useState(false);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('fca_user');
    if (stored) { try { setUser(JSON.parse(stored)); setPhase('lobby'); } catch {} }
  }, []);

  const saveUser = (u: User) => {
    localStorage.setItem('fca_user', JSON.stringify(u));
    setUser(u); setPhase('lobby');
  };

  const ensureProfile = async (userId: string, name: string): Promise<User> => {
    const sb = getSupabase();
    const { data } = await sb.from('users').select('id,display_name,coins').eq('id', userId).single();
    if (data) return { id: data.id, name: data.display_name, coins: data.coins };
    await sb.from('users').insert({ id: userId, display_name: name, coins: 1000, avatar_index: 0 });
    await sb.from('transactions').insert({ user_id: userId, amount: 1000, type: 'initial' });
    return { id: userId, name, coins: 1000 };
  };

  const loginAnon = async () => {
    setLoading(true); setError('');
    try {
      const sb = getSupabase();
      const { data, error: e } = await sb.auth.signInAnonymously();
      if (e) throw e;
      const id = data.user!.id;
      const profile = await ensureProfile(id, `Player_${id.slice(0,6)}`);
      saveUser(profile);
    } catch(e: any) { setError(e.message || 'Erro ao entrar. Tente novamente.'); }
    setLoading(false);
  };

  const loginEmail = async () => {
    if (!email || !password) return;
    setLoading(true); setError('');
    try {
      const sb = getSupabase();
      let id: string;
      const { data: ld, error: le } = await sb.auth.signInWithPassword({ email, password });
      if (!le && ld.user) { id = ld.user.id; }
      else {
        const { data: sd, error: se } = await sb.auth.signUp({ email, password });
        if (se) throw se;
        id = sd.user!.id;
      }
      const profile = await ensureProfile(id, email.split('@')[0]);
      saveUser(profile);
    } catch(e: any) { setError(e.message || 'Erro ao entrar.'); }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('fca_user');
    setUser(null); setPhase('login');
    socketRef.current?.disconnect();
  };

  const joinQueue = useCallback(async () => {
    if (!user) return;
    setPhase('queuing');
    const { io } = await import('socket.io-client');
    const SOCKET_URL = window.location.origin;
    const socket = io(SOCKET_URL, { path: '/api/socketio', transports: ['websocket','polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('queue:join', { userId: user.id, displayName: user.name, avatarIndex: 0 }));
    socket.on('queue:position', ({ position }: any) => setQueuePos(position));
    socket.on('room:joined', ({ room }: any) => {
      setRoomId(room.id);
      setPlayers(room.players.map((p: any) => ({ id: p.id, name: p.displayName, progress: 0, clicks: 0 })));
      setPhase('countdown');
    });
    socket.on('game:countdown', ({ count }: any) => setCountdown(count));
    socket.on('game:start', () => { setPhase('racing'); setCountdown(0); });
    socket.on('game:progress', ({ playerId, progress, clicks }: any) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, progress, clicks } : p));
      if (playerId === user.id) setMyProgress(progress);
    });
    socket.on('game:finished', ({ result: r }: any) => {
      setResult(r);
      setPhase('finished');
      const newCoins = user.coins + r.coinsChange;
      const updated = { ...user, coins: newCoins };
      localStorage.setItem('fca_user', JSON.stringify(updated));
      setUser(updated);
      setTimeout(async () => {
        const sb = getSupabase();
        const { data } = await sb.from('users').select('coins').eq('id', user.id).single();
        if (data) { const u2 = { ...updated, coins: data.coins }; setUser(u2); localStorage.setItem('fca_user', JSON.stringify(u2)); }
      }, 2000);
    });
  }, [user]);

  const sendClick = useCallback(() => {
    if (!socketRef.current || phase !== 'racing' || !user || !roomId) return;
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 80);
    socketRef.current.emit('game:click', { roomId, userId: user.id });
  }, [phase, user, roomId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); sendClick(); }};
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sendClick]);

  const playAgain = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setPhase('lobby'); setPlayers([]); setMyProgress(0); setResult(null); setRoomId(''); setQueuePos(0);
  };

  // LOGIN
  if (phase === 'login') return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#FFE600', textShadow: '0 0 30px #FFE600', letterSpacing: 4 }}>⚡ FLASH</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 6 }}>CLICK ARENA</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 8, letterSpacing: 2 }}>MAY THE FASTEST FINGER WIN</div>
        </div>
        {!showEmail ? (
          <>
            <button style={{ ...S.btnY, fontSize: 18, padding: '18px 0' }} onClick={loginAnon} disabled={loading}>{loading ? 'ENTRANDO...' : '⚡ JOGAR AGORA'}</button>
            <div style={{ textAlign: 'center', color: '#333', margin: '16px 0', fontSize: 11 }}>── OU ──</div>
            <button style={S.btnG} onClick={() => setShowEmail(true)}>LOGIN COM EMAIL</button>
          </>
        ) : (
          <>
            <input style={S.inp} placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" />
            <input style={{ ...S.inp, marginTop: 8 }} placeholder="SENHA (mín 6)" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button style={{ ...S.btnY, marginTop: 12 }} onClick={loginEmail} disabled={loading}>{loading ? '...' : 'ENTRAR / CRIAR CONTA'}</button>
            <button style={{ ...S.btnG, marginTop: 8 }} onClick={() => setShowEmail(false)}>← VOLTAR</button>
          </>
        )}
        {error && <div style={S.err}>{error}</div>}
        <div style={{ textAlign: 'center', color: '#333', fontSize: 11, marginTop: 20 }}>Ganhe <span style={{ color: '#FFE600' }}>1.000 ₵</span> de bônus ao entrar</div>
      </div>
    </div>
  );

  // LOBBY
  if (phase === 'lobby') return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#FFE600' }}>⚡ FLASH ARENA</div>
            <div style={{ fontSize: 11, color: '#555' }}>{user?.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#FFE600', fontWeight: 900, fontSize: 16 }}>₵ {user?.coins?.toLocaleString('pt-BR')}</div>
            <button style={{ fontSize: 10, color: '#444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={logout}>SAIR</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[['ENTRADA',`${ENTRY_FEE} ₵`,'#FFE600'],['JOGADORES','2–4','#00C2FF'],['CLIQUES',`${CLICKS_TO_WIN}`,'#00FF94']].map(([l,v,c]) => (
            <div key={l} style={{ background: '#0D0D2B', border: '1px solid #1A1A3A', borderRadius: 4, padding: 12, textAlign: 'center' }}>
              <div style={{ color: c, fontWeight: 900, fontSize: 18 }}>{v}</div>
              <div style={{ color: '#444', fontSize: 10, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#0D0D2B', border: '1px solid #00FF9433', borderRadius: 4, padding: 12, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ color: '#aaa', fontSize: 12 }}>4 jogadores × {ENTRY_FEE}₵ = {4*ENTRY_FEE}₵</div>
          <div style={{ color: '#00FF94', fontWeight: 900, fontSize: 14, marginTop: 4 }}>VENCEDOR LEVA: {Math.floor(4*ENTRY_FEE*0.9)}₵</div>
        </div>
        {(user?.coins ?? 0) >= ENTRY_FEE
          ? <button style={{ ...S.btnY, fontSize: 22, padding: '20px 0' }} onClick={joinQueue}>⚡ JOGAR</button>
          : <div style={S.err}>Coins insuficientes ({ENTRY_FEE}₵ necessários)</div>
        }
        <div style={{ marginTop: 20, background: '#0D0D2B', border: '1px solid #1A1A3A', borderRadius: 4, padding: 14 }}>
          <div style={{ color: '#444', fontSize: 10, marginBottom: 8, letterSpacing: 2 }}>COMO JOGAR</div>
          {['1. Clique em JOGAR','2. Aguarde 2+ jogadores','3. Clique o mais rápido possível','4. Primeiro a 100% vence!'].map(t => (
            <div key={t} style={{ color: '#555', fontSize: 11, marginBottom: 4 }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );

  // QUEUING
  if (phase === 'queuing') return (
    <div style={{ ...S.page, gap: 20 }}>
      <div style={{ fontSize: 56 }}>⚡</div>
      <div style={{ color: '#FFE600', fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>BUSCANDO OPONENTES...</div>
      <div style={{ color: '#555', fontSize: 13 }}>Posição na fila: #{queuePos || '—'}</div>
      <div style={{ color: '#333', fontSize: 11, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>A partida inicia automaticamente quando houver 2+ jogadores</div>
      <button style={{ ...S.btnG, maxWidth: 200 }} onClick={() => { socketRef.current?.emit('queue:leave'); socketRef.current?.disconnect(); setPhase('lobby'); }}>CANCELAR</button>
    </div>
  );

  // COUNTDOWN
  if (phase === 'countdown') return (
    <div style={{ ...S.page, gap: 16 }}>
      <div style={{ color: '#555', fontSize: 11, letterSpacing: 4 }}>JOGADORES PRONTOS</div>
      {players.map((p, i) => (
        <div key={p.id} style={{ color: p.id === user?.id ? '#fff' : '#444', fontSize: 13 }}>
          {['🟡','🟢','🔵','🔴'][i]} {p.name}{p.id === user?.id ? ' (você)' : ''}
        </div>
      ))}
      <div style={{ fontSize: countdown <= 1 ? 80 : 96, fontWeight: 900, color: countdown === 0 ? '#00FF94' : countdown === 1 ? '#00FF94' : '#FFE600', textShadow: `0 0 40px ${countdown <= 1 ? '#00FF94' : '#FFE600'}`, marginTop: 16 }}>
        {countdown === 0 ? 'VÁ!' : countdown}
      </div>
    </div>
  );

  // RACING
  if (phase === 'racing') return (
    <div style={{ minHeight: '100dvh', background: '#050510', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 32px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {players.map((p, i) => {
          const c = ['#FFE600','#00FF94','#00C2FF','#FF2D55'][i % 4];
          const isMe = p.id === user?.id;
          return (
            <div key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: isMe ? '#fff' : '#444' }}>{p.name}{isMe ? ' ★' : ''}</span>
                <span style={{ fontSize: 11, color: c }}>{Math.round(p.progress)}%</span>
              </div>
              <div style={{ height: 16, background: '#0D0D2B', borderRadius: 2, overflow: 'hidden', border: isMe ? `1px solid ${c}44` : '1px solid #111' }}>
                <div style={{ height: '100%', width: `${p.progress}%`, background: c, transition: 'width 80ms', boxShadow: isMe ? `0 0 10px ${c}` : 'none' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ color: '#FFE600', fontWeight: 900, fontSize: 32, textShadow: '0 0 20px #FFE600' }}>{Math.round(myProgress)}%</div>
        <button
          onMouseDown={sendClick}
          onTouchStart={(e) => { e.preventDefault(); sendClick(); }}
          style={{
            width: 240, height: 240, borderRadius: 8,
            background: isPressed ? '#FFB300' : '#FFE600',
            border: '4px solid #AA9900',
            fontSize: 32, fontWeight: 900, color: '#050510',
            transform: isPressed ? 'scale(0.91)' : 'scale(1)',
            transition: 'transform 0.07s, box-shadow 0.07s',
            boxShadow: isPressed ? '0 0 8px #FFE60044' : '0 0 30px #FFE60099, 0 0 60px #FFE60033',
            cursor: 'pointer', userSelect: 'none', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
          } as any}
        >⚡ CLICK!</button>
        <div style={{ color: '#222', fontSize: 10, letterSpacing: 2 }}>ESPAÇO / ENTER TAMBÉM FUNCIONAM</div>
      </div>
    </div>
  );

  // RESULT
  if (phase === 'finished' && result) return (
    <div style={{ ...S.page, padding: '32px 16px', gap: 20 }}>
      <div style={{ fontSize: 56 }}>{result.isWinner ? '🏆' : '💀'}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: result.isWinner ? '#FFE600' : '#FF2D55', textShadow: `0 0 30px ${result.isWinner ? '#FFE600' : '#FF2D55'}`, letterSpacing: 2 }}>
        {result.isWinner ? 'VITÓRIA!' : 'DERROTA'}
      </div>
      <div style={{ background: '#0D0D2B', border: `1px solid ${result.isWinner ? '#FFE60044' : '#FF2D5544'}`, borderRadius: 4, padding: 20, textAlign: 'center', width: '100%', maxWidth: 360 }}>
        <div style={{ color: '#444', fontSize: 10, marginBottom: 8, letterSpacing: 2 }}>{result.isWinner ? 'PRÊMIO GANHO' : 'ENTRADA PERDIDA'}</div>
        <div style={{ color: result.isWinner ? '#FFE600' : '#FF2D55', fontSize: 36, fontWeight: 900 }}>{result.isWinner ? '+' : ''}{result.coinsChange}₵</div>
        <div style={{ color: '#444', fontSize: 11, marginTop: 8 }}>SALDO: <span style={{ color: '#FFE600' }}>₵ {user?.coins?.toLocaleString('pt-BR')}</span></div>
      </div>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {result.players.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #111' }}>
            <span style={{ fontSize: 18, width: 28 }}>{'🥇🥈🥉4️⃣'[i]}</span>
            <span style={{ flex: 1, color: p.id === user?.id ? '#fff' : '#444', fontSize: 12 }}>{p.name}{p.id === user?.id ? ' (você)' : ''}</span>
            <span style={{ color: ['#FFE600','#aaa','#cd7f32','#555'][i], fontSize: 12, fontWeight: 900 }}>{p.progress}%</span>
          </div>
        ))}
      </div>
      <button style={{ ...S.btnY, fontSize: 18, padding: '18px 0', maxWidth: 360, width: '100%' }} onClick={playAgain}>⚡ JOGAR NOVAMENTE</button>
    </div>
  );

  return <div style={S.page}><div style={{ color: '#555' }}>Carregando...</div></div>;
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100dvh', background: '#050510', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: 16, color: '#fff' },
  box:  { width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column' },
  btnY: { width: '100%', padding: '14px 0', background: '#FFE600', color: '#050510', border: 'none', borderRadius: 4, fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: 2, boxShadow: '0 0 20px #FFE60055', userSelect: 'none', touchAction: 'manipulation' },
  btnG: { width: '100%', padding: '12px 0', background: 'transparent', color: '#555', border: '1px solid #222', borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 2, userSelect: 'none' },
  inp:  { width: '100%', padding: '12px 16px', background: '#0D0D2B', color: '#fff', border: '1px solid #222', borderRadius: 4, fontSize: 13, boxSizing: 'border-box', outline: 'none' },
  err:  { background: '#FF2D5511', border: '1px solid #FF2D5533', borderRadius: 4, padding: '10px 14px', color: '#FF2D55', fontSize: 11, textAlign: 'center', marginTop: 8 },
};
