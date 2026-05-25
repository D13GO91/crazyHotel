import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useGame, getMissionSize } from '../context/GameContext';
import GlassPanel from '../components/GlassPanel';
import Button from '../components/Button';
import ChatPanel from '../components/ChatPanel';
import { 
  Users, ShieldAlert, ShieldCheck, CheckCircle2, 
  ThumbsUp, ThumbsDown, Zap, AlertTriangle, Eye, MessageCircle, X
} from 'lucide-react';

export default function PlayRoom() {
  const { roomCode } = useParams({ from: '/play/$roomCode' });
  const navigate = useNavigate();
  const { 
    room, currentPlayer, players, loading, error, loadRoomData, 
    proposeTeam, submitTeamVote, submitMissionVote, clearGame,
    messages, sendMessage
  } = useGame();

  const [isRoleFlipped, setIsRoleFlipped] = useState(false);
  
  // Estados para escolha do líder
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  
  // Estados para votação local do jogador
  const [hasVotedTeam, setHasVotedTeam] = useState(false);
  const [hasVotedMissionState, setHasVotedMissionState] = useState(false);
  const [showRoleReview, setShowRoleReview] = useState(false);

  const [showChatModal, setShowChatModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isInitialLoad = useRef(true);

  // Carrega os dados da sala
  useEffect(() => {
    if (roomCode) {
      loadRoomData(roomCode, false);
    }
  }, [roomCode, loadRoomData]);

  // Controla contagem de não lidas no chat
  useEffect(() => {
    if (showChatModal) {
      setUnreadCount(0);
      return;
    }
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    setUnreadCount(prev => prev + 1);
  }, [messages.length, showChatModal]);

  // Reseta estados quando as fases do jogo mudam
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (room?.state === 'TEAM_SELECTION') {
        setSelectedPlayers([]);
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [room?.state]);

  // Sincroniza estados de voto locais com o banco de dados
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentPlayer) {
      setHasVotedTeam(!!currentPlayer.team_vote);
      setHasVotedMissionState(currentPlayer.has_voted_mission);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer?.team_vote, currentPlayer?.has_voted_mission]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleTogglePlayerSelection = (playerId: string) => {
    const activePlayers = players.filter(p => !p.is_host);
    const requiredSize = getMissionSize(activePlayers.length, room?.round_number || 1);

    setSelectedPlayers(prev => {
      if (prev.includes(playerId)) {
        return prev.filter(id => id !== playerId);
      }
      if (prev.length >= requiredSize) {
        return prev; // Impede selecionar mais do que o limite
      }
      return [...prev, playerId];
    });
  };

  const handleProposeTeamSubmit = async () => {
    await proposeTeam(selectedPlayers);
  };

  const handleTeamVoteSubmit = async (vote: 'APPROVE' | 'REJECT') => {
    setHasVotedTeam(true);
    await submitTeamVote(vote);
  };

  const handleMissionVoteSubmit = async (vote: 'SUCCESS' | 'FAIL') => {
    setHasVotedMissionState(true);
    await submitMissionVote(vote);
  };

  const handleExitRoom = () => {
    clearGame();
    navigate({ to: '/' });
  };

  if (loading && !currentPlayer) {
    return (
      <div className="flex-center" style={{ minHeight: '80vh', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ border: '3px solid transparent', borderTopColor: 'var(--accent)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
        <p>Conectando ao Crazy Hotel...</p>
      </div>
    );
  }

  if (error || !room || !currentPlayer) {
    return (
      <div className="layout-card flex-center" style={{ minHeight: '80vh', padding: '1rem' }}>
        <GlassPanel style={{ textAlign: 'center', padding: '2.5rem 1.5rem', width: '100%' }}>
          <AlertTriangle size={40} style={{ color: 'var(--color-thief)', marginBottom: '1rem' }} />
          <h2>Acesso negado</h2>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            {error || 'Você precisa fazer o check-in na página inicial usando o código correto da sala.'}
          </p>
          <Button onClick={() => navigate({ to: '/' })}>Ir para a Tela Inicial</Button>
        </GlassPanel>
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.is_host);
  const isGuest = currentPlayer.role === 'GUEST';
  const isThief = currentPlayer.role === 'THIEF';
  const isLeader = room.leader_id === currentPlayer.id;

  // Ladrões conhecem os outros ladrões
  const otherThieves = players.filter(p => p.role === 'THIEF' && p.id !== currentPlayer.id);

  // Tamanho exigido para a missão atual
  const requiredTeamSize = getMissionSize(activePlayers.length, room.round_number);
  const teamMembers = activePlayers.filter(p => room.current_team?.includes(p.id));
  const isInMissionTeam = room.current_team?.includes(currentPlayer.id);

  return (
    <div className="layout-card" style={{ padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Status Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>JOGADOR</div>
          <div style={{ fontWeight: 700, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {currentPlayer.name} {isLeader && <span style={{ fontSize: '0.9rem' }}>👑</span>}
          </div>
        </div>

        {room.state !== 'LOBBY' && currentPlayer.role && (
          <button
            onClick={() => setShowRoleReview(true)}
            style={{
              background: 'rgba(var(--accent-rgb), 0.12)',
              border: '1px solid rgba(var(--accent-rgb), 0.3)',
              color: 'var(--accent-light)',
              padding: '0.4rem 0.8rem',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'var(--transition-smooth)',
              outline: 'none'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.22)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.12)';
              e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.3)';
            }}
          >
            <Eye size={14} /> Rever Papel
          </button>
        )}

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SALA</div>
          <div style={{ fontWeight: 700, color: 'var(--accent-light)', letterSpacing: '0.05em' }}>{room.code}</div>
        </div>
      </div>

      {/* State views */}
      {room.state === 'LOBBY' && (
        <GlassPanel style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '50%', marginBottom: '1.25rem', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
            <Users size={36} className="role-guest-theme" />
          </div>
          <h2>Check-in Realizado!</h2>
          <p style={{ marginBottom: '2rem', fontSize: '1.05rem', lineHeight: '1.5' }}>
            Aguardando mais hóspedes entrarem. <br />
            O jogo começará na TV assim que houver 5+ jogadores.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>JOGADORES CONECTADOS ({activePlayers.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              {activePlayers.map(p => (
                <span key={p.id} style={{ background: p.id === currentPlayer.id ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.85rem', color: p.id === currentPlayer.id ? '#fff' : 'var(--text-normal)' }}>
                  {p.name} {p.id === currentPlayer.id && '(Você)'}
                </span>
              ))}
            </div>
          </div>

          <Button variant="secondary" onClick={handleExitRoom}>
            Sair da Sala
          </Button>
        </GlassPanel>
      )}

      {room.state === 'ROLE_ASSIGNMENT' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Seu Papel Secreto</h2>

          <div 
            onClick={() => setIsRoleFlipped(true)}
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '320px',
              minHeight: '400px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '2rem 1.5rem',
              borderWidth: '2px',
              borderColor: isRoleFlipped 
                ? (isGuest ? 'var(--color-guest)' : 'var(--color-thief)')
                : 'var(--accent)',
              boxShadow: isRoleFlipped
                ? (isGuest ? '0 0 20px var(--color-guest-glow)' : '0 0 20px var(--color-thief-glow)')
                : '0 0 20px var(--accent-glow)',
              background: isRoleFlipped
                ? (isGuest ? 'var(--bg-guest-glass)' : 'var(--bg-thief-glass)')
                : 'rgba(18, 14, 36, 0.95)',
              transition: 'all 0.5s ease',
              borderRadius: '1.5rem',
              textAlign: 'center'
            }}
          >
            {!isRoleFlipped ? (
              <div className="animate-wiggle" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <Users size={64} style={{ color: 'var(--accent-light)' }} />
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', letterSpacing: '0.05em' }}>
                  TOQUE PARA REVELAR
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Não deixe ninguém olhar a sua tela!
                </span>
              </div>
            ) : (
              <div className="animate-reveal" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'space-between', width: '100%' }}>
                <div>
                  {isGuest ? (
                    <ShieldCheck size={56} style={{ color: 'var(--color-guest)', marginBottom: '1rem' }} />
                  ) : (
                    <ShieldAlert size={56} style={{ color: 'var(--color-thief)', marginBottom: '1rem' }} />
                  )}
                  
                  <h3 style={{ 
                    fontSize: '2.25rem', 
                    fontWeight: 800, 
                    color: isGuest ? 'var(--color-guest)' : 'var(--color-thief)',
                    textShadow: isGuest ? '0 0 10px var(--color-guest-glow)' : '0 0 10px var(--color-thief-glow)',
                    marginBottom: '1rem' 
                  }}>
                    {isGuest ? 'HÓSPEDE' : 'LADRÃO'}
                  </h3>
                </div>

                <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
                  {isGuest 
                    ? 'Você quer que as missões tenham SUCESSO. Discuta e expulse os ladrões nas votações para vencer!'
                    : 'Você quer SABOTAR as missões. Minta, infiltre-se nas equipes e vote Fracasso em segredo.'}
                </p>

                {/* Thieves list (Resistance rule) */}
                {isThief && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(244, 63, 94, 0.2)', marginTop: '1rem', width: '100%' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-thief)', fontWeight: 600 }}>OUTROS LADRÕES:</div>
                    <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700, marginTop: '0.25rem' }}>
                      {otherThieves.length === 0 ? 'Você está sozinho!' : otherThieves.map(t => t.name).join(', ')}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', width: '100%', marginTop: '1.5rem' }}>
                  Aguardando a TV iniciar a rodada...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {room.state === 'TEAM_SELECTION' && (
        <GlassPanel style={{ padding: '2rem 1.25rem' }}>
          {isLeader ? (
            <div>
              <h2 style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>Você é o Líder! 👑</h2>
              <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Selecione exatamente **{requiredTeamSize} jogadores** para ir à missão:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {activePlayers.map((player) => {
                  const isSelected = selectedPlayers.includes(player.id);
                  return (
                    <button
                      key={player.id}
                      onClick={() => handleTogglePlayerSelection(player.id)}
                      className="glass-panel"
                      style={{
                        width: '100%',
                        padding: '0.8rem 1rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderWidth: '1px',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border-glass)',
                        background: isSelected ? 'rgba(var(--accent-rgb), 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        color: '#fff',
                        fontWeight: isSelected ? 700 : 500
                      }}
                    >
                      <span>{player.name} {player.id === currentPlayer.id && '(Você)'}</span>
                      <span>{isSelected ? '✔' : '➕'}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.95rem' }}>
                Selecionados: <strong>{selectedPlayers.length} / {requiredTeamSize}</strong>
              </div>

              <Button 
                onClick={handleProposeTeamSubmit} 
                disabled={selectedPlayers.length !== requiredTeamSize}
              >
                Propor Equipe
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ width: '60px', height: '60px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '50%', display: 'flex', alignItems: 'center', margin: '0 auto 1rem auto', justifyContent: 'center' }}>
                👑
              </div>
              <h3>Aguardando o Líder</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.6' }}>
                O líder <strong>{players.find(p => p.id === room.leader_id)?.name}</strong> está montando uma equipe de **{requiredTeamSize} pessoas** para enviar à missão.
              </p>
            </div>
          )}
        </GlassPanel>
      )}

      {room.state === 'TEAM_VOTE' && (
        <GlassPanel style={{ padding: '2rem 1.25rem' }}>
          {!hasVotedTeam ? (
            <div>
              <h2 style={{ fontSize: '1.4rem', textAlign: 'center', marginBottom: '0.5rem' }}>Aprovar Equipe?</h2>
              <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                O líder escolheu a equipe abaixo para a Missão {room.round_number}. Qual o seu veredito?
              </p>

              {/* Proposed members list */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {teamMembers.map(member => (
                  <div key={member.id} style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem', textAlign: 'center' }}>
                    👤 {member.name}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Button onClick={() => handleTeamVoteSubmit('APPROVE')} style={{ background: 'linear-gradient(135deg, var(--color-guest) 0%, #059669 100%)', boxShadow: '0 4px 15px var(--color-guest-glow)', gap: '0.5rem' }}>
                  <ThumbsUp size={20} /> Aprovar Time
                </Button>
                <Button onClick={() => handleTeamVoteSubmit('REJECT')} style={{ background: 'linear-gradient(135deg, var(--color-thief) 0%, #e11d48 100%)', boxShadow: '0 4px 15px var(--color-thief-glow)', gap: '0.5rem' }}>
                  <ThumbsDown size={20} /> Rejeitar Time
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--color-guest)', marginBottom: '1rem', display: 'inline-block' }} />
              <h3>Voto de Equipe Enviado!</h3>
              <p style={{ fontSize: '0.95rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                Aguarde os outros jogadores votarem. O resultado aberto da votação aparecerá na tela da TV.
              </p>
            </div>
          )}
        </GlassPanel>
      )}

      {room.state === 'MISSION_VOTE' && (
        <GlassPanel style={{ padding: '2rem 1.25rem' }}>
          {isInMissionTeam ? (
            <div>
              {!hasVotedMissionState ? (
                <div>
                  <h2 style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>Voto Secreto da Missão</h2>
                  <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Sua decisão é secreta e será embaralhada.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <Button 
                      onClick={() => handleMissionVoteSubmit('SUCCESS')}
                      style={{ background: 'linear-gradient(135deg, var(--color-guest) 0%, #059669 100%)', boxShadow: '0 4px 15px var(--color-guest-glow)', height: '70px', fontSize: '1.25rem', gap: '0.5rem' }}
                    >
                      <Zap size={22} /> Votar SUCESSO
                    </Button>
                    
                    {isThief ? (
                      <Button 
                        onClick={() => handleMissionVoteSubmit('FAIL')}
                        style={{ background: 'linear-gradient(135deg, var(--color-thief) 0%, #e11d48 100%)', boxShadow: '0 4px 15px var(--color-thief-glow)', height: '70px', fontSize: '1.25rem', gap: '0.5rem' }}
                      >
                        <ShieldAlert size={22} /> Votar FRACASSO
                      </Button>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '0.75rem', color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 600 }}>
                        Como Hóspede inocente, você só pode votar por SUCESSO.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <CheckCircle2 size={48} style={{ color: 'var(--color-guest)', marginBottom: '1rem', display: 'inline-block' }} />
                  <h3>Ação de Missão Concluída!</h3>
                  <p style={{ fontSize: '0.95rem', marginTop: '0.5rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Seu voto foi criptografado e enviado anonimamente. <br />
                    Confira o resultado na TV principal.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div style={{ width: '60px', height: '60px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '50%', display: 'flex', alignItems: 'center', margin: '0 auto 1rem auto', justifyContent: 'center' }}>
                ✈️
              </div>
              <h3>Você não está no Time</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.6' }}>
                Apenas os membros da equipe selecionada votam nesta fase. <br />
                Acompanhe o andamento da missão na tela da TV!
              </p>
            </div>
          )}
        </GlassPanel>
      )}

      {room.state === 'MISSION_REVEAL' && (
        <GlassPanel style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <h2>Apuração Concluída</h2>
          <p style={{ margin: '1.5rem 0', fontSize: '1.05rem', color: 'var(--text-light)' }}>
            A missão terminou!
          </p>
          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Olhe para a **Tela da TV** principal para ver os votos revelados de forma embaralhada e o resultado final da missão!
          </div>
        </GlassPanel>
      )}

      {room.state === 'GAME_OVER' && (
        <GlassPanel style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          {(() => {
            const guestsWon = room.score_guests >= 3;
            const didIWin = (isGuest && guestsWon) || (isThief && !guestsWon);

            return (
              <div>
                <h2 style={{ 
                  fontSize: '2.25rem', 
                  color: didIWin ? 'var(--color-guest)' : 'var(--color-thief)',
                  textShadow: didIWin ? '0 0 10px var(--color-guest-glow)' : '0 0 10px var(--color-thief-glow)',
                  fontWeight: 800,
                  marginBottom: '0.5rem'
                }}>
                  {didIWin ? 'VITÓRIA!' : 'DERROTA!'}
                </h2>
                
                <p style={{ fontSize: '1.05rem', color: 'var(--text-light)', marginBottom: '2rem' }}>
                  {didIWin 
                    ? 'Excelente trabalho! Sua equipe venceu a partida de intrigas.'
                    : 'Sua equipe foi sabotada e derrotada.'}
                </p>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>SEU PAPEL ERA</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isGuest ? 'var(--color-guest)' : 'var(--color-thief)' }}>
                    {isGuest ? 'HÓSPEDE INOCENTE' : 'LADRÃO SABOTADOR'}
                  </div>
                </div>

                <Button onClick={handleExitRoom}>
                  Voltar ao Início
                </Button>
              </div>
            );
          })()}
        </GlassPanel>
      )}

      {/* Modal de Revisão de Papel */}
      {showRoleReview && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(6, 4, 13, 0.92)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
          onClick={() => setShowRoleReview(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '340px',
              background: isGuest ? 'var(--bg-guest-glass)' : 'var(--bg-thief-glass)',
              border: `2px solid ${isGuest ? 'var(--color-guest)' : 'var(--color-thief)'}`,
              borderRadius: '1.5rem',
              padding: '2.25rem 1.75rem',
              textAlign: 'center',
              boxShadow: isGuest ? '0 0 25px var(--color-guest-glow)' : '0 0 25px var(--color-thief-glow)',
              backdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              transform: 'scale(1)',
              transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {isGuest ? (
                <ShieldCheck size={56} style={{ color: 'var(--color-guest)', marginBottom: '0.75rem', display: 'inline-block' }} />
              ) : (
                <ShieldAlert size={56} style={{ color: 'var(--color-thief)', marginBottom: '0.75rem', display: 'inline-block' }} />
              )}
              
              <h3 style={{ 
                fontSize: '2.25rem', 
                fontWeight: 800, 
                color: isGuest ? 'var(--color-guest)' : 'var(--color-thief)',
                textShadow: isGuest ? '0 0 10px var(--color-guest-glow)' : '0 0 10px var(--color-thief-glow)',
                marginBottom: '0.25rem' 
              }}>
                {isGuest ? 'HÓSPEDE' : 'LADRÃO'}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>SEU PAPEL SECRETO</div>
            </div>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
              {isGuest 
                ? 'Você quer que as missões tenham SUCESSO. Discuta e expulse os ladrões nas votações para vencer!'
                : 'Você quer SABOTAR as missões. Minta, infiltre-se nas equipes e vote Fracasso em segredo.'}
            </p>

            {isThief && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(244, 63, 94, 0.2)', textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-thief)', fontWeight: 600 }}>OUTROS LADRÕES:</div>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700, marginTop: '0.25rem' }}>
                  {otherThieves.length === 0 ? 'Você está sozinho!' : otherThieves.map(t => t.name).join(', ')}
                </div>
              </div>
            )}

            <Button onClick={() => setShowRoleReview(false)} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '1rem', fontWeight: 600 }}>
              Esconder Papel
            </Button>
          </div>
        </div>
      )}

      {/* Chat Floating Action Button */}
      <button
        onClick={() => setShowChatModal(true)}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '3.25rem',
          height: '3.25rem',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent) 0%, #9a7611 100%)',
          border: 'none',
          color: 'var(--text-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(var(--accent-rgb), 0.4)',
          cursor: 'pointer',
          zIndex: 99,
          transition: 'var(--transition-spring)',
          outline: 'none'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <MessageCircle size={22} />
        {unreadCount > 0 && (
          <div 
            style={{ 
              position: 'absolute', 
              top: '-0.2rem', 
              right: '-0.2rem', 
              background: 'var(--color-thief)', 
              color: '#fff', 
              borderRadius: '50%', 
              minWidth: '1.25rem', 
              height: '1.25rem', 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '0 0.2rem',
              border: '1.5px solid var(--bg-space)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            }}
          >
            {unreadCount}
          </div>
        )}
      </button>

      {/* Modal/Drawer de Chat */}
      {showChatModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(6, 4, 13, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setShowChatModal(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '420px',
              height: '80%',
              maxHeight: '650px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão de Fechar Modal */}
            <button 
              onClick={() => setShowChatModal(false)}
              style={{
                position: 'absolute',
                top: '-2.75rem',
                right: '0',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-normal)',
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)',
                outline: 'none'
              }}
            >
              <X size={18} />
            </button>

            {/* ChatPanel wrapper */}
            <div style={{ flex: 1, height: '100%' }}>
              <ChatPanel 
                messages={messages} 
                onSendMessage={sendMessage} 
                currentUserId={currentPlayer.id} 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
