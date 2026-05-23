-- Hóspedes vs. Ladrões Database Schema (Clone do The Resistance)
-- Rode este script no Editor SQL do seu projeto Supabase

-- Limpa as tabelas caso já existam (útil para recomeçar o banco)
-- Removemos a constraint primeiro para evitar erros de drop
alter table if exists rooms drop constraint if exists fk_rooms_leader;
drop table if exists players;
drop table if exists rooms;

-- 1. Tabela de Salas (Rooms)
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code varchar(4) not null unique,
  state varchar(50) not null default 'LOBBY',
  settings jsonb not null default '{"timer": 60, "maxPlayers": 10}'::jsonb,
  leader_id uuid, -- Referência ao jogador líder atual
  round_number integer not null default 1, -- Rodada/Missão atual (1 a 5)
  refusals_count integer not null default 0, -- Vezes que a equipe foi rejeitada consecutivamente (0 a 2)
  score_guests integer not null default 0, -- Placar dos Hóspedes (Missões com sucesso)
  score_thieves integer not null default 0, -- Placar dos Ladrões (Missões sabotadas)
  current_team jsonb not null default '[]'::jsonb, -- Array de IDs dos jogadores propostos (ex: ["uuid1", "uuid2"])
  mission_votes jsonb not null default '[]'::jsonb, -- Votos secretos enviados da missão (ex: ["SUCCESS", "FAIL"])
  history jsonb not null default '[]'::jsonb, -- Histórico de rodadas terminadas
  created_at timestamp with time zone not null default now()
);

-- 2. Tabela de Jogadores (Players)
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name varchar(100) not null,
  is_host boolean not null default false,
  role varchar(50), -- 'GUEST' (Hóspede), 'THIEF' (Ladrão), ou NULL antes do início
  is_alive boolean not null default true, -- Não usado no Resistance, mas mantido por compatibilidade
  score integer not null default 0,
  team_vote varchar(50), -- Voto para a equipe: 'APPROVE', 'REJECT', ou NULL
  has_voted_mission boolean not null default false, -- Se já votou na missão secreta
  joined_at timestamp with time zone not null default now(),
  status varchar(50) not null default 'CONNECTED' -- 'CONNECTED', 'DISCONNECTED'
);

-- Adiciona a foreign key em rooms para leader_id apontando para players
alter table rooms add constraint fk_rooms_leader foreign key (leader_id) references players(id) on delete set null;

-- Índices para otimizar buscas
create index idx_players_room_id on players(room_id);

-- Desativar RLS (Row Level Security) para simplificar a conexão anônima do jogo
alter table rooms disable row level security;
alter table players disable row level security;

-- 3. Habilitar Supabase Realtime para as duas tabelas
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Tenta adicionar as tabelas à publicação. Se já estiverem associadas, ignora o erro silenciosamente.
do $$
begin
  alter publication supabase_realtime add table rooms;
exception when duplicate_object then
  -- Silencia erro caso a tabela já esteja na publicação
end $$;

do $$
begin
  alter publication supabase_realtime add table players;
exception when duplicate_object then
  -- Silencia erro caso a tabela já esteja na publicação
end $$;

-- 4. Função RPC para registrar voto de missão de forma atômica e anônima
create or replace function append_mission_vote(p_room_id uuid, p_player_id uuid, p_vote text)
returns void as $$
begin
  -- Marca o jogador como tendo votado
  update players 
  set has_voted_mission = true 
  where id = p_player_id;

  -- Adiciona o voto de forma anônima ao array jsonb da sala
  update rooms 
  set mission_votes = mission_votes || jsonb_build_array(p_vote)
  where id = p_room_id;
end;
$$ language plpgsql;
