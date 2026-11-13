-- Zinciri Kırma: cihazlar arası eşitleme tablosu.
-- Supabase panelinde SQL Editor'a yapıştırıp "Run" de.
-- Her kullanıcının her günü tek satır; gün boşalırsa satır silinmez, sets = {} olur
-- (böylece silme işlemi de öbür cihaza geçer).

create table if not exists public.zincir_days (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day        date not null,
  sets       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.zincir_days enable row level security;
revoke all on public.zincir_days from anon;
grant select, insert, update on public.zincir_days to authenticated;

-- herkes sadece kendi satırlarını görür ve değiştirir
create policy "kendi gunlerim - oku"     on public.zincir_days for select using (auth.uid() = user_id);
create policy "kendi gunlerim - ekle"    on public.zincir_days for insert with check (auth.uid() = user_id);
create policy "kendi gunlerim - guncelle" on public.zincir_days for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at'i her zaman sunucu saati belirlesin (cihaz saatleri farklı olabilir)
create or replace function public.zincir_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists zincir_touch on public.zincir_days;
create trigger zincir_touch before insert or update on public.zincir_days
  for each row execute function public.zincir_touch();

-- Hareket listesi (kullanıcı başına tek satır). Sonradan eklendi.
create table if not exists public.zincir_meta (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ex         jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.zincir_meta enable row level security;
revoke all on public.zincir_meta from anon;
grant select, insert, update on public.zincir_meta to authenticated;
create policy "kendi listem - oku"     on public.zincir_meta for select using (auth.uid() = user_id);
create policy "kendi listem - ekle"    on public.zincir_meta for insert with check (auth.uid() = user_id);
create policy "kendi listem - guncelle" on public.zincir_meta for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop trigger if exists zincir_meta_touch on public.zincir_meta;
create trigger zincir_meta_touch before insert or update on public.zincir_meta
  for each row execute function public.zincir_touch();
