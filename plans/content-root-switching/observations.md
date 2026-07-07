# Observations: content-root-switching

**日時:** 2026-07-08

## 実装中の気づき

- 切り替えロジック本体（`ContentRootResolver.reselect`）は初回解決と同じ関数注入設計がそのまま使え、
  red→green は1イテレーションで完了した。ツリーの組み換えは発生していない。
- 統合フェーズ（手順8）で、`.app` の再ビルド（`scripts/app-bundle/build-local.js`）が
  `ERR_FS_CP_EINVAL` で失敗する問題を発見した。今回の変更とは無関係の既存問題。
  原因: self-reference 依存（`node_modules/@tenjuu99/blog` → リポジトリルート）のリンクが
  前回ビルドの出力（`dist-app/` はリポジトリ内）に残っており、Node の `cp` がリンク解決チェックで
  「自分自身の内側へのコピー」とみなす。**一度組み立てた .app への再ビルドで初めて起きる**
  （初回ビルドは dest が無いので通る）ため、native-shell-distribution 当時は顕在化しなかった。
  対応: `bundleWriter.js` を「dest を消してからコピー（クリーン書き出し）+ verbatimSymlinks」に修正し、
  再現テストを `tests/app-bundle/bundleWriter.test.js` に追加した（npm test 273件 green）。
- 上記の副産物として、旧 `dist-app` の `.app` 内の `@tenjuu99/blog` リンクが**絶対パスで
  リポジトリルートを指していた**ことを発見（manifest.json の symlinks 後処理導入前のビルド残骸）。
  この状態の .app を配布すると、ビルド機以外ではモジュール解決が壊れる潜在バグだったが、
  今回の再ビルドで `../..`（.app 内で完結する相対リンク）に置き換わった。
- Node `cp` のリンク解決チェックは **relative リンクを CWD 基準で resolve する**ため、
  `verbatimSymlinks: true` だけでは不十分だった（テストが tmpdir では通るのに実環境で落ちる
  CWD 依存の罠）。最初に書いた再現テストが2回「意図せず green」になり、失敗条件の特定に
  イテレーションを要した（5回連続失敗には達していない）。
- GUI（AppKit メニュー・NSOpenPanel）の自動操作による end-to-end 検証を AppleScript で試みたが、
  フォルダ選択ダイアログの操作（go-to シート・列ビューの選択・Open ボタンの有効化条件）が安定せず、
  type-ahead 文字列が検索フィールドに迷い込むなどで断念。メニュークリック・キャンセル操作・
  終了操作までは AppleScript で検証でき、フォルダ選択のみユーザーに代行してもらった。
  シナリオ3（キャンセル→現状維持）は AppleScript の Cancel クリックで検証済み。
- 依存グラフによる孤立ノードチェック（手順7.5）: 依存グラフは JS のみを収録しており、
  今回の主実装（Swift: `ContentRootResolver.reselect` / `AppDelegate`）は対象外。
  修正した `scripts/app-bundle/bundleWriter.js` も `scripts/` 配下でグラフ未収録
  （entry_points は `bin/*` と `lib/server/**`）。Swift 側と scripts/ 側の構成把握は
  depgraph の枠外という状態が続いている。
- 検証後の状態: アプリのコンテンツルート記憶はスクラッチ領域の検証用プロジェクト
  （`/private/tmp/claude-501/.../scratchpad/project-b`）を指している。この領域は一時的なので、
  ユーザーが新しいメニューから実プロジェクトへ切り替えなおす必要がある（消えていた場合も
  初回解決のフォールバックで選択ダイアログが出るため詰みはしない）。
- 問題定義の範囲外として申し送られていた node_modules 破壊問題（plans/node-modules-destruction）は
  今回スコープに入れていない。切り替え時の `linkAppNodeModulesIntoContentRoot` は既存実装を
  そのまま再利用しており、実体 node_modules を持つプロジェクトへ切り替えると破壊が起きる状況は
  従来どおり残っている（切り替え機能により顕在化しやすくなった）。
