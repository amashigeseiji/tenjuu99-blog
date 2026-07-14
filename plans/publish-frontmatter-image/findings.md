# Findings: publish-frontmatter-image

**日時:** 2026-07-15

## 孤立ノードチェック（手順7.5）

- 依存グラフ上、新規モジュールは `frontmatterImageReferenceExtractor.js` ← `publishTargetCollector.js` ← `publish.js`（公開ハンドラー）まで静的に到達する
- ただし `packages/editor/server/publish.js` は entry_points glob（`bin/*`, `lib/server/**`）に静的には繋がらない。editor のハンドラーはサーバーディレクトリ機構により**実行時登録**されるため、静的グラフでは追えない。孤立ではなく、受け入れテスト（HTTP経由の公開操作）で実到達を確認済み
- editor コンテキストのハンドラー全般に共通する構造のため、entry_points に `packages/*/server/**` を加えるか検討の余地あり

## モジュール配置の注意

- `packages/editor/js/frontmatterImageReferenceExtractor.js` は scaffold の慣例で `js/` に置かれたが、`@tenjuu99/blog/lib/pageData.js`（Node 専用）に依存するためサーバー側専用。現状ブラウザから読み込む箇所はないが、将来クライアントで使う場合は解析器の注入などの分離が必要

## 受け入れテストで得た知見

- 複数ブラウザプロジェクトが同一 spec を並列実行するため、フィクスチャサーバーのポートは `testInfo.parallelIndex` で分離する必要がある（既存の sync-operations.spec.ts は固定ポート 8200 のため同種の競合リスクあり）
- エディタページは goto 直後にボタンをクリックするとハンドラ未登録で無反応になることがある。`#publicationStatus` の `data-status` 確定を待つことで JS 初期化完了を保証してからクリックする
