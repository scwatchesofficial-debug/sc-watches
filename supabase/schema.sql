-- =====================================================================
--  S&C Watches — base de données Supabase
--  À coller dans Supabase → SQL Editor → New query → Run (une seule fois).
--  ⚠️ Remplacez l'e-mail tout en bas par celui de votre compte admin.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.admins (
  email text primary key
);

create table if not exists public.products (
  id          text primary key,
  name        text not null,
  price       numeric(10,2) not null default 0 check (price >= 0),
  stock       integer not null default 0 check (stock >= 0),
  active      boolean not null default true,
  badge       text default '',
  category    text default '',
  image       text default '',
  short_text  text default '',
  description text default '',
  specs       jsonb not null default '{}'::jsonb,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.customers (
  id         text primary key default gen_random_uuid()::text,
  email      text not null unique,
  name       text default '',
  phone      text default '',
  address    jsonb,
  tags       text[] not null default '{}',
  notes      text default '',
  source     text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id          text primary key default gen_random_uuid()::text,
  ref         text not null unique,
  created_at  timestamptz not null default now(),
  customer_id text references public.customers(id) on delete set null,
  customer    jsonb not null,
  address     jsonb not null,
  lines       jsonb not null,
  subtotal    numeric(10,2) not null,
  shipping    numeric(10,2) not null default 0,
  total       numeric(10,2) not null,
  status      text not null default 'en_attente'
              check (status in ('en_attente','payee','preparation','expediee','livree','annulee')),
  tracking    jsonb not null default '{"carrier":"","number":""}'::jsonb,
  notes       text default '',
  history     jsonb not null default '[]'::jsonb
);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.messages (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  email      text not null,
  subject    text default 'Demande générale',
  message    text not null,
  created_at timestamptz not null default now(),
  status     text not null default 'nouveau' check (status in ('nouveau','lu','traite')),
  notes      text default ''
);

create table if not exists public.settings (
  id            integer primary key default 1 check (id = 1),
  shipping      numeric(10,2) not null default 5,
  contact_email text default '',
  instagram     text default '',
  address       text default '',
  stripe_links  jsonb not null default '{}'::jsonb
);

create table if not exists public.activity_log (
  id   bigserial primary key,
  at   timestamptz not null default now(),
  text text not null
);

-- ---------- Qui est administrateur ? ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- Sécurité (Row Level Security) ----------
alter table public.admins       enable row level security;
alter table public.products     enable row level security;
alter table public.customers    enable row level security;
alter table public.orders       enable row level security;
alter table public.messages     enable row level security;
alter table public.settings     enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists "admins: lecture admin"   on public.admins;
drop policy if exists "products: lecture"       on public.products;
drop policy if exists "products: admin"         on public.products;
drop policy if exists "settings: lecture"       on public.settings;
drop policy if exists "settings: admin"         on public.settings;
drop policy if exists "customers: admin"        on public.customers;
drop policy if exists "orders: admin"           on public.orders;
drop policy if exists "messages: admin"         on public.messages;
drop policy if exists "activity_log: admin"     on public.activity_log;

-- Visiteurs : lecture des montres en ligne et des paramètres publics uniquement.
create policy "products: lecture"   on public.products  for select using (active or public.is_admin());
create policy "settings: lecture"   on public.settings  for select using (true);
-- Administrateurs : accès complet.
create policy "admins: lecture admin" on public.admins     for select using (public.is_admin());
create policy "products: admin"     on public.products     for all using (public.is_admin()) with check (public.is_admin());
create policy "settings: admin"     on public.settings     for all using (public.is_admin()) with check (public.is_admin());
create policy "customers: admin"    on public.customers    for all using (public.is_admin()) with check (public.is_admin());
create policy "orders: admin"       on public.orders       for all using (public.is_admin()) with check (public.is_admin());
create policy "messages: admin"     on public.messages     for all using (public.is_admin()) with check (public.is_admin());
create policy "activity_log: admin" on public.activity_log for all using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.products, public.settings to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- Fonctions publiques (appelées par le site) ----------

-- Passer une commande : prix et stock vérifiés côté serveur.
create or replace function public.create_order(p_items jsonb, p_customer jsonb, p_address jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_item  jsonb;
  v_prod  public.products%rowtype;
  v_qty   integer;
  v_lines jsonb := '[]'::jsonb;
  v_sub   numeric := 0;
  v_ship  numeric;
  v_email text := lower(trim(coalesce(p_customer ->> 'email', '')));
  v_name  text := trim(coalesce(p_customer ->> 'name', ''));
  v_phone text := trim(coalesce(p_customer ->> 'phone', ''));
  v_addr  jsonb;
  v_cust  text;
  v_ref   text;
  v_id    text := gen_random_uuid()::text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'Adresse e-mail invalide'; end if;
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Nom invalide'; end if;
  if length(v_phone) > 40 then raise exception 'Téléphone invalide'; end if;
  if coalesce(p_address ->> 'zip', '') !~ '^\d{5}$' then raise exception 'Le code postal doit comporter 5 chiffres'; end if;
  if length(trim(coalesce(p_address ->> 'line1', ''))) < 3 or length(trim(coalesce(p_address ->> 'city', ''))) < 2 then
    raise exception 'Adresse incomplète';
  end if;
  v_addr := jsonb_build_object(
    'line1', left(trim(p_address ->> 'line1'), 200),
    'line2', left(trim(coalesce(p_address ->> 'line2', '')), 200),
    'zip',   p_address ->> 'zip',
    'city',  left(trim(p_address ->> 'city'), 100));

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 10 then
    raise exception 'Panier invalide';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, least(10, coalesce((v_item ->> 'qty')::integer, 1)));
    select * into v_prod from public.products where id = v_item ->> 'productId' and active for update;
    if not found then raise exception 'Ce modèle n''est plus disponible'; end if;
    if v_prod.stock < v_qty then raise exception 'Stock insuffisant pour %', v_prod.name; end if;
    update public.products set stock = stock - v_qty where id = v_prod.id;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'productId', v_prod.id, 'name', v_prod.name, 'price', v_prod.price, 'qty', v_qty, 'image', v_prod.image));
    v_sub := v_sub + v_prod.price * v_qty;
  end loop;

  select shipping into v_ship from public.settings where id = 1;
  v_ship := coalesce(v_ship, 0);

  insert into public.customers (email, name, phone, address, source)
  values (v_email, v_name, v_phone, v_addr, 'commande')
  on conflict (email) do update
    set name = excluded.name, phone = excluded.phone, address = excluded.address, updated_at = now()
  returning id into v_cust;

  loop
    v_ref := 'SC-' || (floor(random() * 900000) + 100000)::integer::text;
    exit when not exists (select 1 from public.orders where ref = v_ref);
  end loop;

  insert into public.orders (id, ref, customer_id, customer, address, lines, subtotal, shipping, total, status, history)
  values (v_id, v_ref, v_cust,
          jsonb_build_object('name', v_name, 'email', v_email, 'phone', v_phone),
          v_addr, v_lines, v_sub, v_ship, v_sub + v_ship, 'en_attente',
          jsonb_build_array(jsonb_build_object('status', 'en_attente', 'at', now(), 'note', 'Commande créée sur le site')));

  return jsonb_build_object('id', v_id, 'ref', v_ref, 'total', v_sub + v_ship, 'email', v_email);
end $$;

-- Suivi de commande : renvoie uniquement les infos utiles au client.
create or replace function public.track_order(p_ref text, p_email text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ref', ref, 'createdAt', created_at, 'status', status, 'tracking', tracking,
                            'lines', lines, 'shipping', shipping, 'total', total)
  from public.orders
  where ref = upper(trim(p_ref)) and customer ->> 'email' = lower(trim(p_email))
  limit 1;
$$;

-- Formulaire de contact.
create or replace function public.add_message(p_name text, p_email text, p_subject text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then raise exception 'Adresse e-mail invalide'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 120 then raise exception 'Nom invalide'; end if;
  if length(trim(coalesce(p_message, ''))) < 2 or length(p_message) > 5000 then raise exception 'Message invalide'; end if;
  insert into public.customers (email, name, source) values (v_email, trim(p_name), 'contact')
  on conflict (email) do nothing;
  insert into public.messages (name, email, subject, message)
  values (trim(p_name), v_email, left(coalesce(nullif(trim(p_subject), ''), 'Demande générale'), 120), trim(p_message));
end $$;

revoke all on function public.create_order(jsonb, jsonb, jsonb) from public;
revoke all on function public.track_order(text, text) from public;
revoke all on function public.add_message(text, text, text, text) from public;
grant execute on function public.create_order(jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.add_message(text, text, text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Automatismes ----------
create or replace function public.status_label(s text) returns text language sql immutable as $$
  select case s when 'en_attente' then 'En attente de paiement' when 'payee' then 'Payée'
    when 'preparation' then 'En préparation' when 'expediee' then 'Expédiée'
    when 'livree' then 'Livrée' when 'annulee' then 'Annulée' else s end;
$$;

-- Remise en stock à l'annulation (et retrait si la commande est réactivée) + journal.
create or replace function public.orders_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare l jsonb;
begin
  if new.status is distinct from old.status then
    if new.status = 'annulee' then
      for l in select * from jsonb_array_elements(old.lines) loop
        update public.products set stock = stock + (l ->> 'qty')::integer where id = l ->> 'productId';
      end loop;
    elsif old.status = 'annulee' then
      for l in select * from jsonb_array_elements(old.lines) loop
        update public.products set stock = greatest(0, stock - (l ->> 'qty')::integer) where id = l ->> 'productId';
      end loop;
    end if;
    insert into public.activity_log (text) values ('Commande ' || new.ref || ' : ' || public.status_label(new.status));
  end if;
  return new;
end $$;
drop trigger if exists orders_after_update on public.orders;
create trigger orders_after_update after update on public.orders
  for each row execute function public.orders_after_update();

create or replace function public.orders_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (text) values ('Nouvelle commande ' || new.ref || ' — ' || trim(to_char(new.total, 'FM999990.##')) || ' €');
  return new;
end $$;
drop trigger if exists orders_after_insert on public.orders;
create trigger orders_after_insert after insert on public.orders
  for each row execute function public.orders_after_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (text) values ('Nouveau message de ' || new.name);
  return new;
end $$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------- Données de départ ----------
insert into public.settings (id, shipping, contact_email, instagram, address)
values (1, 5, 'SCWatchesofficial@gmail.com', 'scwatchesofficial', 'Annecy-le-Vieux, 74940, France')
on conflict (id) do nothing;

insert into public.products (id, name, price, stock, active, badge, category, image, short_text, description, specs, sort) values
('finesse', 'S&C Finesse', 145, 12, true, 'Disponible', 'Classique', 'assets/img/finesse.jpg',
 'Boîtier rectangulaire en acier 316L satiné, cadran argent guilloché soleil à chiffres romains.',
 'La Finesse revisite l''élégance des montres rectangulaires d''antan. Son boîtier en acier 316L satiné encadre un cadran argent guilloché, ponctué d''un guichet date et d''une petite seconde. Portée sur un bracelet en cuir noir texture croco, elle accompagne aussi bien un costume qu''une chemise ouverte.',
 '{"Boîtier":"Acier 316L satiné, rectangulaire","Cadran":"Argent guilloché, guichet date","Verre":"Traité anti-reflets","Bracelet":"Cuir noir texture croco"}', 1),
('celeste-date', 'S&C Céleste Date', 195, 8, true, 'Disponible', 'Classique', 'assets/img/celeste-date.jpg',
 'Montre ronde en acier massif à lunette cannelée, cadran argent météorite texturé, jour et date.',
 'La Céleste Date affiche un cadran argent à texture météorite, sublimé par une lunette cannelée qui capte chaque reflet. Mouvement automatique, guichets jour et date : une pièce de caractère pensée pour durer.',
 '{"Boîtier":"Acier massif, rond","Lunette":"Cannelée polie","Cadran":"Argent texture météorite, jour & date","Mouvement":"Automatique","Bracelet":"Acier"}', 2),
('eclipse', 'S&C Eclipse', 240, 5, true, 'Édition numérotée', 'Sport chic', 'assets/img/eclipse.jpg',
 'Icône contemporaine au boîtier octogonal adouci, cadran noir guilloché à rayures horizontales.',
 'L''Eclipse est notre pièce signature. Son boîtier octogonal aux angles adoucis et son bracelet intégré dessinent une silhouette sport chic, tandis que le cadran noir guilloché à rayures horizontales joue avec la lumière. Chaque exemplaire est numéroté.',
 '{"Boîtier":"Acier 316L brossé et poli, octogonal","Cadran":"Noir guilloché à rayures, guichet date","Verre":"Traité anti-reflets","Bracelet":"Acier intégré","Série":"Édition numérotée"}', 3)
on conflict (id) do nothing;

-- ---------- VOTRE COMPTE ADMINISTRATEUR ----------
-- Remplacez par l'e-mail du compte créé dans Authentication → Users :
insert into public.admins (email) values (lower('VOTRE-EMAIL@exemple.com'))
on conflict do nothing;
