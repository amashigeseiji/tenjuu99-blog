# テストツリー: editor-realtime-preview

**作成:** 2026-06-26

## できるのツリー

```
プレビュー自動更新器 は 入力イベントと画像挿入を検知してプレビューを自動更新できる
├── デバウンサー は 連続呼び出しのうち最後から一定時間後のみ処理を実行できる
│   ├── 遅延実行 は 指定時間後にコールバックを実行できる
│   └── タイマーリセット は 遅延中に再呼び出されたとき前のタイマーをキャンセルできる
└── 自動プレビュー初期化器 は textareaの入力イベントにデバウンサーを接続できる
    └── ドロップ後更新 は 画像挿入後にプレビュー更新コールバックを呼び出せる（手動確認のみ）
```

## コンテキスト割り当て

| ノード | コンテキスト | ソース |
|--------|------------|--------|
| プレビュー自動更新器 | editor | `packages/editor/js/autoPreviewInitializer.js` |
| デバウンサー | editor | `packages/editor/js/debouncer.js` |
| 遅延実行 | editor | `packages/editor/js/debouncer.js` |
| タイマーリセット | editor | `packages/editor/js/debouncer.js` |
| 自動プレビュー初期化器 | editor | `packages/editor/js/autoPreviewInitializer.js` |
| ドロップ後更新 | editor | `packages/editor/js/editor.js`（既存コード修正） |

## 利用仮説

- 使ったらこうなるはず: textareaに入力すると、500ms後（デフォルト）にプレビューが自動更新される
- 使ったらこうなるはず: 連続入力中はプレビューが更新されず、入力が止まってから更新される（デバウンス）
- 使ったらこうなるはず: 画像をドロップするとMarkdownが挿入され、その時点でプレビューが更新される
- こうなったら外れ: 入力のたびに毎回プレビューが更新される（デバウンスが機能していない）
- こうなったら外れ: 画像挿入後にプレビューボタンを押さないと画像が表示されない

## ロード可能性の確認

- `createDebounce` → 純粋関数（setTimeout/clearTimeout）→ Node.js でテスト可能
- `initAutoPreview` → EventTarget + createDebounce → Node.js 19+ の EventTarget でテスト可能
- `initDropReceiver` の修正（ドロップ後更新）→ drag/drop イベント依存 → 手動確認のみ
