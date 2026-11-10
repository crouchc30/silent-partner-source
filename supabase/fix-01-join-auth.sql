-- Fix: join_shop must refuse callers with no account, and any business left
-- behind by one has to go. Paste into the SQL Editor and Run.

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

-- Clear out any business nobody is a member of (the stray from testing).
delete from books   where business_id in (select id from businesses b where not exists (select 1 from members m where m.business_id = b.id));
delete from history where business_id in (select id from businesses b where not exists (select 1 from members m where m.business_id = b.id));
delete from businesses b where not exists (select 1 from members m where m.business_id = b.id);

select count(*) as businesses_left from businesses;
