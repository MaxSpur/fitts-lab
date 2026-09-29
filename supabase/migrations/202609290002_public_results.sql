-- Add an explicitly published, read-only overview. Existing rooms, trials and ingestion are unchanged.
begin;
create table public.fitts_publication (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  revision bigint not null default 1 check (revision > 0),
  published_at timestamptz not null default now()
);
alter table public.fitts_publication enable row level security;
revoke all on public.fitts_publication from public, anon, authenticated;
grant all on public.fitts_publication to service_role;

create function public.publish_fitts_results(p_owner uuid,p_slug text,p_room uuid,p_expected bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare r public.rooms; pub public.fitts_publication; begin
  if not exists(select 1 from public.instructors where user_id=p_owner) then raise exception 'Instructor access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitts-results:'||p_slug,0));
  select * into pub from public.fitts_publication where slug=p_slug;
  if coalesce(pub.revision,0)<>coalesce(p_expected,0) then raise exception 'Publication changed' using errcode='40001'; end if;
  if found and pub.owner_id<>p_owner then raise exception 'Instructor access required' using errcode='42501'; end if;
  if p_room is not null then
    select * into r from public.rooms where id=p_room and owner_id=p_owner and slug=p_slug;
    if not found then raise exception 'Session not found' using errcode='42501'; end if;
    insert into public.fitts_publication(slug,owner_id,room_id) values(p_slug,p_owner,p_room)
      on conflict(slug) do update set room_id=excluded.room_id,revision=public.fitts_publication.revision+1,published_at=clock_timestamp();
  else
    update public.fitts_publication set room_id=null,revision=revision+1,published_at=clock_timestamp() where slug=p_slug and owner_id=p_owner;
  end if;
  return jsonb_build_object('updated',true);
end; $$;
revoke all on function public.publish_fitts_results(uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.publish_fitts_results(uuid,text,uuid,bigint) to service_role;

-- One STABLE SQL statement gives publication, revision, people and trial page the same MVCC snapshot.
-- Read access remains service-only; the Edge Function exposes only these public read operations.
create function public.read_fitts_public_snapshot(p_slug text,p_room uuid,p_after bigint,p_limit integer,p_publication bigint,p_revision integer)
returns jsonb language sql stable security definer set search_path=''
as $$
with permitted as materialized (
  select r.*,p.revision as publication_revision,
    case when p.revision=p_publication and r.data_revision=p_revision then greatest(p_after,0) else 0 end as effective_after
  from public.fitts_publication p join public.rooms r on r.id=p.room_id
  where p.slug=p_slug and (p_room is null or r.id=p_room)
), page as materialized (
  select t.sequence,t.data from public.trials t join permitted r on r.id=t.room_id
  where t.sequence>r.effective_after order by t.sequence asc limit greatest(0,least(p_limit,500))
)
select jsonb_build_object(
  'room',(select jsonb_build_object('id',r.id,'title',r.title,'slug',r.slug,'status',r.status,'created_at',r.created_at,'expires_at',r.expires_at,'data_revision',r.data_revision) from permitted r),
  'publication_revision',(select revision::text from public.fitts_publication where slug=p_slug),
  'participants',case when p_limit>0 then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'label',p.label,'device',p.device,'created_at',p.created_at) order by p.created_at,p.id) from public.participants p join permitted r on r.id=p.room_id),'[]'::jsonb) else '[]'::jsonb end,
  'trials',coalesce((select jsonb_agg(data||jsonb_build_object('seq',sequence::text) order by sequence) from page),'[]'::jsonb),
  'request_after',coalesce((select effective_after::text from permitted),'0'),
  'cursor',coalesce((select max(sequence)::text from page),(select effective_after::text from permitted),'0'),
  'has_more',p_limit>0 and (select count(*) from page)=least(p_limit,500),
  'restarted',coalesce((select effective_after=0 and p_after>0 from permitted),false)
);
$$;
revoke all on function public.read_fitts_public_snapshot(text,uuid,bigint,integer,bigint,integer) from public,anon,authenticated;
grant execute on function public.read_fitts_public_snapshot(text,uuid,bigint,integer,bigint,integer) to service_role;
notify pgrst,'reload schema';
commit;
