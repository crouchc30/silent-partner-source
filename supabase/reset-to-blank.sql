-- Empty these books completely: no businesses, no members, no entries, no history.
-- Run in the SQL Editor of BOTH projects before handing the link to anybody.
-- Accounts are not touched by this; delete those under Authentication > Users.

delete from history;
delete from books;
delete from members;
delete from businesses;

select
  (select count(*) from businesses) as businesses,
  (select count(*) from members)    as members,
  (select count(*) from books)      as books,
  (select count(*) from history)    as history;
