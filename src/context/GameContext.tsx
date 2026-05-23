/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Room, Player, GameState, PlayerRole, MissionHistoryEntry } from '../types';

interface GameContextProps {
  room: Room | null;
  players: Player[];
  currentPlayer: Player | null;
  loading: boolean;
  error: string | null;
  createRoom: () => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  startGame: () => Promise<void>;
  revealRolesDone: () => Promise<void>;
  proposeTeam: (teamPlayerIds: string[]) => Promise<void>;
  submitTeamVote: (vote: 'APPROVE' | 'REJECT') => Promise<void>;
  processTeamVote: () => Promise<void>;
  submitMissionVote: (vote: 'SUCCESS' | 'FAIL') => Promise<void>;
  processMissionResult: () => Promise<void>;
  nextRound: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearGame: () => void;
  loadRoomData: (code: string, isHostPage: boolean) => Promise<void>;
}

// Tabuleiro clássico do The Resistance
export function getMissionSize(playerCount: number, round: number): number {
  const count = Math.max(5, Math.min(10, playerCount));
  const sizes: Record<number, number[]> = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5]
  };
  return sizes[count][round - 1];
}

// Identifica se a rodada 4 precisa de 2 fracassos para falhar (apenas com 7+ jogadores)
export function requiresDoubleFail(playerCount: number, round: number): boolean {
  return playerCount >= 7 && round === 4;
}

const GameContext = createContext<GameContextProps | undefined>(undefined);

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa todos os estados locais e cache
  const clearGame = useCallback(() => {
    setRoom(null);
    setPlayers([]);
    setCurrentPlayer(null);
    setError(null);
    localStorage.removeItem('crazyhotel_player_id');
    localStorage.removeItem('crazyhotel_room_id');
  }, []);

  // Busca inicial dos dados da sala e jogadores
  const loadRoomData = useCallback(async (code: string, isHostPage: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const upperCode = code.toUpperCase();
      // Fetch Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', upperCode)
        .single();

      if (roomError || !roomData) {
        throw new Error('Sala não encontrada.');
      }

      setRoom(roomData as Room);

      // Fetch Players
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('joined_at', { ascending: true });

      if (playersError) {
        throw new Error('Erro ao buscar jogadores.');
      }

      setPlayers((playersData || []) as Player[]);

      // Se não for a tela de TV (Host), tenta reconectar
      if (!isHostPage) {
        const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
        const storedRoomId = localStorage.getItem('crazyhotel_room_id');

        if (storedPlayerId && storedRoomId === roomData.id) {
          const { data: playerExist, error: playerExistError } = await supabase
            .from('players')
            .select('*')
            .eq('id', storedPlayerId)
            .single();

          if (!playerExistError && playerExist) {
            if (playerExist.status !== 'CONNECTED') {
              const { data: updated } = await supabase
                .from('players')
                .update({ status: 'CONNECTED' })
                .eq('id', storedPlayerId)
                .select()
                .single();
              setCurrentPlayer((updated || playerExist) as Player);
            } else {
              setCurrentPlayer(playerExist as Player);
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao carregar a sala.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Assinatura em Tempo Real (Realtime Channels)
  useEffect(() => {
    if (!room) return;

    // 1. Ouvir alterações na sala
    const roomChannel = supabase
      .channel(`room_changes:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          setRoom(payload.new as Room);
        }
      )
      .subscribe();

    // 2. Ouvir alterações nos jogadores
    const playersChannel = supabase
      .channel(`players_changes:${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        async () => {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', room.id)
            .order('joined_at', { ascending: true });

          if (data) {
            setPlayers(data as Player[]);
            
            const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
            if (storedPlayerId) {
              const current = data.find((p) => p.id === storedPlayerId);
              if (current) {
                setCurrentPlayer(current as Player);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // AÇÃO: Criar Sala (Host)
  const createRoom = useCallback(async (): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const code = generateRoomCode();
      const { data, error: createError } = await supabase
        .from('rooms')
        .insert({
          code,
          state: 'LOBBY',
          settings: { timer: 60, maxPlayers: 10 },
        })
        .select()
        .single();

      if (createError) throw new Error('Não foi possível criar a sala.');
      setRoom(data as Room);
      return code;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Não foi possível criar a sala.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // AÇÃO: Entrar na Sala (Player)
  const joinRoom = useCallback(async (code: string, playerName: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const upperCode = code.toUpperCase();
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', upperCode)
        .single();

      if (roomError || !roomData) throw new Error('Sala não encontrada. Verifique o código.');
      if (roomData.state !== 'LOBBY') throw new Error('O jogo nesta sala já foi iniciado!');

      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomData.id);

      const maxPlayers = roomData.settings?.maxPlayers || 10;
      if (count && count >= maxPlayers) {
        throw new Error('Esta sala já atingiu o limite máximo de jogadores.');
      }

      const { data: duplicateName } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', roomData.id)
        .eq('name', playerName.trim())
        .maybeSingle();

      if (duplicateName) {
        throw new Error('Já existe um jogador com este nome na sala.');
      }

      const { data: playerData, error: joinError } = await supabase
        .from('players')
        .insert({
          room_id: roomData.id,
          name: playerName.trim(),
          is_host: false,
          score: 0,
          is_alive: true,
          status: 'CONNECTED',
        })
        .select()
        .single();

      if (joinError) throw new Error('Não foi possível entrar na sala.');

      localStorage.setItem('crazyhotel_player_id', playerData.id);
      localStorage.setItem('crazyhotel_room_id', roomData.id);

      setRoom(roomData as Room);
      setCurrentPlayer(playerData as Player);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erro ao entrar na sala.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // AÇÃO: Iniciar Partida (The Resistance)
  const startGame = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    try {
      const activePlayers = players.filter(p => !p.is_host);
      if (activePlayers.length < 5) {
        throw new Error('São necessários no mínimo 5 jogadores para começar uma partida de The Resistance!');
      }

      // Distribuição de Papéis:
      // 5-6 jogadores: 2 Ladrões (Thieves)
      // 7-9 jogadores: 3 Ladrões
      // 10 jogadores: 4 Ladrões
      let thiefCount = 2;
      if (activePlayers.length >= 7 && activePlayers.length <= 9) {
        thiefCount = 3;
      } else if (activePlayers.length === 10) {
        thiefCount = 4;
      }

      // Embaralha e define os papéis
      const shuffled = [...activePlayers].sort(() => Math.random() - 0.5);
      const updates = shuffled.map((player, index) => {
        const role: PlayerRole = index < thiefCount ? 'THIEF' : 'GUEST';
        return {
          id: player.id,
          room_id: room.id,
          name: player.name,
          role,
          is_alive: true,
          score: 0,
          team_vote: null,
          has_voted_mission: false,
          status: player.status
        };
      });

      const { error: upsertError } = await supabase.from('players').upsert(updates);
      if (upsertError) throw new Error('Falha ao distribuir papéis.');

      // Escolhe o primeiro líder aleatoriamente
      const initialLeader = activePlayers[Math.floor(Math.random() * activePlayers.length)];

      // Atualiza a sala
      const { error: roomError } = await supabase
        .from('rooms')
        .update({
          state: 'ROLE_ASSIGNMENT',
          leader_id: initialLeader.id,
          round_number: 1,
          refusals_count: 0,
          score_guests: 0,
          score_thieves: 0,
          current_team: [],
          mission_votes: [],
          history: []
        })
        .eq('id', room.id);

      if (roomError) throw new Error('Falha ao inicializar a sala.');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Falha ao iniciar jogo.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [room, players]);

  // AÇÃO: Finalizar Revelação de Papéis
  const revealRolesDone = useCallback(async () => {
    if (!room) return;
    try {
      await supabase
        .from('rooms')
        .update({ state: 'TEAM_SELECTION' })
        .eq('id', room.id);
    } catch (err: unknown) {
      console.error(err);
    }
  }, [room]);

  // AÇÃO: Propor equipe de missão (Líder)
  const proposeTeam = useCallback(async (teamPlayerIds: string[]) => {
    if (!room) return;
    try {
      // Se já houver 2 recusas anteriores, a 3ª tentativa é definitiva!
      const isDefinitive = room.refusals_count >= 2;
      
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          current_team: teamPlayerIds,
          state: isDefinitive ? 'MISSION_VOTE' : 'TEAM_VOTE',
          // Se for definitiva, reseta o contador de recusas para a próxima rodada
          refusals_count: isDefinitive ? 0 : room.refusals_count
        })
        .eq('id', room.id);

      if (updateError) throw new Error('Não foi possível propor o time.');

      // Limpa os votos de equipe anteriores e status de voto de missão de todos
      await supabase
        .from('players')
        .update({ team_vote: null, has_voted_mission: false })
        .eq('room_id', room.id);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao propor time.');
    }
  }, [room]);

  // AÇÃO: Enviar voto de time (Player)
  const submitTeamVote = useCallback(async (vote: 'APPROVE' | 'REJECT') => {
    if (!currentPlayer) return;
    try {
      const { data, error: voteError } = await supabase
        .from('players')
        .select('*')
        .eq('id', currentPlayer.id)
        .single();

      if (voteError || !data) throw new Error('Erro ao buscar jogador.');

      await supabase
        .from('players')
        .update({ team_vote: vote })
        .eq('id', currentPlayer.id);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar voto.');
    }
  }, [currentPlayer]);

  // AÇÃO: Apurar votos da equipe (Host/TV)
  const processTeamVote = useCallback(async () => {
    if (!room) return;
    try {
      const activePlayers = players.filter(p => !p.is_host);
      
      const approves = activePlayers.filter(p => p.team_vote === 'APPROVE').length;
      const rejects = activePlayers.filter(p => p.team_vote === 'REJECT').length;

      const isApproved = approves > rejects;

      if (isApproved) {
        // Aprovado! Segue para a votação secreta da missão
        await supabase
          .from('rooms')
          .update({
            state: 'MISSION_VOTE',
            refusals_count: 0
          })
          .eq('id', room.id);

        // Limpa os votos de equipe
        await supabase
          .from('players')
          .update({ team_vote: null, has_voted_mission: false })
          .eq('room_id', room.id);
      } else {
        // Rejeitado! Rotaciona a liderança e incrementa recusas
        const currentLeaderIndex = activePlayers.findIndex(p => p.id === room.leader_id);
        const nextLeader = activePlayers[(currentLeaderIndex + 1) % activePlayers.length];
        
        await supabase
          .from('rooms')
          .update({
            leader_id: nextLeader.id,
            refusals_count: room.refusals_count + 1,
            state: 'TEAM_SELECTION',
            current_team: []
          })
          .eq('id', room.id);

        // Limpa os votos de equipe
        await supabase
          .from('players')
          .update({ team_vote: null, has_voted_mission: false })
          .eq('room_id', room.id);
      }
    } catch (err: unknown) {
      console.error(err);
    }
  }, [room, players]);

  // AÇÃO: Enviar voto de missão secreto (Player)
  const submitMissionVote = useCallback(async (vote: 'SUCCESS' | 'FAIL') => {
    if (!room || !currentPlayer) return;
    try {
      // Chama a RPC atômica e anônima no banco
      await supabase.rpc('append_mission_vote', {
        p_room_id: room.id,
        p_player_id: currentPlayer.id,
        p_vote: vote
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar voto de missão.');
    }
  }, [room, currentPlayer]);

  // AÇÃO: Processar votos da Missão (Host/TV)
  const processMissionResult = useCallback(async () => {
    if (!room) return;
    try {
      const activePlayers = players.filter(p => !p.is_host);
      
      const votes: ('SUCCESS' | 'FAIL')[] = room.mission_votes || [];
      const failVotes = votes.filter(v => v === 'FAIL').length;
      
      // Regra da Missão 4 para 7+ jogadores (precisa de 2 fracassos para falhar)
      const maxPlayersCount = activePlayers.length;
      const failsRequired = requiresDoubleFail(maxPlayersCount, room.round_number) ? 2 : 1;
      
      const isSuccess = failVotes < failsRequired;

      // Atualiza os scores
      const newScoreGuests = isSuccess ? room.score_guests + 1 : room.score_guests;
      const newScoreThieves = !isSuccess ? room.score_thieves + 1 : room.score_thieves;

      // Constrói o histórico da rodada
      const teamPlayerNames = activePlayers
        .filter(p => room.current_team.includes(p.id))
        .map(p => p.name);

      const newHistoryEntry: MissionHistoryEntry = {
        round: room.round_number,
        size: room.current_team.length,
        fails: failVotes,
        result: isSuccess ? 'SUCCESS' : 'FAIL',
        teamNames: teamPlayerNames
      };

      const updatedHistory = [...(room.history || []), newHistoryEntry];

      // Verifica condições de vitória (3 pontos)
      let nextState: GameState = 'MISSION_REVEAL';
      if (newScoreGuests >= 3 || newScoreThieves >= 3) {
        nextState = 'GAME_OVER';
      }

      await supabase
        .from('rooms')
        .update({
          score_guests: newScoreGuests,
          score_thieves: newScoreThieves,
          history: updatedHistory,
          state: nextState
        })
        .eq('id', room.id);

    } catch (err: unknown) {
      console.error(err);
    }
  }, [room, players]);

  // AÇÃO: Avançar para a próxima rodada (Host/TV)
  const nextRound = useCallback(async () => {
    if (!room) return;
    try {
      const activePlayers = players.filter(p => !p.is_host);
      const currentLeaderIndex = activePlayers.findIndex(p => p.id === room.leader_id);
      
      // Próximo Líder
      const nextLeader = activePlayers[(currentLeaderIndex + 1) % activePlayers.length];

      // Limpa os votos de todos
      await supabase
        .from('players')
        .update({ team_vote: null, has_voted_mission: false })
        .eq('room_id', room.id);

      // Avança para escolha do time do próximo round
      await supabase
        .from('rooms')
        .update({
          round_number: room.round_number + 1,
          leader_id: nextLeader.id,
          state: 'TEAM_SELECTION',
          current_team: [],
          mission_votes: [],
          refusals_count: 0
        })
        .eq('id', room.id);

    } catch (err: unknown) {
      console.error(err);
    }
  }, [room, players]);

  // AÇÃO: Reiniciar Jogo (Host/TV)
  const restartGame = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    try {
      await supabase
        .from('players')
        .update({
          role: null,
          team_vote: null,
          has_voted_mission: false
        })
        .eq('room_id', room.id);

      await supabase
        .from('rooms')
        .update({
          state: 'LOBBY',
          round_number: 1,
          refusals_count: 0,
          score_guests: 0,
          score_thieves: 0,
          current_team: [],
          mission_votes: [],
          history: [],
          leader_id: null
        })
        .eq('id', room.id);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao reiniciar o jogo.');
    } finally {
      setLoading(false);
    }
  }, [room]);

  return (
    <GameContext.Provider
      value={{
        room,
        players,
        currentPlayer,
        loading,
        error,
        createRoom,
        joinRoom,
        startGame,
        revealRolesDone,
        proposeTeam,
        submitTeamVote,
        processTeamVote,
        submitMissionVote,
        processMissionResult,
        nextRound,
        restartGame,
        clearGame,
        loadRoomData,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame deve ser utilizado dentro de um GameProvider');
  }
  return context;
};
