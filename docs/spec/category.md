# カテゴリー

ページをディレクトリ階層に基づいて分類し、カテゴリーページとして一覧表示する領域（`category` パッケージ）。ページの描画（SSGコア）、編集 UI（エディタ）は扱わない。

## category パッケージ詳細

階層型カテゴリーの自動ページ生成機能を提供します。

**基本的な使い方:**

1. ページのフロントマターでカテゴリーを指定:
   ```yaml
   ---
   title: React入門
   category: ["Tech", "Frontend", "React"]
   ---
   ```

2. `blog.json` で設定:
   ```json
   {
     "packages": "category",
     "hooks": {
       "afterIndexing": "categoryIndexer.js"
     },
     "category": {
       "template": "category.html",
       "auto_generate": true,
       "max_depth": 3,
       "url_case": "lower",
       "url_separator": "-",
       "url_prefix": ""
     }
   }
   ```

3. ビルド時に以下のページが自動生成されます:
   - `/tech/index.html`
   - `/tech/frontend/index.html`
   - `/tech/frontend/react/index.html`

**スペース変換とURLプレフィックスの使用例:**

```json
{
  "category": {
    "url_case": "lower",
    "url_separator": "-",
    "url_prefix": "/books/category"
  }
}
```

カテゴリー指定: `category: ["Contemporary Art", "Abstract Painting"]`

生成されるURL:
- `/books/category/contemporary-art/index.html`
- `/books/category/contemporary-art/abstract-painting/index.html`

**設定オプション:**

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `name` | カテゴリーシステムの識別子（`categories` 配列使用時のみ） | - |
| `path_filter` | 対象とするページのパスプレフィックス（`categories` 配列使用時に推奨） | `""` (全ページ) |
| `template` | カテゴリーページのテンプレート | `category.html` |
| `auto_generate` | 自動生成の有効/無効 | `true` |
| `max_depth` | カテゴリーの最大階層数 | `3` |
| `url_case` | URLの大文字小文字変換 (`lower`/`original`) | `lower` |
| `url_separator` | スペースの置き換え文字 | `"-"` |
| `url_prefix` | カテゴリーURLのプレフィックス | `""` |
| `per_page` | 1ページあたりの記事数。正の整数のときページネーション有効。`false`・`0`・未設定はページネーションなし | `undefined` |

**設定オプションの詳細:**

- **`name`**: カテゴリーシステムの識別子。`categories` 配列で複数のカテゴリーシステムを定義する際に使用します。

- **`path_filter`**: 対象とするページのパスプレフィックス。
  - 例: `path_filter: "book/"` → `book/` 配下のページのみがこのカテゴリーシステムに含まれる
  - 空文字列の場合は全ページが対象
  - 複数カテゴリーシステムを使用する場合は、各システムで `path_filter` を設定することを推奨

- **`url_separator`**: カテゴリー名にスペースが含まれる場合の置き換え文字を指定します。
  - 例: `category: ["Contemporary Art"]` + `url_separator: "-"` → `/contemporary-art/`
  - 例: `category: ["Contemporary Art"]` + `url_separator: "_"` → `/contemporary_art/`

- **`url_prefix`**: すべてのカテゴリーURLに共通のプレフィックスを追加します。
  - 例: `url_prefix: "/blog/categories"` → カテゴリーページは `/blog/categories/tech/`、`/blog/categories/art/` など
  - 空文字列の場合はルート直下に生成されます

**自動生成されるページのメタデータ:**

```javascript
{
  name: 'tech/frontend/index',
  url: '/tech/frontend/',
  __output: '/tech/frontend/index.html',
  index: false,                         // 一覧（allData のインデックス）には含めない
  title: 'Frontend',                    // カテゴリー名
  template: 'category.html',
  category_path: ['Tech', 'Frontend'],  // カテゴリーパス
  category_pages: ['tech/frontend/react/tutorial', ...],  // このカテゴリーのページ（per_page設定時は当該ページのスライス）
  category_children: [                  // サブカテゴリー（{url, title}[] 型）
    { url: '/tech/frontend/react/', title: 'React' },
    ...
  ],
  __is_auto_category: true,
  distribute: true,
  // 常に設定されるページネーションフィールド（per_page 無効時は current_page=1, total_pages=1, per_page=undefined）:
  category_current_page: 1,           // 現在のページ番号（1始まり）
  category_total_pages: 3,            // 総ページ数
  category_per_page: 10,              // 1ページあたりの件数（per_page 無効時は undefined）
  category_pagination_base: '/tech/frontend/',  // カテゴリー1ページ目URL（末尾スラッシュあり）
}
```

**テンプレート内で利用可能な変数:**

- `{{title}}` - カテゴリー名
- `{{category_path}}` - カテゴリーパス配列
- `{{category_pages}}` - このカテゴリーに属するページ名の配列（ページネーション有効時は当該ページ分のスライス）
- `{{category_children}}` - サブカテゴリーの配列。各要素は `{url: string, title: string}` オブジェクト
- `{{category_current_page}}` - 現在のページ番号（常に設定、ページネーション無効時は `1`）
- `{{category_total_pages}}` - 総ページ数（常に設定、ページネーション無効時は `1`）
- `{{category_per_page}}` - 1ページあたりの件数（ページネーション無効時は `undefined`）
- `{{category_pagination_base}}` - カテゴリーの1ページ目URL、末尾スラッシュあり（常に設定）

**複数カテゴリーシステムの使用:**

`categories` 配列を使用することで、複数の独立したカテゴリーシステムを定義できます。

```json
{
  "packages": "category",
  "hooks": {
    "afterIndexing": "categoryIndexer.js"
  },
  "categories": [
    {
      "name": "books",
      "url_prefix": "/book-list",
      "path_filter": "book/",
      "template": "category.html",
      "auto_generate": true,
      "max_depth": 3,
      "url_case": "lower",
      "url_separator": "-"
    },
    {
      "name": "articles",
      "url_prefix": "/article-list",
      "path_filter": "article/",
      "template": "article-category.html",
      "auto_generate": true,
      "max_depth": 2
    }
  ]
}
```

**動作例:**
- `book/after-rain.md` (category: ["Art", "Painting"]) → `/book-list/art/painting/index.html`
- `article/news/200910.md` (category: ["News"]) → `/article-list/news/index.html`
- `/book-list/news/index.html` は生成**されない**（意図しないページ生成を防止）
- `/article-list/art/index.html` は生成**されない**（各システムは独立）

**後方互換性:**

既存の `category`（単数形）設定も引き続き動作します。`categories` 配列と `category` の両方が定義されている場合、`categories` が優先されます。

```json
{
  "category": {
    "template": "category.html",
    "auto_generate": true
  }
}
```

**手動ページによる上書き:**

`src/pages/tech/index.md` が存在する場合、自動生成はスキップされます。

---

## ページネーション

`per_page` を設定すると、カテゴリーごとに複数の静的HTMLページが自動生成されます。

**設定例:**

```json
{
  "categories": [
    {
      "name": "books",
      "url_prefix": "/book-list",
      "path_filter": "book/",
      "template": "category.html",
      "auto_generate": true,
      "per_page": 10
    }
  ]
}
```

**生成されるURL:**

10件の記事と `per_page: 3` の設定では:

| ページ | ページ名（allData キー） | 出力ファイル |
|--------|--------------------------|-------------|
| 1 | `book-list/art/index` | `dist/book-list/art/index.html` |
| 2 | `book-list/art/2/index` | `dist/book-list/art/2/index.html` |
| 3 | `book-list/art/3/index` | `dist/book-list/art/3/index.html` |

1ページ目のURL・ファイル名は `per_page` 未設定時と同じで後方互換を維持します。

**`per_page` 未設定時との違い:**

| 項目 | per_page 未設定 | per_page 設定あり |
|------|----------------|-----------------|
| 生成ページ数 | 1 | ceil(記事数 / per_page) |
| `category_pages` | 全記事 | 当該ページの記事スライス |
| `category_current_page` 等 | あり（current_page=1, total_pages=1） | あり |

**ページネーション UI パーシャル（`_pagination.html`）:**

`packages/category/template/_pagination.html` がパッケージに同梱されており、`category.html` から自動的に include されます。`total_pages <= 1` のときは何も出力しません。

独自スタイルに合わせてカスタマイズする場合は、`src/template/_pagination.html` に同名ファイルを配置するとパッケージのデフォルトを上書きできます（[SSGコア › ファイル優先順位](ssg-core.md#ファイル優先順位) 参照）。

**ページネーションヘルパー（`pagination.js`）:**

`category` パッケージの `helper/pagination.js` が提供する関数で、パッケージ有効化時にヘルパーとして自動登録されます。独自テンプレートを作成する際は `{script}` ブロックから `helper.getPaginationUrl(...)` / `helper.buildWindowedPages(...)` として利用できます。

```javascript
// ページ番号から URL を生成する
// page === 1 → basePath、それ以外 → basePath + page + '/'
getPaginationUrl(basePath, page)

// ウィンドウ付きページ番号リストを生成する
// 各要素: {num: number, isCurrent: boolean} または {num: null, isEllipsis: true}
buildWindowedPages(totalPages, currentPage, windowSize = 2)
```

**使用例（カスタムテンプレート内）:**

```html
<script type="ssg">
  if ((variables.category_total_pages || 0) <= 1) return ''

  const totalPages = variables.category_total_pages
  const currentPage = variables.category_current_page
  const base = variables.category_pagination_base

  // ページURLを生成（page=1 → base, page=2 → base + '2/'）
  const prevUrl = currentPage > 1 ? base + (currentPage - 1 === 1 ? '' : (currentPage - 1) + '/') : null
  const nextUrl = currentPage < totalPages ? base + (currentPage + 1) + '/' : null

  let html = '<nav class="pagination">'
  if (prevUrl) html += `<a href="${prevUrl}">前へ</a>`
  if (nextUrl) html += `<a href="${nextUrl}">次へ</a>`
  html += '</nav>'
  return html
</script>
```

**`category_children` の型（破壊的変更）:**

この変更により、`category_children` の型が `string[]`（URL文字列の配列）から `{url: string, title: string}[]`（オブジェクトの配列）に変わりました。

既存のカスタムテンプレートで `category_children` を文字列として扱っている場合は更新が必要です。

```html
<!-- 旧 (変更前) -->
<script type="ssg">
  for (const childUrl of variables.category_children) {
    html += `<a href="${childUrl}">${childUrl}</a>`
  }
</script>

<!-- 新 (変更後) -->
<script type="ssg">
  for (const child of variables.category_children) {
    html += `<a href="${child.url}">${child.title}</a>`
  }
</script>
```

---

**ヘルパー関数:**

```javascript
// カテゴリーツリーを取得
const tree = helper.getCategoryTree()

// 特定カテゴリーのページを取得（配列で指定）
const pages = helper.getCategoryPages(['Tech', 'Frontend'])

// サブカテゴリーを含む全ページを取得（配列で指定）
const allPages = helper.getCategoryPagesRecursive(['Tech'])
```

