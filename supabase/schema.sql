-- Silent Partner — database schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- A business is one set of books. Everyone who signs up with the link joins
-- the same one, which is what makes Mollie and Shelly see the same numbers.
-- ---------------------------------------------------------------------------
create table if not exists businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My Business',
  created_at  timestamptz not null default now()
);

-- The people who can open those books.
create table if not exists members (
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  joined_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- The books themselves: one row per business, the whole set of books as one
-- JSON document. `version` goes up by one on every save, so two people saving
-- at the same time can be detected instead of quietly overwriting each other.
create table if not exists books (
  business_id uuid primary key references businesses(id) on delete cascade,
  doc         jsonb not null default '{}'::jsonb,
  version     bigint not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Every login and every change, append-only, visible to everyone on the books.
create table if not exists history (
  id          bigserial primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  email       text not null,
  action      text not null,          -- 'signed in', 'added an expense', ...
  detail      text,                   -- 'Nike invoice, $1,240.00'
  at          timestamptz not null default now()
);
create index if not exists history_business_at on history (business_id, at desc);

-- ---------------------------------------------------------------------------
-- Who is allowed to see what.
-- ---------------------------------------------------------------------------
alter table businesses enable row level security;
alter table members    enable row level security;
alter table books      enable row level security;
alter table history    enable row level security;

-- Helper: the businesses the signed-in person belongs to.
create or replace function my_business_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select business_id from members where user_id = auth.uid() $$;

drop policy if exists businesses_read on businesses;
create policy businesses_read on businesses
  for select using (id in (select my_business_ids()));

drop policy if exists members_read on members;
create policy members_read on members
  for select using (business_id in (select my_business_ids()));

drop policy if exists members_join on members;
create policy members_join on members
  for insert with check (user_id = auth.uid());

drop policy if exists books_read on books;
create policy books_read on books
  for select using (business_id in (select my_business_ids()));

drop policy if exists books_write on books;
create policy books_write on books
  for update using (business_id in (select my_business_ids()))
  with check (business_id in (select my_business_ids()));

drop policy if exists books_create on books;
create policy books_create on books
  for insert with check (business_id in (select my_business_ids()));

-- History can be written by members and read by members. Nothing can edit or
-- delete it: that is the point of a history.
drop policy if exists history_read on history;
create policy history_read on history
  for select using (business_id in (select my_business_ids()));

drop policy if exists history_write on history;
create policy history_write on history
  for insert with check (
    business_id in (select my_business_ids()) and user_id = auth.uid()
  );


-- ---------------------------------------------------------------------------
-- Reach. If the project was made with "automatically expose new tables" off,
-- the four tables above exist but the site cannot see them. These grants say
-- a signed-in person may ask; the policies above decide what they get back.
-- Harmless to run when the setting was on.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on businesses, members, books, history to authenticated;
grant insert on members, books, history to authenticated;
grant update on books to authenticated;
grant usage, select on sequence history_id_seq to authenticated;

-- ---------------------------------------------------------------------------
-- Signing up joins you to the one business this site is for, and creates it
-- the first time anybody signs up. Runs as the owner so a brand-new account
-- can join before it is a member of anything.
-- ---------------------------------------------------------------------------
create or replace function join_shop(shop_name text default 'My Business')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare bid uuid;
begin
  -- This runs as the owner, so it has to do its own checking. Without this line a
  -- caller with no account at all can reach it and leave a stray business behind,
  -- and because the join below picks the OLDEST business, that stray would become
  -- the one everybody signs in to.
  if auth.uid() is null then
    raise exception 'you have to be signed in';
  end if;

  select id into bid from businesses order by created_at limit 1;
  if bid is null then
    insert into businesses (name) values (shop_name) returning id into bid;
    insert into books (business_id, doc, version) values (bid, '{}'::jsonb, 0);
  end if;

  insert into members (business_id, user_id, email)
  values (bid, auth.uid(), coalesce(auth.jwt() ->> 'email', 'someone'))
  on conflict (business_id, user_id) do nothing;

  return bid;
end $$;

grant execute on function join_shop(text) to authenticated;

-- Saving: bump the version and refuse if somebody else saved first.
create or replace function save_books(bid uuid, new_doc jsonb, expected_version bigint)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare v bigint;
begin
  if not exists (select 1 from members where business_id = bid and user_id = auth.uid()) then
    raise exception 'not a member of these books';
  end if;

  update books
     set doc = new_doc,
         version = version + 1,
         updated_at = now(),
         updated_by = coalesce(auth.jwt() ->> 'email', 'someone')
   where business_id = bid
     and (expected_version is null or version = expected_version)
  returning version into v;

  if v is null then
    raise exception 'these books changed on another device';
  end if;
  return v;
end $$;

grant execute on function save_books(uuid, jsonb, bigint) to authenticated;

-- Let the browser hear about other people's saves as they happen.
-- Adding a table that is already in the publication is an error, not a no-op,
-- so ask first. This whole file runs in one transaction: one such error rolls
-- back everything above it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'books')
  then execute 'alter publication supabase_realtime add table books'; end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'history')
  then execute 'alter publication supabase_realtime add table history'; end if;
end $$;
