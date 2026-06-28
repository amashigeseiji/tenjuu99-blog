# テストツリー: editor-sidebar-status

**作成:** 2026-06-28

## できるのツリー

```
サイドバーは各ファイルの公開ステータスを視覚的に表示できる [editor]
├── ツリーレンダラーは公開ステータス付きファイルノードをステータス識別子付きHTMLとして出力できる [editor]
└── ファイルステータスコレクターはファイル群の公開ステータスをまとめて取得できる [editor]
    └── 公開ステータス判定器はファイルパスから公開ステータスを返せる [editor] （既存・実装済み）
```

## 対応実装

| ノード | 実装ファイル | 変更種別 |
|--------|------------|---------|
| ツリーレンダラー | `packages/editor/js/tree.js` — `renderTreeHtml()` | 既存拡張 — statusMap 引数追加 |
| | `packages/editor/helper/sidebarTree.js` — `renderSidebarTree()` | 既存拡張 — statusMap 引数追加 |
| ファイルステータスコレクター | `packages/editor/server/sidebarStatusCollector.js` | 新規 |
| 公開ステータス判定器 | `packages/editor/server/publicationStatus.js` — `getPublicationStatus()` | 変更なし（既存） |

## 利用仮説

- 使ったらこうなるはず:
  - US-01/S1: サイドバーに未公開ファイルと公開済みファイルを表示したとき、それぞれのファイルノードに異なる `data-status` 属性（`new`, `published` など）が付与され、CSSで視覚的に区別できる
  - US-01/S2: 新規作成後に別ファイルへ移動し、再度サイドバーをレンダリングしたとき、新規作成ファイルのノードに `data-status="new"` が付与されたままである
  - US-01/S3: 一度公開後に編集したファイルのノードに `data-status="modified"` が付与される
  - US-01/S4: 未変更の公開済みファイルのノードに `data-status="published"` が付与される

- こうなったら外れ:
  - すべてのファイルノードに `data-status` 属性がない（ステータス情報が HTML に含まれない）
  - すべてのファイルノードに同じ `data-status` 値が設定される（区別できていない）
  - ステータス取得の失敗でサイドバーが空になる
