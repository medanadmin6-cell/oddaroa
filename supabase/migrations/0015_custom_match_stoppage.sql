-- Extra minutes the operator adds to each half of a custom match.
-- The clock shows them as 45+ and 90+, then waits them out before half time
-- and full time.

alter table custom_matches
  add column if not exists stoppage_first smallint not null default 0,
  add column if not exists stoppage_second smallint not null default 0;
