# 週間献立アプリ

1週間(月曜始まり)の献立(朝/昼/夜)を管理するPWAです。

- 献立画面: 今週登録済みの献立のみ表示。左右スワイプで前週/翌週に移動
- 人気献立画面: 履歴の登場回数ランキング(回数・最終登場日つき)。選んだ献立を今週に追加可能
- 曜日タップで朝/昼/夜の編集モードに切り替え
- 献立名の入力は「入力(Notionレシピ検索 + 自由入力)」「履歴から選択」の2通り
- Notionから選んだ献立にはレシピページへのリンクボタン(Notionアイコン付き)が表示される
- フロントエンド: GitHub Pages / データベース: Supabase / レシピ検索: Notion API(Supabase Edge Function経由)

## 構成

```
src/                … React (Vite) アプリ本体
supabase/schema.sql … Supabaseに作成するテーブル定義
supabase/functions/notion-search … Notion検索用 Edge Function
.github/workflows/deploy.yml … GitHub Pagesへの自動デプロイ
```

---

## 使う値の一覧(混同注意)

以下の4つは取得元と用途が異なります。とくに`NOTION_TOKEN`/`NOTION_DATABASE_ID`は**Notion側**の値で、Supabaseの`Project URL`/`anon public key`とは別物なので注意してください。

| 値 | 取得元 | 使う場所 |
|---|---|---|
| `Project URL` | Supabase → Settings → API | ローカルの`.env`、GitHub Secretsの`VITE_SUPABASE_URL` |
| `anon public key` | Supabase → Settings → API | ローカルの`.env`、GitHub Secretsの`VITE_SUPABASE_ANON_KEY` |
| `NOTION_TOKEN` | **Notion**のインテグレーション作成時に発行される`secret_...`/`ntn_...` | `supabase secrets set`(Edge Function用) |
| `NOTION_DATABASE_ID` | **Notion**のレシピDBのURL内の32桁ID | `supabase secrets set`(Edge Function用) |

## 1. Notion側の準備

1. https://www.notion.so/my-integrations で「New integration」を作成し、**Internal Integration Secret**(`secret_...` または `ntn_...`)を控える
2. レシピを管理しているNotionデータベースを開き、右上「…」→「Connections」から作成したインテグレーションを接続(共有)する
3. データベースのURLから **Database ID**(32桁の英数字部分)を控える
   - 例: `https://www.notion.so/xxxx/1a2b3c...?v=...` の `1a2b3c...` の部分
4. タイトル列(データベースの一番左の列 = レシピ名)がそのまま献立名として使われます。列名は何でも構いません
5. 絞り込み検索に使うため、データベースに以下の名前のプロパティ(列)が必要です(型は「セレクト」「マルチセレクト」「ステータス」のいずれかを推奨)
   - `カテゴリー`
   - `評価`
   - これらの列が無い場合は絞り込みチップが表示されないだけで、名称検索自体は問題なく動作します

## 2. Supabaseの準備

1. https://supabase.com でプロジェクトを作成
2. SQL Editorで `supabase/schema.sql` の内容を実行し、`meals` テーブルを作成
3. Settings → API から `Project URL` と `anon public key` を控える(フロントエンドの環境変数に使用)
4. Notion検索用のEdge Functionをデプロイ(要 [Supabase CLI](https://supabase.com/docs/guides/cli)):

   ```bash
   supabase login
   supabase link --project-ref <あなたのプロジェクトref>
   supabase functions deploy notion-search
   supabase secrets set NOTION_TOKEN=secret_xxxxxxxx NOTION_DATABASE_ID=xxxxxxxxxxxxxxxx
   ```

   ログイン必須のアプリになったため、`--no-verify-jwt` は付けていません(ログイン済みユーザーのトークンがある場合のみ呼び出せます)。

### ログイン(2人での共有)の設定

このアプリはSupabase Authでログインしたユーザーだけがデータを読み書きできます。個人ごとにデータを分けるのではなく、「ログインした人は同じ献立データを共有して見る」設計です(夫婦2人で1つの献立表を見る用途に合わせています)。

1. Supabaseダッシュボード → **Authentication → Providers** で `Email` が有効になっていることを確認
2. **Authentication → Settings** で「Allow new users to sign up」をオフにする
   - これで、見知らぬ第三者が勝手にアカウントを作れなくなります(アプリ側にも新規登録フォームは用意していません)
3. **Authentication → Users → Add user** から、自分と奥様の分、2件のユーザーを直接作成する
   - 「Auto Confirm User」を有効にすると、確認メールなしですぐログインできる状態で作成できます
4. アプリを開くとログイン画面が表示されるので、作成したメールアドレス・パスワードでログインすればOKです

パスワードを忘れた場合や増員したい場合も、同じ「Authentication → Users」画面から再設定・追加ができます。

## 3. ローカル開発

```bash
npm install
cp .env.example .env
# .env に Supabase の URL / anon key を記入
npm run dev
```

## 4. GitHubへpush & GitHub Pagesへデプロイ

1. このフォルダの内容でGitHubリポジトリを作成しpush
2. リポジトリの Settings → Secrets and variables → Actions で以下を登録
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Settings → Pages で Source を「GitHub Actions」に設定
4. `main` ブランチにpushすると `.github/workflows/deploy.yml` が自動でビルド・デプロイします
5. 発行されたURL(`https://<user>.github.io/<repo>/`)にスマホでアクセスし、「ホーム画面に追加」からPWAとしてインストールできます

## 既知の制限・改善ポイント

- カテゴリー/評価での絞り込みは、Notion側のプロパティ型が「セレクト」「マルチセレクト」「ステータス」の場合のみ対応しています(数値・数式型などは選択肢を取得できないため、絞り込みチップは表示されません)
- ログインユーザー間でデータは分離されません(2人で1つの献立表を共有する設計)。3人目以降を追加したい場合も「Authentication → Users」でアカウントを増やすだけで対応できます
