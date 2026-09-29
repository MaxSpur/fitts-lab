-- Run against the deployed schema through a privileged SQL connection. All fixtures roll back.
begin;
do $$
declare owner uuid; rid uuid:=gen_random_uuid(); p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); run1 uuid:=gen_random_uuid(); run2 uuid:=gen_random_uuid(); batch jsonb; result jsonb; n integer; denied boolean:=false;
begin
 select user_id into owner from public.instructors limit 1;
 insert into public.rooms(id,owner_id,slug,title) values(rid,owner,'reset-test-'||rid::text,'Transactional reset test');
 insert into public.participants(id,room_id,client_key,token_hash,label,device) values(p1,rid,gen_random_uuid(),repeat('a',64),'Test A','unspecified'),(p2,rid,gen_random_uuid(),repeat('b',64),'Test B','unspecified');
 batch:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'schema_version',1,'hit',true,'run_id',run1),jsonb_build_object('id',gen_random_uuid(),'schema_version',1,'hit',true,'run_id',run2));
 perform public.ingest_fitts_batch(p1,repeat('a',64),batch);
 perform public.ingest_fitts_batch(p2,repeat('b',64),jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'schema_version',1,'hit',true,'run_id',run1)));
 begin perform public.reset_fitts_participant_run(p1,repeat('b',64),run1); exception when insufficient_privilege then denied:=true; end;
 assert denied,'Wrong credential must fail';
 result:=public.reset_fitts_participant_run(p1,repeat('a',64),run1);
 assert (result->>'removed')::integer=1,'Only own current round removed';
 select count(*) into n from public.trials where room_id=rid;assert n=2,'Earlier round and other participant preserved';
 result:=public.ingest_fitts_batch(p1,repeat('a',64),jsonb_build_array(batch->0));
 assert (result->>'inserted')::integer=0,'Delayed deleted trial discarded';
 assert jsonb_array_length(result->'accepted')=1,'Delayed upload acknowledged to drain queue';
 result:=public.reset_fitts_participant_run(p1,repeat('a',64),run1);assert (result->>'removed')::integer=0,'Retry is idempotent';
 select trial_count into n from public.rooms where id=rid;assert n=2,'Room count correct';
 select attempt_count into n from public.participants where id=p1;assert n=1,'Participant count correct';
 select data_revision into n from public.rooms where id=rid;assert n=2,'Classroom invalidated';
 update public.rooms set accept_until=now()-interval '1 minute' where id=rid;
 perform public.reset_fitts_participant_run(p1,repeat('a',64),run2);
 select count(*) into n from public.trials where room_id=rid;assert n=1,'Reset works after admission ends';
end $$;
rollback;
select 'PASS: ownership, round isolation, late upload rejection, idempotency, counters, revision, ended-room reset; all fixtures rolled back' as result;
