# Observations: editor-publish

**日時:** 2026-06-27

## 実装中の気づき

- 画像URLのフォーマットが `/image/...`（先頭スラッシュ、`src` なし）であることが実装中に判明し、`collectTarget` のインターフェースを修正した。当初のテストは `src/image/...` 形式を仮定していたが、`image_upload.js` の `resolveImagePath` を確認して修正。
- `変更反映器` の `公開済み状態` を `{ commit, push }` オブジェクトとして注入する設計が、実際の git 操作なしにテストを書く上で有効に機能した。
- `scaffold.sh` は `editor` コンテキストを `packages/editor/js/` にマップするが、`公開ハンドラー`・`公開対象コレクター`・`変更反映器` はいずれもサーバーサイド（`server/`）に属するため scaffold を使わず手動作成した。`画像参照抽出器` のみ純粋関数として `js/` に配置。
- git hook `pre-push`（`ALLOW_PUSH=1` でバイパス）を実装前に設置したことで、実装中の誤 push リスクを排除できた。
- `publicationStatus.js` の `getPublicationStatus` は `@{u}` (upstream tracking branch) を動的に取得して remote HEAD と比較する。追跡ブランチがない場合は `unknown` を返す。
- `公開ステータス` のUIへの反映トリガーは3点: ページロード・ファイル選択変更・publish 成功後。`fetchPublicationStatus` は `onloadFunction` 内の `const` として定義しているが、すべてのトリガーは非同期コールバック内で呼ぶため、定義より前の行から参照していても実行時には問題なし。
