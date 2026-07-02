# Findings: native-mac-shell

**日時:** 2026-07-03

## 7.5 依存グラフチェック（孤立ノードチェック）: スキップ

`.claude/tdd/config.json` の `depgraph.regen`（`.claude/tdd/depgraph-regen.js`）は正規表現ベースのJS/ESM専用静的解析ツールで、対象は `lib/`, `bin/`, `packages/`, `src-sample/`, `index.js` のみ。今回追加した `native/`（Swiftコード）はツールの対象言語・対象ディレクトリのどちらにも該当しないため、孤立ノードチェックは実施不可（設定不備ではなく、ツールの守備範囲外）。

将来 `native/` 側で依存関係の追跡が必要になった場合、Swift用の依存グラフツール（`swift package show-dependencies` 等）を別途検討する必要がある。

## 8.5 ユーザーストーリーテスト: pending（6件中6件 skip）

`tests/acceptance/native-mac-shell.spec.ts` を生成し実行した結果は `pending`（全6シナリオ `test.skip`）。

理由: このプロジェクトの受け入れ対象はAppKitのネイティブウィンドウ・プロセスライフサイクルが中心で、Playwrightが自動操作できる「ブラウザでHTTPサーバーにアクセスする」という手段では検証できない。US-02（保存・プレビュー・ツリー操作そのもの）はeditorコンテキストの既存受け入れテスト（`editor-realtime-preview.spec.ts` / `editor-sidebar-status.spec.ts`）がブラウザ経由で既にカバーしており、native-shell固有の観点（WKWebView内で外部切り替えなしに完結すること）はPlaywrightでは区別できない。

全シナリオは2026-07-03に実機での手動検証で確認済み（`swift run App` を実行し、起動→編集→終了までの一連の操作とプロセスのクリーンアップを確認）。
