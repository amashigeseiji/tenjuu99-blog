# 問題定義: コンテンツルート選択が既存プロジェクトの node_modules を黙って破壊する

**バージョン:** v1
**最終更新:** 2026-07-08
**作業ディレクトリ:** /Users/amashige/dev/tenjuu99-blog
**関連設計資料:** plans/archives/native-shell-distribution/problem.md, plans/archives/native-shell-distribution/findings.md（F-02）, docs/dictionary.json（`app-bundle` コンテキスト）
**性格:** 現時点の問題理解のスナップショット。design/run/feedback を経て改版されることが正常な軌道。

## 変更履歴

### v1 (2026-07-08)
- 初版（plans/archives/native-shell-distribution/findings.md の F-02 を起点に定義）

---

## 問題

開発機には、既に開発中のプロジェクト（実体の `node_modules` を持つコンテンツフォルダ）が存在する。
それをネイティブアプリのコンテンツルートに選ぶと、アプリがそのフォルダの中身を利用者に断りなく
削除・置換する。配布先（Node 未インストールの Mac）では `node_modules` が存在しない前提が成り立つため、
元のプランの範囲では顕在化しなかった挙動である。

### やりたいこと

- 開発機で既に開発中のプロジェクトを、そのままネイティブアプリのコンテンツルートとして使いたい（ローカルで開発中のものとアプリ利用を同居させたい）
- アプリにフォルダを渡しても、そのフォルダ内の既存のファイル・ディレクトリが黙って変更・削除されないでほしい

### 障害・制約

- アプリはコンテンツルート直下の `node_modules` を、既存の実体ディレクトリであっても無条件に削除し、同梱アプリコードへのシンボリックリンクに置き換える
- 削除・置換にあたって利用者への確認も通知もない
- `npm install` で復元可能ではあるが、利用者のデータを黙って消すという挙動そのものが、フォルダを預ける側の信頼と両立しない

### 観察された症状

- `~/dev/nobi` をコンテンツルートに選んだところ、既存の実体 `node_modules` がシンボリックリンクに置き換えられた
- 現時点で実害は未観測（ユーザーの言葉: 「いまは問題ないようです」）。ただし実害の有無にかかわらず、破壊的挙動が確認・通知なしに起きること自体が問題の実体

## 範囲外

- コンテンツルートを切り替える手段の不在（plans/content-root-switching/problem.md が扱う）
- 配布先（Node 未インストールの Mac、`node_modules` が存在しないフォルダ）での初回利用フロー（native-shell-distribution で解決済みの範囲。そこではこの問題は起きない）

## 解決したと言える状態（問題領域の言葉で）

- 実体の `node_modules` を持つプロジェクトをコンテンツルートに選んでも、そのプロジェクト内の既存ファイル・ディレクトリが利用者の同意なく削除・置換されない
- その上で、アプリとしての動作（起動〜編集）が引き続き成立する。もしその選択のままでは動作を成立させられないのであれば、黙って壊すのではなく、利用者がその状況を認識できる

## 他の問題との関係

- `関連`: plans/content-root-switching/problem.md — 同じ「開発機で複数の既存プロジェクトを扱う」利用文脈から生まれた。互いに独立して解決できる

## 技術的背景（調査結果）

- `native/Sources/App/AppDelegate.swift:52` の `linkAppNodeModulesIntoContentRoot` が、コンテンツルート直下の `node_modules` について「バンドルへのリンクでない既存アイテム」を `try? fm.removeItem` で無条件に削除し、シンボリックリンクを作成している
- このリンク（コンテンツルートモジュール解決リンク）は、Node の ESM 解決がコンテンツルートの祖先を遡っても `.app` 内の `node_modules` へ辿り着けないために導入された配線であり、bare specifier（`@tenjuu99/blog` 等）の import 解決に必要とされている
- つまり「既存の実体を消す」ことは目的ではなく、配布先では `node_modules` が存在しない前提だったために、既存アイテムの扱いが設計上の論点にならなかった

## /tdd-run への申し送り

- 「実体の `node_modules` を持つプロジェクト」「開発中プロジェクトとの同居」を語る語彙が docs/dictionary.json にない → 新規語彙の種
- findings には解決手段の候補（NODE_PATH 等の環境変数による解決、リンクを張らずに起動、警告して中断）が記録されているが、いずれも設計フェーズの論点であり、ここでは選定しない
- 「利用者の同意なく」の同意の形（確認して進むのか、そもそも既存物に触らないのか）は未確定のまま開いている
- 実体 `node_modules` が存在する場合にアプリの動作が実際に成立するか（同梱コードとの整合）は未検証

## 参考資料

- plans/archives/native-shell-distribution/findings.md（F-02）
- plans/archives/native-shell-distribution/problem.md
- native/Sources/App/AppDelegate.swift（`linkAppNodeModulesIntoContentRoot`）
- docs/dictionary.json
