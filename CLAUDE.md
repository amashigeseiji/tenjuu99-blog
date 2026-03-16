# CLAUDE.md

このファイルはClaude Code（AI開発アシスタント）が `@tenjuu99/blog` の開発を支援する際の参照ドキュメントです。

## ドキュメント参照優先順位

1. **[docs/spec.md](docs/spec.md)** - 完全な技術仕様（必ず最初に確認）
2. **[docs/develop.md](docs/develop.md)** - 開発ガイド（ライブラリ開発時）
3. **[README.md](README.md)** - ユーザー向けガイド

## クイックリファレンス

### プロジェクト概要
- **種類**: 静的サイトジェネレーター（Node.js製）
- **機能**: Markdown → HTML変換、テンプレートエンジン、開発サーバー
- **要件**: Node.js >= 21.7

### ディレクトリ構造
```
lib/         コアライブラリ（メイン開発対象）
bin/         CLIコマンド
src-sample/  サンプルプロジェクト（動作確認用）
packages/    コアパッケージ（拡張機能）
```

### 主要コマンド
```bash
npm run dev        # 開発サーバー起動
npm run generate   # 静的サイト生成
npm test           # テスト実行（test/*.test.js）
```

## 開発時の重要ポイント

### 1. モジュール構成の把握
- `lib/pageData.js` - フロントマター解析
- `lib/indexer.js` - 全ページスキャン → `allData` 生成
- `lib/render.js` - レンダリングパイプライン
- `lib/filter.js` - テンプレートエンジン（if, script）
- `lib/generate.js` - ビルドプロセス統括（Hook機構を含む）

詳細は [docs/develop.md#主要モジュールの開発ガイド](docs/develop.md#主要モジュールの開発ガイド) 参照。

**Hook機構**: `afterIndexing` フックでビルドプロセスに介入可能（カテゴリー自動生成など）。詳細は [docs/spec.md#Hook機構](docs/spec.md#Hook機構) 参照。

**カテゴリーパッケージ**: `packages/category` は階層型カテゴリーの自動生成機能を提供。`categories` 配列で複数の独立したカテゴリーシステムを定義可能（`path_filter` でページを絞り込み）。詳細は [docs/spec.md#category-パッケージ詳細](docs/spec.md#category-パッケージ詳細) 参照。

### 2. 制約事項（重要）
- フロントマターはYAML完全互換でない（独自パーサー）
- 配列・オブジェクトはJSON形式必須（`["item1", "item2"]`）
- 変数名は強制小文字化（`{{TITLE}}` → `{{title}}`）
- `include()` は同期処理のみ
- SSGスクリプト内で `import()` 不可

詳細は [docs/spec.md#制約事項](docs/spec.md#制約事項) 参照。

### 3. よくある問題
- **キャッシュ問題**: `.cache/` ディレクトリ削除して再起動
- **テンプレート未反映**: 開発サーバー再起動
- **ヘルパー関数未認識**: `blog.json` の `helper` 設定確認

詳細は [docs/develop.md#よくある問題と対処法](docs/develop.md#よくある問題と対処法) 参照。

## 変更時のチェックリスト

1. **影響範囲調査**: 該当モジュールの依存関係確認（`grep -r "import.*from.*lib/" lib/`）
2. **テスト作成**: 新機能の場合はテストを先に書く（TDD推奨、詳細は [docs/develop.md#TDD](docs/develop.md#TDD（テスト駆動開発）のワークフロー) 参照）
3. **実装**: テストがパスするように実装
4. **動作確認**: `src-sample/` で手動テスト、`npm test` でテスト実行
5. **リグレッションチェック**: 既存機能が壊れていないか確認
6. **ドキュメント更新**: `docs/spec.md` を更新

## トークン効率化

### コード調査の優先順位
1. **ファイル一覧確認**: `ls lib/` でモジュール把握
2. **特定モジュールのみ読む**: 必要最小限のファイル読み込み
3. **grep活用**: 関数・変数の使用箇所を特定（全ファイル読み込み回避）

### 質問対応の効率化
- **仕様確認**: docs/spec.md の該当セクションを直接参照
- **開発方法**: docs/develop.md の該当セクションを直接参照
- **具体例が必要**: src-sample/ を参照

### コンテキスト節約のコツ
- 一度読んだファイルは再読み込みしない（メモリに保持）
- 長大なファイルは必要な関数周辺のみ読む（`offset`, `limit` パラメータ活用）
- 複数ファイルの並列読み込みを活用

## デバッグガイド

### ログ確認
```bash
npm run generate  # ビルドログ確認（青=情報、緑=成功、赤=エラー）
```

### .cache/ ディレクトリ確認
```bash
ls -la .cache/              # キャッシュ内容確認
cat .cache/index.json       # ページインデックス確認
```

### dist/ 確認
```bash
cat dist/index.html         # 生成HTML確認
```

詳細は [docs/develop.md#デバッグ方法](docs/develop.md#デバッグ方法) 参照。

## 追加情報が必要な場合

- **完全な仕様**: [docs/spec.md](docs/spec.md)
- **開発詳細**: [docs/develop.md](docs/develop.md)
- **ユーザーガイド**: [README.md](README.md)
