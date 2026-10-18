-- HIMARTHA Aipan Art Clocks — Supabase setup
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
