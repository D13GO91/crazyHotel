-- Hóspedes vs. Ladrões Database Schema (Clone do The Resistance)
-- Rode este script no Editor SQL do seu projeto Supabase

-- Limpa as tabelas caso já existam (útil para recomeçar o banco)
-- Removemos as tabelas dependentes primeiro na ordem correta
alter table if exists rooms drop constraint if exists fk_rooms_leader;
drop table if exists messages;
drop table if exists player_roles;
drop table if exists player_secrets;
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

-- 3. Habilitar Row Level Security (RLS) e Criar Políticas de Acesso
alter table rooms enable row level security;
alter table players enable row level security;

-- Políticas para salas (Rooms)
create policy "Permitir tudo em salas" on rooms for all using (true);

-- Políticas para jogadores (Players)
create policy "Permitir tudo em jogadores" on players for all using (true);

-- 4. Habilitar Supabase Realtime para as tabelas principais
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

-- 5. Tabelas Privadas de Segurança (Com RLS estrito e sem políticas de SELECT público)

-- Tabela para papéis secretos
create table player_roles (
  player_id uuid primary key references players(id) on delete cascade,
  role varchar(50) not null -- 'GUEST' ou 'THIEF'
);
alter table player_roles enable row level security;
create policy "Permitir inserção de papéis" on player_roles for insert with check (true);
create policy "Permitir remoção de papéis" on player_roles for delete using (true);

-- Tabela para tokens secretos dos jogadores (apenas o cliente sabe seu próprio token)
create table player_secrets (
  player_id uuid primary key references players(id) on delete cascade,
  secret_token uuid not null default gen_random_uuid()
);
alter table player_secrets enable row level security;
create policy "Permitir inserção de segredos" on player_secrets for insert with check (true);

-- 6. Função RPC para registrar voto de missão de forma atômica e anônima
create or replace function append_mission_vote(p_room_id uuid, p_player_id uuid, p_vote text)
returns void as $$
declare
  v_already_voted boolean;
begin
  -- Verifica se o jogador já votou
  select has_voted_mission into v_already_voted
  from players
  where id = p_player_id;

  if v_already_voted then
    return;
  end if;

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

-- 7. Tabela de Mensagens (Chat) e Políticas RLS
create table messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  player_name varchar(100) not null,
  content text not null,
  created_at timestamp with time zone not null default now()
);

-- Índices para otimizar buscas do chat
create index idx_messages_room_id on messages(room_id);

-- Ativar RLS para o chat
alter table messages enable row level security;
create policy "Permitir tudo no chat" on messages for all using (true);

-- Habilitar Supabase Realtime para mensagens
do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then
  -- Silencia erro caso a tabela já esteja na publicação
end $$;

-- 8. Funções RPC Seguras (Security Definer) para consulta de papéis confidenciais

-- A) Buscar o próprio papel
create or replace function get_my_role(p_player_id uuid, p_secret_token uuid)
returns text as $$
declare
  v_role text;
begin
  -- Verifica se o token secreto confere
  if not exists (
    select 1 from player_secrets 
    where player_id = p_player_id and secret_token = p_secret_token
  ) then
    return null;
  end if;

  select role into v_role from player_roles where player_id = p_player_id;
  return v_role;
end;
$$ language plpgsql security definer;

-- B) Buscar os IDs dos outros Ladrões (apenas se quem chama for Ladrão)
create or replace function get_thieves(p_player_id uuid, p_secret_token uuid)
returns table (player_id uuid) as $$
begin
  -- Verifica se o token secreto confere E se quem chama é Ladrão (THIEF)
  if not exists (
    select 1 from player_secrets s
    join player_roles r on r.player_id = s.player_id
    where s.player_id = p_player_id 
      and s.secret_token = p_secret_token 
      and r.role = 'THIEF'
  ) then
    return;
  end if;

  -- Retorna todos os IDs dos jogadores que são ladrões na mesma sala
  return query 
  select pr.player_id 
  from player_roles pr
  join players p on p.id = pr.player_id
  where pr.role = 'THIEF' 
    and p.room_id = (select room_id from players where id = p_player_id);
end;
$$ language plpgsql security definer;

-- C) Revelar todos os papéis (Apenas quando a partida terminou em GAME_OVER)
create or replace function get_game_over_roles(p_room_id uuid)
returns table (player_id uuid, role varchar(50)) as $$
begin
  -- Permite visualizar se o estado da sala for GAME_OVER
  if exists (select 1 from rooms where id = p_room_id and state = 'GAME_OVER') then
    return query 
    select pr.player_id, pr.role 
    from player_roles pr
    join players p on p.id = pr.player_id
    where p.room_id = p_room_id;
  end if;
end;
$$ language plpgsql security definer;

