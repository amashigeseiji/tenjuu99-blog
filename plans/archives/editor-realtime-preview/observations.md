# Observations: editor-realtime-preview

**日時:** 2026-06-26

## 実装中の気づき

- `initDropReceiver` の呼び出しを `DOMContentLoaded` から `onloadFunction` 内に移動した。`submit` 関数が `onloadFunction` のクロージャーにあるため、`onUpdate` コールバックとして渡すには同じスコープに置く必要があった。
- `node:test` の `mock.timers.enable` で `clearTimeout` を `apis` に指定できない（Node.js v24.15）。`setTimeout` のみを指定すれば `clearTimeout` も自動でモックされる。
- `autoPreviewInitializer.js` と `debouncer.js` は ESM モジュールとして作成したが、`editor.js` はブラウザ向けのインライン実装が必要（`import` 不可）。`createDebounce` のインライン実装を `editor.js` に追加した。
- テスト環境（Node.js v24.15）の `EventTarget` と fake timers が組み合わせて使えることを確認。`initAutoPreview` のような DOM 依存関数も `EventTarget` を使えば Node.js でテスト可能。
