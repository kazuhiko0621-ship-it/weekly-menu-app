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
