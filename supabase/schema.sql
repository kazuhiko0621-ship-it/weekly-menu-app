-- 週間献立アプリ用スキーマ
create extension if not exists pgcrypto;

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot text not null check (slot in ('breakfast','lunch','dinner')),
  name text not null,
  notion_page_id text,
  notion_url text,
  source text not null default 'manual' check (source in ('notion','manual','history','each','dining')),
  google_event_id text,
  place_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 既存環境向け: Googleカレンダー連携用の列を追加
alter table meals add column if not exists google_event_id text;

-- 既存環境向け: 外食(Googleマップの店舗)用の列を追加
alter table meals add column if not exists place_id text;

-- 既存環境向け: sourceの許可値に "each"(各自) / "dining"(外食) を追加する(すでに反映済みでも安全に実行できる)
alter table meals drop constraint if exists meals_source_check;
alter table meals add constraint meals_source_check check (source in ('notion','manual','history','each','dining'));

-- 以前は「1日1コマにつき1レコード」の一意制約を付けていましたが、
-- 同じ食事(朝/昼/夜)に複数レシピを登録できるようにするため撤廃しました。
-- すでにこのunique indexを作成済みの環境向けに、まずdropしています。
drop index if exists meals_date_slot_key;

create index if not exists meals_date_slot_idx on meals (date, slot);
create index if not exists meals_name_idx on meals (name);
create index if not exists meals_date_idx on meals (date);

-- 買い物リスト(常に最新の1回分だけを保持する単一レコード)
create table if not exists shopping_list (
  id text primary key default 'current',
  start_date date not null,
  end_date date not null,
  generated_at timestamptz not null default now(),
  items jsonb not null,
  warnings jsonb,
  recipe_summary jsonb
);

alter table shopping_list enable row level security;
drop policy if exists "allow all for authenticated users" on shopping_list;
create policy "allow all for authenticated users" on shopping_list
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 弁当の作りおき在庫。献立(meals)とは完全に独立していて、
-- 人気献立の集計にも買い物リストにも影響しない。
-- 「いつ・どのメニューを・何食分作ったか」を製造ロット単位の1行で持つ。
create table if not exists bento_stock (
  id uuid primary key default gen_random_uuid(),
  notion_page_id text not null,
  name text not null,
  notion_url text,
  made_on date not null,
  made_count int not null check (made_count between 1 and 10),
  remaining int not null check (remaining between 0 and 10),
  created_at timestamptz not null default now()
);

create index if not exists bento_stock_remaining_idx on bento_stock (remaining);
create index if not exists bento_stock_made_on_idx on bento_stock (made_on);

alter table bento_stock enable row level security;
drop policy if exists "allow all for authenticated users" on bento_stock;
create policy "allow all for authenticated users" on bento_stock
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 弁当を食べた記録。在庫から1食消費するたびに1行追加される。
-- 献立(meals)とは別物で、献立画面には参考情報として表示するだけ。
create table if not exists bento_log (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid,
  notion_page_id text,
  name text not null,
  notion_url text,
  eaten_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists bento_log_eaten_on_idx on bento_log (eaten_on);

alter table bento_log enable row level security;
drop policy if exists "allow all for authenticated users" on bento_log;
create policy "allow all for authenticated users" on bento_log
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- よく買うもの(定番リスト)。ユーザーが自分で登録・削除して育てるマスタ。
-- 買い物メモの履歴とは独立しているので、買い物リストを片付けても消えない。
create table if not exists staple_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table staple_items enable row level security;
drop policy if exists "allow all for authenticated users" on staple_items;
create policy "allow all for authenticated users" on staple_items
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 手動追加の買い物メモ(音声入力/手入力)。
-- 献立から作る買い物リストとは独立していて、リストを作り直しても消えない。
create table if not exists shopping_extra_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table shopping_extra_items enable row level security;
drop policy if exists "allow all for authenticated users" on shopping_extra_items;
create policy "allow all for authenticated users" on shopping_extra_items
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 食べたいものリスト(献立とは独立。献立に登録してもここからは消えない)
create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notion_page_id text,
  notion_url text,
  place_id text,
  source text not null default 'manual' check (source in ('notion','manual','history','dining')),
  created_at timestamptz not null default now()
);

alter table wishlist enable row level security;
drop policy if exists "allow all for authenticated users" on wishlist;
create policy "allow all for authenticated users" on wishlist
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 夫婦2人など、少人数で共有して使う想定のポリシーです。
-- 「ログイン済みのユーザーであれば誰でも同じ献立データを読み書きできる」
-- という設計にしています(個人ごとにデータを分離するものではありません)。
-- Supabase側でアカウントを作成した本人たちだけがログインできるため、
-- 見知らぬ第三者はアクセスできません。
alter table meals enable row level security;

drop policy if exists "allow all for anon" on meals;
drop policy if exists "allow all for authenticated users" on meals;
create policy "allow all for authenticated users" on meals
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
