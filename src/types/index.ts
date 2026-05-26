export type GameState = 
  | 'LOBBY' 
  | 'ROLE_ASSIGNMENT' 
  | 'TEAM_SELECTION' 
  | 'TEAM_VOTE' 
  | 'MISSION_VOTE' 
  | 'MISSION_REVEAL' 
  | 'ASSASSIN_CHOICE'
  | 'GAME_OVER';

export type PlayerRole = 'GUEST' | 'THIEF' | 'MANAGER' | 'ASSASSIN';

export interface RoomSettings {
  timer: number;
  maxPlayers: number;
  gameMode?: 'NORMAL' | 'GERENTE_ASSASSINO';
  assassination_target_id?: string;
  assassination_success?: boolean;
}

export interface MissionHistoryEntry {
  round: number;
  size: number;
  fails: number;
  result: 'SUCCESS' | 'FAIL';
  teamNames: string[];
}

export interface Room {
  id: string;
  code: string;
  state: GameState;
  settings: RoomSettings;
  leader_id: string | null;
  round_number: number;
  refusals_count: number;
  score_guests: number;
  score_thieves: number;
  current_team: string[]; // Player IDs
  mission_votes: ('SUCCESS' | 'FAIL')[]; // Shuffled secretly
  history: MissionHistoryEntry[];
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  is_host: boolean;
  role: PlayerRole | null;
  is_alive: boolean; // Retained for compatibility
  score: number;
  team_vote: 'APPROVE' | 'REJECT' | null;
  has_voted_mission: boolean;
  joined_at: string;
  status: 'CONNECTED' | 'DISCONNECTED';
}

export interface Message {
  id: string;
  room_id: string;
  player_id: string | null;
  player_name: string;
  content: string;
  created_at: string;
}

