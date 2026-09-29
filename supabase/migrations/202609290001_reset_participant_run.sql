begin;
-- Tombstones outlive a reset so delayed/offline copies cannot restore the round.
create table public.participant_reset_runs (
  participant_id uuid not null references public.participants(id) on delete cascade,
  run_id uuid not null,
  primary key(participant_id,run_id)
);
alter table public.participant_reset_runs enable row level security;
revoke all on public.participant_reset_runs from public,anon,authenticated;
grant all on public.participant_reset_runs to service_role;

create function public.reset_fitts_participant_run(p_participant uuid,p_hash text,p_run uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare r public.rooms; p public.participants; rid uuid; n integer; begin
  if p_run is null then raise exception 'Run ID required'; end if;
  select room_id into rid from public.participants where id=p_participant and token_hash=p_hash;
  if not found then raise exception 'Invalid participant credentials' using errcode='42501'; end if;
  select * into r from public.rooms where id=rid for update;
  select * into p from public.participants where id=p_participant and token_hash=p_hash for update;
  if not found then raise exception 'Invalid participant credentials' using errcode='42501'; end if;
  insert into public.participant_reset_runs values(p.id,p_run) on conflict do nothing;
  delete from public.trials where participant_id=p.id and data->>'run_id'=p_run::text;
  get diagnostics n = row_count;
  update public.participants set attempt_count=greatest(0,attempt_count-n),last_batch_at=null where id=p.id;
  update public.rooms set trial_count=greatest(0,trial_count-n),data_revision=data_revision+1 where id=rid returning * into r;
  begin
    perform realtime.send(to_jsonb(r),'room','classroom:'||rid::text,true);
  exception when others then raise warning 'Fitts participant reset notification could not be sent'; end;
  return jsonb_build_object('removed',n);
end; $$;
revoke all on function public.reset_fitts_participant_run(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.reset_fitts_participant_run(uuid,text,uuid) to service_role;

create or replace function public.ingest_fitts_batch(p_participant uuid,p_hash text,p_rows jsonb)
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
  -- The room lock serializes reset with ingestion, including already in-flight batches.
  select coalesce(jsonb_agg(value->>'id'),'[]'::jsonb) into accepted from jsonb_array_elements(p_rows)
    where exists(select 1 from public.participant_reset_runs d where d.participant_id=p.id and d.run_id::text=value->>'run_id');
  select coalesce(jsonb_agg(value),'[]'::jsonb) into p_rows from jsonb_array_elements(p_rows)
    where not exists(select 1 from public.participant_reset_runs d where d.participant_id=p.id and d.run_id::text=value->>'run_id');
  if jsonb_array_length(p_rows)=0 then return jsonb_build_object('accepted',accepted,'inserted',0); end if;
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
notify pgrst,'reload schema';
commit;
