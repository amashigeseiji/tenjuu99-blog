# Findings: publish-abstraction

**日時:** 2026-07-10
**対象:** plans/publish-abstraction/

## 操作の事実

- `~/dev/private/blog`（実プロジェクト）で公開済み記事を編集し、Publish 操作を実行。実際にサイトへ反映されたことを確認した（git 手段）
- blog.json に `"publish": {"means": "ftp"}` を追記し、tenjuu99-blog.app を再起動。エディタ画面は表示されるがサイドバーに何も表示されない状態になった
  - ブラウザのネットワークタブ上、`/get_sidebar` が 404
  - `publish.means` を `git` にする、または項目自体を削除するとサイドバーが復帰。`ftp` にすると再現する
  - エディタで直接ファイルを指名するとファイル内容の textarea 表示・プレビュー描画は機能する（壊れているのはサイドバー系エンドポイントのみ）
  - サーバーログには `Error: 未知の公開手段です: ftp` が出力されている

## 利用仮説の照合

- US-01（手段を意識せずに記事を公開できる）: 期待どおり。git 手段での公開・更新は従来どおり動作した
- test-tree.md の利用仮説（「外れ側」）は「公開手段を差し替えるために既存コードの変更が必要になる」「git の言葉が語彙に再侵入する」「既存の git 運用が壊れる」の3点を想定していたが、いずれにも該当しない
- 一方、「構成に未対応の公開手段が指定されたときにどう振る舞うか」は利用仮説・test-tree のどちらにも記述がなく、想定外の経路として今回のインタビューで見つかった

## 印象（ユーザーの言葉）

- 「means ftp の場合、publish が実行できないということを期待していました。もしくは、もっと手前でエラーとなるか、です」
- 実際に手前でエラーにはなっている（`resolvePublicationMeans` が `未知の公開手段です: ftp` を送出）が、それが `/get_sidebar` 経由では利用者に一切見えず、無関係に見えるサイドバー空白・404という形でしか観測できなかった

## 発見（解釈・原因の仮説、戻し先つき）

### F-01: `/get_sidebar` と `/publication-status` が解決器の例外を握りつぶす

**戻し先:** /tdd-run（同一 plan、次サイクル）
**出どころ:** 利用インタビュー + 成果物レビュー（コード確認）
**解釈・原因の仮説:**
`resolvePublicationMeans` 自体は意図どおり「未知の手段は構成の誤りとして拒否する」ように実装・テスト済み
（`tests/publishing/publicationMeans.test.js`）。`packages/editor/server/publish.js` はこの例外を
try/catch し 500 + エラーメッセージとして返しているが、`get_sidebar.js` と
`get_publication_status.js` は同じ呼び出しを裸で行っており、例外が
`lib/tryServer.js` の汎用 catch（`console.log(e)` のみでレスポンスを返さない）に飲まれ、
結果として利用者には素の404としか見えない。3エンドポイントとも本 plan で
`resolvePublicationMeans` への依存を新設した箇所であり、エラー処理の対称性が
テストツリーでカバーされていなかった。
**推奨される対応:** 「公開手段が解決できないときの `/get_sidebar` ・ `/publication-status` の振る舞い」を
test-tree に追加し、`/publish` と同様に構成エラーを利用者が知覚できる形（エラーレスポンス等）に揃える。

## 保留・再検証で無効になった観察

- 「`npm run server` で ftp 設定時に git として処理された」という当初の報告は、`~/dev/private/blog`
  にライブラリの最新反映がない環境での実行だったため無効。再検証の結果、tenjuu99-blog 側の
  最新コードでは想定どおり `未知の公開手段です: ftp` のエラーが発生することを確認した
  （F-01 に統合）

## F-01 対応（2026-07-10、/tdd-run 次サイクル）

**採用した設計:** fail-fast（起動時検証）ではなく、「エディター全体は動作を継続し、公開操作だけが
行えない」方針をユーザーと対話の上で採用した。理由: `publish.means` は editor パッケージのみが
使う値であり、他機能を止める理由がない。

**実装:**
- 新規 `lib/publishing/publishedStateResolver.js`（`公開済み状態解決器`）: `resolvePublicationMeans`
  が失敗したら、常に例外を投げる（= 既存の `unknown` ステータス判定にそのまま乗る）公開済み状態を
  代わりに返し、失敗をログに出力する
- `get_sidebar.js` / `get_publication_status.js` はこれを介して取得するよう変更。個別の try/catch は
  書かず、両エンドポイントとも落ちずに動作を継続する
- `POST /publish` は変更なし。既存の外側 catch が正確なエラー（`未知の公開手段です: ftp`）を
  `publishFeedback` に返せており、`unknown` 経由の git 前提の文言より良いと判断したため。
  ただしログが出ていなかったため `console.log` を追加した
- 新規 `packages/editor/js/publishAvailability.js`（`公開可否判定器`）: 公開ステータスが `unknown`
  のとき Publish ボタンを無効化し理由を表示する純粋関数。unknown の原因（means 不正 / git remote
  未設定）を問わず同一に扱う

**実機確認（ステップ8）:** `blog.json` に `"publish": {"means": "ftp"}` を設定した状態で
`node bin/server` を起動し、`/get_sidebar`（200、`data-status="unknown"` で全ファイル表示）・
`/publication-status`（`{"status":"unknown"}`）・`POST /publish`（`{"success":false,"error":"未知の公開手段です: ftp"}`、
サーバーログに `[publish] エラー: 未知の公開手段です: ftp` が出力される）を確認した

## ウォークスルー（7.5、F-01 対応分）

| 語彙（plans/dictionary） | テスト describe() | 実装（関数・モジュール名） | 型定義 |
|--------------------------|-------------------|---------------------------|--------|
| 公開済み状態解決器 | ✓ | resolvePublishedState() | なし（装置） |
| 公開可否判定器 | ✓ | publishAvailability() | なし（装置） |

- 名前の消失・変換なし
- src フィールド書き込み済み: 公開済み状態解決器 → lib/publishing/publishedStateResolver.js、
  公開可否判定器 → packages/editor/js/publishAvailability.js
- 依存グラフ（孤立ノードチェック）: `公開済み状態解決器` は静的依存元0件だったが、これは新規の孤立ではなく、
  同じ `@tenjuu99/blog/...` 自己パッケージ指定子 + `.cache/server` 動的 import を使う既存モジュール
  （`公開手段解決器`・`publish.js` 自体）と同一の既知の静的解析限界。実到達性は上記の実機確認で担保した

## 受け入れテストの更新（US-01 シナリオ3、既存挙動からの意図的な変更）

Publishボタンの事前グレーアウトを導入したことで、`tests/acceptance/publish-abstraction.spec.ts` の
US-01 シナリオ3（リモート参照不能）は**クリック後に `#publishFeedback` へエラーが表示される**という
旧アサーションが成立しなくなった（ボタンが無効化され、クリックしても `POST /publish` 自体が
発火しないため）。これは退行ではなく、案1（事前グレーアウト）を採用したことによる意図的な仕様変更。
テストを「`#publicationStatus` が `data-status=\"unknown\"`」「`#publishBtn` が disabled」を
検証する形に更新した。`playwright test` で全10件（6 passed / 4 skipped、既存の US-02 skip 分）を
リポジトリ直下の `blog.json` を一時的に有効な設定（means 未指定 = git）に戻した上で確認した
（フィクスチャは `beforeAll` でリポジトリ直下の `blog.json` をコピーするため、作業中の
`publish.means: \"ftp\"` の変更がそのまま漏れ込む）。
