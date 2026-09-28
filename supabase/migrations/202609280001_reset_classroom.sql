begin;
alter table public.rooms add column data_revision integer not null default 0;
create function public.reset_fitts_room_data(p_room uuid,p_owner uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare r public.rooms; n integer; begin
  select * into r from public.rooms where id=p_room and owner_id=p_owner for update;
  if not found or not exists(select 1 from public.instructors where user_id=p_owner) then
    raise exception 'Instructor access required' using errcode='42501';
  end if;
  delete from public.trials where room_id=p_room;
  get diagnostics n = row_count;
  update public.participants set attempt_count=0,last_batch_at=null where room_id=p_room;
  update public.rooms set trial_count=0,data_revision=data_revision+1 where id=p_room returning * into r;
  begin
    perform realtime.send(to_jsonb(r),'room','classroom:'||p_room::text,true);
  exception when others then raise warning 'Fitts reset notification could not be sent'; end;
  return jsonb_build_object('room',to_jsonb(r),'removed',n);
end; $$;
revoke all on function public.reset_fitts_room_data(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reset_fitts_room_data(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
