import React, { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useGame } from '../context/GameContext';
import GlassPanel from '../components/GlassPanel';
import Button from '../components/Button';
import Input from '../components/Input';
import { Users, Tv, ShieldAlert } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { createRoom, joinRoom, error: gameError, clearGame } = useGame();
  
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Clear previous game state when entering home
  React.useEffect(() => {
    clearGame();
  }, [clearGame]);

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
    <div className="layout-card animate-float" style={{ padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(var(--accent-rgb), 0.1)', borderRadius: '50%', marginBottom: '1rem', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
          <ShieldAlert size={48} style={{ color: 'var(--accent-light)' }} />
        </div>
        <h1>HÓSPEDES</h1>
        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.3em', color: 'var(--color-thief)', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
          VS. LADRÕES
        </div>
        <p style={{ fontSize: '1.125rem' }}>Um jogo de intriga, sabotagem e dedução social.</p>
      </div>

      <GlassPanel hoverable style={{ marginBottom: '2rem' }}>
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
              background: 'rgba(244, 63, 94, 0.1)', 
              border: '1px solid rgba(244, 63, 94, 0.3)', 
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

      <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ padding: '0 1rem', color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 600 }}>OU</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <GlassPanel hoverable style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.95rem' }}>
            Vai transmitir o jogo na TV ou projetor? Crie uma sala nova abaixo.
          </div>
          <Button 
            variant="secondary" 
            onClick={handleCreateRoom} 
            loading={isCreating} 
            disabled={isJoining}
            style={{ gap: '0.5rem' }}
          >
            <Tv size={20} /> Criar Sala da TV
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}
