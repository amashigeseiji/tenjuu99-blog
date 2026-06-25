---
name: editor-image-converter-vocabulary
description: 画像変換プラグイン機構の語彙定義（作業仮説）
metadata:
  type: project
---

# 語彙定義: editor-image-converter

**最終更新:** 2026-06-25
**ステータス:** wip（/tdd-vocab promote 前）
**参照:** plans/editor-image-upload/dictionary.md（コンバーターファクトリー・変換ドライバー・画像コンバーター）

---

## アプリケーションドメイン

（新規概念なし。plans/editor-image-upload/dictionary.md の語彙を使用する）

---

## ソリューションドメイン

### ユーザー提供コンバーターモジュール

**定義:** ユーザーがプロジェクトに配置する JavaScript モジュール。変換関数をデフォルトエクスポートし、出力拡張子を `ext` としてエクスポートする。`blog.json` の `image_converter` にパスを指定することで[コンバーターファクトリー](#コンバーターファクトリー)が解決する。
**インターフェース:**
```js
export default async function(buffer) { return convertedBuffer }
export const ext = 'webp' // 省略可
```
**関係:** [コンバーターファクトリー](plans/editor-image-upload/dictionary.md#コンバーターファクトリー)が読み込む。[変換ドライバー](plans/editor-image-upload/dictionary.md#変換ドライバー)の具体的な実装形態。
**実装参照:** `src-sample/converters/webp.js`（sharp を使った WebP 変換のサンプル）
**テスト:** `tests/editor/editor-image-upload.test.js` → `コンバーターファクトリー は ユーザー指定パスから...`

---

### ビルトインコンバーター

**定義:** `@tenjuu99/blog` パッケージに同梱された変換ドライバー。`blog.json` の `image_converter` でビルトイン名（例: `"sharp"`）を指定することで[コンバーターファクトリー](docs/dictionary.md#コンバーターファクトリー)が解決する。ユーザーが別途ライブラリをインストールしなくても変換が動作することを保証する。
**関係:** [コンバーターファクトリー](docs/dictionary.md#コンバーターファクトリー)が名前で解決する。[変換ドライバー](docs/dictionary.md#変換ドライバー)の一種。
**実装参照:** `packages/editor/server/converters/sharp.js`
**テスト:** `tests/editor/editor-image-upload.test.js` → `コンバーターファクトリー は ビルトイン名から...`
**src:** `packages/editor/server/converters/sharp.js`（実装済み）

---

### ビルド画像配布器

**定義:** ビルドコマンド実行時に、変換設定に従い画像をdistディレクトリに出力する装置。変換設定がある場合は各画像ファイルをコンバーターに通し、ない場合はそのままコピーする。
**インターフェース:**
```js
distributeImages(srcDir, distDir, { fn, ext })
// fn: Buffer → Promise<Buffer>
// ext: 出力拡張子（null のとき元の拡張子を保持）
```
**関係:** [コンバーターファクトリー](docs/dictionary.md#コンバーターファクトリー)が解決した `{ fn, ext }` を受け取る。[ビルド](docs/dictionary.md#ビルド)の一部として実行される。
**実装参照:** `lib/image-distributor.js`（新規）
**テスト:** `tests/ssg-core/imageDistributor.test.js`
**src:** `lib/imageDistributor.js`
