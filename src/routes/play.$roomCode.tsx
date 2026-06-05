import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useGame, getMissionSize } from '../context/GameContext';
import GlassPanel from '../components/GlassPanel';
import Button from '../components/Button';
import ChatPanel from '../components/ChatPanel';
import { 
  Users, ShieldAlert, ShieldCheck, CheckCircle2, 
  ThumbsUp, ThumbsDown, Zap, AlertTriangle, Eye, MessageCircle, X,
  RotateCcw, ArrowRight
} from 'lucide-react';

export default function PlayRoom() {
  const { roomCode } = useParams({ from: '/play/$roomCode' });
  const navigate = useNavigate();
  const { 
    room, currentPlayer, players, loading, error, loadRoomData, 
    proposeTeam, submitTeamVote, submitMissionVote, clearGame,
    messages, sendMessage, startGame, restartGame, processMissionResult,
    updateRoomSettings, executeAssassination
  } = useGame();

  const [isRoleFlipped, setIsRoleFlipped] = useState(false);
  
  // Estados para escolha do líder
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  
  // Estados para votação local do jogador
  const [hasVotedTeam, setHasVotedTeam] = useState(false);
  const [hasVotedMissionState, setHasVotedMissionState] = useState(false);
  const [showRoleReview, setShowRoleReview] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

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

  const handleExitRoom = async () => {
    await clearGame();
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
  const isRoomOwner = activePlayers[0]?.id === currentPlayer?.id;
  const isLeader = room.leader_id === currentPlayer.id;

  const isGuestTeam = currentPlayer.role === 'GUEST' || currentPlayer.role === 'MANAGER';
  const isThiefTeam = currentPlayer.role === 'THIEF' || currentPlayer.role === 'ASSASSIN';
  
  const showTeammates = currentPlayer.role === 'THIEF' || currentPlayer.role === 'ASSASSIN' || currentPlayer.role === 'MANAGER';

  // Ladrões e Gerente conhecem quem são os ladrões (que no client aparecem com role === 'THIEF')
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
          <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(var(--color-guest-rgb), 0.08)', borderRadius: '50%', marginBottom: '1.25rem', border: '1px solid rgba(var(--color-guest-rgb), 0.15)' }}>
            <Users size={36} className="role-guest-theme" />
          </div>
          <h2>Check-in Realizado!</h2>
          
          {isRoomOwner ? (
            <div style={{ marginBottom: '2.5rem', width: '100%' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>MODO DE JOGO</div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => updateRoomSettings({ gameMode: 'NORMAL' })}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      background: (room.settings?.gameMode || 'NORMAL') === 'NORMAL' ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${(room.settings?.gameMode || 'NORMAL') === 'NORMAL' ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => updateRoomSettings({ gameMode: 'GERENTE_ASSASSINO' })}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      background: room.settings?.gameMode === 'GERENTE_ASSASSINO' ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${room.settings?.gameMode === 'GERENTE_ASSASSINO' ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Gerente & Assassino
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: '1.4' }}>
                  {(room.settings?.gameMode || 'NORMAL') === 'NORMAL' 
                    ? 'Modo clássico: Hóspedes vs Ladrões.' 
                    : 'Modo especial: Adiciona o Gerente (sabe quem são os ladrões) e o Assassino (pode assassinar o Gerente no final).'}
                </p>
              </div>

              <Button 
                onClick={startGame} 
                disabled={activePlayers.length < 5} 
                style={{ width: '100%', gap: '0.5rem' }}
              >
                Iniciar Jogo <Zap size={18} />
              </Button>
              {activePlayers.length < 5 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-thief)', marginTop: '0.5rem' }}>
                  É necessário no mínimo 5 jogadores para iniciar.
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Modo de Jogo:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-light)' }}>
                  {(room.settings?.gameMode || 'NORMAL') === 'NORMAL' ? 'Normal' : 'Gerente & Assassino'}
                </span>
              </div>
              <p style={{ fontSize: '1.05rem', lineHeight: '1.5' }}>
                {activePlayers.length >= 5 
                  ? 'Aguardando o Dono da Sala iniciar o jogo...' 
                  : 'Aguardando mais hóspedes entrarem...'}
              </p>
            </div>
          )}

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

          <Button variant="secondary" onClick={handleExitRoom} style={{ width: '100%' }}>
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
              borderColor: 'var(--accent)',
              boxShadow: '0 0 20px var(--accent-glow)',
              background: 'rgba(24, 23, 20, 0.98)',
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
                  {isGuestTeam ? (
                    <ShieldCheck size={56} style={{ color: 'var(--color-guest)', marginBottom: '1rem' }} />
                  ) : (
                    <ShieldAlert size={56} style={{ color: 'var(--color-thief)', marginBottom: '1rem' }} />
                  )}
                  
                  <h3 style={{ 
                    fontSize: '2.25rem', 
                    fontWeight: 800, 
                    color: isGuestTeam ? 'var(--color-guest)' : 'var(--color-thief)',
                    marginBottom: '1rem' 
                  }}>
                    {currentPlayer.role === 'MANAGER' ? 'GERENTE' :
                     currentPlayer.role === 'ASSASSIN' ? 'ASSASSINO' :
                     isGuestTeam ? 'HÓSPEDE' : 'LADRÃO'}
                  </h3>
                </div>

                <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
                  {currentPlayer.role === 'MANAGER' 
                    ? 'Você sabe quem são todos os ladrões e o assassino. Mas cuidado! Se a sua identidade for descoberta no fim da partida, os ladrões podem te assassinar para vencer!'
                    : currentPlayer.role === 'ASSASSIN'
                    ? 'Você é o Assassino. Se os hóspedes vencerem as missões, você terá a última chance de apontar quem é o Gerente para roubar a vitória!'
                    : isGuestTeam 
                    ? 'Você quer que as missões tenham SUCESSO. Discuta e expulse os ladrões nas votações para vencer!'
                    : 'Você quer SABOTAR as missões. Minta, infiltre-se nas equipes e vote Fracasso em segredo.'}
                </p>

                {/* Teammates/Thieves list */}
                {showTeammates && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', marginTop: '1rem', width: '100%' }}>
                    <div style={{ fontSize: '0.8rem', color: currentPlayer.role === 'MANAGER' ? 'var(--color-guest)' : 'var(--color-thief)', fontWeight: 600 }}>
                      {currentPlayer.role === 'MANAGER' ? 'SABOTADORES (LADRÕES & ASSASSINO):' : 'COMPANHEIROS DE EQUIPE:'}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700, marginTop: '0.25rem' }}>
                      {otherThieves.length === 0 ? 'Não há outros!' : otherThieves.map(t => t.name).join(', ')}
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
                <Button onClick={() => handleTeamVoteSubmit('APPROVE')} style={{ background: 'linear-gradient(135deg, var(--color-guest) 0%, #0284c7 100%)', boxShadow: '0 4px 15px var(--color-guest-glow)', gap: '0.5rem' }}>
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
                      style={{ background: 'linear-gradient(135deg, var(--color-guest) 0%, #0284c7 100%)', boxShadow: '0 4px 15px var(--color-guest-glow)', height: '70px', fontSize: '1.25rem', gap: '0.5rem' }}
                    >
                      <Zap size={22} /> Votar SUCESSO
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        if (isThiefTeam) {
                          handleMissionVoteSubmit('FAIL');
                        } else {
                          alert("Como Hóspede inocente, você só pode votar por SUCESSO.");
                        }
                      }}
                      style={{ background: 'linear-gradient(135deg, var(--color-thief) 0%, #e11d48 100%)', boxShadow: '0 4px 15px var(--color-thief-glow)', height: '70px', fontSize: '1.25rem', gap: '0.5rem' }}
                    >
                      <ShieldAlert size={22} /> Votar FRACASSO
                    </Button>
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
            Os votos estão sendo revelados na TV!
          </p>
          {isLeader ? (
            <div style={{ marginTop: '2rem' }}>
              <Button onClick={processMissionResult} style={{ width: '100%', gap: '0.5rem' }}>
                Avançar Rodada <ArrowRight size={18} />
              </Button>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Olhe para a **Tela da TV** principal para ver os votos revelados de forma embaralhada.
            </div>
          )}
        </GlassPanel>
      )}

      {room.state === 'ASSASSIN_CHOICE' && (
        <GlassPanel style={{ padding: '2rem 1.25rem' }}>
          {currentPlayer.role === 'ASSASSIN' ? (
            <div>
              <h2 style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem', color: 'var(--color-thief)' }}>Última Chance! 🔪</h2>
              <p style={{ textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                Os Hóspedes completaram 3 missões. Se você assassinar o **Gerente** correto, os Ladrões roubam a vitória! Selecione um jogador:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {players
                  .filter(p => !p.is_host && p.role !== 'THIEF' && p.id !== currentPlayer.id)
                  .map((player) => {
                    const isSelected = selectedTargetId === player.id;
                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedTargetId(player.id)}
                        className="glass-panel"
                        style={{
                          width: '100%',
                          padding: '0.8rem 1rem',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderWidth: '1px',
                          borderColor: isSelected ? 'var(--color-thief)' : 'var(--border-glass)',
                          background: isSelected ? 'rgba(var(--color-thief-rgb), 0.12)' : 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '0.75rem',
                          cursor: 'pointer',
                          color: '#fff',
                          fontWeight: isSelected ? 700 : 500
                        }}
                      >
                        <span>{player.name}</span>
                        <span>{isSelected ? '✔' : ''}</span>
                      </button>
                    );
                  })}
              </div>

              <Button 
                onClick={async () => {
                  if (selectedTargetId) {
                    await executeAssassination(selectedTargetId);
                  }
                }} 
                disabled={!selectedTargetId}
                style={{ width: '100%', background: 'var(--color-thief)', border: 'none', color: '#fff' }}
              >
                Confirmar Assassinato
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div className="animate-pulse" style={{ width: '60px', height: '60px', background: 'rgba(var(--color-thief-rgb), 0.1)', border: '1px solid var(--color-thief)', borderRadius: '50%', display: 'flex', alignItems: 'center', margin: '0 auto 1.5rem auto', justifyContent: 'center' }}>
                🔪
              </div>
              <h3 style={{ color: 'var(--color-thief)', textShadow: '0 0 10px var(--color-thief-glow)', fontSize: '1.35rem', fontWeight: 800 }}>O Assassino está agindo!</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.75rem', lineHeight: '1.6' }}>
                Os Hóspedes atingiram 3 sucessos, mas a vitória ainda não está garantida! <br />
                O Assassino tem a chance de apontar quem é o Gerente. Se ele acertar, os Ladrões vencem. Aguarde...
              </p>
            </div>
          )}
        </GlassPanel>
      )}

      {room.state === 'GAME_OVER' && (
        <GlassPanel style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          {(() => {
            const guestsWon = room.score_guests >= 3 && !room.settings?.assassination_success;
            const didIWin = (isGuestTeam && guestsWon) || (isThiefTeam && !guestsWon);

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
                    ? (room.settings?.assassination_success 
                      ? 'O Assassino descobriu o Gerente! Os Ladrões roubaram a vitória.'
                      : 'Excelente trabalho! Sua equipe venceu a partida de intrigas.')
                    : (room.settings?.assassination_success 
                      ? 'Você conseguiu encontrar o Gerente! Vitória gloriosa para os Ladrões.'
                      : 'Sua equipe foi sabotada e derrotada.')}
                </p>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>SEU PAPEL ERA</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isGuestTeam ? 'var(--color-guest)' : 'var(--color-thief)' }}>
                    {currentPlayer.role === 'MANAGER' ? 'GERENTE (LÍDER INOCENTE)' :
                     currentPlayer.role === 'ASSASSIN' ? 'ASSASSINO (SABOTADOR)' :
                     isGuestTeam ? 'HÓSPEDE INOCENTE' : 'LADRÃO SABOTADOR'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {isRoomOwner && (
                    <Button onClick={restartGame} style={{ width: '100%', gap: '0.5rem' }}>
                      Jogar Novamente <RotateCcw size={18} />
                    </Button>
                  )}
                  <Button variant="secondary" onClick={handleExitRoom} style={{ width: '100%' }}>
                    Voltar ao Início
                  </Button>
                  {!isRoomOwner && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Aguardando o Dono da Sala iniciar uma nova partida...
                    </span>
                  )}
                </div>
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
            background: 'rgba(8, 8, 8, 0.92)',
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
              background: 'rgba(24, 23, 20, 0.98)',
              border: '2px solid var(--accent)',
              borderRadius: '1.5rem',
              padding: '2.25rem 1.75rem',
              textAlign: 'center',
              boxShadow: '0 0 25px var(--accent-glow)',
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
              {isGuestTeam ? (
                <ShieldCheck size={56} style={{ color: 'var(--color-guest)', marginBottom: '0.75rem', display: 'inline-block' }} />
              ) : (
                <ShieldAlert size={56} style={{ color: 'var(--color-thief)', marginBottom: '0.75rem', display: 'inline-block' }} />
              )}
              
              <h3 style={{ 
                fontSize: '2.25rem', 
                fontWeight: 800, 
                color: isGuestTeam ? 'var(--color-guest)' : 'var(--color-thief)',
                marginBottom: '0.25rem' 
              }}>
                {currentPlayer.role === 'MANAGER' ? 'GERENTE' :
                 currentPlayer.role === 'ASSASSIN' ? 'ASSASSINO' :
                 isGuestTeam ? 'HÓSPEDE' : 'LADRÃO'}
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>SEU PAPEL SECRETO</div>
            </div>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', lineHeight: '1.5' }}>
              {currentPlayer.role === 'MANAGER' 
                ? 'Você sabe quem são todos os ladrões e o assassino. Cuidado para não ser descoberto no final da partida!'
                : currentPlayer.role === 'ASSASSIN'
                ? 'Você é o Assassino. Se os hóspedes vencerem as missões, você poderá apontar quem é o Gerente para roubar a vitória!'
                : isGuestTeam 
                ? 'Você quer que as missões tenham SUCESSO. Discuta e expulse os ladrões nas votações para vencer!'
                : 'Você quer SABOTAR as missões. Minta, infiltre-se nas equipes e vote Fracasso em segredo.'}
            </p>

            {showTeammates && (
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                <div style={{ fontSize: '0.75rem', color: currentPlayer.role === 'MANAGER' ? 'var(--color-guest)' : 'var(--color-thief)', fontWeight: 600 }}>
                  {currentPlayer.role === 'MANAGER' ? 'SABOTADORES (LADRÕES & ASSASSINO):' : 'COMPANHEIROS DE EQUIPE:'}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 700, marginTop: '0.25rem' }}>
                  {otherThieves.length === 0 ? 'Não há outros!' : otherThieves.map(t => t.name).join(', ')}
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
