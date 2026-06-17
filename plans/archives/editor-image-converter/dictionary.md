---
name: editor-image-converter-vocabulary
description: 画像変換プラグイン機構の語彙定義（作業仮説）
metadata:
  type: project
---

# 語彙定義: editor-image-converter

**最終更新:** 2026-06-15
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
