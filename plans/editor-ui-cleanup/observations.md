# Observations: editor-ui-cleanup

**日時:** 2026-06-28

## 実装中の気づき

- ツリーの組み換えはなし。スタブ通りの実装で完了した。

## 受け入れテスト作成中の気づき

### Playwright テストと dev-server の相性問題

`npm run dev`（dev-server）はファイル変更を検知するたびにサーバーを再起動する。
受け入れテストがファイルを作成・削除するたびに再起動が走り、次のナビゲーションが `ERR_CONNECTION_REFUSED` になっていた。

**解決策:**
- playwright.config.ts の `webServer` を `node bin/server`（ファイル監視なし）＋ポート 8001 に変更
- `reuseExistingServer: false` で常に新規起動
- 起動前に `.cache` を削除するコマンドにした（スタート時のキャッシュ汚染を防ぐ）

```
command: 'rm -rf .cache && PORT=8001 node bin/server'
```

### `.cache/index.json` の汚染

テストで作成したファイルのエントリが `.cache/index.json` に残ると、次回の `generate()` で存在しないソースファイルを処理しようとして挙動が不安定になった。起動時に `.cache` を削除することで解決。

### `toContainText()` vs `toHaveValue()`

Playwright の `toContainText()` は要素の `textContent` を読む。`<textarea>` の `.value` はJSで動的に設定されるため、`toHaveValue(/regex/)` を使う必要がある。`textContent` は静的HTML時点の値（空文字か SSG で埋めた初期値）を返す。

### `waitForResponse('/preview')` の登録タイミング

`page.goto()` の `waitUntil: 'load'` は外部リソース（CSS・画像）のロード完了を待つが、モジュールスクリプト内の非同期フェッチ（`initFrontmatterTemplate` → `/get_frontmatter_templates`、`fetchData` → `/get_editor_target`、`submit` → `/preview`）の完了は保証しない。

- `goto` の前に `waitForResponse('/preview')` を登録するとリトライ中にタイムアウトが消費される
- `goto` の後に登録すると、初期ロード時の `/preview` が先着した場合に取りこぼす

**解決策:** DOM 状態のポーリングを使う。`#currentFileName.textContent` が期待値になるまで `waitForFunction` で待つ。これは `fetchData` 完了後の `setCurrentFile()` 呼び出しによって設定されるため、信頼できるシグナル。

### `force: true` では viewport 外クリックが通らないケース

Playwright の `click({ force: true })` でもビューポート外要素のクリックが "Element is outside of the viewport" で失敗するケースがあった（サイドバー内の `<summary>` 要素）。

**解決策:** `locator.evaluate(el => el.click())` でブラウザの JS から直接クリック。Playwright のアクショナビリティチェックを完全にバイパスできる。

### `waitForResponse` 解決後の `setAttribute` 競合

`waitForResponse('/preview')` が解決するのは HTTP レスポンス受信のタイミング。ブラウザ側で `response.json()` をパースして `iframe.setAttribute('srcdoc', ...)` を実行するのは非同期の次ティック以降。`getAttribute('srcdoc')` を即座に呼ぶと古い値を読む可能性がある。

**解決策:** `expect(locator).toHaveAttribute('srcdoc', /regex/, { timeout: 5000 })` のリトライ付きアサーションを使う。

### afterEach vs afterAll でのファイル削除

テストが作成したファイルを `afterEach` で削除すると、テストごとにサーバーが再起動（dev-server 使用時）またはキャッシュが汚染される。`afterAll` でテスト全体完了後にまとめて削除することで、テスト実行中のサーバー状態を安定させた。
