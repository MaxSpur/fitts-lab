-- Fitts Lab 1.0. Apply to a dedicated Supabase project using `supabase db push`.
-- All participant writes go through the validated Edge Function. Anonymous database access is revoked.
begin;
create table public.instructors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  title text not null check (length(title) between 1 and 100),
  phase text not null default 'horizontal' check (phase in ('horizontal','circles','interfaces','results')),
  status text not null default 'open' check (status in ('open','closed')),
  capacity integer not null default 60 check (capacity between 1 and 400),
  participant_count integer not null default 0 check (participant_count >= 0),
  trial_count integer not null default 0 check (trial_count between 0 and 150000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  accept_until timestamptz not null default (now()+interval '24 hours')
);
create unique index one_open_room_per_slug on public.rooms(slug) where status='open';
create index rooms_by_owner on public.rooms(owner_id,created_at desc);
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  client_key uuid not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  label text not null,
  device text not null check (device in ('mouse','trackpad','pen','other','unspecified')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 4000),
  last_batch_at timestamptz,
  created_at timestamptz not null default now(),
  unique(room_id,client_key), unique(id,room_id)
);
create table public.trials (
  sequence bigint generated always as identity primary key,
  trial_id uuid not null,
  participant_id uuid not null,
  room_id uuid not null references public.rooms(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data)='object'),
  received_at timestamptz not null default clock_timestamp(),
  foreign key(participant_id,room_id) references public.participants(id,room_id) on delete cascade,
  unique(participant_id,trial_id)
);
create index trials_room_sequence on public.trials(room_id,sequence);
create index participants_room on public.participants(room_id);
alter table public.instructors enable row level security;
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.trials enable row level security;
revoke all on public.instructors, public.rooms, public.participants, public.trials from anon, authenticated;
revoke all on sequence public.trials_sequence_seq from anon, authenticated;
grant all on public.instructors, public.rooms, public.participants, public.trials to service_role;
grant usage, select on sequence public.trials_sequence_seq to service_role;

create function public.is_fitts_instructor() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.instructors where user_id=auth.uid()); $$;
revoke all on function public.is_fitts_instructor() from public, anon;
grant execute on function public.is_fitts_instructor() to authenticated, service_role;
-- The rooms table is readable only by its instructor owner; this also backs Realtime authorization.
grant select on public.rooms to authenticated;
create policy "instructor reads own rooms" on public.rooms for select to authenticated
using (owner_id=auth.uid() and public.is_fitts_instructor());
create policy "Fitts owner receives private broadcasts" on realtime.messages for select to authenticated
using (
  extension='broadcast' and exists (
    select 1 from public.rooms r
    where r.owner_id=auth.uid() and ('classroom:'||r.id::text)=realtime.topic()
      and public.is_fitts_instructor()
  )
);
-- No INSERT policy on realtime.messages: browsers cannot publish class measurements.

create function public.create_fitts_room(p_owner uuid,p_slug text,p_title text,p_capacity integer)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare result public.rooms; begin
  if not exists(select 1 from public.instructors where user_id=p_owner) then raise exception 'Instructor access required' using errcode='42501'; end if;
  -- Serialize competing creation requests for a slug, including those from different instructors.
  perform pg_advisory_xact_lock(hashtextextended(p_slug,0));
  update public.rooms set status='closed',accept_until=least(expires_at,clock_timestamp()+interval '10 minutes')
    where slug=p_slug and status='open' and (owner_id=p_owner or expires_at<clock_timestamp());
  if exists(select 1 from public.rooms where slug=p_slug and status='open') then raise exception 'This classroom name is in use'; end if;
  insert into public.rooms(owner_id,slug,title,capacity) values(p_owner,p_slug,p_title,p_capacity) returning * into result;
  return to_jsonb(result);
end; $$;

create function public.join_fitts_room(p_room uuid,p_client uuid,p_hash text,p_device text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare r public.rooms;p public.participants;new_id uuid;begin
  select * into r from public.rooms where id=p_room for update;
  if not found or r.status<>'open' or r.expires_at<=clock_timestamp() then raise exception 'Classroom is closed'; end if;
  select * into p from public.participants where room_id=p_room and client_key=p_client;
  if found then
    if p.token_hash<>p_hash then raise exception 'Invalid participant credentials' using errcode='42501'; end if;
    return jsonb_build_object('id',p.id,'label',p.label,'device',p.device);
  end if;
  if r.participant_count>=r.capacity then raise exception 'Classroom capacity reached'; end if;
  new_id:=gen_random_uuid();
  insert into public.participants(id,room_id,client_key,token_hash,label,device)
    values(new_id,p_room,p_client,p_hash,'P-'||upper(left(new_id::text,6)),p_device) returning * into p;
  update public.rooms set participant_count=participant_count+1 where id=p_room;
  begin
    perform realtime.send(jsonb_build_object('id',p.id,'label',p.label,'device',p.device),'participant','classroom:'||p_room::text,true);
  exception when others then
    -- The database remains authoritative if Realtime is temporarily unavailable.
    raise warning 'Fitts participant notification could not be sent';
  end;
  return jsonb_build_object('id',p.id,'label',p.label,'device',p.device);
end; $$;

create function public.ingest_fitts_batch(p_participant uuid,p_hash text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare r public.rooms;p public.participants;rid uuid;item jsonb;stored jsonb;
  n integer:=0;new_count integer:=0;seq bigint;accepted jsonb:='[]'::jsonb;published jsonb:='[]'::jsonb;begin
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 24 or pg_column_size(p_rows)>150000 then raise exception 'Invalid batch size'; end if;
  select room_id into rid from public.participants where id=p_participant and token_hash=p_hash;
  if not found then raise exception 'Invalid participant credentials' using errcode='42501'; end if;
  -- Lock the room before the participant. Inserts/commits are serialized PER ROOM so a snapshot
  -- cursor can safely advance, even when requests arrive concurrently from many participants.
  select * into r from public.rooms where id=rid for update;
  select * into p from public.participants where id=p_participant for update;
  if r.accept_until<=clock_timestamp() or r.expires_at<=clock_timestamp() then raise exception 'Upload window has ended'; end if;
  select count(distinct (value->>'id')::uuid) into new_count from jsonb_array_elements(p_rows)
    where not exists(select 1 from public.trials t where t.participant_id=p.id and t.trial_id=(value->>'id')::uuid);
  if new_count>0 and p.last_batch_at is not null and clock_timestamp()-p.last_batch_at<interval '250 milliseconds' then raise exception 'Upload rate exceeded'; end if;
  if p.attempt_count+new_count>4000 or r.trial_count+new_count>150000 then raise exception 'Measurement capacity reached'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    if (item->>'schema_version')::integer<>1 or jsonb_typeof(item->'hit')<>'boolean' then raise exception 'Invalid trial schema'; end if;
    stored:=item || jsonb_build_object('participant_id',p.id,'participant_label',p.label,'room_id',rid,'source','classroom');
    seq:=null;
    insert into public.trials(trial_id,participant_id,room_id,data)
      values((item->>'id')::uuid,p.id,rid,stored) on conflict(participant_id,trial_id) do nothing returning sequence into seq;
    accepted:=accepted||jsonb_build_array(item->>'id');
    if seq is not null then n:=n+1;published:=published||jsonb_build_array(stored||jsonb_build_object('seq',seq::text));end if;
  end loop;
  update public.participants set attempt_count=attempt_count+n,last_batch_at=clock_timestamp() where id=p.id;
  update public.rooms set trial_count=trial_count+n where id=rid;
  if n>0 then
    begin
      -- Exactly one notification per accepted batch, NOT one row-change event per click.
      perform realtime.send(jsonb_build_object('rows',published),'trials','classroom:'||rid::text,true);
    exception when others then raise warning 'Fitts trial notification could not be sent';end;
  end if;
  return jsonb_build_object('accepted',accepted,'inserted',n);
end; $$;
-- SECURITY DEFINER helpers must never be invokable directly by browsers.
revoke all on function public.create_fitts_room(uuid,text,text,integer) from public, anon, authenticated;
revoke all on function public.join_fitts_room(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.ingest_fitts_batch(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_fitts_room(uuid,text,text,integer) to service_role;
grant execute on function public.join_fitts_room(uuid,uuid,text,text) to service_role;
grant execute on function public.ingest_fitts_batch(uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
