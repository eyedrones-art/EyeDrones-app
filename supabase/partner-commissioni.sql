-- EyeDrones — programma partner: quanti piloti porta ogni partner (link app.eyedrones.it/?ref=nome)
-- Ogni mese: incolla nello SQL Editor e premi Run.
-- «a_pagamento» conta chi oggi ha un piano a pagamento. Quando arriveranno i pagamenti con Stripe
-- questa query si aggiorna con gli importi reali pagati nel mese (commissione = 25% per 12 mesi).
select
  p.referral as partner,
  count(*) as iscritti,
  count(*) filter (where u.created_at > date_trunc('month', now())) as iscritti_questo_mese,
  count(*) filter (where p.piano in ('pilota', 'pro')) as a_pagamento
from public.profili p
join auth.users u on u.id = p.user_id
where p.referral is not null
  and p.referral not in ('facebook', 'instagram', 'tiktok', 'google', 'linkedin', 'youtube', 'whatsapp', 'telegram', 'ricerca', 'dronezine', 'pagina-pilota', 'galleria', 'partner-pagina')
group by 1
order by a_pagamento desc, iscritti desc;
