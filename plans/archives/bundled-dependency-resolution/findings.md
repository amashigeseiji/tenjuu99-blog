# Findings: bundled-dependency-resolution

**日時:** 2026-07-17
**対象:** plans/bundled-dependency-resolution/

## 操作の事実

- `node scripts/app-bundle/build-local.js` で `.app` をビルド
- `~/dev/blog` の実体 `node_modules` を削除した状態で `tenjuu99-blog.app` から `~/dev/blog` をコンテンツルートとして選択し、画像メタデータ読み取り機能を操作 → 問題なく動作
- 続けて `~/dev/blog` で `pnpm install` を実行し、実体 `node_modules` がある状態で同じ `.app` から `~/dev/blog` を開き直して同機能を操作 → 問題なく動作し、`node_modules` は破壊されていないことを確認

## 利用仮説の照合

- 利用仮説（US-01 シナリオ1: 実体 node_modules なし）: 期待どおり
- 利用仮説（US-01 シナリオ2: 実体 node_modules ありの開発中プロジェクトとの同居）: 期待どおり
- 外れ側の兆候（`Cannot find package`、node_modules への書き込み）: いずれも発生せず

## 印象（ユーザーの言葉）

- 「特になし」— 引っかかった点・意外だった点は無し

## 成果物レビュー

語彙（plans/bundled-dependency-resolution/dictionary.json）:
- 新規エントリ「依存パッケージ名判定器」は関係（`同梱モジュール解決器` への references、`配布物` への belongs_to）が明記されており孤立していない
- 既存の安定語彙「同梱モジュール解決器」（docs/dictionary.json）の定義文は現状「アプリ自身のパッケージ名（@tenjuu99/blog）への参照」のみを対象と書いており、今回の実装でこの装置の役割は「自己参照＋同梱コード自身の依存パッケージへの参照」全般に広がった（observations.md 記載どおり）。promote 時、新規エントリの追加だけでなく、この既存エントリの再定義（`dict-write.js update` 経由、check を通す）が必要

ソリューション構造（test-tree.md と現在の describe() 構造の比較）:
- ツリーと `tests/app-bundle/bundledDependencyMatcher.test.js` / `bundledModuleResolver.test.js` の describe() 構造はほぼ1:1で対応しており、差分は無し
- ツリー確定後に「配布物として実際に組み立てられた状態での合成」（manifest 経由の同梱漏れ検証）を検証するノードが欠けていたことが実機検証で発覚し、同一セッション内で `distributionBundleAssembler.test.js` に回帰テストを追加して解消済み。現状は解決済みだが、テストツリー設計プロセス自体への教訓として残す（下記 F-01）

観察メモ（observations.md）:
- 依存グラフ孤立チェックで `scripts/app-bundle/` 配下が全件カバレッジ外だった点は、今回の新規コードに起因するものではなく、既存の app-bundle コンテキスト全体（`register()` への文字列渡し、動的 import 起点）が元々この静的解析ツールの走査対象外だったという既存の性質。新規の問題ではないため対応不要

## 発見（解釈・原因の仮説、戻し先つき）

### F-01: app-bundle コンテキストのテストツリー設計に「実際に組み立てられた配布物での合成」ノードが最初から必要
**戻し先:** tdd-skills
**出どころ:** observations.md（実機検証で発覚したギャップ）
**解釈・原因の仮説:** 単体テスト・受け入れテストは `bin/server` をリポジトリから直接起動しており、`manifest.json` に基づく物理コピー（実際の `.app` 組み立て）を経由しない。そのため「新規ファイルを manifest に登録し忘れる」という失敗モードを、テストツリー確定時点では検知するノードが用意されていなかった。今回は実機検証で発覚し、同一セッション内で回帰テスト追加により解消したが、事前にツリー設計へ組み込めれば実機検証を待たずに検知できた
**推奨される対応:** app-bundle コンテキストで新しい同梱コードを追加する問題に取り組む際は、tdd-run のテストツリー設計ステップで「マニフェストへの同梱漏れがない」ことを検証するノードを既定で候補に含める

## 判断

- 利用仮説はシナリオ1・2とも期待どおりで、印象面の懸念も無し
- 語彙は「依存パッケージ名判定器」の新規昇格に加え、「同梱モジュール解決器」の再定義が必要（範囲外にはならない、通常の promote 手順内で対応可能）
- ソリューション構造に問題なし。F-01 は今回のスコープ内で既に解消済みの教訓であり、プランを差し戻す理由にはならない

→ **クローズ（アーカイブ）** で問題なし。promote 実施後にアーカイブする。
