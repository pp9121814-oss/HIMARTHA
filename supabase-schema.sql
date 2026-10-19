-- SHAILYA Aipan Art Clocks — Supabase setup
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
-- Create the owner in Authentication > Users first; then add their UUID at the bottom.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  category text not null default 'Traditional'
    check (category in ('Classic','Festive','Minimal','Traditional')),
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  badge text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;

drop policy if exists "Admins can read admin list" on public.admin_users;
create policy "Admins can read admin list" on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Anyone can read published products" on public.products;
create policy "Anyone can read published products" on public.products
  for select to anon, authenticated
  using (is_active = true or exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  ));

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products" on public.products
  for insert to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products" on public.products
  for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products" on public.products
  for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- Supabase table privileges + RLS: visitors may only read published products;
-- authenticated owners still need to pass the policies above to manage inventory.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users to authenticated;

-- Storage bucket: public URLs allow shoppers to see product photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images' and exists (
      select 1 from public.admin_users a where a.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images" on storage.objects
  for update to authenticated using (
    bucket_id = 'product-images' and exists (
      select 1 from public.admin_users a where a.user_id = (select auth.uid())
    )
  ) with check (
    bucket_id = 'product-images' and exists (
      select 1 from public.admin_users a where a.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-images' and exists (
      select 1 from public.admin_users a where a.user_id = (select auth.uid())
    )
  );

-- After creating the owner account in Supabase Authentication > Users,
-- replace OWNER_AUTH_USER_UUID below with that user's actual UUID and run:
-- insert into public.admin_users (user_id)
-- values ('OWNER_AUTH_USER_UUID')
-- on conflict (user_id) do nothing;

-- Optional demo products: use the included local image assets first, then replace image_url
-- with public Supabase Storage URLs once you upload product photos through admin.html.
insert into public.products (name, description, category, price, image_url, stock, badge, is_active)
select v.name, v.description, v.category, v.price, v.image_url, v.stock, v.badge, v.is_active
from (values
('Devbhoomi Elegance','Handcrafted Aipan Art Wall Clock','Classic',1299::numeric,'assets/clock-1.jpg',10,'Bestseller',true),
('Floral Heritage','Traditional floral Aipan wall clock','Festive',1199::numeric,'assets/clock-2.jpg',10,'New',true),
('Pahadi Peacock','A bold Pahadi-inspired Aipan wall clock','Classic',1399::numeric,'assets/clock-3.jpg',10,null,true),
('Surya Mandala','Sun-inspired folk art wall clock','Minimal',1199::numeric,'assets/clock-4.jpg',10,'New',true),
('Nature’s Harmony','Nature-inspired Aipan wall clock','Traditional',1499::numeric,'assets/clock-5.jpg',10,null,true)
) as v(name,description,category,price,image_url,stock,badge,is_active)
where not exists (select 1 from public.products p where p.name = v.name);

-- --------------------------------------------------------------------------
-- SHAILYA ONLINE ORDERS (run this updated schema once in Supabase SQL Editor)
-- Public customers can submit orders only through the validated RPC function.
-- Only accounts listed in admin_users can read or update orders.
-- --------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new','confirmed','processing','shipped','delivered','cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','cod','paid','refunded')),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  customer_consent boolean not null default false,
  customer_phone text not null check (customer_phone ~ '^[6-9][0-9]{9}$'),
  address_line text not null,
  area text not null,
  post_office text,
  landmark text,
  city text not null,
  district text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  latitude numeric(10,7),
  longitude numeric(10,7),
  delivery_notes text,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  shipping_charge numeric(10,2) check (shipping_charge is null or shipping_charge >= 0),
  grand_total numeric(10,2) check (grand_total is null or grand_total >= 0),
  courier_name text,
  tracking_number text,
  tracking_url text,
  admin_note text
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_pincode_idx on public.orders (pincode);

alter table public.orders add column if not exists customer_consent boolean not null default false;
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders enable row level security;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders" on public.orders
  for select to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders
  for update to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

grant select, update on public.orders to authenticated;


-- Keep visible stock honest: reserve stock on order creation; restore it when an
-- unshipped order is cancelled. Reopening a cancelled order checks stock again.
create or replace function public.sync_inventory_for_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
begin
  if old.status is distinct from new.status then
    if new.status = 'cancelled' and old.status in ('new','confirmed','processing') then
      for v_item in select value from jsonb_array_elements(old.items) loop
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        update public.products
          set stock = stock + v_quantity, updated_at = now()
          where id = v_product_id;
      end loop;
    elsif old.status = 'cancelled' and new.status <> 'cancelled' then
      for v_item in select value from jsonb_array_elements(new.items) loop
        v_product_id := (v_item->>'product_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        update public.products
          set stock = stock - v_quantity, updated_at = now()
          where id = v_product_id and stock >= v_quantity;
        if not found then
          raise exception 'Cannot reopen this order because stock is insufficient for %.', coalesce(v_item->>'name','an ordered item');
        end if;
      end loop;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists shailya_order_inventory_status on public.orders;
create trigger shailya_order_inventory_status
before update of status on public.orders
for each row execute function public.sync_inventory_for_order_status();

create or replace function public.create_public_order(p_customer jsonb, p_items jsonb)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_phone text;
  v_address text;
  v_area text;
  v_post_office text;
  v_landmark text;
  v_city text;
  v_district text;
  v_state text;
  v_pincode text;
  v_notes text;
  v_latitude numeric;
  v_longitude numeric;
  v_items jsonb;
  v_subtotal numeric(10,2);
  v_item_count integer;
  v_match_count integer;
  v_order_id uuid;
  v_order_number text;
begin
  if p_customer is null or jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Please provide valid customer and delivery details.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Your cart must be a valid product list.';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Your cart must contain between 1 and 20 product lines.';
  end if;

  if coalesce(p_customer->>'consent', 'false') <> 'true' then
    raise exception 'Please agree to share your delivery details so the store can process this order.';
  end if;

  v_name := nullif(btrim(p_customer->>'name'), '');
  v_phone := nullif(btrim(p_customer->>'phone'), '');
  v_address := nullif(btrim(p_customer->>'address'), '');
  v_area := nullif(btrim(p_customer->>'area'), '');
  v_post_office := nullif(btrim(p_customer->>'postOffice'), '');
  v_landmark := nullif(btrim(p_customer->>'landmark'), '');
  v_city := nullif(btrim(p_customer->>'city'), '');
  v_district := nullif(btrim(p_customer->>'district'), '');
  v_state := nullif(btrim(p_customer->>'state'), '');
  v_pincode := nullif(btrim(p_customer->>'pincode'), '');
  v_notes := nullif(btrim(p_customer->>'notes'), '');
  v_latitude := nullif(p_customer->>'latitude', '')::numeric;
  v_longitude := nullif(p_customer->>'longitude', '')::numeric;

  if v_name is null or char_length(v_name) > 100
     or v_phone is null or v_phone !~ '^[6-9][0-9]{9}$'
     or v_address is null or char_length(v_address) > 240
     or v_area is null or char_length(v_area) > 100
     or v_city is null or char_length(v_city) > 100
     or v_district is null or char_length(v_district) > 100
     or v_state is null or char_length(v_state) > 100
     or v_pincode is null or v_pincode !~ '^[1-9][0-9]{5}$' then
    raise exception 'Please check the required fields, mobile number and 6-digit PIN code.';
  end if;
  if (v_post_office is not null and char_length(v_post_office) > 100)
     or (v_landmark is not null and char_length(v_landmark) > 120)
     or (v_notes is not null and char_length(v_notes) > 180) then
    raise exception 'One of the optional delivery fields is too long.';
  end if;
  if (v_latitude is null) <> (v_longitude is null) then
    raise exception 'Location needs both latitude and longitude.';
  end if;
  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90 or v_longitude < -180 or v_longitude > 180) then
    raise exception 'The GPS coordinates are not valid.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) as x(item)
    where jsonb_typeof(x.item) <> 'object'
       or coalesce(x.item->>'product_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(x.item->>'quantity','') !~ '^[1-9][0-9]?$'
       or (x.item->>'quantity')::integer > 20
  ) then
    raise exception 'The cart contains an invalid product or quantity. Please reload the store and try again.';
  end if;

  if exists (
    select x.item->>'product_id'
    from jsonb_array_elements(p_items) as x(item)
    group by x.item->>'product_id'
    having count(*) > 1
  ) then
    raise exception 'The cart contains a duplicate product line. Reload the cart and try again.';
  end if;

  -- Lock listed products to prevent two simultaneous orders reserving the same last item.
  perform p.id
  from public.products p
  join jsonb_array_elements(p_items) as x(item) on p.id = (x.item->>'product_id')::uuid
  order by p.id
  for update of p;

  select count(*) into v_item_count from jsonb_array_elements(p_items);
  select count(*) into v_match_count
  from jsonb_array_elements(p_items) as x(item)
  join public.products p on p.id = (x.item->>'product_id')::uuid
  where p.is_active = true and (x.item->>'quantity')::integer <= p.stock;
  if v_match_count <> v_item_count then
    raise exception 'A product is no longer available in the selected quantity. Please update your cart.';
  end if;

  select
    jsonb_agg(jsonb_build_object(
      'product_id', p.id,
      'name', p.name,
      'description', p.description,
      'category', p.category,
      'image_url', p.image_url,
      'unit_price', p.price,
      'quantity', (x.item->>'quantity')::integer,
      'line_total', (p.price * (x.item->>'quantity')::integer)
    ) order by p.name),
    coalesce(sum(p.price * (x.item->>'quantity')::integer), 0)::numeric(10,2)
  into v_items, v_subtotal
  from jsonb_array_elements(p_items) as x(item)
  join public.products p on p.id = (x.item->>'product_id')::uuid
  where p.is_active = true;

  v_order_number := 'SH-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.orders (
    order_number, status, payment_status, customer_name, customer_consent, customer_phone,
    address_line, area, post_office, landmark, city, district, state, pincode,
    latitude, longitude, delivery_notes, items, subtotal
  ) values (
    v_order_number, 'new', 'pending', v_name, true, v_phone,
    v_address, v_area, v_post_office, v_landmark, v_city, v_district, v_state, v_pincode,
    v_latitude, v_longitude, v_notes, v_items, v_subtotal
  ) returning id into v_order_id;

  -- Reserve stock only after a successful order insert. Cancellation before shipping restores it.
  update public.products p
  set stock = p.stock - (x.item->>'quantity')::integer,
      updated_at = now()
  from jsonb_array_elements(p_items) as x(item)
  where p.id = (x.item->>'product_id')::uuid;

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.create_public_order(jsonb, jsonb) from public;
grant execute on function public.create_public_order(jsonb, jsonb) to anon, authenticated;
