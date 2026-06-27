# Findings: editor-publish

**日時:** 2026-06-27
**対象:** plans/editor-publish/

---

## 操作の事実

- 開発サーバー（`npm run dev`）起動中に、新規ファイルおよび既存ファイルで Publish ボタンを押した
- ブラウザに「Failed to fetch」と表示された
- サーバーログ: `[server POST /editor]` → `[editor/post] finished` → プロセス再起動（ファイル変更検知による自動リロード）
- publish 処理のログは一切出ていない（git 操作は一度も実行されていない）

---

## 利用仮説の照合

- 利用仮説: Publishボタンを押すとターミナル操作なしにGitHubへのpushが実行され、編集画面に結果（完了または失敗）が表示される
- 実際: **外れ** — auto-save が書き込んだファイルを開発サーバーのファイルウォッチャーが検知して自動リロードを起動し、直後の publish リクエストがサーバー未応答状態に当たった

---

## 印象（ユーザーの言葉）

- 「意味がわからない」
- 「git のエラーをそのまま出さないでほしい」
  → 「Failed to fetch」を git fetch のエラーと読んだ（実際は JavaScript fetch API のネットワーク到達不能エラー）

---

## 発見（解釈・原因の仮説）

### F-04: auto-save → publish の連続実行が dev サーバーのリロードと競合する

**戻し先:** /tdd-run (editor-publish)
**出どころ:** 利用インタビュー
**解釈・原因の仮説:**
auto-save（POST /editor）がファイルを書き込むと、`npm run dev` のファイルウォッチャーがサーバーを自動リロードする。その間に送信された publish リクエストはサーバー未応答のまま `Failed to fetch` になる。publish エンドポイントに到達していないため、git 操作は一度も実行されていない。
**推奨される対応:** auto-save と publish を1リクエストに統合する（サーバー側で save → git commit/push を一括処理）か、ファイルウォッチ対象から editor が管理するファイルを除外する。どちらが適切かは tdd-run で検討する。

---

### F-05: 「Failed to fetch」がユーザーに git エラーとして読まれた

**戻し先:** /tdd-run (editor-publish)
**出どころ:** 利用インタビュー
**解釈・原因の仮説:**
「publish = git 操作」という文脈で表示されたため、ブラウザの fetch API ネットワークエラーが git fetch のエラーに見えた。ネットワーク到達不能エラーと git 操作失敗が区別されていない。
**推奨される対応:** `公開フィードバック` で `Failed to fetch` をそのまま表示せず、ユーザー向けのエラーメッセージに翻訳する。ネットワーク到達不能（サーバー落ち）と git 操作失敗は別メッセージにする。

---

### F-01: 公開ステータス判定にテストがない（tdd-run 中の気づき）

**戻し先:** /tdd-run (editor-publish)
**出どころ:** tdd-run 中

`getPublicationStatus`（`packages/editor/server/publicationStatus.js`）はテストツリーに存在せず、単体テストが一切ない。`公開ステータス` 表示の要求がツリー確定後に追加されたためツリーに入らなかった。また `execFileAsync` がモジュール内に閉じており、注入できないためテスト不可能な実装になっている。

**対応:** `公開済み状態` の概念を読み込み操作に拡張し（F-02 参照）、`getPublicationStatus` をテスト可能な形に書き直してテストツリーに追加する。

```javascript
// 拡張後の公開済み状態
{
  existsInRemote(filePath),  // 読み込み（新規判定）
  diffFromRemote(filePath),  // 読み込み（更新あり判定）
  commit(files),             // 書き込み（既存）
  push()                     // 書き込み（既存）
}

// 書き直し後: 純粋関数になりテスト可能
async function getPublicationStatus(filePath, publishedState) {
  if (!await publishedState.existsInRemote(filePath)) return 'new'
  const diff = await publishedState.diffFromRemote(filePath)
  return diff ? 'modified' : 'published'
}
```

---

### F-02: 公開済み状態が書き込み専用になっており概念が不完全（tdd-run 中の気づき）

**戻し先:** /tdd-run (editor-publish)
**出どころ:** tdd-run 中

`公開済み状態` は辞書上「ローカルとの対比の基準」として定義されているが、実装では `{ commit, push }` の書き込み操作しか持っていない。読み込み（`existsInRemote`, `diffFromRemote`）が `publicationStatus.js` 内に実装詳細として埋め込まれており、概念の外に漏れ出している。

**対応:** `公開済み状態` に読み込み操作を追加して概念を完結させる。辞書の定義を更新し、`createGitPublishedState`（`publish.js`）に読み込みメソッドを追加する。

---

### F-03: 公開ステータスを状態マシンとして明示化していない（tdd-run 中の気づき）

**戻し先:** /tdd-run (editor-publish)
**出どころ:** tdd-run 中

`公開ステータス`（新規・更新あり・公開済み）は状態マシンで整理できる概念だが、現在の実装では「都度 git を叩いて状態を計算する」形になっており、遷移が明示されていない。状態マシンとして明示化するかどうかは problem.md レベルで議論すべき設計判断。

**優先度:** F-01・F-02・F-04・F-05 より低い（動作上のバグではなく設計上の改善）
