# @tenjuu99/blog

静的なブログを作るのにどうして React を必要としてしまったんですか

`@tenjuu99/blog` は、Markdownファイルから静的HTMLサイトを生成する軽量な静的サイトジェネレーターです。

## クイックスタート

```bash
npm i @tenjuu99/blog
npx create-blog
npx server
```

詳細な使い方は [チュートリアル](docs/tutorial.md) をご覧ください。

## ドキュメント

- **[チュートリアル (docs/tutorial.md)](docs/tutorial.md)** - 初めての方向けの入門ガイド
- **[技術仕様書 (docs/spec.md)](docs/spec.md)** - 詳細な技術仕様とリファレンス
- **[開発ガイド (docs/develop.md)](docs/develop.md)** - ライブラリ開発者向けガイド
- **[CLAUDE.md](CLAUDE.md)** - AI開発アシスタント向け参照ドキュメント

## 主な特徴

- Markdownファイルベースのコンテンツ管理
- フロントマターによるメタデータ定義
- テンプレートエンジン機能（変数展開、条件分岐、スクリプト実行）
- ホットリロード対応の開発サーバー
- CSSの自動結合・minify・キャッシュバスト
- ヘルパー関数による拡張性
- パッケージシステムによる機能拡張

## システム要件

- Node.js >= 21.7

## ライセンス

MIT
