# TDD Requirements: helper.js top-level await 修正

**現在のバージョン:** v1
**最終更新:** 2026-04-27
**テストファイル:** test/helper.test.js
**実装対象:** lib/helper.js, lib/render.js

## 変更履歴

### v1 (2026-04-27)
- 初版

---

## 要件概要

`helper.js` が top-level await を使用しているため、循環依存が発生すると ESM の
デッドロックが起きる。`helper.js` の top-level await を IIFE に置き換え、ロード完了を
示す `helperReady` Promise をエクスポートする。`render.js` はヘルパー関数を使う前に
`helperReady` を await することで、ヘルパーが確実にロードされた状態でテンプレートを
描画できるようにする。

## 技術的背景（調査結果）

### 問題の循環依存
```
helper.js（top-level await で停止中）
  └─ await import(".cache/helper/index.js")
       └─ [static] import replaceVariablesFilter.js
            └─ [static] import helper.js  ← まだ未完了 → デッドロック
```

### 修正方針
- **`lib/helper.js`:** top-level await を IIFE `(async () => { ... })()` に変更し、その Promise を `helperReady` としてエクスポート
- **`lib/render.js`:** `helperReady` を import し、`render()` 冒頭で `await helperReady`

### 関連ファイル
- `lib/helper.js:11` - 問題の top-level await
- `lib/render.js:15` - `render()` 関数（`await helperReady` の追加が必要）
- `lib/replaceVariablesFilter.js:48-51` - `helper` オブジェクトからヘルパー関数を呼び出す
- `.cache/helper/add.js` - `additionalHelper()` 定義（外部依存なし、テストに利用可能）
- `blog.json` - `"helper": "index.js,add.js"` が設定されている
- **テストフレームワーク:** Node.js built-in `node:test`

## テストケース

### TC-01: `helper.js` モジュールは top-level await なしでロード完了する

**目的:** 修正後の `helper.js` が同期的にロード完了し、`helper` オブジェクトがすぐに参照できること
**入力:** `import helper from '../lib/helper.js'`
**期待出力:**
- `typeof helper === 'object'`
- `helper instanceof Promise === false`
**実装のヒント:** IIFE 変更後は `const helper = {}` が同期的に返る

### TC-02: `helperReady` は Promise としてエクスポートされる

**目的:** `helperReady` が Promise であり、ヘルパーのロード完了を待てること
**入力:** `import { helperReady } from '../lib/helper.js'`
**期待出力:** `helperReady instanceof Promise === true`
**実装のヒント:** `const helperReady = (async () => { ... })()` の返り値が export される

### TC-03: `await helperReady` 後に `helper` にヘルパー関数が設定されている

**目的:** IIFE が完了した後、`Object.assign` によって `helper` オブジェクトに関数が追加されること
**入力:** `await helperReady` 実行後の `helper` オブジェクト
**期待出力:** `typeof helper.additionalHelper === 'function'`
**実装のヒント:**
- `blog.json` の `helper: "index.js,add.js"` により `.cache/helper/add.js` がロードされる
- `add.js` の `additionalHelper()` は外部依存がないため test 環境でも動作する
- `helper` は同じオブジェクト参照を `Object.assign` で変更するため、import 側にも変更が反映される

### TC-04: `render()` はヘルパー関数呼び出しを含むテンプレートを処理できる

**目的:** `render.js` が `await helperReady` することで、ヘルパー関数がロードされた状態でテンプレートを描画できること
**入力:**
```javascript
await render(null, {
  markdown: '{{additionalHelper()}}',
  __filetype: 'html'
})
```
**期待出力:** `'これは追加ヘルパーによって出力されているメッセージです。'`
**実装のヒント:**
- `templateName = null` のとき `template = '{{MARKDOWN}}'` → `data.markdown` の内容がそのまま返る
- `__filetype = 'html'` で marked.parse はスキップされる
- `render()` が `await helperReady` を持たない場合、このテストは timing に依存して不安定になる

### TC-05: `render.js` のソースに `helperReady` が含まれている（構造テスト）

**目的:** 将来の regression 検出のため、`render.js` が `helperReady` を参照していることを確認
**入力:** `readFileSync('./lib/render.js', 'utf8')`
**期待出力:** 文字列に `'helperReady'` が含まれる

## 実装チェックリスト

- [ ] TC-01 を満たす（`helper.js` の top-level await を IIFE に変更）
- [ ] TC-02 を満たす（`helperReady` を named export として追加）
- [ ] TC-03 を満たす（IIFE 内で `Object.assign(helper, ...)` する）
- [ ] TC-04 を満たす（`render.js` に `import { helperReady }` と `await helperReady` を追加）
- [ ] TC-05 を満たす（render.js の構造確認）

## 品質方針

- **既存テストへの影響なし:** `helper.js` の default export の型（オブジェクト）は変わらない
- **コードスタイル:** 既存の `node:test` / `node:assert` パターンに準拠
- **`helperReady` は一度 resolve すれば即返る:** `render()` が複数回呼ばれても問題ない

## 未解決の課題

- [ ] TC-04 は `render.js` が `await helperReady` を持たない状態でも IIFE が先に完了していれば通過する可能性がある（timing 依存）。信頼性の高いテストにするためには TC-05 の構造テストを補完として使う

## 参考資料

- 問題の詳細: `helper-top-level-await.md`（プロジェクトルート）
- `lib/replaceVariablesFilter.js:48-51` - helper 呼び出し箇所
- `.cache/helper/add.js` - テスト用ヘルパー関数
