-- The site is Oddaroa now. Same two places the name reaches the database as
-- the last rename: the house league custom matches are filed under, and the
-- account name shown on the manual deposit screen. Both are carried over here
-- so a running deployment says the new name without anyone editing a row by
-- hand.

alter table custom_matches alter column league set default 'Oddaroa Special';

update custom_matches
   set league = 'Oddaroa Special'
 where league in ('BetCono Special', 'Stakeza Special', 'Betlixx Special');

update app_settings
   set value = 'Oddaroa Ghana', updated_at = now()
 where key = 'deposit_account_name'
   and value in ('BetCono Ghana', 'Stakeza Ghana', 'Betlixx Ghana');
