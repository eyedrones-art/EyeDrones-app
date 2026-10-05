-- Provenienza degli iscritti: da dove arriva chi si registra (?ref=facebook, ?ref=instagram, ...)
-- 1) Una volta sola: assicura che la colonna esista (se c'è già non cambia nulla)
alter table public.profili add column if not exists referral text;

-- 2) Ogni volta che vuoi vedere i numeri: incolla da qui in giù nello SQL Editor e premi Run
select
  coalesce(p.referral, 'diretto') as provenienza,
  count(*) as iscritti,
  count(*) filter (where u.created_at > now() - interval '30 days') as ultimi_30_giorni,
  count(*) filter (where u.created_at > now() - interval '7 days') as ultimi_7_giorni
from public.profili p
join auth.users u on u.id = p.user_id
group by 1
order by iscritti desc;
