# Observations: editor-diagnosis

**日時:** 2026-08-14

## 工程の入口で確定した事実

- 再節合型（入口文書: diagnosis.md）。再設計案は案B（クライアント側の装置分割＋基盤くくり出し、およびサーバーハンドラー基盤の導入）を軸に進めることをユーザーが承認（正式決定は手順5）
- 本工程で触らないと確定した診断・申し送り項目（ユーザー承認済み）:
  - editor→lib の node_modules 自己参照コピー経由の実行時依存（既知の別問題）
  - in_scope「AIへの相談」の実装先行宣言（別プラン editor-claude-integration の仕事）
  - depgraph がパッケージ名自己参照 import を解決しない件（診断ツールの改善）
  - スコープ外の徴候（server / dev-server / native-shell の tests 不在、check-vocab の src 未注釈警告）

## 被覆確認・挙動保存で確定した事実

- 回帰面: 台帳の行為18件（作成者）＋間接2件（アプリ利用者: パッケージ解決系）。witness 全緑を確認（78 passed。恒常スキップは手動確認と記録されたシナリオのみ）
- **未登記挙動2件**（コードと witness にあるが台帳に act が無い。feedback の拍で登記判定へ）:
  - リモートの内容を手元に取り込める（pull）— witness: tests/acceptance/sync-operations.spec.ts US-03（5シナリオ・緑）
  - 検出できない参照の宣言 — witness: tests/acceptance/editor-image-library-publication-state.spec.ts US-06（緑）
- 公開ステータスは現在ブランチの upstream（`@{u}`）から導出されるため、upstream の無いブランチでは editor-sidebar-status シナリオ4が落ちる。`git push -u` で解消（ユーザー承認済み）。**受け入れテストの前提として upstream が必要**という事実は今後のセッションでも効く
- 外から入ってくる依存は lib/distribute.js → server/createConverter.js の1辺のみ（grep 実測）。createConverter のインターフェースを変えない限りビルドへの影響なし

## 実装中の気づき

- editor.js のドロップ処理（738行付近）は、既存の Markdown挿入器（js/image_upload.js の insertImageMarkdown）を使わずに挿入をインラインで再実装している。診断の「同型の重複」一覧に未掲載の断片
- （随時追記）
