# Test Tree: editor-diagnosis

## editor context 再節合（2026-08-14・再節合型）

### できるのツリー

root と行為層は台帳（docs/acts.json）からの固定点。装置の述語は初出時のみ記し、以降は名前で参照する（semi-lattice）。

```
◆ 記事編集・ナビゲーション系
作成者 は サイドバーのファイルをクリックしてエディタで開ける [editor] (act-0006)
├── 表示対象ナビゲーター は 表示対象の切り替えをURLに宣言し、URLから表示を再構成できる [editor]
│   （移設元: editor.js loadFileInPlace / popstate ハンドラー / leaveImageDetail / DOMContentLoaded の URL 復元 /
│     サイドバークリックデリゲーションの URL 処理部 / 新規作成・画像追加後の URL 更新 / reloadCurrentArticle）
├── 記事読み込み器 は 記事の内容を取得してエディタへ反映でき、未存在の記事にはフロントマターテンプレートから初期内容を用意できる [editor]
│   （移設元: editor.js fetchData・テンプレートフォールバック・setCurrentFile）
├── プレビュー描画器 は 編集中の内容から描画結果を取得してプレビュー領域に反映できる [editor]
│   （移設元: editor.js submit）
├── 公開ステータス表示器 は 記事の公開ステータスを取得し、ラベルと操作の可否に反映できる [editor]
│   （移設元: editor.js fetchPublicationStatus / renderPublicationStatus / applyPublishAvailability）
└── アクティブ状態同期器（基盤節）

作成者 は テキスト入力の手を止めるとプレビューが自動更新される [editor] (act-0002)
├── プレビュー自動更新器（既存・触らない）
├── プレビュー描画器
├── プレビュー自己完結化 は プレビューの描画結果を外部参照なしに単体で表示できる形へ変えられる [editor]
│   （移設元: server/preview.js inlineStyles — 名前の付与とテスト接続。実装は既存のまま）
└── ハンドラー基盤（基盤節）

作成者 は saveボタンを押さなくても書いた内容が保存される [editor] (act-0005)
├── 自動保存（既存語彙・editor.js autoSave の実体関数をモジュールへ移設）
├── 公開ステータス表示器
└── ハンドラー基盤（基盤節）

作成者 は 新規作成からファイル名とテンプレートを指定して未公開のファイルを作れる [editor] (act-0004)
├── 新規作成UI（既存語彙・editor.js の新規作成リスナー群 307-401 とタブ側の選択肢再構築を移設）
├── テンプレートレゾルバー（既存語彙・editor.js initFrontmatterTemplate と _frontmatterTemplates を移設）
├── 表示対象ナビゲーター
└── ハンドラー基盤（基盤節）

作成者 は 画像をドロップするとMarkdown構文が挿入されその場で確認できる [editor] (act-0003)
├── ドロップレシーバー（既存語彙・editor.js initDropReceiver を移設）
├── Markdown挿入器（既存・editor.js のインライン再実装を js/image_upload.js insertImageMarkdown の利用へ置換）
├── 画像アップローダー（既存語彙・editor.js uploadImage / addLibraryImage の2実装を一本化して移設）
└── プレビュー描画器

作成者 は アップロードした画像がWebに適した形に変換されて保存される [editor] (act-0001)
├── 画像アップローダー
├── コンバーターファクトリー（既存・触らない）
└── ハンドラー基盤（基盤節）

◆ 公開・同期系
作成者 は 手段を意識せず記事を公開でき、参照不能時は理由が分かる [editor] (act-0008)
├── 操作実行器（基盤節）
├── 公開可否判定器（既存・触らない）
├── 公開ステータス表示器
└── ハンドラー基盤（基盤節）

作成者 は 公開した記事を原稿を残したまま非公開に戻せる [editor] (act-0009)
├── 操作実行器（基盤節）
└── ハンドラー基盤（基盤節）

作成者 は 記事を削除できる（公開済みは非公開への誘導つき） [editor] (act-0010)
├── 操作実行器（基盤節）
├── 確認ダイアログ（既存語彙・editor.js 先頭の showConfirm と DOM 参照を移設し、import 時の DOM 参照を除去）
├── 表示対象ナビゲーター
└── ハンドラー基盤（基盤節）

作成者 は リモートの内容を手元に取り込める [editor] (未登記・witness緑: sync-operations US-03)
├── 操作実行器（基盤節）
├── 確認ダイアログ（リモートのみ記事の選択肢提示）
├── 記事読み込み器（取り込み後の開き直し）
└── ハンドラー基盤（基盤節）

作成者 は サイドバーで各ファイルの公開ステータスを識別できる [editor] (act-0007)
├── サイドバー取得エンドポイント（既存語彙・server/get_sidebar.js の定型部を基盤へ）
├── 公開ステータス表示器
└── アクティブ状態同期器（基盤節）

◆ 画像ライブラリ系
作成者 は サイト全体の画像を一覧・プレビューしメタデータを確認できる [editor] (act-0011)
├── 画像ライブラリビュー は 画像一覧を取得・保持し、一覧と詳細の表示を最新の状態に描き直せる [editor]
│   （移設元: editor.js initImageLibrary / _imageLibraryEntries / openImageDetail / closeImageDetail /
│     wireImageDetailOperations / wireRemoteOnlyImageRemoval の配線部 / _currentImageDetailEntry）
└── ハンドラー基盤（基盤節）

作成者 は 画像を削除でき、参照がある場合は参照記事の提示と選択を経られる [editor] (act-0012)
├── 画像削除UI（既存・触らない）
├── 確認ダイアログ
└── 画像ライブラリビュー

作成者 は 画像の置き場所とファイル名を付け替えられる [editor] (act-0013)
├── 画像移動UI（既存・触らない）
├── 表示対象ナビゲーター（履歴を積まないURL付け替え）
└── 画像ライブラリビュー

作成者 は 記事編集を経由せず画像を追加できる [editor] (act-0014)
├── 新規作成UI
├── 画像アップローダー
├── 表示対象ナビゲーター
└── 画像ライブラリビュー

作成者 は 画像の選択・表示をURLで特定でき、直打ち・リロード・戻るで再現される [editor] (act-0016)
├── 表示対象ナビゲーター
├── 表示対象解決器（既存・触らない）
├── 画像ライブラリビュー
└── アクティブ状態同期器（基盤節）

作成者 は 画像自身の公開ステータスを画面で確認できる [editor] (act-0017)
├── 画像ライブラリビュー
└── 画像リストコレクター（既存・触らない）

作成者 は リモートにのみ残る画像を別枠で見つけ取り除ける [editor] (act-0018)
├── 操作実行器（基盤節）
├── 確認ダイアログ
├── 画像ライブラリビュー
└── ハンドラー基盤（基盤節）

作成者 は 検出できない参照を宣言して自動非公開から外せる [editor] (未登記・witness緑: editor-image-library-publication-state US-06)
├── 画像宣言UI（既存・触らない）
└── 画像ライブラリビュー

◆ サーバー側のみで完結する root
作成者 は 画像の公開・非公開が記事からの参照に連動して決まる [editor] (act-0015)
└── ハンドラー基盤（基盤節）※業務ロジック（画像公開同期器ほか）は触らない

アプリ利用者 は node_modules の状態によらず同梱機能を使える [app-bundle] (act-0019, act-0020)
└── （装置変更なし。import 形式（@tenjuu99/blog/... 自己参照）を変えないことが制約。witness で確認のみ）
```

Entry point:
- クライアント root 群: `packages/editor/js/editor.js`（DOMContentLoaded）
- サーバー root 群: `packages/editor/server/*.js`（lib/server のハンドラー登録経由）
- act-0001 / act-0015: 境界辺 `lib/distribute.js → packages/editor/server/createConverter.js` を含む

### 基盤節

- **操作実行器** — 進行中の表示・結果の伝達・完了後の更新という操作の一連の流れを、一つの定型として実行できる
  影響先: act-0008 / act-0009 / act-0010 / act-0018 / 取り込む（未登記）
  移設元: editor.js publishWithFeedback / unpublishWithFeedback / deleteWithFeedback / pullWithFeedback / wireRemoteOnlyImageRemoval の定型部・setImageOperationFeedback
- **アクティブ状態同期器** — サイドバーのアクティブ表示を現在の表示対象に一致させられる
  影響先: act-0006 / act-0007 / act-0016
  移設元: editor.js 内5箇所のセレクタ照合（renderPublicationStatus / loadFileInPlace / initSidebarTree / leaveImageDetail / openImageDetail）
- **ハンドラー基盤** — リクエストの解釈と成功・失敗の応答の定型を引き受け、各エンドポイントに業務処理だけを書かせられる
  影響先: act-0001 / act-0002 / act-0004 / act-0005 / act-0008〜0018 / 取り込む / 検出外参照宣言
  移設元: packages/editor/server/ 12ファイル（publish / unpublish / delete / delete_image / move_image / image_upload / image_declaration / remove_remote_image / get_publication_status / get_image_references / preview / save）の parseJsonBody→400→try/catch→500→return true 定型部

### 残余

- **editor.js は composition root として残す**: DOM 要素の取得・イベント配線・装置の初期化と接続のみ。モジュール先頭での DOM 参照を除去し、DOM なしで import 可能にする
- サイドバー開閉・展開状態（sidebarToggle / loadDirOpenState / saveDirOpenState / initSidebarTree）はサイドバー用の小モジュールへ移設（既存語彙「サイドバー」「展開状態」の帰属先。新語彙なし）
- 既存の小モジュール群（tree.js・debouncer.js・publishAvailability.js・publicationStatusLabel.js・imageListDisplay.js・imageDetailDisplay.js・displayTargetResolver.js・imageDeleteUI.js・imageMoveUI.js・imageDeclarationUI.js・inlineFileNameEditUI.js・remoteOnlyImageDisplay.js・error.js・frontmatter_template.js・autoPreviewInitializer.js・autoSaveInitializer.js・imagePathDetector.js・imageReferenceExtractor.js・frontmatterImageReferenceExtractor.js）と、server の業務ロジック関数（saveFile・handlePublish・画像公開同期器ほか）は触らない

### 前提決定

- 採用: 案B（クライアント装置分割＋サーバーハンドラー基盤） / 不採用: 案A（クライアントのみ） — server 12ファイルの定型反復が診断項目のまま残るため
- 採用: 〃 / 不採用: 案C（witness 未確立3語の最小抽出のみ） — 理解容易性・拡張容易性の診断に応えないため
- 採用: 操作実行器を基盤として一本化 / 不採用: 各操作モジュールが個別に定型を持つ — 文言と形の散在（5箇所）が再発するため
- 採用: アクティブ状態同期を独立基盤 / 不採用: 表示対象ナビゲーターの内部機能 — 公開ステータス描画・ツリー初期化などナビゲーション以外の枝からも使われるため
- 採用: ハンドラー基盤は packages/editor/server 内 / 不採用: lib/server のヘルパー拡張 — 触る範囲を editor に閉じ、lib の回帰面に踏み込まないため

### 挙動保存

- 回帰面: 台帳の行為 act-0001〜0018（作成者）＋未登記2件（取り込む・検出外参照宣言）＋act-0019/0020（アプリ利用者・間接）
- witness: 受け入れテスト11ファイルで全緑を確認（78 passed。恒常スキップは「手動確認」と記録されたシナリオのみ）。未登記2件にも witness が実在するため特性テストの新規追加は不要
- 受け入れテストの前提: 現在ブランチに upstream が必要（公開ステータスが `@{u}` から導出されるため）
- ユニットテスト基線: `npm test` 458 tests 全緑
- 確認ダイアログ・サイドバータブ・サイドバー開閉は受け入れテストの間接被覆（削除確認・画像タブ切替・別枠操作をスペックが実際に操作する）

### 利用仮説

- 退行なし: 上記 witness と `npm test` が合成の全期間を通じて緑のまま
- 構造の改善（検証は合成後のブラインドレビュー）:
  - 理解容易性: editor.js が配線のみになり、各装置が「何をするか」を名前で言える。辞書の粒度と実装の粒度が一致する
  - 拡張容易性: 操作を1つ足すとき操作実行器の利用1箇所、エンドポイントを1つ足すとき業務関数1つで済む。接続失敗の文言が1箇所になる
  - 頑健性: 全装置が DOM なしで import 可能になり、witness 未確立だった3語（サイドバー取得エンドポイント・サイドバータブ・確認ダイアログ）にユニットテストが張れる
- こうなったら外れ: 装置分割後も editor.js に状態や分岐が残り続ける ／ 操作実行器の抽象が個別操作の差異（確認の有無・後続更新の違い）を吸収できず引数が膨らむ ／ witness が赤になる
