import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGame } from '../context/GameContext';
import GlassPanel from '../components/GlassPanel';
import Button from '../components/Button';
import Input from '../components/Input';
import { Users, Tv } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, error: gameError, clearGame, clearReactState } = useGame();

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ playerId: string; roomCode: string } | null>(() => {
    const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
    const storedRoomCode = localStorage.getItem('crazyhotel_room_code');
    if (storedPlayerId && storedRoomCode) {
      return { playerId: storedPlayerId, roomCode: storedRoomCode };
    }
    return null;
  });

  // Limpa o estado local de memória mas preserva o localStorage
  React.useEffect(() => {
    clearReactState();
  }, [clearReactState]);

  const handleReconnect = () => {
    if (activeSession) {
      navigate({ to: '/play/$roomCode', params: { roomCode: activeSession.roomCode } });
    }
  };

  const handleAbandonSession = async () => {
    await clearGame();
    setActiveSession(null);
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setValidationError(null);
    try {
      const code = await createRoom();
      navigate({ to: '/host/$roomCode', params: { roomCode: code } });
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const code = roomCodeInput.trim().toUpperCase();
    const name = playerNameInput.trim();

    if (code.length !== 4) {
      setValidationError('O código da sala deve ter exatamente 4 letras.');
      return;
    }

    if (!name) {
      setValidationError('Por favor, digite seu nome.');
      return;
    }

    if (name.length > 15) {
      setValidationError('O nome deve ter no máximo 15 caracteres.');
      return;
    }

    setIsJoining(true);
    try {
      await joinRoom(code, name);
      navigate({ to: '/play/$roomCode', params: { roomCode: code } });
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="home-container animate-float" style={{ padding: '2rem 1rem' }}>
      <div style={{ height: '140px', marginBottom: '1.5rem' }} />

      {activeSession && (
        <GlassPanel
          style={{
            marginBottom: '2rem',
            border: '1px solid rgba(var(--accent-rgb), 0.3)',
            background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.15) 0%, rgba(var(--color-guest-rgb), 0.05) 100%)',
            padding: '1.25rem',
            borderRadius: '1rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontWeight: 'bold', color: 'var(--accent-light)', fontSize: '1.1rem' }}>
              Você tem uma partida em andamento!
            </div>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Identificamos uma conexão active na sala <strong style={{ color: '#fff', fontSize: '1.1rem', letterSpacing: '0.05em' }}>{activeSession.roomCode}</strong>.
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '0.25rem' }}>
              <Button onClick={handleReconnect} style={{ flex: 2 }}>
                Reconectar à Sala
              </Button>
              <Button onClick={handleAbandonSession} variant="secondary" style={{ flex: 1, border: '1px solid rgba(var(--color-thief-rgb), 0.4)', color: 'var(--color-thief)' }}>
                Abandonar
              </Button>
            </div>
          </div>
        </GlassPanel>
      )}

      <div className="home-grid">
        <GlassPanel hoverable>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Users size={24} /> Entrar no Jogo
          </h2>
          <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <Input
                type="text"
                placeholder="CÓDIGO DA SALA (4 LETRAS)"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.slice(0, 4).toUpperCase())}
                maxLength={4}
                disabled={isJoining || isCreating}
                style={{ letterSpacing: '0.2em', fontWeight: 'bold' }}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="SEU APELIDO"
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value.slice(0, 15))}
                maxLength={15}
                disabled={isJoining || isCreating}
              />
            </div>

            {(validationError || gameError) && (
              <div style={{
                background: 'rgba(var(--color-thief-rgb), 0.1)',
                border: '1px solid rgba(var(--color-thief-rgb), 0.3)',
                color: 'var(--color-thief)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.95rem'
              }}>
                {validationError || gameError}
              </div>
            )}

            <Button type="submit" loading={isJoining} disabled={isCreating}>
              Entrar na Sala
            </Button>
          </form>
        </GlassPanel>

        <div className="home-divider">
          <div className="home-divider-line" />
          <span className="home-divider-text">OU</span>
          <div className="home-divider-line" />
        </div>

        <GlassPanel hoverable style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', height: '100%', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.95rem' }}>
              Vai transmitir o jogo na TV ou projetor? Crie uma sala nova abaixo.
            </div>
            <Button
              variant="secondary"
              onClick={handleCreateRoom}
              loading={isCreating}
              disabled={isJoining}
              style={{ gap: '0.5rem', marginTop: 'auto' }}
            >
              <Tv size={20} /> Criar Sala da TV
            </Button>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
