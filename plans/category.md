# カテゴリー機能実装計画

## 概要

`@tenjuu99/blog` に階層型カテゴリー機能を追加する。

### 要件

各ページのフロントマターに以下のように記述:

```yaml
category: ["Art", "Painting"]
```

この場合、以下のインデックスページが自動生成される:

- `art/index.html` - カテゴリー Art に所属するコンテンツをリスト化
- `art/painting/index.html` - カテゴリー Art > Painting に所属するコンテンツをリスト化

**上書き動作**: `src/pages/art/index.md` が存在する場合、自動生成をスキップして手動作成ページを優先。

---

## 実装方式

### 選択した方式: フックポイント方式（案1）

`lib/generate.js` の `indexing()` 後にフックポイントを提供し、`blog.json` で指定したフック関数を実行する。

#### アーキテクチャ

```
indexing()
  ↓
allData 生成完了
  ↓
runHooks('afterIndexing') ← フックポイント
  ↓
categoryIndexer.afterIndexing() が実行
  ↓
allData に仮想カテゴリーページを追加
  ↓
distribute()
```

---

## ディレクトリ構成

```
packages/category/
  ├── helper/
  │   ├── category.js         # ヘルパー関数（getCategoryTree, getCategoryPages など）
  │   └── categoryIndexer.js  # フック関数（afterIndexing）
  ├── template/
  │   └── category.html       # カテゴリーページテンプレート
  └── css/
      └── category.css        # カテゴリーページスタイル

lib/
  └── generate.js             # フック実行機構を追加
  └── helper.js               # 非同期処理の修正

tests/
  ├── category.test.js        # カテゴリー機能のテスト
  └── hooks.test.js           # フック機構のテスト
```

---

## 設定ファイル (`blog.json`)

```json
{
  "packages": "breadcrumbs,category",
  "hooks": {
    "afterIndexing": "categoryIndexer.js"
  },
  "category": {
    "template": "category.html",
    "auto_generate": true,
    "max_depth": 3,
    "url_case": "lower"
  }
}
```

### 設定項目

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| `category.template` | `"category.html"` | カテゴリーページのテンプレート |
| `category.auto_generate` | `true` | 自動生成の有効/無効 |
| `category.max_depth` | `3` | カテゴリー階層の最大深さ |
| `category.url_case` | `"lower"` | URL生成時の大文字小文字処理（`lower`, `original`） |

---

## 実装タスク

### フェーズ1: フック機構の実装

#### 1.1 `lib/helper.js` の非同期処理修正

**現状の問題**:
```javascript
files.forEach(async file => {  // ← await が効かない
  const helperAdditional = await import(`${helperDir}/${file}`)
  helper = Object.assign(helper, helperAdditional)
})
```

**修正内容**:
```javascript
for (const file of files) {
  if (existsSync(`${helperDir}/${file}`)) {
    const helperAdditional = await import(`${helperDir}/${file}`)
    helper = Object.assign(helper, helperAdditional)
  }
}
```

#### 1.2 `lib/generate.js` にフック実行機構を追加

**追加する関数**:
```javascript
const runHooks = async (hookName) => {
  if (!config.hooks || !config.hooks[hookName]) {
    return
  }

  const hookFiles = Array.isArray(config.hooks[hookName])
    ? config.hooks[hookName]
    : [config.hooks[hookName]]

  for (const hookFile of hookFiles) {
    const hookPath = `${helperDir}/${hookFile}`

    if (existsSync(hookPath)) {
      try {
        const hookModule = await import(hookPath)
        if (typeof hookModule[hookName] === 'function') {
          await hookModule[hookName](allData, config)
          console.log(styleText('blue', `[hook] ${hookName} executed: ${hookFile}`))
        }
      } catch (e) {
        console.error(styleText('red', `[hook error] ${hookName}:`), e)
      }
    }
  }
}
```

**`generate()` 関数の修正**:
```javascript
const generate = async () => {
  let start = performance.now()
  await beforeGenerate()
  await indexing()
  let end = performance.now()
  console.log(styleText('blue', '[indexing: ' + (end - start) + "ms]"))

  // フックポイント追加
  start = performance.now()
  await runHooks('afterIndexing')
  end = performance.now()
  if (config.hooks?.afterIndexing) {
    console.log(styleText('blue', '[afterIndexing hook: ' + (end - start) + "ms]'))
  }

  start = performance.now()
  await distribute(allData, srcDir, distDir)
  end = performance.now()
  console.log(styleText('blue', '[distribute: ' + (end - start) + "ms]'))
}
```

#### テスト項目

- [ ] `runHooks()` が存在しないフック名で呼ばれても例外が発生しない
- [ ] `runHooks()` が存在しないファイルを指定しても例外が発生しない
- [ ] `runHooks()` が正しいフック関数を実行する
- [ ] `runHooks()` が複数のフック関数を順番に実行する
- [ ] フック関数内でエラーが発生してもビルドが続行される
- [ ] `lib/helper.js` の修正後、ヘルパー関数が正しくロードされる

---

### フェーズ2: カテゴリーツリー構築

#### 2.1 `packages/category/helper/category.js` 実装

**関数仕様**:

##### `buildCategoryTree(allData)`

全ページの `category` フロントマターからカテゴリーツリーを構築する。

**入力**:
```javascript
{
  "post/1": { category: ["Art", "Painting"], ... },
  "post/2": { category: ["Art", "Sculpture"], ... },
  "post/3": { category: ["Art", "Painting"], ... },
  "post/4": { category: ["Music"], ... }
}
```

**出力**:
```javascript
{
  "/art": {
    title: "Art",
    path: ["Art"],
    pages: ["post/1", "post/2", "post/3"],
    children: {
      "/art/painting": {
        title: "Painting",
        path: ["Art", "Painting"],
        pages: ["post/1", "post/3"],
        children: {}
      },
      "/art/sculpture": {
        title: "Sculpture",
        path: ["Art", "Sculpture"],
        pages: ["post/2"],
        children: {}
      }
    }
  },
  "/music": {
    title: "Music",
    path: ["Music"],
    pages: ["post/4"],
    children: {}
  }
}
```

##### `getCategoryPages(categoryPath)`

特定のカテゴリーに所属するページを取得する。

**引数**:
- `categoryPath`: `["Art", "Painting"]` 形式の配列

**戻り値**:
- 該当カテゴリーに属するページデータの配列

**動作**:
- 完全一致のみ（`["Art"]` は `["Art", "Painting"]` にマッチしない）
- サブカテゴリーを含める場合は `getCategoryPagesRecursive()` を使用

##### `getCategoryTree()`

構築済みのカテゴリーツリーを取得する（キャッシュ）。

#### テスト項目

- [ ] `buildCategoryTree()` が空の `allData` で空オブジェクトを返す
- [ ] `buildCategoryTree()` が単一カテゴリーを正しく構築する
- [ ] `buildCategoryTree()` が階層カテゴリーを正しく構築する
- [ ] `buildCategoryTree()` が複数のルートカテゴリーを処理する
- [ ] `buildCategoryTree()` が `category` フィールドを持たないページを無視する
- [ ] `buildCategoryTree()` が不正な `category` 値（文字列、null など）をスキップする
- [ ] `buildCategoryTree()` が `max_depth` を超える階層を無視する
- [ ] `buildCategoryTree()` が URL を `url_case` 設定に従って生成する
- [ ] `getCategoryPages(["Art"])` が正しいページを返す
- [ ] `getCategoryPages(["Art", "Painting"])` が正しいページを返す
- [ ] `getCategoryPages(["NonExistent"])` が空配列を返す

---

### フェーズ3: 仮想ページ生成

#### 3.1 `packages/category/helper/categoryIndexer.js` 実装

**フック関数仕様**:

##### `afterIndexing(allData, config)`

`allData` に仮想カテゴリーインデックスページを追加する。

**動作**:
1. `buildCategoryTree(allData)` でカテゴリーツリーを構築
2. 各カテゴリーに対して仮想ページを生成
3. 既存ページ（手動作成）が存在する場合はスキップ
4. `allData` に仮想ページを追加

**生成されるページデータの例**:
```javascript
{
  name: "art/painting/index",
  url: "/art/painting",
  __output: "/art/painting/index.html",
  title: "Painting",
  template: "category.html",
  markdown: "",
  category_path: ["Art", "Painting"],
  category_pages: ["post/1", "post/3"],
  category_children: ["/art/painting/oil", "/art/painting/watercolor"],
  __is_auto_category: true,
  distribute: true,
  index: false,
  noindex: false,
  lang: "ja",
  published: "1970-01-01",
  // ...その他デフォルト値
}
```

#### テスト項目

- [ ] `afterIndexing()` が単一カテゴリーの仮想ページを生成する
- [ ] `afterIndexing()` が階層カテゴリーの仮想ページを生成する
- [ ] `afterIndexing()` が既存ページを上書きしない
- [ ] `afterIndexing()` が `category.auto_generate: false` のとき何もしない
- [ ] 生成された仮想ページが正しい `name` を持つ
- [ ] 生成された仮想ページが正しい `url` を持つ
- [ ] 生成された仮想ページが正しい `__output` を持つ
- [ ] 生成された仮想ページが `distribute: true` を持つ
- [ ] 生成された仮想ページが `index: false` を持つ
- [ ] 生成された仮想ページが `__is_auto_category: true` を持つ
- [ ] 生成された仮想ページが `category_pages` にページリストを持つ
- [ ] 生成された仮想ページが `category_children` にサブカテゴリーリストを持つ

---

### フェーズ4: テンプレート実装

#### 4.1 `packages/category/template/category.html` 実装

**テンプレート仕様**:

```html
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8">
  <title>{{title}} - {{site_name}}</title>
</head>
<body>
  <h1>{{title}}</h1>

  <!-- サブカテゴリーリスト -->
  {if category_children}
    <h2>サブカテゴリー</h2>
    <script type="ssg">
      const children = variables.category_children || []
      return children.map(childUrl => {
        const childData = Object.values(helper.allData).find(p => p.url === childUrl)
        return `<li><a href="${childUrl}">${childData?.title || childUrl}</a></li>`
      }).join('')
    </script>
  {/if}

  <!-- ページリスト -->
  <h2>コンテンツ</h2>
  <script type="ssg">
    const pageNames = variables.category_pages || []
    const pages = pageNames.map(name => helper.allData[name]).filter(Boolean)
    return helper.renderIndex(pages)
  </script>
</body>
</html>
```

#### 4.2 `packages/category/css/category.css` 実装

基本的なスタイル定義。

#### テスト項目

- [ ] カテゴリーページが正しくレンダリングされる
- [ ] サブカテゴリーリストが表示される
- [ ] ページリストが表示される
- [ ] `category_children` が空の場合、サブカテゴリーセクションが非表示になる
- [ ] `category_pages` が空の場合、空のリストが表示される

---

### フェーズ5: 統合テスト

#### 5.1 エンドツーエンドテスト

**テストシナリオ**:

1. **基本的なカテゴリー生成**
   ```
   pages/post/1.md: category: ["Tech"]
   pages/post/2.md: category: ["Tech"]
   ```
   → `dist/tech/index.html` が生成される
   → Tech カテゴリーページに post/1, post/2 がリストされる

2. **階層カテゴリー生成**
   ```
   pages/post/1.md: category: ["Tech", "Frontend"]
   pages/post/2.md: category: ["Tech", "Backend"]
   ```
   → `dist/tech/index.html` が生成される
   → `dist/tech/frontend/index.html` が生成される
   → `dist/tech/backend/index.html` が生成される

3. **手動ページによる上書き**
   ```
   pages/tech/index.md: (手動作成)
   pages/post/1.md: category: ["Tech"]
   ```
   → 手動作成の `tech/index.html` が優先される
   → 仮想ページは生成されない

4. **複数ルートカテゴリー**
   ```
   pages/post/1.md: category: ["Tech"]
   pages/post/2.md: category: ["Art"]
   ```
   → `dist/tech/index.html` が生成される
   → `dist/art/index.html` が生成される

5. **深い階層のカテゴリー**
   ```
   pages/post/1.md: category: ["A", "B", "C", "D"]
   ```
   → `max_depth: 3` の場合、D は無視される
   → `dist/a/b/c/index.html` まで生成される

#### テスト項目

- [ ] 基本的なカテゴリー生成が動作する
- [ ] 階層カテゴリー生成が動作する
- [ ] 手動ページによる上書きが動作する
- [ ] 複数ルートカテゴリーが動作する
- [ ] `max_depth` 制限が動作する
- [ ] `url_case: "lower"` で URL が小文字化される
- [ ] `url_case: "original"` で URL が元の大文字小文字を保持する
- [ ] `category.auto_generate: false` でカテゴリーページが生成されない
- [ ] カテゴリーページが `.cache/index.json` に記録される
- [ ] カテゴリー削除時に対応する HTML ファイルが削除される

---

## 技術的制約と対処

### 制約1: URL衝突

**問題**: `pages/art.md` と自動生成 `art/index` が衝突する可能性

**対処**:
- `allData` のキー照合で先に実ファイルが登録されるため、自動生成時にスキップ
- `__is_auto_category: true` フラグで識別

### 制約2: カテゴリー変更時のキャッシュ

**問題**: カテゴリーフロントマター変更時、旧カテゴリーページが残る

**対処**:
- `.cache/category-index.json` に前回生成したカテゴリーページリストを保存
- 次回ビルド時に差分を検出して削除

### 制約3: パフォーマンス

**問題**: 大量ページでのカテゴリーツリー構築コスト

**対処**:
- カテゴリーツリーは1度だけ構築し、ヘルパー関数でキャッシュ
- `category_pages` は名前のみ保存（ページデータ全体は保存しない）

---

## 実装スケジュール

### ステップ1: フック機構実装（TDDスタイル）
1. テスト作成: `tests/hooks.test.js`
2. `lib/generate.js` 修正
3. `lib/helper.js` 修正
4. テスト実行・修正

### ステップ2: カテゴリーツリー構築（TDDスタイル）
1. テスト作成: `tests/category-tree.test.js`
2. `packages/category/helper/category.js` 実装
3. テスト実行・修正

### ステップ3: 仮想ページ生成（TDDスタイル）
1. テスト作成: `tests/category-indexer.test.js`
2. `packages/category/helper/categoryIndexer.js` 実装
3. テスト実行・修正

### ステップ4: テンプレート実装
1. `packages/category/template/category.html` 作成
2. `packages/category/css/category.css` 作成
3. 手動テスト（`src-sample/` で確認）

### ステップ5: 統合テスト
1. テスト作成: `tests/category-integration.test.js`
2. エンドツーエンドテスト実行
3. バグ修正・調整

---

## 将来の拡張可能性

### 追加可能なフックポイント

- `beforeDistribute` - 配布前の最終調整
- `afterDistribute` - 配布後のクリーンアップ
- `beforeRender` - 各ページレンダリング前
- `afterRender` - 各ページレンダリング後

### 他の機能への応用

- **タグ機能**: `tags: ["JavaScript", "React"]` で同様の仕組み
- **シリーズ機能**: `series: "Getting Started"` で連載記事のインデックス
- **言語切り替え**: `lang: "en"` で多言語対応

---

## 参考情報

### 既存コード

- `lib/indexer.js:34-44` - ページインデックス化処理
- `lib/generate.js:12-23` - ビルドプロセス
- `lib/distribute.js:19-37` - ページ配布処理
- `src-sample/pages/post/index.md` - 手動インデックスページの例
- `packages/breadcrumbs/helper/breadcrumbs.js` - ヘルパー関数の例

### ドキュメント

- `docs/spec.md` - 技術仕様
- `docs/develop.md` - 開発ガイド
- `CLAUDE.md` - 開発支援ガイド
