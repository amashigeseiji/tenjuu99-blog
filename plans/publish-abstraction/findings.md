# Findings: publish-abstraction

**日時:** 2026-07-09

## ウォークスルー（7.5）

| 語彙（plans/dictionary） | テスト describe() | 実装（関数・モジュール名） | 型定義 |
|--------------------------|-------------------|---------------------------|--------|
| 公開手段 | ✓（ルート） | publicationMeans.js | PublicationMeans（typedef） |
| git公開手段 | ✓ | createGitPublicationMeans() | なし（装置） |
| 公開手段解決器 | ✓ | resolvePublicationMeans() | なし（装置） |
| 公開ハンドラー | ✓ | handlePublish()（既存） | なし（装置） |
| 公開済み状態 | -（データ概念） | means.publishedState | PublishedState（typedef） |
| 公開する / 更新する | ✓（it 文言） | publish() / update() | なし |
| 公開物 | -（データ概念） | means.deliverable | 'manuscript'\|'artifact'（インライン union） |
| ローカル / リモート / 原稿 / 成果物 | - | -（概念のみ） | なし |

- 名前の消失・変換なし。PublishedState typedef は publicationStatus.js と publishing の
  二重定義になっていたため lib/publishing/publicationMeans.js に一本化した
- src フィールド書き込み済み: git公開手段 → lib/publishing/gitPublicationMeans.js、
  公開手段解決器 → lib/publishing/publicationMeansResolver.js

## 依存グラフ（孤立ノードチェック）

- publishing の2モジュールは publish.js / get_publication_status.js / get_sidebar.js の
  3エンドポイントから静的に到達する
- ただしエンドポイント自体は静的依存元ゼロで entry_points（bin/*, lib/server/**）に届かない。
  原因は lib/tryServer.js が serverDir（.cache/server）を readdirSync + 動的 import で
  読み込むため。**孤立ではなく静的解析の限界**。実到達はステップ8の実サーバー確認で担保した

## 残課題・promote への申し送り

- **参照不能時のエラーメッセージが git 前提のまま**: handlePublish の 'unknown' 分岐が
  「リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）」を返す。
  診断文言は手段が知っていることなので、公開手段がエラー内容を提供する形への移行が候補
- **コンテキスト移動の残り**: 公開ステータス・公開対象・公開フィードバック・更新する・
  公開ステータス判定器・ファイルステータスコレクター等は定義に git の言葉がないため今回は
  改訂せず editor に残置。promote 時に publishing への移動を検討する
- **モジュール配置の残り**: publicationStatus.js（公開ステータス判定器）は概念上 publishing に
  属するが packages/editor/server/ に残置。移動はリファクタリングフェーズの候補
- **Strategy パターン語彙**: 手段が2つ以上になった時点でパターン登録を検討
  （heuristic: 同じ「できる」を複数の実現が差し替え可能に提供している）

## ユーザーストーリーテスト（8.5）

- 結果: pass（US-01 3シナリオ実行・成功 / US-02 3シナリオは設計レビュー事項として
  根拠を明記の上 skip）
- US-01 は $TMPDIR のフィクスチャプロジェクト＋ローカル bare origin で実際の
  commit → push → リモート反映まで検証（外部ネットワーク不使用）
