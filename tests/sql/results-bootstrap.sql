-- Isolated CI-only database bootstrap. Never run this against a hosted project.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create schema realtime;
create table realtime.messages(id bigint,extension text);
create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
create function realtime.send(jsonb,text,text,boolean) returns void language plpgsql as $$ begin return; end $$;
