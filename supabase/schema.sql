-- ============================================================
-- 米 kome — esquema completo (ya aplicado en el proyecto
-- Supabase "dietas-familia"). Guardado por si hay que rehacerlo.
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_emoji text not null default '🙂',
  color text not null default '#e11d48',
  sex text default 'f' check (sex in ('f','m')),
  birth_date date,
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  activity_level text default 'ligero' check (activity_level in ('sedentario','ligero','moderado','activo','muy_activo')),
  goal text default 'mantener' check (goal in ('perder_rapido','perder','mantener','ganar','ganar_rapido')),
  auto_targets boolean not null default true,
  protein_per_kg numeric(4,2) default 1.8,
  fat_per_kg numeric(4,2) default 0.9,
  kcal_goal integer not null default 2000,
  protein_goal integer not null default 130,
  carbs_goal integer not null default 220,
  fat_goal integer not null default 65,
  fiber_goal integer default 30,
  water_goal_ml integer default 2000,
  meal_split jsonb default '{"desayuno":0.25,"comida":0.35,"merienda":0.10,"cena":0.30,"snack":0.0}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  barcode text,
  source text not null default 'manual' check (source in ('manual','off')),
  off_id text,
  kcal_100 numeric(8,2) not null default 0,
  protein_100 numeric(8,2) not null default 0,
  carbs_100 numeric(8,2) not null default 0,
  fat_100 numeric(8,2) not null default 0,
  fiber_100 numeric(8,2),
  sugars_100 numeric(8,2),
  sat_fat_100 numeric(8,2),
  sodium_100 numeric(8,2),
  default_serving_g numeric(8,2) default 100,
  serving_name text,
  image_url text,
  is_favorite boolean not null default false,
  times_used integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists foods_barcode_key on public.foods (barcode) where barcode is not null;
create index if not exists foods_name_idx on public.foods using gin (to_tsvector('spanish', name));

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'comida' check (category in ('desayuno','comida','cena','merienda','snack')),
  photo_url text,
  notes text,
  steps text,
  servings numeric(6,2) not null default 1,
  prep_min integer,
  total_weight_g numeric(8,2),
  tags text[] default '{}',
  kcal numeric(8,2) not null default 0,
  protein numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  fiber numeric(8,2) not null default 0,
  sugars numeric(8,2) not null default 0,
  sat_fat numeric(8,2) not null default 0,
  sodium numeric(8,2) not null default 0,
  is_favorite boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  name text not null,
  grams numeric(8,2) not null default 0,
  kcal numeric(8,2) not null default 0,
  protein numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  fiber numeric(8,2) not null default 0,
  sugars numeric(8,2) not null default 0,
  sat_fat numeric(8,2) not null default 0,
  sodium numeric(8,2) not null default 0,
  position integer not null default 0
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  meal text not null default 'comida' check (meal in ('desayuno','comida','cena','merienda','snack')),
  source_type text not null default 'quick' check (source_type in ('food','recipe','quick')),
  food_id uuid references public.foods(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  name text not null,
  grams numeric(8,2),
  servings numeric(6,2),
  kcal numeric(8,2) not null default 0,
  protein numeric(8,2) not null default 0,
  carbs numeric(8,2) not null default 0,
  fat numeric(8,2) not null default 0,
  fiber numeric(8,2) not null default 0,
  sugars numeric(8,2) not null default 0,
  sat_fat numeric(8,2) not null default 0,
  sodium numeric(8,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists diary_profile_date_idx on public.diary_entries (profile_id, date desc);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  ml integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric(5,2) not null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists weight_profile_date_key on public.weight_logs (profile_id, date);

create or replace view public.daily_totals as
select profile_id, date,
  round(sum(kcal))::int as kcal, round(sum(protein))::int as protein,
  round(sum(carbs))::int as carbs, round(sum(fat))::int as fat,
  round(sum(fiber))::int as fiber, round(sum(sugars))::int as sugars,
  round(sum(sat_fat))::int as sat_fat, round(sum(sodium))::int as sodium,
  count(*)::int as items
from public.diary_entries group by profile_id, date;

-- RLS abierta a la clave pública: app familiar sin login
do $$
declare t text;
begin
  foreach t in array array['profiles','foods','recipes','recipe_ingredients','diary_entries','water_logs','weight_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "acceso_familia" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Fotos de recetas
insert into storage.buckets (id, name, public) values ('recipe-photos','recipe-photos',true)
on conflict (id) do nothing;
create policy "fotos_lectura" on storage.objects for select to anon, authenticated using (bucket_id = 'recipe-photos');
create policy "fotos_subida"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'recipe-photos');
create policy "fotos_borrado" on storage.objects for delete to anon, authenticated using (bucket_id = 'recipe-photos');

-- ============================================================
-- Ampliación: gustos por persona, plan semanal y pasos
-- ============================================================

alter table public.recipes add column if not exists liked_by uuid[] not null default '{}';
create index if not exists recipes_liked_idx on public.recipes using gin (liked_by);

alter table public.profiles add column if not exists steps_goal integer default 10000;

create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  steps integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists step_profile_date_key on public.step_logs (profile_id, date);

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  meal text not null check (meal in ('desayuno','comida','merienda','cena','snack')),
  recipe_id uuid references public.recipes(id) on delete set null,
  note text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists meal_plan_date_idx on public.meal_plan (date);

create or replace view public.daily_water as
select profile_id, date, sum(ml)::int as ml from public.water_logs group by profile_id, date;

create or replace view public.daily_steps as
select profile_id, date, max(steps)::int as steps from public.step_logs group by profile_id, date;

alter table public.step_logs enable row level security;
alter table public.meal_plan enable row level security;
create policy "acceso_familia" on public.step_logs for all to anon, authenticated using (true) with check (true);
create policy "acceso_familia" on public.meal_plan for all to anon, authenticated using (true) with check (true);
grant select on public.daily_water, public.daily_steps to anon, authenticated;

-- Lista de la compra de la casa (manual, con casillas)
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  done boolean not null default false,
  qty text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.shopping_items enable row level security;
create policy "acceso_familia" on public.shopping_items for all to anon, authenticated using (true) with check (true);
