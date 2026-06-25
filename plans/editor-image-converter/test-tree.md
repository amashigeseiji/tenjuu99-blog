# テストツリー: editor-image-converter

**作成:** 2026-06-25

## できるのツリー

```
画像自動変換器は image_converter 設定に従い手動変換なしで画像を自動変換できる
├── コンバーターファクトリー は ビルトイン名からビルトインコンバーターを解決できる  [editor]
│   └── コンバーターファクトリー は "sharp" 指定でビルトインsharpコンバーターを読み込める  [editor]
└── ビルド画像配布器はビルド実行時に変換設定に従い画像をdistに出力できる            [ssg-core]
    ├── ビルド画像配布器は変換設定なしのとき画像をそのままdistにコピーできる         [ssg-core]
    └── ビルド画像配布器は変換設定があるとき変換した画像をdistに書き込める           [ssg-core]
        ├── ビルド画像配布器は変換対象の全ファイルを収集できる                       [ssg-core]
        └── ビルド画像配布器はファイルを変換してdistの対応パスに書き込める            [ssg-core]
```

## モジュール配置

| ノード | コンテキスト | 実装 |
|--------|-------------|------|
| コンバーターファクトリー (builtin) | editor | `packages/editor/server/image_upload.js:createConverter`（既存） |
| ビルトインsharpコンバーター | editor | `packages/editor/server/converters/sharp.js`（既存、sharp インストール済み） |
| ビルド画像配布器 | ssg-core | `lib/image-distributor.js`（新規） |

## テストファイル

- `tests/editor/editor-image-upload.test.js` — TODO を実装（既存ファイル）
- `tests/ssg-core/image-distributor.test.js` — 新規作成

## 利用仮説

- 使ったらこうなるはず: `blog.json` に `image_converter: "sharp"` を設定した状態でアップロードすると `.webp` ファイルが保存される
- 使ったらこうなるはず: `generate` を実行すると `dist/image/` に変換済み画像（`.webp`）が出力される
- こうなったら外れ: sharp インストール後も `createConverter('sharp')` が `ext: null` を返す（パススルーのまま）
- こうなったら外れ: `generate` 後の `dist/image/` に元のサイズ・フォーマットの画像が残る
