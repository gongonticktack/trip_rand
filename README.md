# Trip Rand

全国のドライブ先を地図で探し、訪問日・写真をユーザーIDごとに保存するアプリです。

**公開URL: https://trip-rand.pages.dev/**

79件のスポット、ユーザー情報、訪問記録、写真は、job_postと同じSupabaseプロジェクト `ngsfugndmboqquyksnwr` の専用テーブルに保存します。ユーザー切り替えはIDだけです。パスワード・メール認証・Supabase Auth・D1は使いません。

## ユーザーの切り替え

初回は「新規登録」、登録後は「ユーザー切り替え」を選びます。IDは半角英数字・_・-の3〜32文字で、大文字・小文字を区別しません。同じIDを知っている人は、同じ訪問記録・写真を開けます。

90日間のHttpOnly Cookieとアクセス元IPの照合値でユーザーを記憶します。同じIPなら別端末・Cookieなしでも最後に選んだユーザーを自動で開きます。有効な端末Cookieがあればそのユーザーを優先します。同じWi-Fi・共有回線では訪問記録と写真が共有されます。未知のIPではIDを選択します。明示的なログアウト後はそのブラウザの自動選択を停止し、右上から再選択できます。更新前の有効なCookieは次回アクセス時にIP記憶へ移行します。Cookieが既にない場合は更新後に一度IDを選ぶ必要があります。

## 地図・訪問・写真

- 緑が未訪問、オレンジが訪問済み。検索・県・カテゴリ・所要時間・訪問状態を地図と一覧に反映します。
- 地図は名古屋駅周辺を拡大して表示し、全国のスポットは条件指定後に一覧・地図で探せます。
- 検索の初期値とリセットは未訪問。「すべて」でも訪問済みは末尾です。無料駐車場・景色のよい道で絞れます。料金未確認は無料扱いにしません。
- 「現在地を取得」は利用者の操作でブラウザに許可を求めます。拒否・失敗時は名古屋駅へ戻ります。位置はメモリだけで保持し、DB・localStorageに保存しません。名古屋駅または現在地からの直線距離（Haversine）を表示し、半径で絞ります。車の走行距離・時間ではありません。Google Mapsリンクを開くと選んだ出発地点がMapsに渡ります。
- 訪問済みの「思い出マップ」は場所ごとの最新写真・訪問日・枚数を表示。写真を押すと詳細へ。地図内の最大24地点を対象に同時3件まで読み込み、縮小画像をメモリに保持。ユーザー切り替え時は破棄します。写真未登録の訪問先は点表示です。
- 既存28件は名古屋駅周辺から片道の概算を表示します。全国追加分は所要時間未算定で、出発地からの直線距離を表示します。高速利用を含む時間は既存値のみで、渋滞・休憩・駐車待ちは含みません。時間フィルターは時間のあるスポットだけを対象にします。Google Mapsへのリンクで経路を確認できます。
- 詳細の「行った！」で訪問日を保存し、訪問済みをランダム対象から外します。記録の同期中・失敗時はユーザーの抽選を止めます。
- JPEG・PNG・WebP、元画像20MB以内。最大辺1600pxのJPEGに縮小し、5MiB以内でDB保存します。元EXIF等はコピーしません。一度に5枚、1スポット10枚まで。HEIC非対応です。
- 未訪問に戻しても写真は残ります。写真削除機能はありません。
- 同じIDで別端末から利用すると記録を共有します。再読み込みや画面へ戻った際に更新します。常時リアルタイム同期はありません。
- 行きたいリストはブラウザのlocalStorage保存で、端末間同期しません。

## 起動・停止

Windowsでは `start.bat` をダブルクリックします。依存準備・ビルド・DBとAPIの確認後に http://127.0.0.1:8788/ を開きます。停止は `stop.bat`。再実行時はこのアプリ所有のサーバーだけを再起動します。他アプリがポート8788を使っていればエラーにします。

Node.js 22.13以上が必要です。未導入なら公式22系Windows x64版を `.runtime` に取得し、公式SHA-256と照合します。npm依存は `package-lock.json` で固定し、ハッシュ変更時に更新します。初回はインターネット接続が必要です。管理者権限・グローバルPATH変更は不要です。

手動起動は `npm.cmd ci` → `npm.cmd run build` → `npm.cmd start`。テストは `npm.cmd test`。ログは `.runtime/server.log` と `.runtime/server-error.log` です。HTMLはHTTPサーバー経由で使います。

## 実装・保存先

| ファイル・サービス | 役割 |
| --- | --- |
| index.html / styles.css / app.js | HTML・CSS・ブラウザJavaScript。地図、検索、抽選、ID切り替え |
| lib/spots.mjs / lib/photos.mjs | 絞り込み・抽選、Canvasでの写真変換 |
| Leaflet 1.9.4 / OpenStreetMap | 地図UIとタイル。現在地はブラウザGeolocationで取得 |
| backend/api.mjs | Web標準APIとWeb Crypto。ID登録、セッション・IP照合、訪問・写真API |
| functions/api/[[path]].js | Pages Functions。CF-Connecting-IPを共通APIに渡す |
| trip_rand_spots | 公開スポット79件、位置、時間、出典 |
| trip_rand_app_profiles | ユーザーUUIDとID |
| trip_rand_id_sessions | セッション・IPのハッシュと有効期限 |
| trip_rand_app_visits | ユーザーごとの訪問状態・日付 |
| trip_rand_app_photos | ユーザーごとのJPEGバイナリ・登録日 |
| supabase-config.json | 既存DBの公開anon keyとURL。service role不要 |
| scripts/build.mjs | esbuild 0.28.2でLeafletと静的ファイル・ライセンスをdistに生成 |
| scripts/server.mjs | ローカルHTTP配信・API・health・SQL確認ページ |
| start.bat / stop.bat / scripts/launch.ps1 | 依存準備、起動、再起動、停止 |

CookieはHttpOnly・SameSite=Strict、HTTPSではSecureです。セッションとIPはハッシュで照合します。Cloudflareでは信頼できるCF-Connecting-IP、ローカルでは接続元アドレスを使います。書込APIは同一オリジンだけ受け付けます。

Supabaseの専用RPCがセッションのユーザー行を読み書きし、ユーザー情報・記録テーブルの直接読取は匿名・authenticatedともに拒否します。写真の枚数・容量もDB側で制限します。現在はSQLite・D1を使いません。旧方式のローカルDB、メールログイン時代のテーブル・Storage、既存求人テーブルは削除していません。

外部通信はSupabaseとOpenStreetMapのタイルです。公式サイト・Google Mapsはリンクから開きます。AIモデル・定期クロール・ライブ経路計算はありません。

## DBセットアップ

現在のDBには反映済みです。新しく構築する場合はSQL Editorで順に実行します。

1. schema.sql
2. migrations/002-map-visits.sql
3. migrations/003-independent-login.sql
4. migrations/004-id-only.sql
5. migrations/005-nationwide-memories.sql（公開スポットの追加列のみ）
6. seed.sql

スポット更新は `data/spots.json` を編集 → `npm.cmd run seed:sql` → SQL Editorでseed.sql実行。slug単位のupsertで、JSONから消した項目を自動削除しません。
既存DBへ今回の30件だけ追加する場合は、`seed-regional.sql` をSupabase SQL Editorで実行します。新規構築では79件を含む `seed.sql` を使います。

ローカルの `/setup/schema`、`/setup/migration`、`/setup/seed`、`/setup/accounts`、`/setup/id-only` でSQLを確認できます。SQLとruntimeは公開用distに含めません。

## Cloudflareの更新

Pagesプロジェクトはtrip-rand、production branchはmain、出力はdistです。Wrangler 4.149.0をローカル依存で固定しています。Cloudflare認証済み環境で実行します。
アプリの変更時はテスト・ビルド後、公開サイトも更新するためproductionへデプロイします。

```powershell
npm.cmd run build
npm.cmd run deploy -- --branch main
```

Functionsはfunctionsディレクトリからビルドされます。D1バインディングは不要です。IP記憶にはCloudflareの暗号化Secret `TRIP_RAND_IP_SECRET` を使用します。`node scripts/configure-ip-memory.mjs` で `.runtime/ip-secret.json` を初回のみ生成し、`wrangler pages secret bulk .runtime/ip-secret.json --project-name trip-rand` で設定してからデプロイします。秘密値を公開設定・distへ含めません。ローカル起動では同じファイルを読みます。Git連携ならFramework None、Build command `npm run build`、出力dist、Node.js 22.13以上です。

## 調査・検証

79件・28都道府県の公式観光情報や現地取材の出典・2026-10-10〜11の調査日を保存しています。今回追加した30件は関東・中部中心で、位置は代表地点です。所要時間・おすすめ理由・滞在時間は編集上の目安です。新規追加分の所要時間は未算定です。

データ・抽選・ID方式・距離・訪問順・思い出APIの14テストを確認済みです。ID登録・重複・未登録ID・同IPの記憶・IP変更・同IDの共有・Cookie偽造・他オリジン書込・ログアウトを検証します。APIテストはSupabase RPCをスタブ化しています。

実DBで訪問・写真RPCの保存と取得、ユーザー分離、直接読取拒否を一時トランザクションで確認済みです。Cloudflare本番で79件のスポットと全79カードを確認しました。追加分を含むDB同期と名古屋中心の初期地図・写真の本番配信を確認しました。既存の390px表示と写真縮小・容量・形式も検証済みです。ユーザー本人の写真による端末間の通し確認、Node.js未導入時のダウンロードは未実施です。

## 観光地の写真

Wikimedia Commonsの再利用可能な写真をimages/spotsへ保存し、Cloudflareから配信します。一覧・詳細に作者、出典、ライセンスへのリンクを表示します。data/spot-images.jsonがslugごとの対応・原画像URL・利用条件・取得日を記録します。画像は元のライセンスで配布し、一覧ではCSSで表示枠に合わせてトリミングします。三河湾スカイラインのみ周辺の三河湾（三ヶ根山からの眺め）を使い、その旨を写真の下に明記しています。観光地の参考写真は訪問時に登録したユーザー写真とは別に表示します。今回追加した30スポットはすべて写真付きです。

写真追加後はローカルビルドに含まれるJPEG58件の署名・形式を確認しました。追加30枚はWikimedia Commonsの作者・ライセンスを表示し、DB同期後の本番反映時に公開配信します。既存21件は観光写真未登録です。

### 全国・思い出マップの確認（2026-10-11）

ブラウザのローカルテスト用サーバー `node scripts/test-map-server.mjs` は8790番で仮ユーザー・仮の東京位置・既存の観光画像を使います。DBに訪問や写真を保存しません。未訪問47/49、全件表示の訪問済み末尾、写真2地点、ID切替後の写真消去、位置許可成功/拒否、距離絞り込み、390px表示を確認。実際のGPS位置と利用者本人の写真による通し確認は未実施です。テスト専用ファイルはCloudflare配信に含めません。

`/api/memories` は既存の訪問一覧と写真一覧RPCを、同じセッションで組み合わせて最新写真のメタデータだけを返します。新しいDB権限・RPCは追加していません。

IP記憶はサーバー秘密鍵付きHMACから作る推測困難な検索用セッションを既存DBの trip_rand_id_sessions に保存します。IPの平文保存・DB権限追加は行いません。未記憶IP・未知のIP情報・明示的ログアウトでは自動ログインしません。自動復帰後には端末ごとの新しいセッションCookieを発行します。
