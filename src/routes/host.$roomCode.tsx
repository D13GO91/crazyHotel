import { useEffect, useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useGame, getMissionSize, requiresDoubleFail } from '../context/GameContext';
import GlassPanel from '../components/GlassPanel';
import Button from '../components/Button';
import { 
  Tv, Users, Shield, Play, RotateCcw, 
  AlertTriangle, ArrowRight, ShieldAlert, Award
} from 'lucide-react';

export default function HostRoom() {
  const { roomCode } = useParams({ from: '/host/$roomCode' });
  const navigate = useNavigate();
  const { 
    room, players, loading, error, loadRoomData, 
    startGame, revealRolesDone, processTeamVote, processMissionResult, nextRound, restartGame 
  } = useGame();

  const [revealCountdown, setRevealCountdown] = useState(10);
  const [revealedCards, setRevealedCards] = useState<boolean[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);

  // Carrega os dados da sala ao montar
  useEffect(() => {
    if (roomCode) {
      loadRoomData(roomCode, true);
    }
  }, [roomCode, loadRoomData]);

  // Contagem regressiva na revelação de papéis
  useEffect(() => {
    if (room?.state !== 'ROLE_ASSIGNMENT') return;
    
    const timeoutId = setTimeout(() => {
      setRevealCountdown(10);
    }, 0);

    const interval = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          revealRolesDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [room?.state, revealRolesDone]);

  // Processa votação de equipe automaticamente quando todos votam
  useEffect(() => {
    if (room?.state !== 'TEAM_VOTE') return;

    const activePlayers = players.filter(p => !p.is_host);
    const allVoted = activePlayers.length > 0 && activePlayers.every(p => p.team_vote !== null);

    if (allVoted) {
      const timeout = setTimeout(() => {
        processTeamVote();
      }, 5000); // 5 segundos para que todos vejam quem votou o quê na TV
      return () => clearTimeout(timeout);
    }
  }, [players, room?.state, processTeamVote]);

  // Processa votação de missão automaticamente quando todos os escolhidos votam
  useEffect(() => {
    if (room?.state !== 'MISSION_VOTE') return;

    const teamPlayerIds = room.current_team || [];
    const teamPlayers = players.filter(p => teamPlayerIds.includes(p.id));
    const allVoted = teamPlayers.length > 0 && teamPlayers.every(p => p.has_voted_mission);

    if (allVoted) {
      const timeout = setTimeout(() => {
        processMissionResult();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [players, room?.current_team, room?.state, processMissionResult]);

  // Reseta estado das cartas ao entrar em MISSION_REVEAL
  useEffect(() => {
    if (room?.state === 'MISSION_REVEAL' && room.mission_votes) {
      const timeoutId = setTimeout(() => {
        setRevealedCards(new Array(room.mission_votes.length).fill(false));
        setIsRevealing(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [room?.state, room?.mission_votes]);

  // Revela as cartas uma a uma com delay
  const handleRevealCards = () => {
    if (!room?.mission_votes) return;
    setIsRevealing(true);
    
    room.mission_votes.forEach((_, idx) => {
      setTimeout(() => {
        setRevealedCards(prev => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
      }, (idx + 1) * 1200); // Revela a cada 1.2 segundos
    });
  };

  if (loading && !room) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ border: '4px solid transparent', borderTopColor: 'var(--accent)', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite' }} />
        <p>Configurando a TV da Sala...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="layout-card flex-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: '1.5rem' }}>
        <GlassPanel style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <AlertTriangle size={48} style={{ color: 'var(--color-thief)', marginBottom: '1rem' }} />
          <h2>Ops! Sala não encontrada</h2>
          <p style={{ marginBottom: '2rem' }}>{error || 'Não conseguimos conectar à sala informada.'}</p>
          <Button onClick={() => navigate({ to: '/' })}>Voltar ao Início</Button>
        </GlassPanel>
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.is_host);
  const currentLeader = activePlayers.find(p => p.id === room.leader_id);
  const teamMembers = activePlayers.filter(p => room.current_team?.includes(p.id));

  return (
    <div style={{ width: '100%', padding: '1rem 0' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Tv size={24} style={{ color: 'var(--accent-light)' }} />
          <span style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.05em' }}>CRAZY HOTEL: THE RESISTANCE</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>CÓDIGO:</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-light)', letterSpacing: '0.1em', background: 'rgba(255, 255, 255, 0.05)', padding: '0.2rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {room.code}
          </span>
        </div>
      </div>

      {/* 5 Missions Progress Bar (Classic Tabuleiro) */}
      {room.state !== 'LOBBY' && (
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            
            {/* Linha de conexão do tabuleiro */}
            <div style={{ position: 'absolute', top: '50%', left: '50px', right: '50px', height: '4px', background: 'rgba(255,255,255,0.06)', zIndex: 1, transform: 'translateY(-50%)' }} />

            {[1, 2, 3, 4, 5].map((roundNum) => {
              const size = getMissionSize(activePlayers.length, roundNum);
              const doubleFail = requiresDoubleFail(activePlayers.length, roundNum);
              
              // Verifica se já passou essa rodada
              const roundHistory = room.history?.find(h => h.round === roundNum);
              const isCurrent = room.round_number === roundNum;
              
              let circleBg = 'var(--bg-glass)';
              let circleBorder = '1px solid var(--border-glass)';
              let circleShadow = 'none';
              let textHex = 'var(--text-light)';
              
              if (roundHistory) {
                const wasSuccess = roundHistory.result === 'SUCCESS';
                circleBg = wasSuccess ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)';
                circleBorder = `2px solid ${wasSuccess ? 'var(--color-guest)' : 'var(--color-thief)'}`;
                circleShadow = `0 0 15px ${wasSuccess ? 'var(--color-guest-glow)' : 'var(--color-thief-glow)'}`;
                textHex = wasSuccess ? 'var(--color-guest)' : 'var(--color-thief)';
              } else if (isCurrent) {
                circleBg = 'rgba(var(--accent-rgb), 0.15)';
                circleBorder = '2px solid var(--accent-light)';
                circleShadow = '0 0 15px var(--accent-glow)';
              }

              return (
                <div key={roundNum} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    background: circleBg,
                    border: circleBorder,
                    boxShadow: circleShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease'
                  }}>
                    <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>M{roundNum}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: textHex }}>{size}p</span>
                  </div>
                  {doubleFail && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-thief)', fontWeight: 'bold', background: 'rgba(244, 63, 94, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                      Requer 2x ✗
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Placar de Rodadas e Recusas */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Hóspedes (Sucesso):</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-guest)' }}>{room.score_guests}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ladrões (Sabotados):</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-thief)' }}>{room.score_thieves}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tentativas Rejeitadas:</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: room.refusals_count >= 2 ? 'var(--color-thief)' : 'var(--text-light)' }}>
                {room.refusals_count} / 2
              </span>
            </div>
          </div>
          {room.refusals_count >= 2 && (
            <div style={{ textAlign: 'center', color: 'var(--color-thief)', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.5rem', animation: 'wiggle 0.5s ease-in-out infinite alternate' }}>
              ⚠️ A PRÓXIMA ESCOLA DE TIME SERÁ DEFINITIVA (SEM VOTAÇÃO)!
            </div>
          )}
        </div>
      )}

      {/* Main Board state machine */}
      {room.state === 'LOBBY' && (
        <GlassPanel style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Aguardando Check-in no Hotel...</h2>
          <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto 2.5rem auto' }}>
            Acesse o link no celular e use o código acima. É preciso de **no mínimo 5 jogadores** para jogar.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1.5rem', borderRadius: '2rem', width: 'fit-content', margin: '0 auto 2.5rem auto' }}>
            <Users style={{ color: 'var(--accent-light)' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>{activePlayers.length} / 10 Conectados</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', margin: '0 auto 3rem auto', maxWidth: '900px' }}>
            {activePlayers.map((player) => (
              <div 
                key={player.id} 
                className="glass-panel" 
                style={{ 
                  padding: '1.25rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  borderColor: player.status === 'CONNECTED' ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  animation: 'float 4s ease-in-out infinite' 
                }}
              >
                <div style={{ width: '48px', height: '48px', background: 'rgba(var(--accent-rgb), 0.1)', border: '1px solid var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.25rem', color: '#fff' }}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontWeight: 600, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {player.name}
                </span>
                <span style={{ fontSize: '0.8rem', color: player.status === 'CONNECTED' ? 'var(--color-guest)' : 'var(--color-thief)' }}>
                  {player.status === 'CONNECTED' ? '● Online' : '○ Offline'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ maxWidth: '300px', margin: '0 auto' }}>
            <Button 
              onClick={startGame} 
              disabled={activePlayers.length < 5}
              style={{ gap: '0.75rem', fontSize: '1.25rem', padding: '1.25rem 2rem' }}
            >
              <Play size={22} /> Iniciar Jogo
            </Button>
            {activePlayers.length < 5 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Conecte mais {5 - activePlayers.length} jogadores para iniciar.
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {room.state === 'ROLE_ASSIGNMENT' && (
        <GlassPanel style={{ textAlign: 'center', padding: '4rem 2rem' }} className="animate-pulse-glow">
          <h2 style={{ fontSize: '3.5rem', color: 'var(--accent-light)', marginBottom: '1.5rem' }}>
            Distribuição de Papéis
          </h2>
          <div style={{ fontSize: '1.5rem', color: 'var(--text-light)', maxWidth: '600px', margin: '0 auto 3rem auto', lineHeight: '1.6' }}>
            Verifique a tela do seu celular em segredo! <br />
            Você é um <strong>Hóspede</strong> protegendo o hotel, ou um <strong>Ladrão</strong> planejando a sabotagem?
          </div>
          
          <div style={{ margin: '2rem 0' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>A PRIMEIRA RODADA COMEÇA EM</div>
            <div style={{ fontSize: '6rem', fontWeight: 800, color: 'var(--text-light)', lineHeight: '1' }}>
              {revealCountdown}
            </div>
          </div>
        </GlassPanel>
      )}

      {room.state === 'TEAM_SELECTION' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem' }}>
          <GlassPanel style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--accent-light)', letterSpacing: '0.2em', fontWeight: 700, display: 'block', marginBottom: '1rem' }}>
              FASE DE ESCOLHA DA EQUIPE
            </span>
            <div style={{ width: '80px', height: '80px', background: 'rgba(var(--accent-rgb), 0.1)', border: '2px solid var(--accent-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: '#fff', marginBottom: '1rem', boxShadow: 'var(--shadow-neon)' }}>
              👑
            </div>
            <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem', color: '#fff' }}>
              {currentLeader?.name} é o Líder!
            </h2>
            <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '550px', marginBottom: '3rem' }}>
              O líder está selecionando exatamente **{getMissionSize(activePlayers.length, room.round_number)} jogadores** em seu celular para a missão atual.
            </p>

            {/* Live proposed team representation */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '500px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>TIME EM ESCOLHA:</div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', minHeight: '80px', padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '1rem', width: '100%' }}>
                {teamMembers.length === 0 ? (
                  <span style={{ color: 'var(--text-dark)', display: 'flex', alignItems: 'center' }}>Nenhum jogador selecionado ainda...</span>
                ) : (
                  teamMembers.map(member => (
                    <div key={member.id} className="glass-panel" style={{ padding: '0.5rem 1rem', background: 'rgba(var(--accent-rgb), 0.05)', borderColor: 'var(--accent-light)' }}>
                      <span style={{ fontWeight: 600, color: '#fff' }}>{member.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </GlassPanel>

          {/* Connected Players list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, paddingLeft: '0.5rem' }}>TODOS OS JOGADORES ({activePlayers.length})</h3>
            {activePlayers.map((player) => {
              const isLeader = player.id === room.leader_id;
              return (
                <div 
                  key={player.id} 
                  className="glass-panel" 
                  style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderColor: isLeader ? 'var(--accent)' : 'rgba(255,255,255,0.04)' }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{isLeader ? '👑' : '👤'}</span>
                  <span style={{ fontWeight: isLeader ? 700 : 500, color: isLeader ? '#fff' : 'var(--text-normal)' }}>{player.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {room.state === 'TEAM_VOTE' && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem' }}>
          <GlassPanel style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--accent-light)', letterSpacing: '0.2em', fontWeight: 700, display: 'block', marginBottom: '1rem' }}>
              VOTAÇÃO DA EQUIPE PROPOSTA
            </span>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>Aprovar esta equipe para a missão?</h2>

            {/* Proposed Team Members */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3.5rem' }}>
              {teamMembers.map(member => (
                <div key={member.id} className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderColor: 'var(--accent-light)', background: 'rgba(var(--accent-rgb), 0.05)', boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.1)' }}>
                  <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>{member.name}</span>
                </div>
              ))}
            </div>

            {/* Realtime Voting Indicators */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
              {activePlayers.map((player) => {
                const voted = player.team_vote !== null;
                return (
                  <div 
                    key={player.id} 
                    className="glass-panel" 
                    style={{ 
                      padding: '1rem 1.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      borderColor: voted ? 'var(--color-guest)' : 'rgba(255,255,255,0.06)',
                      background: voted ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-glass)'
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{player.name}</span>
                    <span>{voted ? '✔' : '⏳'}</span>
                  </div>
                );
              })}
            </div>

            {/* Open Vote Reveal (shows after everyone votes) */}
            {(() => {
              const allVoted = activePlayers.every(p => p.team_vote !== null);
              if (!allVoted) return <p style={{ color: 'var(--text-muted)' }}>Aguardando os votos de todos no celular...</p>;

              const approves = activePlayers.filter(p => p.team_vote === 'APPROVE');
              const rejects = activePlayers.filter(p => p.team_vote === 'REJECT');

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem', animation: 'float 4s ease-in-out infinite' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: approves.length > rejects.length ? 'var(--color-guest)' : 'var(--color-thief)' }}>
                    {approves.length > rejects.length ? 'EQUIPE APROVADA!' : 'EQUIPE REJEITADA!'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '500px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '2rem' }}>
                      <div style={{ color: 'var(--color-guest)', fontWeight: 700, marginBottom: '0.5rem' }}>Aprovou ({approves.length}):</div>
                      {approves.map(p => <div key={p.id} style={{ fontSize: '0.95rem' }}>✓ {p.name}</div>)}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: 'var(--color-thief)', fontWeight: 700, marginBottom: '0.5rem' }}>Rejeitou ({rejects.length}):</div>
                      {rejects.map(p => <div key={p.id} style={{ fontSize: '0.95rem' }}>✗ {p.name}</div>)}
                    </div>
                  </div>
                  <p style={{ color: 'var(--accent-light)', fontSize: '0.85rem', marginTop: '1rem' }}>Processando resultado e avançando...</p>
                </div>
              );
            })()}
          </GlassPanel>

          {/* Leader Side board */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', borderColor: 'var(--accent)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>LÍDER PROPOSITOR</div>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#fff', marginTop: '0.25rem' }}>{currentLeader?.name}</div>
            </div>
          </div>
        </div>
      )}

      {room.state === 'MISSION_VOTE' && (
        <GlassPanel style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-light)', letterSpacing: '0.2em', fontWeight: 700, display: 'block', marginBottom: '1rem' }}>
            MISSÃO EM ANDAMENTO
          </span>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>A Missão Começou!</h2>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
            Apenas os membros da equipe votam secretamente na tela do celular: **Sucesso** ou **Fracasso**.
          </p>

          {/* Voters Status */}
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3rem' }}>
            {teamMembers.map(member => {
              const voted = member.has_voted_mission;
              return (
                <div 
                  key={member.id} 
                  className="glass-panel animate-float"
                  style={{ 
                    padding: '1.5rem 2.5rem', 
                    borderColor: voted ? 'var(--color-guest)' : 'var(--accent-light)',
                    background: voted ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-glass)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minWidth: '150px'
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '1.15rem', color: '#fff' }}>{member.name}</span>
                  <span style={{ fontSize: '0.9rem', color: voted ? 'var(--color-guest)' : 'var(--text-muted)' }}>
                    {voted ? 'Votou ✓' : 'Esperando... ⏳'}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ color: 'var(--text-dark)', fontSize: '1rem', fontWeight: 600 }}>
            A TV REVELARÁ OS VOTOS DE FORMA ANÔNIMA E EMBARALHADA ASSIM QUE TODOS CONFIRMAREM.
          </div>
        </GlassPanel>
      )}

      {room.state === 'MISSION_REVEAL' && (
        <GlassPanel style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--accent-light)', letterSpacing: '0.2em', fontWeight: 700, display: 'block', marginBottom: '1rem' }}>
            REVELAÇÃO DE VOTOS DE MISSÃO
          </span>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>O Veredito da Missão</h2>

          {/* Anonymous Cards Reveal Layout */}
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
            {room.mission_votes?.map((vote, idx) => {
              const isFlipped = revealedCards[idx];
              const isSuccess = vote === 'SUCCESS';
              
              return (
                <div 
                  key={idx}
                  style={{
                    width: '120px',
                    height: '180px',
                    perspective: '1000px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'none'
                  }}>
                    {/* Frente da carta (Facedown/Costas) */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      borderRadius: '1rem',
                      border: '2px dashed var(--accent)',
                      background: 'rgba(18, 14, 36, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      boxShadow: '0 0 10px var(--accent-glow)'
                    }}>
                      ❓
                    </div>
                    {/* Verso da carta (Faceup/Frente) */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      borderRadius: '1rem',
                      border: `2px solid ${isSuccess ? 'var(--color-guest)' : 'var(--color-thief)'}`,
                      background: isSuccess ? 'var(--bg-guest-glass)' : 'var(--bg-thief-glass)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: `0 0 15px ${isSuccess ? 'var(--color-guest-glow)' : 'var(--color-thief-glow)'}`
                    }}>
                      {isSuccess ? (
                        <>
                          <Shield size={36} style={{ color: 'var(--color-guest)' }} />
                          <span style={{ fontWeight: 800, color: 'var(--color-guest)', fontSize: '0.9rem' }}>SUCESSO</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={36} style={{ color: 'var(--color-thief)' }} />
                          <span style={{ fontWeight: 800, color: 'var(--color-thief)', fontSize: '0.9rem' }}>FRACASSO</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', maxWidth: '400px', margin: '0 auto' }}>
            {!isRevealing && (
              <Button onClick={handleRevealCards} style={{ fontSize: '1.15rem', padding: '1rem 2rem' }}>
                Revelar Cartas
              </Button>
            )}
            
            {revealedCards.every(c => c) && (
              <Button onClick={nextRound} style={{ gap: '0.5rem', fontSize: '1.15rem', padding: '1rem 2rem' }}>
                Próxima Rodada <ArrowRight size={20} />
              </Button>
            )}
          </div>
        </GlassPanel>
      )}

      {room.state === 'GAME_OVER' && (
        <GlassPanel style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          {(() => {
            const guestsWon = room.score_guests >= 3;
            return (
              <div>
                <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(var(--accent-rgb), 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
                  <Award size={48} style={{ color: 'var(--accent-light)' }} />
                </div>
                <span style={{ fontSize: '1rem', color: 'var(--accent-light)', letterSpacing: '0.3em', fontWeight: 700, display: 'block' }}>FIM DA INTRIGA</span>
                <h2 style={{ 
                  fontSize: '4.5rem', 
                  fontWeight: 800, 
                  color: guestsWon ? 'var(--color-guest)' : 'var(--color-thief)', 
                  textShadow: guestsWon ? '0 0 25px var(--color-guest-glow)' : '0 0 25px var(--color-thief-glow)',
                  marginTop: '0.5rem',
                  marginBottom: '2rem',
                  lineHeight: '1.1'
                }}>
                  {guestsWon ? 'VITÓRIA DOS HÓSPEDES!' : 'VITÓRIA DOS LADRÕES!'}
                </h2>

                <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
                  {guestsWon 
                    ? 'Os Hóspedes inocentes descobriram as sabotagens e protegeram o Crazy Hotel de todos os Ladrões!' 
                    : 'Os Ladrões infiltrados sabortaram 3 missões com sucesso e assumiram o controle do Crazy Hotel!'}
                </div>

                {/* Role reveal */}
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-light)', marginBottom: '1.5rem', textAlign: 'left', maxWidth: '600px', margin: '0 auto 1.5rem auto' }}>REVELAÇÃO DAS IDENTIDADES</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
                  {activePlayers.map((player) => {
                    const isThief = player.role === 'THIEF';
                    return (
                      <div 
                        key={player.id} 
                        className="glass-panel" 
                        style={{ 
                          padding: '1rem 1.5rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          borderColor: isThief ? 'var(--border-thief)' : 'var(--border-guest)',
                          background: isThief ? 'var(--bg-thief-glass)' : 'var(--bg-guest-glass)'
                        }}
                      >
                        <span style={{ fontSize: '1.15rem', fontWeight: 600 }}>{player.name}</span>
                        <span style={{ 
                          fontWeight: 'bold', 
                          color: isThief ? 'var(--color-thief)' : 'var(--color-guest)',
                          textShadow: isThief ? '0 0 5px var(--color-thief-glow)' : '0 0 5px var(--color-guest-glow)'
                        }}>
                          {isThief ? 'LADRÃO' : 'HÓSPEDE'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', maxWidth: '400px', margin: '0 auto' }}>
                  <Button onClick={restartGame} style={{ gap: '0.5rem' }}>
                    <RotateCcw size={18} /> Jogar Novamente
                  </Button>
                  <Button variant="secondary" onClick={() => navigate({ to: '/' })}>
                    Voltar ao Menu
                  </Button>
                </div>
              </div>
            );
          })()}
        </GlassPanel>
      )}
    </div>
  );
}
