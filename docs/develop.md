# @tenjuu99/blog — 開発ガイド

このドキュメントは `@tenjuu99/blog` ライブラリを開発する際のガイドです。

**注意**: このライブラリを使用してウェブサイトを構築する方法ではなく、ライブラリ自体を開発・改善するための情報を提供します。

## 前提知識

完全な仕様は [spec.md](spec.md) を参照してください。このドキュメントでは開発のコツや実践的な情報のみ記載します。

## 開発環境のセットアップ

```bash
git clone https://github.com/amashigeseiji/tenjuu99-blog.git
cd tenjuu99-blog
npm install
```

### 動作確認

サンプルプロジェクトで動作確認:

```bash
npm run dev     # 開発サーバー起動 (src-sample/ を使用)
npm run generate # 静的サイト生成
```

## プロジェクト構造

```
tenjuu99-blog/
├── lib/              # コアライブラリ（メインロジック）
├── bin/              # CLIコマンド
├── src-sample/       # サンプルプロジェクト（動作確認用）
├── packages/         # コアパッケージ
├── index.js          # エントリーポイント
├── package.json
└── README.md
```

## lib/ ディレクトリの構成

各モジュールの役割:

### コア処理

| ファイル | 役割 |
|---------|------|
| `config.js` | 設定管理（blog.json読み込み） |
| `pageData.js` | フロントマター解析・ページデータ生成 |
| `indexer.js` | 全ページをスキャンして `allData` オブジェクト生成 |
| `render.js` | ページレンダリング（Markdown変換、フィルター適用） |
| `generate.js` | 静的サイト生成プロセス全体の制御 |
| `distribute.js` | ビルド結果の出力・ファイルコピー |

### テンプレート処理

| ファイル | 役割 |
|---------|------|
| `applyTemplate.js` | テンプレート読み込み・適用 |
| `filter.js` | `{if}` 条件分岐、`{script}` 実行 |
| `includeFilter.js` | `{include()}` ディレクティブ処理 |
| `replaceVariablesFilter.js` | `{{変数}}` 展開、ヘルパー関数実行 |

### CSS処理

| ファイル | 役割 |
|---------|------|
| `cssGenerator.js` | CSS結合・minify・キャッシュバスト |
| `minify.js` | CSS/HTML minify |

### サーバー

| ファイル | 役割 |
|---------|------|
| `server.js` | HTTPサーバー（開発用） |
| `tryServer.js` | カスタムサーバーハンドラー |
| `watcher.js` | ファイル監視 |
| `contentType.js` | MIMEタイプ判定 |

### ユーティリティ

| ファイル | 役割 |
|---------|------|
| `dir.js` | ディレクトリパス定義・キャッシュ管理 |
| `files.js` | 静的ファイル読み込み・キャッシュ |
| `helper.js` | ユーザー定義ヘルパー関数読み込み |

## 開発ワークフロー

### 1. 機能追加の基本フロー

1. **仕様検討**: 追加する機能の要件を明確化
2. **影響範囲調査**: どのモジュールに影響があるか確認
3. **テスト作成**: 機能の振る舞いを定義するテストコードを先に書く（TDD推奨）
4. **実装**: 該当モジュールを編集してテストをパスさせる
5. **動作確認**: `src-sample/` で実際の動作テスト
6. **ドキュメント更新**: `docs/spec.md` を更新

#### TDD（テスト駆動開発）のワークフロー

新機能の実装時は、以下のTDDサイクルを推奨します:

**Red → Green → Refactor サイクル:**

1. **Red（テスト作成）**: 失敗するテストを書く
   ```bash
   # test/ ディレクトリにテストファイルを作成
   # 例: test/category-tree.test.js
   ```

2. **Green（最小限の実装）**: テストがパスする最小限のコードを書く
   ```bash
   # 実装を追加
   # 例: packages/category/helper/category.js
   ```

3. **テスト実行**: すべてのテストが通ることを確認
   ```bash
   npm test
   ```

4. **Refactor（リファクタリング）**: コードを改善（テストは変更しない）

**テストファイルの配置:**

- `test/` ディレクトリに `*.test.js` 形式で配置
- Node.js標準のテストランナーを使用（`node --test`）

**テストの例:**

```javascript
// test/example.test.js
import { test } from 'node:test'
import assert from 'node:assert'
import { myFunction } from '../lib/myModule.js'

test('機能の説明', () => {
  const result = myFunction('input')
  assert.strictEqual(result, 'expected')
})
```

**実装例（カテゴリー機能の場合）:**

1. `test/category-tree.test.js` - カテゴリーツリー構築のテスト（12件）
2. `packages/category/helper/category.js` - 実装
3. `npm test` - テスト実行
4. すべてパス後、次のテストを作成

このアプローチにより:
- 仕様が明確になる
- リグレッションを防止できる
- リファクタリングが安全になる

### 2. バグ修正のフロー

1. **再現**: `src-sample/` で問題を再現
2. **原因特定**: 該当モジュールを特定
3. **修正**: コードを修正
4. **検証**: 再度 `src-sample/` でテスト
5. **リグレッションチェック**: 他の機能に影響がないか確認

## 主要モジュールの開発ガイド

### pageData.js の編集

フロントマターの解析ロジックを変更する際:

- `parse()`: メタデータ抽出
- `parseMetaData()`: フロントマターのパース（JSON対応）
- デフォルト値の変更: `metaDataDefault` オブジェクト

**注意点**:
- `config.` プレフィックスで設定値を参照可能（lib/pageData.js:74-77）
- 複数行文字列は `"` で開始・終了（lib/pageData.js:80-89）

### filter.js の編集

テンプレートエンジンの機能追加:

- `replaceIfFilter()`: if文処理
- `ifConditionEvaluator()`: 条件評価ロジック
- `replaceScriptFilter()`: SSGスクリプト実行

**注意点**:
- `{if}` と `<if>` 両方の記法をサポート（lib/filter.js:67）
- `helper` 関数へのアクセスは `helper` オブジェクト経由（lib/filter.js:94）
- `Promise` 対応済み（lib/filter.js:95-96）

### cssGenerator.js の編集

CSS処理の変更:

- `cssGenerator()`: CSS結合・minify・ハッシュ生成
- `applyCss()`: テンプレート内のCSS記法を処理

**記法**: `${出力先<<元ファイル1,元ファイル2}` (lib/cssGenerator.js:54)

### watcher.js の編集

ファイル監視の変更:

- `watchers.push()`: 監視対象追加
- `prior: true` で優先度の高い監視を登録可能（lib/watcher.js:11）

### dir.js の重要性

**最初に読み込まれるモジュール**: 他のモジュールが `import` する前に実行されます。

- `cache()` 関数: `.cache/` ディレクトリへのコピー
- パッケージの統合処理（lib/dir.js:34-51）
- 自動実行: `import` 時に自動で `cache()` が呼ばれる（lib/dir.js:64）

**注意**: `dir.js` の変更は広範囲に影響するため慎重に行ってください。

## パッケージ開発

### パッケージ構成

```
packages/{パッケージ名}/
  ├── {パッケージ名}.js   # ヘルパー関数（必須）
  ├── template/           # テンプレートファイル（任意）
  ├── css/                # スタイルシート（任意）
  └── helper/             # 追加ヘルパー（任意）
```

### パッケージの動作

1. `blog.json` の `packages` で有効化
2. `dir.js` の `cache()` で `.cache/` にコピー（lib/dir.js:34-51）
3. `{パッケージ名}.js` が自動的に `helper` に追加

### 既存パッケージの参考

- `packages/breadcrumbs/` - パンくずリスト機能
- `packages/editor/` - エディター機能
- `packages/turbolink/` - Turbolink機能

## デバッグ方法

### 1. console.log デバッグ

各モジュールに `console.log()` を追加:

```javascript
// lib/pageData.js
const parse = (content, name, ext) => {
  console.log('Parsing:', name, ext)
  // ...
}
```

### 2. ビルドプロセスの確認

```bash
npm run generate
```

- 青色: 情報メッセージ（キャッシュ、インデックス）
- 緑色: 成功（ファイル生成）
- 赤色: エラー（ファイル削除、404）

ログ出力は `node:util` の `styleText()` を使用（lib/generate.js:6, lib/dir.js:3）

### 3. .cache/ ディレクトリの確認

ビルド時に `.cache/` ディレクトリが作成されます:

```bash
ls -la .cache/
cat .cache/index.json  # ページインデックス
```

### 4. dist/ の確認

生成されたHTMLを直接確認:

```bash
cat dist/index.html
```

## Claude Code での開発のコツ

### 1. モジュール間の依存関係を把握

各モジュールがどのモジュールをimportしているか確認:

```bash
grep -r "import.*from.*lib/" lib/
```

### 2. 変更影響範囲の特定

特定の関数がどこで使われているか検索:

```bash
grep -r "関数名" lib/
```

### 3. フロー全体の理解

ビルドプロセス全体:
1. `bin/dev-server` または `bin/server` 実行
2. `lib/generate.js` 呼び出し
3. `lib/indexer.js` で全ページスキャン
4. `lib/render.js` で各ページレンダリング
5. `lib/distribute.js` で出力

### 4. エントリーポイントの確認

- `index.js`: ライブラリとしてのエクスポート
- `bin/server`: 本番サーバー
- `bin/dev-server`: 開発サーバー（ホットリロード）
- `bin/generate`: 静的サイト生成のみ
- `bin/new`: 新規プロジェクト作成

## よくある問題と対処法

### 1. キャッシュ問題

`.cache/` ディレクトリが古い状態の場合:

```bash
rm -rf .cache/
npm run dev
```

### 2. テンプレートが反映されない

`lib/applyTemplate.js` のキャッシュをクリア:
- 開発サーバー再起動で自動クリア

### 3. ヘルパー関数が認識されない

- `blog.json` の `helper` 設定を確認
- `lib/helper.js` が正しくimportしているか確認
- パッケージの場合、`dir.js` でヘルパーが追加されているか確認

### 4. パッケージが有効化されない

- `blog.json` の `packages` 設定を確認
- `packages/{パッケージ名}/{パッケージ名}.js` が存在するか確認
- `.cache/helper/{パッケージ名}.js` にコピーされているか確認

## 制約事項と設計上の注意

### 1. 同期処理の制約

- `includeFilter.js`: 同期処理のため `await` 不可（lib/includeFilter.js:22）
- `files.js` の `warmUp()` で事前読み込みが必要

### 2. 変数名の小文字化

- `replaceVariablesFilter.js`: 変数名を強制的に小文字化（lib/replaceVariablesFilter.js:13）
- 大文字小文字を区別したい場合は別の方法を検討

### 3. eval() の使用

- `pageData.js`: `config.` 参照に `eval()` を使用（lib/pageData.js:76）
- セキュリティ上の理由で将来的に変更の可能性あり

### 4. フロントマターパーサー

- YAML完全互換ではなく独自実装（lib/pageData.js:61-93）
- 配列・オブジェクトはJSON形式必須

## テストについて

### テストフレームワーク

**Node.js標準の `node:test` を使用** - 追加の依存関係なし

```bash
npm test              # 全テスト実行
npm run test:watch    # ウォッチモード
```

### テストの追加方法

新しいテストを追加する場合:

```javascript
// test/example.test.js
import { test } from 'node:test';
import assert from 'node:assert';

test('テストの説明', () => {
  assert.strictEqual(actual, expected);
});
```

### 統合テスト

ユニットテストに加えて、`src-sample/` での手動テストも推奨します。

## コントリビューション

### コーディングスタイル

- ES Modules使用（`import/export`）
- `"use strict"` は一部モジュールで使用
- JSDocコメントは部分的に記載

### 変更を加える際の確認事項

1. `src-sample/` で動作確認
2. 既存機能が壊れていないか確認
3. `docs/spec.md` を更新
4. `README.md` が必要に応じて更新

## パフォーマンス最適化

### 現在の最適化

1. **テンプレートキャッシュ**: `lib/applyTemplate.js` と `lib/files.js`
2. **CSSキャッシュバスト**: MD5ハッシュで変更検知（lib/cssGenerator.js:32）
3. **差分ビルド**: 開発サーバーでは変更ページのみ再生成

### 最適化の余地

- ページデータのキャッシュ
- 並列処理の導入
- インクリメンタルビルド

## 参考リソース

- [spec.md](spec.md) — 完全な技術仕様
- [README.md](../README.md) — ユーザー向けガイド
- GitHub Issues — バグ報告・機能要望
- `src-sample/` — サンプルプロジェクト（動作確認用）
