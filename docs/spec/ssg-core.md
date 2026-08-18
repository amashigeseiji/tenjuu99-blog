# SSGコア

Markdown ソースファイルから静的 HTML サイトを生成する領域。フロントマター解析・テンプレート適用・レンダリング・全ページのインデックス化・ビルド出力・パッケージシステム（キャッシュ機構）を扱う。誰がどう編集するか（エディタ）、カテゴリー分類（カテゴリー）、HTTP 配信（サーバー）、ファイル監視（開発サーバー）は扱わない。

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
| `url` | `/${name}` | URLパス（出力先も決定する。後述）。`pages/index.md` では `/index`（`full_url` では `/`） |
| `description` | `""`（描画時に本文先頭150文字で補われる） | ページ説明。インデックス時点（フック・ヘルパーから見える値）は空文字 |
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
- 左辺のパスに従って `dist/` 配下に結合・minifyされたCSSが出力されます。`href` には `relative_path` が前置されます

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
- `editor` - エディター機能（[エディタ](editor.md)）
- `turbolink` - Turbolink機能
- `category` - カテゴリー機能（階層型カテゴリーページ自動生成。[カテゴリー](category.md)）

### 有効化方法

```json
{
  "packages": "breadcrumbs,turbolink"
}
```

### パッケージの構成

```
packages/breadcrumbs/
  ├── helper/breadcrumbs.js   # ヘルパー関数（自動読み込み）
  └── css/                    # スタイルシート
```

パッケージは `helper/`・`template/`・`css/`・`server/`・`pages/` などのディレクトリを持てる。パッケージを有効化すると:
1. パッケージディレクトリが `.cache/` にコピーされる（名前空間はフラット化される）
2. パッケージの `helper/` 配下のすべての `.js`（`hooks` に登録したファイルを除く）が自動的に `helper` に追加される


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

- **配置場所**: `src/helper/`（またはパッケージの `helper/`）。解決先は `.cache/helper/`
- **形式**: ES Module（`export` 必須）
- **実行順序**: 配列で指定した順に実行

### 注意事項

- フック関数は非同期（`async`）に対応
- `allData` は参照渡しのため、直接変更可能
- エラー発生時はビルドが中断される
- フックファイルが存在しない場合はスキップ（エラーにならない）


## ビルドプロセス

### 静的サイト生成 (`npx generate`)

1. `.cache/` にソースをコピー（パッケージ含む）
2. テンプレートを事前読み込み（warmUp）
3. 全ページをインデックス化
4. `afterIndexing` フックを実行（[Hook機構](#hook機構)）
5. 各ページをレンダリング
   - テンプレート読み込み
   - フィルター処理（include, if, script）
   - Markdown → HTML変換
   - 変数展開
   - HTML minify
6. `dist/` に出力
7. `distribute_raw` で指定したディレクトリをコピー。`image_converter` が設定されていれば、その中の画像ファイル（jpg/jpeg/png/gif/webp/avif/tiff/heic/bmp）は変換して出力し（拡張子はコンバーターの `ext`）、それ以外はそのままコピーする（ビルド画像配布器。コンバーターは[エディタ](editor.md)の画像コンバーターと同じ設定を使う）
8. 削除されたページのファイルをクリーンアップ


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

キャッシュへの展開は以下の順序で行われます:

1. **パッケージの展開**: `packages` に列挙した順に、パッケージごとにコアパッケージ（`packages/<name>/`）→ ユーザーパッケージ（`src/packages/<name>/`）の順で `.cache/` へコピー（名前空間フラット化）
2. **ユーザーコードのコピー**: `src/` → `.cache/`（`src/packages/` を除く。上書き）

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
2. **`src/packages/<name>/`** （同名のコアパッケージに対するユーザー定義パッケージ）
3. **`packages/<name>/`** （コアパッケージ）

この優先順位が成り立つのは同一パッケージ名の中でのみで、異なるパッケージ間では後勝ち（`packages` のリストで後に列挙したものが優先）になります。この仕組みにより、ユーザーはパッケージが提供する任意のファイルを上書きしてカスタマイズできます。

#### Helper の自動登録

`blog.json` の `packages` で指定されたパッケージは:
- パッケージの `helper/` 配下のすべての `.js`（`hooks` に登録したファイルを除く）が自動的に `config.helper` に追加される
- ユーザーが明示的に設定する必要はない

#### ディレクトリ構造

ビルド時に以下がコピーされます:

```
.cache/
  ├── pages/       # src/pages/ のコピー
  ├── template/    # src/template/ + パッケージのテンプレート
  ├── css/         # src/css/ + パッケージのCSS
  ├── helper/      # src/helper/ + パッケージのヘルパー
  ├── server/      # src/server/ + パッケージのサーバーハンドラー
  ├── js/          # src/js/ のコピー
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
| `pages/index.md` | `/index`（`full_url` は `/`、出力は `/index.html`） |

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


## エクスポートAPI

`index.js` から以下をエクスポート:

```javascript
import { allData, config, dir } from '@tenjuu99/blog'

// allData: 全ページデータ
// config: 設定オブジェクト
// dir: ディレクトリパス定義
```

これによりヘルパー関数から直接アクセスできます。

