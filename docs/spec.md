# @tenjuu99/blog — 技術仕様書

このドキュメントは `@tenjuu99/blog` の技術仕様を定義します。

## コンテキスト別の仕様

機能領域（コンテキスト）ごとの仕様は `docs/spec/` に分かれている。名前と関係は `docs/dictionary.json`、行為の証拠は `docs/acts.json`、実装の所在は `docs/map.json` が持ち、spec はその説明にあたる。

| コンテキスト | ファイル |
|---|---|
| SSGコア（ssg-core） | [spec/ssg-core.md](spec/ssg-core.md) — フロントマター・テンプレート記法・ヘルパー・パッケージ・Hook・ビルド・キャッシュ・URL |
| カテゴリー（category） | [spec/category.md](spec/category.md) |
| サーバー（server） | [spec/server.md](spec/server.md) — サーバーハンドラーの登録と振り分け |
| 開発サーバー（dev-server） | [spec/dev-server.md](spec/dev-server.md) — 起動・監視・静的配信のルーティング |
| エディタ（editor） | [spec/editor.md](spec/editor.md) |
| 公開（publishing） | [spec/publishing.md](spec/publishing.md) |
| ネイティブシェル（native-shell） | [spec/native-shell.md](spec/native-shell.md) |
| アプリバンドル配布（app-bundle） | [spec/app-bundle.md](spec/app-bundle.md) |

## プロジェクト概要

`@tenjuu99/blog` は、Markdownファイルから静的HTMLサイトを生成するNode.js製の軽量静的サイトジェネレーターです。

### 主な特徴

- Markdownファイルベースのコンテンツ管理
- フロントマターによるメタデータ定義
- テンプレートエンジン機能（変数展開、条件分岐、スクリプト実行）
- ファイル変更で自動再起動する開発サーバー
- CSSの自動結合・minify・キャッシュバスト
- ヘルパー関数による拡張性
- パッケージシステムによる機能拡張

### 動作環境

- Node.js >= 22
- 依存パッケージ:
  - `marked` ^13.x (Markdown → HTML変換)
  - `chokidar` ^4.0.x (ファイル監視)
  - `sharp` (画像変換)

## CLIコマンド

```bash
npx create-blog  # 新規プロジェクト作成
npx server       # サーバー起動（生成 + HTTP 配信。ポートは PORT 環境変数、既定 8000）
npx dev-server   # ファイル監視つきサーバー起動（変更で自動再起動）
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
  │   ├── server/        # サーバーハンドラー（任意）
  │   ├── js/            # そのまま配布する JS など（任意、distribute_raw で指定）
  │   └── packages/      # カスタムパッケージ
  ├── dist/              # ビルド出力（デフォルト）
  └── .cache/            # ビルド時キャッシュ（自動生成）
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
| `hooks` | 無し | ビルドフック（[SSGコア › Hook機構](spec/ssg-core.md#hook機構)） |
| `image_converter` | 無し | 画像コンバーター（[エディタ](spec/editor.md)。ビルド時の画像変換にも使われる） |
| `category` / `categories` | 無し | カテゴリー設定（[カテゴリー](spec/category.md)） |
| `editor_enable` / `frontmatter_templates` | 無し | エディタの設定（[エディタ](spec/editor.md)） |
| `publish` | `{ "means": "git" }` | 公開手段の設定（[公開](spec/publishing.md)） |

`blog.json` のすべてのキーはページ変数としても展開され（フロントマターより優先度が低い）、テンプレートから `{{key}}` で参照できる。


## 制約事項

- フロントマターは YAML 完全互換ではなく、独自パーサーを使用
- 配列は JSON 形式（`["item1"]`）または YAML リスト形式（`- item`）で記述可能
- オブジェクトは JSON 形式で記述必須
- 変数名は強制的に小文字化される
- `include()` は同期処理のため、非同期ファイル読み込みは不可
- SSGスクリプト内での `import()` は想定しない（相対パスの解決が cwd 依存になるため。ヘルパー関数を使用）

