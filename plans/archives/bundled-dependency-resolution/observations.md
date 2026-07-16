# Observations: bundled-dependency-resolution

**日時:** 2026-07-17

## 実装中の気づき

- 既存の安定語彙「同梱モジュール解決器」（docs/dictionary.json）は、現在の定義文が「アプリ自身のパッケージ名（@tenjuu99/blog）への参照」のみを対象と書いている。今回の実装でこの装置の役割は「自己参照＋同梱コード自身の依存パッケージへの参照」全般に広がった。docs/dictionary.json は `/tdd-vocab promote` 経由でのみ編集できる制約のため、このセッションでは書き換えていない。次の `/tdd-feedback` または `/tdd-vocab promote` の際に、この定義文の更新（自己参照に限定しない旨への書き換え）を反映する必要がある。
- ステップ7.5の依存グラフ孤立チェック（`.claude/tdd/depgraph.regen`）を実行したところ、`scripts/app-bundle/` 配下のファイルはグラフに1件も含まれていなかった（全87モジュール中0件）。`config.json` に `depgraph.scope` は設定されていないため、グロブ不一致によるスコープ外ケースには該当しないが、実態としてはこのツール自体の走査対象ルートが `scripts/app-bundle/` を含んでいない。
  - この孤立らしさは新規コードの設計問題ではない: `bundledDependencyMatcher.js` は `bundledModuleResolver.js` から静的 `import` されており（コード上の合成は成立している）、既存の `bundledModuleResolver.js` 自体も同種の理由（`registerBundledModuleResolver.js` からは `node:module` の `register()` に文字列で渡されるだけで、静的 import エッジとして現れない）でこのツールからは元々追跡できない構造だった。今回新たに生じた問題ではなく、既存の app-bundle コンテキスト全体がこの静的解析ツールのカバレッジ外にあるという既存の性質。
- 依存パッケージの解決先を自前でURL組み立てするのではなく、Nodeの`nextResolve`へ`parentURL`を同梱コードのルートへ差し替えて委譲する設計にしたことで、`sharp`のような`exports`/`main`解決が絡むパッケージでもコード側で再実装せずに済んだ。既存の自己参照リダイレクト（`redirect()`）とは異なるアプローチになったが、双方とも「同梱コードのルートを起点に解決させる」という同じ考え方の表れ。
- **実機検証で発覚したギャップ**: セッション終了後、利用者が実際に `build-local.js` でビルドした `.app` を起動したところ `Cannot find module '.../bundledDependencyMatcher.js'` でクラッシュした。原因は新規ファイル `scripts/app-bundle/bundledDependencyMatcher.js` を `scripts/app-bundle/manifest.json` の `entries` に追記し忘れていたこと（`bundledModuleResolver.js` だけを追加し、そこから import される新ファイル自体の同梱を忘れていた）。
  - 単体テスト・受け入れテストのいずれも、`bin/server` を**リポジトリから直接**起動しており、実際に組み立てられた `.app`（manifestに基づく物理コピー）を経由しないため、この種の「新規ファイルをmanifestに登録し忘れる」不具合を検知できなかった。テストツリー設計時点でこの合成経路（マニフェスト経由での同梱）の検証がツリーに含まれていなかったことが根本原因。
  - 対応: `manifest.json` にエントリを追記し、加えて `tests/app-bundle/distributionBundleAssembler.test.js` に「`repo/scripts/app-bundle/` 配下のファイルが相対importする先が必ずmanifestに含まれる」ことを検証する回帰テストを追加した（修正前は実際に red になることを確認済み）。今後 `scripts/app-bundle/` に新規ファイルを追加した際、manifest登録漏れがあれば自動的に検知される。
  - `/tdd-feedback` へ: 今回のテストツリー設計（ステップ4）に「配布物として実際に組み立てられた状態での合成」を検証するノードが欠けていた。同種の `app-bundle` コンテキストの問題では、マニフェストへの同梱漏れを機械的に検知するテストを最初から設計に含めるべきという教訓。
