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

## 3. Googleカレンダー連携の準備

献立を登録/更新/削除/移動すると、Googleカレンダーの予定にほぼリアルタイムで反映されます。夫婦2人など少人数での個人利用を想定し、Googleの正式な審査(アプリ検証)を受けずに使える設定にしています。

### 3-1. Google Cloudプロジェクトの作成とAPI有効化

1. https://console.cloud.google.com を開き、新しいプロジェクトを作成
2. 左メニュー「APIとサービス」→「ライブラリ」で **Google Calendar API** を検索し、有効化する

### 3-2. OAuth同意画面の設定

1. 「APIとサービス」→「OAuth同意画面」を開く
2. User Type は **外部(External)** を選択(個人のGoogleアカウントの場合、これしか選べません)
3. アプリ名(何でも構いません。例:「週間献立」)、自分のメールアドレスなどを入力して保存
4. スコープの追加画面で `../auth/calendar` (Google Calendar API の読み書きスコープ)を追加
5. テストユーザーの追加は不要です。保存後、画面上部の公開ステータスを **「テスト中」から「本番環境」に変更** してください
   - 「本番環境」に変更する際、審査(検証)を求められる場合がありますが、個人利用(100人未満)の場合は **審査を受けずにそのまま本番環境として使うことができます**(「アプリの確認は不要です」といった趣旨の案内が出ます)
   - これを行わず「テスト中」のままにすると、認証情報(リフレッシュトークン)が **7日で失効し**、7日おきに再認証が必要になってしまうため、必ず本番環境に変更してください

### 3-3. OAuthクライアントの作成

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
2. アプリケーションの種類は **「ウェブアプリケーション」** を選択(名前は何でも構いません)
3. 「承認済みのリダイレクトURI」に `https://developers.google.com/oauthplayground` を追加登録する(OAuth Playgroundを使うために必須です)
4. 作成すると **クライアントID** と **クライアントシークレット** が発行されるので控えておく

### 3-4. リフレッシュトークンの取得(この作業は最初に1回だけ)

1. https://developers.google.com/oauthplayground を開く
2. 右上の歯車アイコン →「Use your own OAuth credentials」にチェックを入れ、3-3で控えた クライアントID・シークレットを入力
3. 左側の一覧から「Google Calendar API v3」→ `https://www.googleapis.com/auth/calendar` にチェックを入れて「Authorize APIs」
4. 献立を反映したいGoogleアカウント(自分や、夫婦共有用に新しく作ったアカウントなど)でログイン・許可する
   - この時点で「このアプリは Google で確認されていません」という警告が出ますが、自分で作ったアプリなので「詳細」→「(アプリ名)に移動(安全ではないページ)」を選んで進めてください
5. 「Exchange authorization code for tokens」をクリックすると **Refresh token** が表示されるので控えておく

### 3-5. 反映先カレンダーの確認

- 特に何も作らなければ、そのGoogleアカウントの **メインカレンダー**(`primary`)に予定が作成されます
- 献立専用のカレンダーを分けたい場合は、Googleカレンダーで新しいカレンダーを作成し、その「カレンダー設定」→「カレンダーの統合」にある **カレンダーID**(`xxxxx@group.calendar.google.com` の形式)を控えておいてください。夫婦で見る場合は、このカレンダーを配偶者のGoogleアカウントと共有(表示権限)しておくと、双方のGoogleカレンダーアプリに表示されます

### 3-6. Edge Functionのデプロイとsecrets設定

```powershell
supabase functions deploy calendar-sync
supabase secrets set GOOGLE_CLIENT_ID=xxxxx GOOGLE_CLIENT_SECRET=xxxxx GOOGLE_REFRESH_TOKEN=xxxxx GOOGLE_CALENDAR_ID=xxxxx
```

- `GOOGLE_CALENDAR_ID` は、3-5で専用カレンダーを作らなかった場合は `primary` を指定してください
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` は、Supabaseが各Edge Functionに自動で渡してくれるため、こちらで設定する必要はありません

これで、アプリ側で献立を登録・更新・削除・別の日への移動をするたびに、Googleカレンダーの予定が自動で作成・更新・削除されます(朝食7:00〜7:30、昼食12:00〜13:00、夕食19:00〜20:00 の枠で登録され、Notionのレシピにリンクしている場合は予定の詳細欄にURLが入ります)。

## 4. Google Places API(外食モード)の準備

入力画面の「外食」モードでは、Googleマップの店舗名検索を使います。Notion/Calendarと違い、**この APIキーはブラウザから直接呼び出す**ため、キー自体は公開されます(そのため、後述の「アプリケーション制限」で悪用を防ぎます)。

### 4-1. Places APIの有効化

1. Google Cloud Consoleで、3で使ったものと同じプロジェクトを開く(別プロジェクトでも構いません)
2. 「APIとサービス」→「ライブラリ」で **Places API (New)** を検索して有効化する

### 4-2. 請求先アカウント(お支払い方法)の登録

Google Maps系のAPIは、無料枠内の利用であっても請求先アカウントの登録(クレジットカード)が必須です。

1. 「お支払い」からお支払い方法を登録する
2. 心配な場合は「予算とアラート」で、例えば月100円などの少額の予算アラートを設定しておくと、想定外の利用があった際に気づけます
3. 夫婦2人が外食のたびに数回検索する程度であれば、月間の無料枠(数千〜1万回程度)を超えることはまず無く、実質無料で使えます

### 4-3. APIキーの作成と制限

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」
2. 作成されたキーをクリックして詳細設定を開く
3. 「アプリケーションの制限」→ **「HTTPリファラー」** を選び、GitHub PagesのURLを追加登録する
   ```
   https://<user>.github.io/*
   ```
4. 「API の制限」→ **「キーを制限」** を選び、**Places API (New)** のみにチェックを入れる
5. 保存し、表示されているAPIキーの文字列を控える

### 4-4. secretsの設定

このキーはEdge Functionではなく**フロントエンド側**で使うため、GitHub Secretsとローカルの`.env`に設定します。

- ローカルの`.env`に追記
  ```
  VITE_GOOGLE_PLACES_API_KEY=控えたAPIキー
  ```
- GitHubリポジトリの Settings → Secrets and variables → Actions に、新しく `VITE_GOOGLE_PLACES_API_KEY` を追加登録する(既存の`VITE_SUPABASE_URL`などと同じ場所です)

## 5. ローカル開発

```bash
npm install
cp .env.example .env
# .env に Supabase の URL / anon key / Google Places APIキー を記入
npm run dev
```

## 6. GitHubへpush & GitHub Pagesへデプロイ

1. このフォルダの内容でGitHubリポジトリを作成しpush
2. リポジトリの Settings → Secrets and variables → Actions で以下を登録
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GOOGLE_PLACES_API_KEY`
3. Settings → Pages で Source を「GitHub Actions」に設定
4. `main` ブランチにpushすると `.github/workflows/deploy.yml` が自動でビルド・デプロイします
5. 発行されたURL(`https://<user>.github.io/<repo>/`)にスマホでアクセスし、「ホーム画面に追加」からPWAとしてインストールできます

## 既知の制限・改善ポイント

- Googleカレンダーとの同期に失敗しても(トークン切れなど)、献立の登録・編集自体はそのまま行えます。同期エラーはブラウザの開発者ツールのコンソールに出力されるだけで、アプリ画面上にはエラー表示しない設計にしています(同期は「おまけ機能」という位置づけです)
- リフレッシュトークンが失効した場合(Googleアカウントのパスワード変更、6か月以上未使用、など)は、3-4の手順を再度行ってトークンを取り直し、`supabase secrets set` で更新してください
- 「外食」モードは地図を画面に埋め込む機能はなく、店舗名の検索と、登録後にGoogleマップアプリ/サイトへのリンクを開ける機能のみです
- 「外食」機能の追加に伴い、`source`列に`dining`、新しく`place_id`列を追加しています。**`supabase/schema.sql`の再実行**で反映されます

- 同じ食事(朝/昼/夜)に複数レシピを登録できるようにしたため、以前作成したテーブルをお使いの場合は **`supabase/schema.sql` をもう一度SQL Editorで実行してください**(1日1コマ1件の制約を撤廃するdrop文が含まれています)
- 「各自」機能の追加に伴い、`source`列の許可値に`each`を追加しています。こちらも**`supabase/schema.sql`の再実行**で反映されます

- カテゴリー/評価での絞り込みは、Notion側のプロパティ型が「セレクト」「マルチセレクト」「ステータス」の場合のみ対応しています(数値・数式型などは選択肢を取得できないため、絞り込みチップは表示されません)
- ログインユーザー間でデータは分離されません(2人で1つの献立表を共有する設計)。3人目以降を追加したい場合も「Authentication → Users」でアカウントを増やすだけで対応できます
