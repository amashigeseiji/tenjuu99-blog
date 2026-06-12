# @tenjuu99/blog — 技術仕様書

このドキュメントは `@tenjuu99/blog` の技術仕様を定義します。

## プロジェクト概要

`@tenjuu99/blog` は、Markdownファイルから静的HTMLサイトを生成するNode.js製の軽量静的サイトジェネレーターです。

### 主な特徴

- Markdownファイルベースのコンテンツ管理
- フロントマターによるメタデータ定義
- テンプレートエンジン機能（変数展開、条件分岐、スクリプト実行）
- ホットリロード対応の開発サーバー
- CSSの自動結合・minify・キャッシュバスト
- ヘルパー関数による拡張性
- パッケージシステムによる機能拡張

### 動作環境

- Node.js >= 21.7
- 依存パッケージ:
  - `marked` ^13.x (Markdown → HTML変換)
  - `chokidar` ^4.0.x (ファイル監視)

## CLIコマンド

```bash
npx create-blog  # 新規プロジェクト作成
npx server       # 開発サーバー起動（ホットリロード対応）
npx generate     # 静的サイト生成
```

## ディレクトリ構成

### ユーザープロジェクト構成

```
project/
  ├── blog.json          # 設定ファイル
  ├── src/               # ソースディレクトリ（デフォルト）
  │   ├── pages/         # Markdownコンテンツ
  │   ├── template/      # HTMLテンプレート
  │   ├── css/           # スタイルシート
  │   ├── image/         # 画像ファイル
  │   ├── helper/        # ヘルパー関数
  │   └── packages/      # カスタムパッケージ
  ├── dist/              # ビルド出力（デフォルト）
  └── .cache/            # ビルド時キャッシュ（自動生成）
```

### ライブラリ内部構成

```
@tenjuu99/blog/
  ├── lib/               # コアライブラリ
  ├── bin/               # CLIコマンド
  ├── src-sample/        # サンプルプロジェクト
  ├── packages/          # コアパッケージ
  │   ├── breadcrumbs    # パンくずリスト
  │   ├── editor         # エディター機能
  │   └── turbolink      # Turbolink機能
  └── index.js           # エントリーポイント
```

## 設定ファイル (blog.json)

プロジェクトルートに `blog.json` を配置します。

```json
{
  "site_name": "サイト名",
  "url_base": "http://localhost:8000",
  "src_dir": "src",
  "dist_dir": "dist",
  "distribute_raw": "image,js",
  "helper": "index.js",
  "packages": "breadcrumbs,turbolink",
  "relative_path": "",
  "allowedSrcExt": "md|html|txt"
}
```

### 設定項目

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| `site_name` | `"default"` | サイト名 |
| `url_base` | `"http://localhost:8000"` | ベースURL |
| `src_dir` | `"src"` | ソースディレクトリ |
| `dist_dir` | `"dist"` | 出力ディレクトリ |
| `distribute_raw` | `"image"` | そのままコピーするディレクトリ（カンマ区切り） |
| `helper` | `""` | ヘルパーファイル（カンマ区切り） |
| `packages` | `""` | 使用するパッケージ（カンマ区切り） |
| `relative_path` | `""` | 相対パス（サブディレクトリ配置時） |
| `allowedSrcExt` | `"md\|html\|txt"` | 処理対象の拡張子（正規表現） |

## フロントマター仕様

Markdownファイルの冒頭で `---` または `<!--` で囲んだ領域にメタデータを記述します。

### Markdown形式

```markdown
---
title: ページタイトル
url: /custom-url
published: 2024-03-18
template: default.html
description: ページの説明
---

# コンテンツ
```

### HTML形式

```html
<!--
title: ページタイトル
url: /custom-url
-->
<h1>コンテンツ</h1>
```

### 組み込み変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `name` | ファイル名（拡張子なし） | ページの内部名 |
| `title` | `name` の値 | ページタイトル |
| `url` | `/${name}` | URLパス（出力先も決定する。後述） |
| `description` | 本文先頭150文字 | ページ説明 |
| `og_description` | `description` と同じ | OGP説明文 |
| `published` | `"1970-01-01"` | 公開日 |
| `preview` | `false` | プレビューモード（`true` で `/preview` 配下） |
| `index` | `true` | インデックスに含めるか |
| `noindex` | `false` | `noindex` メタタグ出力 |
| `lang` | `"ja"` | 言語コード |
| `distribute` | `true` | 配布対象とするか |
| `template` | `"default.html"` | 使用テンプレート |
| `ext` | `"html"` | 出力ファイル拡張子 |
| `site_name` | `config.site_name` | サイト名 |
| `url_base` | `config.url_base` | ベースURL |
| `relative_path` | `config.relative_path` | 相対パス |
| `markdown` | 解析後のHTML | Markdown変換後のHTML |
| `markdown_not_parsed` | フロントマター除去後 | 変換前のMarkdown |
| `full_url` | 自動生成 | 完全なURL |
| `__output` | 自動生成 | 出力ファイルパス（`url` から導出） |
| `__filetype` | 拡張子 | 元ファイルの拡張子 |

### `url` と出力先の関係

`url` フィールドはリンクの `href` に使われるだけでなく、**出力ファイルパス（`__output`）の導出元**にもなっています。

| `url` の形式 | `__output` |
|-------------|-----------|
| `/foo/bar`（末尾スラッシュなし） | `/foo/bar.html` |
| `/foo/bar/`（末尾スラッシュあり） | `/foo/bar/index.html` |

フロントマターで `url` を上書きすると `__output` も再計算されるため、ファイルの物理的な配置とは無関係に出力先を変更できます。

```markdown
---
url: /book/new/book
---
```

この場合、ファイルが `src/pages/book/new_book.md` であっても、出力先は `dist/book/new/book.html` になります。

**例外**: ファイル名が `index` の場合は `__output = /index.html` 固定（`url` に関係なし）。また、カテゴリーパッケージの仮想ページのように `__output` を明示的に設定するケースでは、この導出は行われません。

### URLの末尾スラッシュ規約

S3+CDN 等のファイルシステムベースのホスティングでは、`/book` というURLが `book.html` を指すのか `book/index.html` を指すのかをURLだけから判断できません。これを避けるため、以下の規約を推奨します。

| ページ種別 | URL形式 | 出力先 |
|-----------|---------|-------|
| アイテム系（記事・個別ページ） | 末尾スラッシュなし `/book/foo` | `dist/book/foo.html` |
| リスト系（一覧・カテゴリー・ページネーション） | 末尾スラッシュあり `/book/` | `dist/book/index.html` |

リスト系ページを作る場合は、フロントマターで `url` を末尾スラッシュつきで指定するか、ファイル名を `index.md` にします。カテゴリーパッケージの仮想ページはこの規約に従い、`url` に末尾スラッシュを付与しています。

### データ型の記述

フロントマター内のデータ型:

```yaml
# 文字列
title: ページタイトル

# 数値
price: 1000

# 真偽値
published: true

# 配列（JSON形式）
tags: ["tag1", "tag2", "tag3"]

# 配列（YAMLリスト形式）
tags:
  - tag1
  - tag2
  - tag3

# オブジェクト（JSON形式）
metadata: {"author": "名前", "year": 2024}

# 複数行文字列（ダブルクォートで開始・終了）
description: "これは
複数行にわたる
説明文です"

# config参照
url_base: config.url_base
```

**配列の記述形式**: JSON形式（`["item1", "item2"]`）とYAMLリスト形式（`- item`）の両方をサポートします。オブジェクトはJSON形式のみ対応です。

## テンプレート記法

`src/template/` 以下にHTMLテンプレートを配置します。

### 変数展開

```html
{{ 変数名 }}
```

**重要**: 変数名は強制的に小文字化されます（`{{TITLE}}` も `{{title}}` として解釈）。

### エスケープ

```html
\{{ 変数名 }}  <!-- {{ 変数名 }} と出力される -->
```

### includeディレクティブ

テンプレートやCSSファイルを読み込みます。

```html
{include('template/header.html')}
{include('css/reset.css')}
```

- 再帰的にincludeを解決します
- キャッシュされるため同じファイルは1度だけ読み込まれます

### 条件分岐 (if)

```html
{if 変数名}
  表示される内容
{/if}

{if 変数名}
  trueの場合
{else}
  falseの場合
{/if}
```

#### 比較演算子

```html
{if 変数A == 変数B} ... {/if}
{if 変数A != 変数B} ... {/if}
{if 変数A == "文字列"} ... {/if}
{if 変数A == 100} ... {/if}
```

#### ヘルパー関数による条件

```html
{if ヘルパー関数名(引数)} ... {/if}
```

### スクリプト実行 (SSG)

ビルド時にJavaScriptを実行してHTML生成します。

```html
<script type="ssg">
  return (new Date()).toString()
</script>

<!-- 短縮記法 -->
{script}
  return variables.title.toUpperCase()
{/script}
```

#### 利用可能なオブジェクト

- `variables`: 現在のページデータ（フロントマター + 組み込み変数）
- `helper`: ヘルパー関数オブジェクト

#### 注意点

- `return` で返した値がHTMLに展開されます
- `Promise` を返すこともできます（`async/await` 対応）
- `undefined` / `null` は空文字列として扱われます

### CSSジェネレーター記法

複数のCSSファイルを結合・minify・キャッシュバストします。

```html
<link rel="stylesheet" href="${/css/bundle.css<<reset.css,layout.css,page.css}">
```

↓ビルド時に次のように変換されます:

```html
<link rel="stylesheet" href="/css/bundle.css?t=a1b2c3d4e5f6...">
```

- `${出力先<<元ファイル1,元ファイル2,...}` の形式
- MD5ハッシュによるキャッシュバスト
- `dist/css/` に結合・minifyされたCSSが出力されます

## ヘルパー関数

`src/helper/` 以下にJavaScriptファイルを配置し、`blog.json` の `helper` で指定します。

### 定義方法

```javascript
// src/helper/index.js
import { allData, config } from '@tenjuu99/blog'

export function dateFormat(dateString) {
  const date = new Date(dateString)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function readIndex(filter = null) {
  const data = Object.entries(allData)
    .sort((a, b) => new Date(b[1].published) - new Date(a[1].published))
  return filter
    ? data.filter(v => v[0].indexOf(filter) === 0).map(v => v[1])
    : data.map(v => v[1])
}
```

### 使用方法

#### テンプレート内

```html
{{ dateFormat(published) }}
{{ readIndex('post') }}
```

#### スクリプト内

```html
<script type="ssg">
  const posts = helper.readIndex('post')
  return posts.map(p => `<li>${p.title}</li>`).join('')
</script>
```

### `allData` オブジェクト

全ページデータを保持するオブジェクトです。

**キー形式**: 先頭スラッシュなしのパス（`pages/sample.md` → `sample`）

```javascript
{
  "sample": { title: "...", url: "/sample", ... },
  "post/1": { title: "...", url: "/post/1", ... },
  "post/2": { title: "...", url: "/post/2", ... }
}
```

**注意**: `readIndex()` などでフィルタリングする際は先頭スラッシュを付けません。

```javascript
// 正しい
helper.readIndex('post')

// 間違い（マッチしない）
helper.readIndex('/post')
```

## パッケージシステム

コアパッケージまたはカスタムパッケージを有効化できます。

### コアパッケージ

`@tenjuu99/blog/packages/` に含まれるパッケージ:

- `breadcrumbs` - パンくずリスト機能
- `editor` - エディター機能
- `turbolink` - Turbolink機能
- `category` - カテゴリー機能（階層型カテゴリーページ自動生成）

#### category パッケージ詳細

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
  url: '/tech/frontend',
  __output: '/tech/frontend/index.html',
  title: 'Frontend',                    // カテゴリー名
  template: 'category.html',
  category_path: ['Tech', 'Frontend'],  // カテゴリーパス
  category_pages: ['tech/frontend/react/tutorial', ...],  // このカテゴリーのページ（per_page設定時は当該ページのスライス）
  category_children: [                  // サブカテゴリー（{url, title}[] 型）
    { url: '/tech/frontend/react', title: 'React' },
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

#### category パッケージ: ページネーション

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

独自スタイルに合わせてカスタマイズする場合は、`src/template/_pagination.html` に同名ファイルを配置するとパッケージのデフォルトを上書きできます（[ファイル優先順位](#ファイル優先順位) 参照）。

**ページネーションヘルパー（`pagination.js`）:**

`packages/category/helper/pagination.js` に以下の関数が提供されています。独自テンプレートを作成する際に `{script}` ブロックから直接利用できます（`import` 不要、インライン実装）。

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

### 有効化方法

```json
{
  "packages": "breadcrumbs,turbolink"
}
```

### パッケージの構成

```
packages/breadcrumbs/
  ├── breadcrumbs.js   # ヘルパー関数（自動読み込み）
  ├── template/        # テンプレートファイル
  └── css/             # スタイルシート
```

パッケージを有効化すると:
1. パッケージディレクトリが `.cache/` にコピーされる
2. `{パッケージ名}.js` が自動的に `helper` に追加される

## Hook機構

ビルドプロセスの特定のタイミングで、カスタムロジックを実行できるフック機構を提供しています。

### Hook設定

`blog.json` で設定:

```json
{
  "hooks": {
    "afterIndexing": "categoryIndexer.js"
  }
}
```

- **複数フック対応**: 配列で複数ファイル指定可能
  ```json
  {
    "hooks": {
      "afterIndexing": ["hook1.js", "hook2.js"]
    }
  }
  ```

### 利用可能なフックポイント

#### `afterIndexing`

全ページのインデックス化完了後、レンダリング開始前に実行されます。

**実行タイミング:**
```
indexing() → afterIndexing Hook → distribute()
```

**関数シグネチャ:**
```javascript
export async function afterIndexing(allData, config) {
  // allData: 全ページデータ（参照渡し、変更可能）
  // config: blog.json の設定内容
}
```

**使用例:**
```javascript
// src/helper/categoryIndexer.js
export async function afterIndexing(allData, config) {
  // カテゴリーページを自動生成
  allData['tech/index'] = {
    name: 'tech/index',
    title: 'Tech',
    template: 'category.html',
    distribute: true,
    // ... その他のメタデータ
  }
}
```

### Hook関数の配置

- **配置場所**: `src/helper/` ディレクトリ
- **形式**: ES Module（`export` 必須）
- **実行順序**: 配列で指定した順に実行

### 注意事項

- フック関数は非同期（`async`）に対応
- `allData` は参照渡しのため、直接変更可能
- エラー発生時はビルドが中断される
- フックファイルが存在しない場合はスキップ（エラーにならない）

## ビルドプロセス

### 開発サーバー (`npx server`)

1. `.cache/` にソースをコピー（パッケージ含む）
2. テンプレートを事前読み込み（warmUp）
3. 全ページをインデックス化
4. 静的サイト生成
5. HTTPサーバー起動（ポート8000）
6. ファイル監視を開始

ファイル変更時:
- 該当ページのみ再生成（高速）
- テンプレート変更時は全ページ再生成

### 静的サイト生成 (`npx generate`)

1. `.cache/` にソースをコピー（パッケージ含む）
2. テンプレートを事前読み込み（warmUp）
3. 全ページをインデックス化（`lib/indexer.js`）
4. 各ページをレンダリング（`lib/render.js`）
   - テンプレート読み込み
   - フィルター処理（include, if, script）
   - Markdown → HTML変換
   - 変数展開
   - HTML minify
5. `dist/` に出力
6. `distribute_raw` で指定したディレクトリをコピー
7. 削除されたページのファイルをクリーンアップ

## レンダリングパイプライン

各ページは以下の順序で処理されます:

### 1. ページデータ解析 (`lib/pageData.js`)

- フロントマターを抽出（`---...---` または `<!--...-->`）
- メタデータをパース（JSON対応）
- デフォルト値とマージ

### 2. テンプレート適用 (`lib/applyTemplate.js`)

- テンプレートファイル読み込み
- `include()` ディレクティブ解決
- CSSジェネレーター処理

### 3. フィルター処理（テンプレート） (`lib/filter.js`)

- `{if}` 条件分岐処理
- `{script}` / `<script type="ssg">` 実行

### 4. フィルター処理（Markdown） (`lib/render.js`)

- `include()` 解決
- `{if}` 処理
- `{script}` 実行
- 変数展開（`{{変数名}}`）
- Markdown → HTML変換（`.md` ファイルのみ）

### 5. 変数展開（テンプレート） (`lib/replaceVariablesFilter.js`)

- `{{変数名}}` を実際の値に置換
- ヘルパー関数実行（`{{関数名(引数)}}`）

### 6. 出力 (`lib/distribute.js`)

- HTML minify
- `dist/` に書き込み

## ファイル操作とキャッシュ

### `.cache/` ディレクトリの役割

#### 概要

`.cache/` はパッケージとユーザーコードを統合した「実効的なソースディレクトリ」として機能します。ビルドシステムはこのディレクトリを実際のソースとして扱います。

#### ファイル展開の仕組み

`lib/dir.js` の `cache()` 関数が以下の順序で実行します:

1. **コアパッケージの展開**: `packages/*/` → `.cache/`（名前空間フラット化）
2. **ユーザーパッケージの展開**: `src/packages/*/` → `.cache/`
3. **ユーザーコードのコピー**: `src/` → `.cache/`（上書き）

**展開例**:
```
packages/breadcrumbs/helper/breadcrumbs.js → .cache/helper/breadcrumbs.js
packages/breadcrumbs/css/breadcrumbs.css   → .cache/css/breadcrumbs.css
packages/category/template/category.html   → .cache/template/category.html
src/helper/custom.js                       → .cache/helper/custom.js（追加）
src/template/category.html                 → .cache/template/category.html（上書き）
```

#### ファイル優先順位

同名ファイルが存在する場合の優先順位:

1. **`src/`** （最優先 - ユーザーカスタム）
2. **`src/packages/`** （ユーザー定義パッケージ）
3. **`packages/`** （コアパッケージ）

この仕組みにより、ユーザーはパッケージが提供する任意のファイルを上書きしてカスタマイズできます。

#### Helper の自動登録

`blog.json` の `packages` で指定されたパッケージは:
- `.cache/helper/<package>.js` が自動的に `config.helper` に追加される（`lib/dir.js:38-40, 45-47`）
- ユーザーが明示的に設定する必要はない

#### ディレクトリ構造

ビルド時に以下がコピーされます:

```
.cache/
  ├── pages/       # src/pages/ のコピー
  ├── template/    # src/template/ + パッケージのテンプレート
  ├── css/         # src/css/ + パッケージのCSS
  ├── helper/      # src/helper/ + パッケージのヘルパー
  ├── image/       # src/image/ のコピー
  └── index.json   # ページインデックス（差分検出用）
```

### テンプレートキャッシュ

`lib/applyTemplate.js` と `lib/files.js` により:
- 初回ビルド時に全テンプレート・CSSをメモリにロード
- 2回目以降はキャッシュから取得

### CSSキャッシュバスト

`lib/cssGenerator.js` により:
- CSS内容のMD5ハッシュを生成
- クエリパラメータとして付与（`?t={hash}`）

## URL生成ルール

### 基本ルール

| ファイルパス | デフォルトURL |
|-------------|--------------|
| `pages/sample.md` | `/sample` |
| `pages/post/1.md` | `/post/1` |
| `pages/index.md` | `/` |

### カスタムURL

フロントマターで `url` を指定:

```yaml
---
url: /custom-path
---
```

### 拡張子の扱い

- `ext: "html"` (デフォルト): `/path` → `/path.html`
- `ext: "txt"`: `/path` → `/path.txt`
- `index.md`: `/index.html`

### プレビューモード

```yaml
---
preview: true
url: /article
---
```

→ `/preview/article` として出力され、`index: false`, `noindex: true` が自動設定されます。

## 開発サーバーの挙動

### ルーティング

1. `/path/` → `/path/index.html`
2. `/path` (拡張子なし) → `/path.html`
3. `/path.txt` → そのまま
4. 404の場合 → `/404.html` を返す
5. エラーの場合 → `/500.html` を返す

### MIMEタイプ判定

`lib/contentType.js` により拡張子からMIMEタイプを判定:

- `.html` → `text/html`
- `.css` → `text/css`
- `.js` → `text/javascript`
- `.jpg` → `image/jpeg`
- など

## エクスポートAPI

`index.js` から以下をエクスポート:

```javascript
import { allData, config, dir } from '@tenjuu99/blog'

// allData: 全ページデータ
// config: 設定オブジェクト
// dir: ディレクトリパス定義
```

これによりヘルパー関数から直接アクセスできます。

## 制約事項

- フロントマターは YAML 完全互換ではなく、独自パーサーを使用
- 配列は JSON 形式（`["item1"]`）または YAML リスト形式（`- item`）で記述可能
- オブジェクトは JSON 形式で記述必須
- 変数名は強制的に小文字化される
- `include()` は同期処理のため、非同期ファイル読み込みは不可
- SSGスクリプト内で `import()` は使用不可（ヘルパー関数を使用）
