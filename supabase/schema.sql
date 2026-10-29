-- =====================================================================
--  Librairie Samir Shoker — database schema (Supabase / PostgreSQL)
--  Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
--
--  Roles
--    pending : signed up, no access yet
--    staff   : sell, stock counts, customers, repairs, own recent receipts
--    owner   : everything, including costs, suppliers, profits, reports
--
--  Cost prices, suppliers, purchase orders, sale costs and reports live in
--  tables and functions that only owners can read. The staff app never
--  asks for them, and the database refuses them to staff accounts anyway.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- people
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  username    text unique,
  role        text not null default 'pending' check (role in ('pending','staff','owner')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner' and active);
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff','owner') and active);
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, username)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'username', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The very first person to call this becomes owner. Afterwards it does nothing.
create or replace function public.claim_owner() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from profiles where role = 'owner') then return false; end if;
  update profiles set role = 'owner', active = true where id = auth.uid();
  return true;
end $$;

-- Owners set someone's role, name and whether the account is active.
create or replace function public.set_member(p_user uuid, p_role text, p_active boolean, p_full_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'owners only'; end if;
  if p_role not in ('pending','staff','owner') then raise exception 'bad role'; end if;
  if p_user = auth.uid() and (p_role <> 'owner' or not p_active) then
    raise exception 'you cannot remove your own owner access';
  end if;
  update profiles
     set role = p_role, active = p_active,
         full_name = coalesce(nullif(trim(p_full_name), ''), full_name)
   where id = p_user;
end $$;

-- ---------------------------------------------------------------- settings
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings (key, value) values
  ('shop',  '{"name":"Librairie Samir Shoker","address":"Qab Elias, Bekaa","phone":"","footer":"Thank you · شكراً · Merci"}'),
  ('rate',  '89500'),
  ('book_share', '60')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- catalogue
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null default '',
  city       text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  barcode     text,
  category    text not null default 'stationery',
  kind        text not null default 'item' check (kind in ('item','service')),
  price_usd   numeric(12,2) not null default 0 check (price_usd >= 0),
  qty         numeric(12,2) not null default 0,
  min_qty     numeric(12,2) not null default 0,
  active      boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists products_barcode_uq on public.products (barcode)
  where barcode is not null and barcode <> '';
create index if not exists products_name_idx on public.products (lower(name));

-- Owner-only: cost price and supplier for each product.
create table if not exists public.product_private (
  product_id  uuid primary key references public.products(id) on delete cascade,
  cost_usd    numeric(12,2) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes       text not null default ''
);

create table if not exists public.stock_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products(id) on delete cascade,
  delta       numeric(12,2) not null,
  qty_after   numeric(12,2),
  reason      text not null,          -- initial, sale, void, receive, count, add, remove
  ref_id      uuid,
  note        text not null default '',
  user_id     uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- Products: staff may create products and edit descriptions, but stock
-- quantities only change through the functions below, and only owners
-- may change the price of an existing product.
create or replace function public.products_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.price_usd is distinct from old.price_usd and not is_owner() then
      raise exception 'only owners can change prices';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists products_guard on public.products;
create trigger products_guard before update on public.products
  for each row execute function public.products_guard();

create or replace function public.products_initial_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.qty <> 0 then
    insert into stock_movements (product_id, delta, qty_after, reason)
    values (new.id, new.qty, new.qty, 'initial');
  end if;
  return new;
end $$;
drop trigger if exists products_initial_stock on public.products;
create trigger products_initial_stock after insert on public.products
  for each row execute function public.products_initial_stock();

-- ---------------------------------------------------------------- customers
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null default '',
  notes       text not null default '',
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists customers_name_idx on public.customers (lower(name));

create table if not exists public.customer_payments (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  amount_usd   numeric(12,2) not null check (amount_usd > 0),
  note         text not null default '',
  received_by  uuid default auth.uid(),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- repairs
create table if not exists public.repairs (
  id           uuid primary key default gen_random_uuid(),
  job_no       bigint generated always as identity,
  customer_id  uuid references public.customers(id) on delete set null,
  bike         text not null default '',
  problem      text not null default '',
  status       text not null default 'received'
               check (status in ('received','in_progress','ready','collected','cancelled')),
  labour_usd   numeric(12,2) not null default 0,
  notes        text not null default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  ready_at     timestamptz,
  collected_at timestamptz,
  sale_id      uuid
);

create table if not exists public.repair_parts (
  id          uuid primary key default gen_random_uuid(),
  repair_id   uuid not null references public.repairs(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  qty         numeric(12,2) not null default 1 check (qty > 0),
  unit_price  numeric(12,2) not null default 0
);

-- ---------------------------------------------------------------- sales
create table if not exists public.sales (
  id           uuid primary key default gen_random_uuid(),
  receipt_no   bigint generated always as identity,
  created_at   timestamptz not null default now(),
  seller_id    uuid references public.profiles(id) on delete set null,
  customer_id  uuid references public.customers(id) on delete set null,
  repair_id    uuid references public.repairs(id) on delete set null,
  subtotal     numeric(12,2) not null default 0,
  discount     numeric(12,2) not null default 0,
  total_usd    numeric(12,2) not null default 0,
  paid_usd     numeric(12,2) not null default 0,
  paid_lbp     numeric(16,0) not null default 0,
  rate         numeric(12,2) not null default 89500,
  on_account   numeric(12,2) not null default 0,   -- unpaid part added to the customer's balance
  note         text not null default '',
  voided       boolean not null default false,
  voided_by    uuid,
  voided_at    timestamptz
);
create index if not exists sales_created_idx on public.sales (created_at desc);
create index if not exists sales_customer_idx on public.sales (customer_id);

create table if not exists public.sale_lines (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  qty         numeric(12,2) not null check (qty > 0),
  unit_price  numeric(12,2) not null
);
create index if not exists sale_lines_sale_idx on public.sale_lines (sale_id);

-- Owner-only: what each sold line cost us at the time of sale.
create table if not exists public.sale_costs (
  sale_line_id uuid primary key references public.sale_lines(id) on delete cascade,
  unit_cost    numeric(12,2) not null default 0
);

-- ---------------------------------------------------------------- purchasing (owner-only)
create table if not exists public.purchase_orders (
  id           uuid primary key default gen_random_uuid(),
  po_no        bigint generated always as identity,
  supplier_id  uuid references public.suppliers(id) on delete set null,
  status       text not null default 'ordered' check (status in ('draft','ordered','received','cancelled')),
  note         text not null default '',
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  received_at  timestamptz
);
create table if not exists public.purchase_order_lines (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references public.purchase_orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  qty         numeric(12,2) not null check (qty > 0),
  unit_cost   numeric(12,2) not null default 0
);

-- ---------------------------------------------------------------- schools (owner-only planning)
create table if not exists public.schools (
  id    uuid primary key default gen_random_uuid(),
  name  text not null
);
create table if not exists public.school_grades (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  name       text not null,
  students   integer not null default 0 check (students >= 0),
  sort       integer not null default 0
);
create table if not exists public.grade_books (
  grade_id    uuid not null references public.school_grades(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  primary key (grade_id, product_id)
);

insert into public.schools (name)
select n from (values
  ('Notre Dame des Apôtres (Kab Elias)'),
  ('Notre-Dame de la Consolata (Tanaïl)'),
  ('Saint-Élie (Taalabaya)'),
  ('National Evangelical School (Kab Elias)'),
  ('قب الياس الثانوية الإسلامية'),
  ('يوحنا لودفك شنلر (Schneller)')
) v(n)
where not exists (select 1 from public.schools);

-- =====================================================================
--  Row level security
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.settings             enable row level security;
alter table public.suppliers            enable row level security;
alter table public.products             enable row level security;
alter table public.product_private      enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.customers            enable row level security;
alter table public.customer_payments    enable row level security;
alter table public.repairs              enable row level security;
alter table public.repair_parts         enable row level security;
alter table public.sales                enable row level security;
alter table public.sale_lines           enable row level security;
alter table public.sale_costs           enable row level security;
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.schools              enable row level security;
alter table public.school_grades        enable row level security;
alter table public.grade_books          enable row level security;

-- Signed-in users reach tables through the policies below (some Supabase
-- projects don't grant this automatically, so it is stated here).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Signed-out visitors get nothing.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- profiles: members see the team (names on receipts); everyone sees their own row.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or is_member());
revoke insert, update, delete on public.profiles from authenticated;

-- settings: members read, owners write.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (is_member());
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all using (is_owner()) with check (is_owner());

-- products: members read and add; edits are column-limited (see grants below).
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (is_member());
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert with check (is_member());
drop policy if exists products_update on public.products;
create policy products_update on public.products for update using (is_member()) with check (is_member());
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete using (is_owner());

revoke insert, update on public.products from authenticated;
grant insert (name, barcode, category, kind, price_usd, qty, min_qty, active) on public.products to authenticated;
grant update (name, barcode, category, kind, price_usd, min_qty, active) on public.products to authenticated;

-- customers and repairs: the whole team works with them; only owners delete.
drop policy if exists customers_rw on public.customers;
create policy customers_rw on public.customers for select using (is_member());
drop policy if exists customers_ins on public.customers;
create policy customers_ins on public.customers for insert with check (is_member());
drop policy if exists customers_upd on public.customers;
create policy customers_upd on public.customers for update using (is_member()) with check (is_member());
drop policy if exists customers_del on public.customers;
create policy customers_del on public.customers for delete using (is_owner());

drop policy if exists payments_read on public.customer_payments;
create policy payments_read on public.customer_payments for select using (is_owner() or received_by = auth.uid());
drop policy if exists payments_ins on public.customer_payments;
create policy payments_ins on public.customer_payments for insert with check (is_member() and received_by = auth.uid());
drop policy if exists payments_del on public.customer_payments;
create policy payments_del on public.customer_payments for delete using (is_owner());

drop policy if exists repairs_read on public.repairs;
create policy repairs_read on public.repairs for select using (is_member());
drop policy if exists repairs_ins on public.repairs;
create policy repairs_ins on public.repairs for insert with check (is_member());
drop policy if exists repairs_upd on public.repairs;
create policy repairs_upd on public.repairs for update using (is_member()) with check (is_member());
drop policy if exists repairs_del on public.repairs;
create policy repairs_del on public.repairs for delete using (is_owner());

drop policy if exists rparts_read on public.repair_parts;
create policy rparts_read on public.repair_parts for select using (is_member());
drop policy if exists rparts_ins on public.repair_parts;
create policy rparts_ins on public.repair_parts for insert with check (is_member());
drop policy if exists rparts_upd on public.repair_parts;
create policy rparts_upd on public.repair_parts for update using (is_member()) with check (is_member());
drop policy if exists rparts_del on public.repair_parts;
create policy rparts_del on public.repair_parts for delete using (is_member());

-- sales: owners see all; staff see the receipts they made in the last 3 days.
-- Sales are only created through create_sale().
drop policy if exists sales_read on public.sales;
create policy sales_read on public.sales for select
  using (is_owner() or (is_member() and seller_id = auth.uid() and created_at > now() - interval '3 days'));
revoke insert, update, delete on public.sales from authenticated;

drop policy if exists sale_lines_read on public.sale_lines;
create policy sale_lines_read on public.sale_lines for select
  using (exists (select 1 from public.sales s where s.id = sale_id));
revoke insert, update, delete on public.sale_lines from authenticated;

-- stock history: owners see everything; staff see their own entries.
drop policy if exists moves_read on public.stock_movements;
create policy moves_read on public.stock_movements for select using (is_owner() or user_id = auth.uid());
revoke insert, update, delete on public.stock_movements from authenticated;

-- Owner-only tables.
do $$
declare t text;
begin
  foreach t in array array['suppliers','product_private','sale_costs','purchase_orders',
                           'purchase_order_lines','schools','school_grades','grade_books']
  loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all using (is_owner()) with check (is_owner())', t);
  end loop;
end $$;
revoke insert, update, delete on public.sale_costs from authenticated;

-- =====================================================================
--  Functions the apps call
-- =====================================================================

-- Record a sale: prices of catalogue items come from the database, stock
-- goes down, costs are snapshotted for profit reports.
-- p = {customer_id, discount, paid_usd, paid_lbp, on_account(bool), note, repair_id,
--      lines:[{product_id|null, name, qty, unit_price}]}
create or replace function public.create_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sale  uuid;
  v_no    bigint;
  v_rate  numeric := coalesce((select (value #>> '{}')::numeric from settings where key = 'rate'), 89500);
  v_sub   numeric := 0;
  v_disc  numeric := greatest(coalesce((p->>'discount')::numeric, 0), 0);
  v_total numeric;
  v_pu    numeric := greatest(coalesce((p->>'paid_usd')::numeric, 0), 0);
  v_pl    numeric := greatest(coalesce((p->>'paid_lbp')::numeric, 0), 0);
  v_cust  uuid := nullif(p->>'customer_id', '')::uuid;
  v_rep   uuid := nullif(p->>'repair_id', '')::uuid;
  v_acc   numeric := 0;
  l       jsonb;
  v_pid   uuid;
  v_qty   numeric;
  v_price numeric;
  v_name  text;
  v_line  uuid;
  v_after numeric;
  v_kind  text;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  if jsonb_typeof(p->'lines') <> 'array' or jsonb_array_length(p->'lines') = 0 then
    raise exception 'empty sale';
  end if;

  insert into sales (seller_id, customer_id, repair_id, rate, note)
  values (auth.uid(), v_cust, v_rep, v_rate, coalesce(p->>'note', ''))
  returning id, receipt_no into v_sale, v_no;

  for l in select * from jsonb_array_elements(p->'lines') loop
    v_pid := nullif(l->>'product_id', '')::uuid;
    v_qty := coalesce((l->>'qty')::numeric, 0);
    if v_qty <= 0 then raise exception 'bad quantity'; end if;
    if v_pid is not null then
      select name, price_usd, kind into v_name, v_price, v_kind from products where id = v_pid;
      if not found then raise exception 'unknown product'; end if;
      -- owners may override the price on a line; staff always get the catalogue price
      if is_owner() and l ? 'unit_price' then v_price := greatest((l->>'unit_price')::numeric, 0); end if;
    else
      v_name  := coalesce(nullif(trim(l->>'name'), ''), 'Item');
      v_price := greatest(coalesce((l->>'unit_price')::numeric, 0), 0);
    end if;

    insert into sale_lines (sale_id, product_id, name, qty, unit_price)
    values (v_sale, v_pid, v_name, v_qty, v_price) returning id into v_line;
    v_sub := v_sub + v_qty * v_price;

    if v_pid is not null then
      insert into sale_costs (sale_line_id, unit_cost)
      values (v_line, coalesce((select cost_usd from product_private where product_id = v_pid), 0));
      if v_kind = 'item' then
        update products set qty = qty - v_qty, updated_at = now() where id = v_pid returning qty into v_after;
        insert into stock_movements (product_id, delta, qty_after, reason, ref_id)
        values (v_pid, -v_qty, v_after, 'sale', v_sale);
      end if;
    end if;
  end loop;

  v_disc  := least(v_disc, v_sub);
  v_total := v_sub - v_disc;
  if v_cust is not null and coalesce((p->>'on_account')::boolean, false) then
    v_acc := greatest(round(v_total - v_pu - v_pl / v_rate, 2), 0);
  end if;

  update sales set subtotal = v_sub, discount = v_disc, total_usd = v_total,
                   paid_usd = v_pu, paid_lbp = v_pl, on_account = v_acc
   where id = v_sale;

  if v_rep is not null then
    update repairs set status = 'collected', collected_at = now(), sale_id = v_sale, updated_at = now()
     where id = v_rep;
  end if;

  return jsonb_build_object('id', v_sale, 'receipt_no', v_no, 'total_usd', v_total);
end $$;

-- Cancel a sale (owners): stock goes back, the sale stays visible as voided.
create or replace function public.void_sale(p_sale uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_after numeric;
begin
  if not is_owner() then raise exception 'owners only'; end if;
  if (select voided from sales where id = p_sale) then return; end if;
  for r in select sl.product_id, sl.qty from sale_lines sl join products pr on pr.id = sl.product_id
           where sl.sale_id = p_sale and pr.kind = 'item' loop
    update products set qty = qty + r.qty, updated_at = now() where id = r.product_id returning qty into v_after;
    insert into stock_movements (product_id, delta, qty_after, reason, ref_id) values (r.product_id, r.qty, v_after, 'void', p_sale);
  end loop;
  update sales set voided = true, voided_by = auth.uid(), voided_at = now(), on_account = 0 where id = p_sale;
end $$;

-- Stock changes by hand: mode 'add' (received), 'remove' (damaged/lost), 'set' (counted).
create or replace function public.adjust_stock(p_product uuid, p_mode text, p_qty numeric, p_note text default '')
returns numeric language plpgsql security definer set search_path = public as $$
declare v_old numeric; v_new numeric;
begin
  if not is_member() then raise exception 'not allowed'; end if;
  select qty into v_old from products where id = p_product for update;
  if not found then raise exception 'unknown product'; end if;
  v_new := case p_mode when 'add' then v_old + p_qty
                       when 'remove' then v_old - p_qty
                       when 'set' then p_qty
                       else null end;
  if v_new is null then raise exception 'bad mode'; end if;
  update products set qty = v_new, updated_at = now() where id = p_product;
  insert into stock_movements (product_id, delta, qty_after, reason, note)
  values (p_product, v_new - v_old, v_new,
          case p_mode when 'add' then 'add' when 'remove' then 'remove' else 'count' end,
          coalesce(p_note, ''));
  return v_new;
end $$;

-- Receive a purchase order (owners): stock goes up, cost prices update.
create or replace function public.receive_po(p_po uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_after numeric; v_sup uuid;
begin
  if not is_owner() then raise exception 'owners only'; end if;
  select supplier_id into v_sup from purchase_orders where id = p_po and status <> 'received';
  if not found then return; end if;
  for r in select product_id, qty, unit_cost from purchase_order_lines where po_id = p_po and product_id is not null loop
    update products set qty = qty + r.qty, updated_at = now() where id = r.product_id returning qty into v_after;
    insert into stock_movements (product_id, delta, qty_after, reason, ref_id) values (r.product_id, r.qty, v_after, 'receive', p_po);
    insert into product_private (product_id, cost_usd, supplier_id)
    values (r.product_id, r.unit_cost, v_sup)
    on conflict (product_id) do update
      set cost_usd = case when excluded.cost_usd > 0 then excluded.cost_usd else product_private.cost_usd end,
          supplier_id = coalesce(product_private.supplier_id, excluded.supplier_id);
  end loop;
  update purchase_orders set status = 'received', received_at = now() where id = p_po;
end $$;

-- What each customer still owes (whole team, so the till can collect).
create or replace function public.customer_balances() returns table (customer_id uuid, balance numeric)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce((select sum(on_account) from sales s where s.customer_id = c.id and not s.voided), 0)
       - coalesce((select sum(amount_usd) from customer_payments cp where cp.customer_id = c.id), 0)
    from customers c
   where is_member();
$$;

-- ---------------------------------------------------------------- reports (owners)
create or replace function public.report_daily(p_from date, p_to date)
returns table (day date, receipts bigint, revenue numeric, cost numeric, discount numeric, on_account numeric)
language sql stable security definer set search_path = public as $$
  with s as (
    select id, (created_at at time zone 'Asia/Beirut')::date d, total_usd, discount, on_account
      from sales where not voided
       and (created_at at time zone 'Asia/Beirut')::date between p_from and p_to
  ), c as (
    select sl.sale_id, sum(sl.qty * coalesce(sc.unit_cost, 0)) cost
      from sale_lines sl left join sale_costs sc on sc.sale_line_id = sl.id
     where sl.sale_id in (select id from s) group by sl.sale_id
  )
  select s.d, count(*), sum(s.total_usd), coalesce(sum(c.cost), 0), sum(s.discount), sum(s.on_account)
    from s left join c on c.sale_id = s.id
   where is_owner()
   group by s.d order by s.d;
$$;

create or replace function public.report_products(p_from date, p_to date)
returns table (product_id uuid, name text, category text, qty numeric, revenue numeric, cost numeric)
language sql stable security definer set search_path = public as $$
  select sl.product_id, max(sl.name), max(coalesce(pr.category, 'services')),
         sum(sl.qty), sum(sl.qty * sl.unit_price), sum(sl.qty * coalesce(sc.unit_cost, 0))
    from sale_lines sl
    join sales s on s.id = sl.sale_id and not s.voided
    left join sale_costs sc on sc.sale_line_id = sl.id
    left join products pr on pr.id = sl.product_id
   where is_owner()
     and (s.created_at at time zone 'Asia/Beirut')::date between p_from and p_to
   group by sl.product_id, case when sl.product_id is null then sl.name end
   order by 5 desc;
$$;

create or replace function public.report_sellers(p_from date, p_to date)
returns table (seller_id uuid, name text, receipts bigint, revenue numeric)
language sql stable security definer set search_path = public as $$
  select s.seller_id, coalesce(max(p.full_name), ''), count(*), sum(s.total_usd)
    from sales s left join profiles p on p.id = s.seller_id
   where is_owner() and not s.voided
     and (s.created_at at time zone 'Asia/Beirut')::date between p_from and p_to
   group by s.seller_id order by 4 desc;
$$;

-- Stock value at cost (owners).
create or replace function public.stock_value() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(greatest(p.qty, 0) * coalesce(pp.cost_usd, 0)), 0)
    from products p left join product_private pp on pp.product_id = p.id
   where p.active and p.kind = 'item' and is_owner();
$$;

-- Lock down function access: signed-out visitors can call nothing.
revoke execute on all functions in schema public from anon, public;
grant execute on function public.is_owner(), public.is_member(), public.claim_owner(),
  public.set_member(uuid,text,boolean,text), public.create_sale(jsonb), public.void_sale(uuid),
  public.adjust_stock(uuid,text,numeric,text), public.receive_po(uuid), public.customer_balances(),
  public.report_daily(date,date), public.report_products(date,date), public.report_sellers(date,date),
  public.stock_value()
  to authenticated;
