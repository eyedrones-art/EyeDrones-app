-- ora prevista del volo nei piani di volo (Pianificazione volo)
alter table public.piani_volo add column if not exists ora_prevista time;
