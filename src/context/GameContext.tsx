/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { Room, Player, GameState, PlayerRole, MissionHistoryEntry, Message, RoomSettings } from '../types';

interface GameContextProps {
  room: Room | null;
  players: Player[];
  currentPlayer: Player | null;
  messages: Message[];
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
  revealMissionVotes: () => Promise<void>;
  restartGame: () => Promise<void>;
  clearGame: () => Promise<void>;
  clearReactState: () => void;
  loadRoomData: (code: string, isHostPage: boolean) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  executeAssassination: (targetPlayerId: string) => Promise<boolean>;
  updateRoomSettings: (settings: Partial<RoomSettings>) => Promise<void>;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa todos os estados locais e cache, e remove o jogador do banco
  const clearGame = useCallback(async () => {
    const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
    if (storedPlayerId) {
      try {
        await supabase
          .from('players')
          .delete()
          .eq('id', storedPlayerId);
      } catch (err) {
        console.error('Erro ao remover jogador ao sair:', err);
      }
    }
    setRoom(null);
    setPlayers([]);
    setCurrentPlayer(null);
    setMessages([]);
    setError(null);
    localStorage.removeItem('crazyhotel_player_id');
    localStorage.removeItem('crazyhotel_room_id');
    localStorage.removeItem('crazyhotel_room_code');
    localStorage.removeItem('crazyhotel_secret_token');
  }, []);

  // Limpa apenas os estados em memória (React state)
  const clearReactState = useCallback(() => {
    setRoom(null);
    setPlayers([]);
    setCurrentPlayer(null);
    setMessages([]);
    setError(null);
  }, []);

  // Busca e enriquece os papéis confidenciais (hóspede/ladrão) dos jogadores
  const fetchRolesForPlayers = useCallback(async (
    roomState: string,
    playersList: Player[],
    myPlayerId: string | null,
    mySecretToken: string | null
  ): Promise<Player[]> => {
    if (!playersList || playersList.length === 0) return playersList;

    // 1. Se o jogo terminou (GAME_OVER), todos os papéis são públicos via RPC
    if (roomState === 'GAME_OVER') {
      const { data: gameOverRoles, error: rpcErr } = await supabase.rpc('get_game_over_roles', {
        p_room_id: playersList[0].room_id
      });
      if (!rpcErr && gameOverRoles) {
        return playersList.map(p => {
          const found = gameOverRoles.find((r: any) => r.player_id === p.id);
          return { ...p, role: found ? found.role as PlayerRole : null };
        });
      }
      return playersList;
    }

    // 2. Se for jogador normal com credenciais válidas, busca as informações permitidas
    if (myPlayerId && mySecretToken) {
      try {
        const { data: myRole, error: roleError } = await supabase.rpc('get_my_role', {
          p_player_id: myPlayerId,
          p_secret_token: mySecretToken
        });

        if (!roleError && myRole) {
          let thiefIds: string[] = [];
          if (myRole === 'THIEF' || myRole === 'ASSASSIN' || myRole === 'MANAGER') {
            const { data: thieves } = await supabase.rpc('get_thieves', {
              p_player_id: myPlayerId,
              p_secret_token: mySecretToken
            });
            if (thieves) {
              thiefIds = thieves.map((t: any) => t.player_id);
            }
          }

          return playersList.map(p => {
            if (p.id === myPlayerId) {
              return { ...p, role: myRole as PlayerRole };
            }
            if (
              (myRole === 'THIEF' || myRole === 'ASSASSIN' || myRole === 'MANAGER') && 
              thiefIds.includes(p.id)
            ) {
              return { ...p, role: 'THIEF' as PlayerRole };
            }
            return { ...p, role: null };
          });
        }
      } catch (err) {
        console.error('Erro ao buscar papéis secretos:', err);
      }
    }

    // Por padrão (ex: Host durante o jogo ou sem sessão), oculta todos os papéis
    return playersList.map(p => ({ ...p, role: null }));
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

      // Fetch Messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true });

      if (!messagesError && messagesData) {
        setMessages(messagesData as Message[]);
      }

      // Se não for a tela de TV (Host), tenta reconectar
      let currentPl: Player | null = null;
      const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
      const storedSecretToken = localStorage.getItem('crazyhotel_secret_token');
      const storedRoomId = localStorage.getItem('crazyhotel_room_id');

      if (!isHostPage && storedPlayerId && storedRoomId === roomData.id) {
        const { data: playerExist, error: playerExistError } = await supabase
          .from('players')
          .select('*')
          .eq('id', storedPlayerId)
          .single();

        if (!playerExistError && playerExist) {
          localStorage.setItem('crazyhotel_room_code', roomData.code);
          if (playerExist.status !== 'CONNECTED') {
            const { data: updated } = await supabase
              .from('players')
              .update({ status: 'CONNECTED' })
              .eq('id', storedPlayerId)
              .select()
              .single();
            currentPl = (updated || playerExist) as Player;
          } else {
            currentPl = playerExist as Player;
          }
        }
      }

      // Enriquecer os papéis
      const enrichedPlayers = await fetchRolesForPlayers(
        roomData.state,
        (playersData || []) as Player[],
        !isHostPage ? storedPlayerId : null,
        !isHostPage ? storedSecretToken : null
      );

      setPlayers(enrichedPlayers);

      if (currentPl) {
        const foundCurrent = enrichedPlayers.find(p => p.id === currentPl?.id);
        setCurrentPlayer(foundCurrent || currentPl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao carregar a sala.');
    } finally {
      setLoading(false);
    }
  }, [fetchRolesForPlayers]);

  // Adiciona listener para marcar status do jogador como DISCONNECTED ao fechar a aba/janela
  useEffect(() => {
    if (!currentPlayer) return;

    const handleUnload = () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = 
        import.meta.env.VITE_SUPABASE_ANON_KEY || 
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
        '';
      
      if (!supabaseUrl || !supabaseAnonKey) return;

      const url = `${supabaseUrl}/rest/v1/players?id=eq.${currentPlayer.id}`;
      
      fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ status: 'DISCONNECTED' }),
        keepalive: true
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [currentPlayer]);

  // Assinatura em Tempo Real (Realtime Channels)
  useEffect(() => {
    if (!room) return;

    // 1. Ouvir alterações na sala
    const roomChannel = supabase
      .channel(`room_changes:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        async (payload) => {
          const updatedRoom = payload.new as Room;
          setRoom(updatedRoom);

          // Ao atualizar a sala (por exemplo, se mudou para GAME_OVER), recarregamos os papéis dos jogadores
          const { data: latestPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', room.id)
            .order('joined_at', { ascending: true });

          if (latestPlayers) {
            const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
            const storedSecretToken = localStorage.getItem('crazyhotel_secret_token');
            const isHostPage = !storedPlayerId;

            const enriched = await fetchRolesForPlayers(
              updatedRoom.state,
              latestPlayers as Player[],
              !isHostPage ? storedPlayerId : null,
              !isHostPage ? storedSecretToken : null
            );
            setPlayers(enriched);
            
            if (storedPlayerId) {
              const current = enriched.find((p) => p.id === storedPlayerId);
              if (current) {
                setCurrentPlayer(current);
              }
            }
          }
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
            const storedPlayerId = localStorage.getItem('crazyhotel_player_id');
            const storedSecretToken = localStorage.getItem('crazyhotel_secret_token');
            const isHostPage = !storedPlayerId;

            const enrichedPlayers = await fetchRolesForPlayers(
              room.state,
              data as Player[],
              !isHostPage ? storedPlayerId : null,
              !isHostPage ? storedSecretToken : null
            );

            setPlayers(enrichedPlayers);
            
            if (storedPlayerId) {
              const current = enrichedPlayers.find((p) => p.id === storedPlayerId);
              if (current) {
                setCurrentPlayer(current);
              }
            }
          }
        }
      )
      .subscribe();

    // 3. Ouvir alterações nas mensagens
    const messagesChannel = supabase
      .channel(`messages_changes:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(messagesChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, fetchRolesForPlayers]);

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
          settings: { timer: 60, maxPlayers: 10, gameMode: 'NORMAL' },
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

      // Verifica se o jogador já está na sala (pelo nome) para permitir reconexão
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('name', playerName.trim())
        .maybeSingle();

      if (existingPlayer) {
        // Reclama o jogador existente (reconexão)
        const { data: updatedPlayer, error: updateError } = await supabase
          .from('players')
          .update({ status: 'CONNECTED' })
          .eq('id', existingPlayer.id)
          .select()
          .single();

        if (updateError || !updatedPlayer) {
          throw new Error('Erro ao tentar reconectar como este jogador.');
        }

        localStorage.setItem('crazyhotel_player_id', updatedPlayer.id);
        localStorage.setItem('crazyhotel_room_id', roomData.id);
        localStorage.setItem('crazyhotel_room_code', roomData.code);

        setRoom(roomData as Room);
        setCurrentPlayer(updatedPlayer as Player);
        return;
      }

      // Se é um jogador novo, aplicamos as regras de entrada de novos jogadores
      if (roomData.state !== 'LOBBY') throw new Error('O jogo nesta sala já foi iniciado!');

      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomData.id);

      const maxPlayers = roomData.settings?.maxPlayers || 10;
      if (count && count >= maxPlayers) {
        throw new Error('Esta sala já atingiu o limite máximo de jogadores.');
      }

      const secretToken = crypto.randomUUID();
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

      // Insere o token secreto na tabela privada de segredos
      const { error: secretError } = await supabase
        .from('player_secrets')
        .insert({
          player_id: playerData.id,
          secret_token: secretToken
        });

      if (secretError) throw new Error('Falha ao salvar segredo do jogador.');

      localStorage.setItem('crazyhotel_player_id', playerData.id);
      localStorage.setItem('crazyhotel_secret_token', secretToken);
      localStorage.setItem('crazyhotel_room_id', roomData.id);
      localStorage.setItem('crazyhotel_room_code', roomData.code);

      // Busca os jogadores novamente e enriquece com papéis
      const { data: rawPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('joined_at', { ascending: true });

      const enriched = await fetchRolesForPlayers(
        roomData.state,
        (rawPlayers || []) as Player[],
        playerData.id,
        secretToken
      );

      setRoom(roomData as Room);
      setPlayers(enriched);
      setCurrentPlayer(enriched.find(p => p.id === playerData.id) || (playerData as Player));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erro ao entrar na sala.';
      setError(errMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchRolesForPlayers]);

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
      
      // 1. Atualiza a tabela players (sem o campo role)
      const playerUpdates = shuffled.map((player) => ({
        id: player.id,
        room_id: room.id,
        name: player.name,
        is_alive: true,
        score: 0,
        team_vote: null,
        has_voted_mission: false,
        status: player.status
      }));

      const { error: upsertError } = await supabase.from('players').upsert(playerUpdates);
      if (upsertError) throw new Error('Falha ao atualizar jogadores.');

      // 2. Insere os papéis na tabela privada player_roles
      const gameMode = room.settings?.gameMode || 'NORMAL';
      const roleUpdates = shuffled.map((player, index) => {
        let role: PlayerRole = index < thiefCount ? 'THIEF' : 'GUEST';
        if (gameMode === 'GERENTE_ASSASSINO') {
          if (index === 0) {
            role = 'ASSASSIN';
          } else if (index === thiefCount) {
            role = 'MANAGER';
          }
        }
        return {
          player_id: player.id,
          role
        };
      });

      const { error: rolesError } = await supabase.from('player_roles').insert(roleUpdates);
      if (rolesError) throw new Error('Falha ao distribuir papéis secretos.');

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
    if (currentPlayer.has_voted_mission) return;

    // Atualiza o estado local temporariamente/imediatamente para evitar duplo clique
    setCurrentPlayer(prev => prev ? { ...prev, has_voted_mission: true } : null);

    try {
      // Chama a RPC atômica e anônima no banco
      await supabase.rpc('append_mission_vote', {
        p_room_id: room.id,
        p_player_id: currentPlayer.id,
        p_vote: vote
      });
    } catch (err: unknown) {
      // Se der erro, desfaz a alteração local
      setCurrentPlayer(prev => prev ? { ...prev, has_voted_mission: false } : null);
      setError(err instanceof Error ? err.message : 'Erro ao enviar voto de missão.');
    }
  }, [room, currentPlayer]);

  // AÇÃO: Revelar os Votos da Missão de forma embaralhada (Host/TV)
  const revealMissionVotes = useCallback(async () => {
    if (!room) return;
    try {
      await supabase.rpc('reveal_mission_votes_secure', {
        p_room_id: room.id
      });
    } catch (err: unknown) {
      console.error('Erro ao revelar votos de missão:', err);
    }
  }, [room]);

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
      let nextState: GameState = 'TEAM_SELECTION';
      let nextRoundNumber = room.round_number + 1;

      if (newScoreThieves >= 3) {
        nextState = 'GAME_OVER';
        nextRoundNumber = room.round_number;
      } else if (newScoreGuests >= 3) {
        const gameMode = room.settings?.gameMode || 'NORMAL';
        if (gameMode === 'GERENTE_ASSASSINO') {
          nextState = 'ASSASSIN_CHOICE';
        } else {
          nextState = 'GAME_OVER';
        }
        nextRoundNumber = room.round_number;
      }

      // Escolha do próximo líder (rotaciona entre os jogadores ativos)
      const currentLeaderIndex = activePlayers.findIndex(p => p.id === room.leader_id);
      const nextLeader = activePlayers[(currentLeaderIndex + 1) % activePlayers.length];
      const nextLeaderId = nextLeader ? nextLeader.id : room.leader_id;

      // 1. Limpa os votos e status de envio de todos os jogadores
      await supabase
        .from('players')
        .update({ team_vote: null, has_voted_mission: false })
        .eq('room_id', room.id);

      // 2. Atualiza a sala para a próxima rodada ou fim de jogo
      await supabase
        .from('rooms')
        .update({
          score_guests: newScoreGuests,
          score_thieves: newScoreThieves,
          history: updatedHistory,
          state: nextState,
          round_number: nextRoundNumber,
          leader_id: nextLeaderId,
          current_team: [],
          mission_votes: [],
          refusals_count: 0
        })
        .eq('id', room.id);

    } catch (err: unknown) {
      console.error('Erro ao processar resultado da missão:', err);
    }
  }, [room, players]);



  // AÇÃO: Reiniciar Jogo (Host/TV)
  const restartGame = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    try {
      // 1. Remove os papéis antigos da tabela privada player_roles
      // Buscamos os jogadores atuais da sala no banco para evitar dependência obsoleta do estado React
      const { data: roomPlayers } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', room.id);

      const playerIds = roomPlayers?.map((p) => p.id) || [];
      if (playerIds.length > 0) {
        await supabase
          .from('player_roles')
          .delete()
          .in('player_id', playerIds);
      }

      // 2. Reseta campos dos jogadores
      await supabase
        .from('players')
        .update({
          team_vote: null,
          has_voted_mission: false
        })
        .eq('room_id', room.id);

      const nextSettings = {
        timer: room.settings.timer,
        maxPlayers: room.settings.maxPlayers,
        gameMode: room.settings.gameMode || 'NORMAL'
      };

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
          leader_id: null,
          settings: nextSettings
        })
        .eq('id', room.id);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao reiniciar o jogo.');
    } finally {
      setLoading(false);
    }
  }, [room]);

  // AÇÃO: Executar assassinato do Gerente (Assassino)
  const executeAssassination = useCallback(async (targetPlayerId: string): Promise<boolean> => {
    if (!room || !currentPlayer) return false;
    setLoading(true);
    try {
      const { data: success, error: rpcErr } = await supabase.rpc('execute_assassination', {
        p_room_id: room.id,
        p_assassin_id: currentPlayer.id,
        p_target_id: targetPlayerId
      });

      if (rpcErr) throw rpcErr;
      return !!success;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Falha ao executar assassinato.';
      setError(errMsg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [room, currentPlayer]);

  // AÇÃO: Atualizar configurações da sala
  const updateRoomSettings = useCallback(async (newSettings: Partial<RoomSettings>) => {
    if (!room) return;
    try {
      const updatedSettings = { ...room.settings, ...newSettings };
      const { error: err } = await supabase
        .from('rooms')
        .update({ settings: updatedSettings })
        .eq('id', room.id);

      if (err) throw err;
    } catch (err: unknown) {
      console.error('Erro ao atualizar configurações da sala:', err);
    }
  }, [room]);

  // AÇÃO: Enviar Mensagem no Chat
  const sendMessage = useCallback(async (content: string) => {
    if (!room || !currentPlayer) return;
    try {
      await supabase
        .from('messages')
        .insert({
          room_id: room.id,
          player_id: currentPlayer.id,
          player_name: currentPlayer.name,
          content: content.trim()
        });
    } catch (err: unknown) {
      console.error('Erro ao enviar mensagem:', err);
    }
  }, [room, currentPlayer]);

  return (
    <GameContext.Provider
      value={{
        room,
        players,
        currentPlayer,
        messages,
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
        revealMissionVotes,
        restartGame,
        clearGame,
        clearReactState,
        loadRoomData,
        sendMessage,
        executeAssassination,
        updateRoomSettings,
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
