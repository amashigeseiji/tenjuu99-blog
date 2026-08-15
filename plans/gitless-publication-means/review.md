# コードレビュー: gitless-publication-means（GitHub公開手段）

対象: 作業ツリーの未コミット変更（`lib/publishing/` の新規 5 ファイルと変更 3 ファイル、`packages/editor/server/` の呼び出し変更、`tests/publishing/gitHubPublicationMeans.test.js`、`tests/publishing/fixtures/fakeGitHub.js`、`tests/acceptance/gitless-publication-means.spec.ts`、`.gitignore`、`docs/spec.md`）。
根拠はコード・テスト・diff のみ。`node --test tests/publishing/*.test.js` は 64 件すべて通過を確認した。

## 総評

- 構造は良い。「接続（transport）／手段（意味）／同期の基点（永続化）／フィンガープリント（同一性）／認証情報（本人性）」が別モジュールに分かれ、`PublicationMeans` の既存契約を一切変えずに手段を一つ増やしている。解決器の registry へ 1 エントリ足すだけで手段が増やせる形も維持されている。
- テストは実体のある bare リポジトリを裏に持つ偽 GitHub を使い、git 運用マシンとの相互運用（tree の同一性・ff-only で追いつける・バイナリが壊れない）を直接検証している点が強い。受け入れテストは git を PATH から外してサーバーを起動しており、問題定義そのもの（git 不要）を検証できている。
- 一方で、**同期の基点の永続化に多インスタンス間の保護がない**こと、**基点を失ったファイルが「公開拒否 × 取り込み見送り」で行き詰まる**こと、**除去（unpublish）だけリモート先行の保護がない**ことは、実運用で表面化しうるリスクとして挙げる。

---

## 1. 理解が容易か

### 良い点
- 各モジュール冒頭の `@vocab` JSDoc が概念（同期の基点・フィンガープリント・認証情報提供者・GitHub接続）を先に説明しており、初見でも「git の refs/merge-base をシステム側が持ち直す」という設計のあらましは掴める（`lib/publishing/syncBase.js` 14-19 行、`lib/publishing/gitHubPublicationMeans.js` 19-30 行）。
- `judge`（`lib/publishing/versionLineage.js` 39-47）は純関数で、三者の指紋から連なりを決める規則が 8 行に収まっている。
- `GitHubConnectionError.kind` により、失敗の種別が文字列マッチではなく型付きで伝わる。

### 読みにくい点・リスク
- **`createGitHubPublicationMeans` は 160 行のクロージャで、可変状態 `version` / `loadError` と 10 個の内部関数が同居する**（`gitHubPublicationMeans.js` 38-196）。とくに宣言順が読み手を惑わせる: `reconcileOnFirstContact`（59 行）が後で宣言される `observe`（93 行）を参照し、`await load()`（64 行）が宣言群の途中に挟まり、`reconcileOnFirstContact()` の呼び出し（99 行）は `observe` の直後に置かれる。動作は正しいが「組み立て時に何が起きるか」を追うには上下に往復が要る。組み立て手順（load → observe 群 → 初回接触の揃え）を末尾にまとめるか、状態を持つ部分（`version`/`loadError`/`load`/`known`）を「リモートの知識」オブジェクトとして切り出すと読みやすくなる。
- **読み取り操作が書き込み副作用を持つ**: `remoteState.diffFromRemote` と `lineageOf` が `observe` 経由で `syncBase.advance` を呼び、`.blog/sync-base.json` を書く（`gitHubPublicationMeans.js` 93-98, 113-117, 184-188）。意味的には正しい（local === remote なら base=それ で矛盾しない）が、`RemoteState` は「読み取り専用の抽象」（`publicationMeans.js` 27-33）と定義されており、契約に反する副作用が実装の中に隠れている。コメントはあるが、`RemoteState` 側の JSDoc からは見えない。
- **「リモートが進んでいる」の検出が二系統ある**ことが一読では分からない: (a) `reflect` 内のファイル単位の事前検査（`remote !== syncBase.get(filePath)`、135-137 行）と、(b) `writeVersion` の PATCH が 422 を返す場合（`gitHubConnection.js` 86-88 → `toFailure` 13-15 行）。(a) は「同じファイルの上書き防止」、(b) は「読んでから書くまでの間の競合」だが、後者の存在理由はコメントに書かれていない。
- `known()` という名前は「無ければ投げる」振る舞いを示していない（67-70 行）。`requireVersion()` などの方が意図が伝わる。
- `RemoteVersion.files` の値に `mode` が含まれ、`applyWritten` が `'100644'` を既定にしている（106 行）。git の tree entry の概念が「手段」の層に一部漏れている（小さいが、`gitHubConnection.js` の `BLOB_MODE` と知識が二重になっている。§5 参照）。
- `ResolveOptions`（`publicationMeansResolver.js` 30-38）は blog.json の形（`github.api_base` の snake_case）とテスト用の注入点（`credentialProvider`, `fetch`）を同じ袋に入れている。サーバー側は `{ ...config.publish, cwd }` で設定を丸ごと流し込むため、設定と DI の境界がコード上で見えない。今は害がないが、将来 blog.json に `fetch` などのキーが増えたとき黙って注入点に流れ込む。

## 2. 拡張が容易か

### 良い点
- 手段の追加は `publicationMeansResolver.js` の `registry` に 1 エントリ（既存の `git` エントリと同じ形）。サーバーハンドラは `config.publish` を丸ごと渡すため、新手段の設定項目を増やしてもハンドラは触らなくてよい。
- `createGitHubPublicationMeans` は接続を `{ readCurrentVersion, readContent, writeVersion }` の 3 メソッドにしか依存しない。同じ形を満たす別ホスト（GitLab 等）の接続を作れば手段本体は流用できる見込みがある（フィンガープリントが git blob id と一致する前提は残る）。
- 「版の連なり」の判定が `judge` として純関数化されたので、判定規則の変更は 1 か所で済む（ただし git 手段側は未統合。§5-3）。

### 懸念
- **`syncBase` の置き場所は resolver に固定**（`defaultSyncBaseLocation(cwd)`）で、`credentialProvider` / `fetch` のような注入点がない。テストは resolver を迂回して直接組み立てているので今は困らないが、resolver 経由で基点を差し替えたくなったとき（例: 基点をコンテンツルート外に置く運用）は resolver を触る必要がある。
- **`toFailure` と `reflect` 内のメッセージ**が別々に持たれているため、文言変更が 2 か所に及ぶ（§5-1）。
- 除去・反映・取り込みの `try { … } catch (e) { return toFailure(e) }` の枠は 3 回書かれており、共通の失敗変換ポリシーを変えるときは 3 か所（git 手段まで含めれば 6 か所）を触る。

## 3. ロバストか

重大度順。

### R1（高）同期の基点の永続化に多インスタンス保護がなく、失われると行き詰まる
- `createSyncBase` は組み立て時に一度だけファイルを読み（`syncBase.js` 29-38）、`advance`/`forget` のたびに**メモリの全体像を丸ごと書き戻す**（39-44 行）。サーバーは HTTP リクエストごとに `resolvePublicationMeans` → 新しい `createSyncBase` を作る（`packages/editor/server/*.js` の 9 か所）。同一プロセスで 2 つのリクエストが重なると（例: publish の反映が blob アップロード中に、別タブや後続の `get_sidebar` / `get_publication_status` が `observe` で新しい基点を書く）、**先に読んだ古い像で上書きし、他方が進めた基点が消える**（lost update）。
- 基点を失ったファイル X（手元で編集済み）は行き詰まる: `reflect` は `remote !== null && remote !== base(null)` で拒み（`gitHubPublicationMeans.js` 135-137）、`pull` は `judge → 'diverged'` で見送る（`versionLineage.js` 39-47、`pull.js`）。ユーザーは「取り込んでから」と言われるが取り込めない。手元の内容を一度リモートと同じに戻して `observe` に揃えさせる以外の脱出路が UI にない。
- `syncBase.js` の冒頭コメント自身が「消すと退化する」と認めているが、退化ではなく「公開不能」に至る。対策候補: `save()` で書く直前にファイルを再読込して差分だけ適用する（`advance`/`forget` は差分なので合成しやすい）、あるいは基点が無い場合の `reflect` に「リモートの内容を採用して上書きする」明示操作を用意する。

### R2（中）除去（`remove`）にはリモート先行の保護がない
- `reflect` はファイル単位で「基点と違う内容がリモートにあれば拒む」が、`remove`（150-164 行）は `base.files.has(f)` だけで削除する。マシン A が X を更新した直後にマシン B が X を非公開にすると、A の新しい内容が黙って消える（履歴には残る）。
- git 手段では、A の push 後に B の push は non-fast-forward で失敗するため、同じ状況で B の unpublish は通らない。**手段によって「非公開」の安全性が異なる**。テストにもこのケースは無く、振る舞いが未定義のまま。

### R3（中）`handlePublish` の 'unknown' メッセージが git 固有のまま
- `packages/editor/server/publish.js` 38 行: `'リモートへの接続に失敗しました（upstream branch が未設定の可能性があります）'`。GitHub 手段で認証情報が無い・通らないときもこの文言が返り、原因（トークン）と無関係な助言になる。今回の diff の外だが、新手段の追加でこの文言が誤りになった。`remoteState` の例外メッセージ（`GitHubConnectionError.message` は日本語で原因を言う）を伝える形に変えるのが望ましい。

### R4（中）403 をすべて「認証情報が通らない」に分類
- `gitHubConnection.js` 80-82: 401/403 → `'unauthorized'`。GitHub の rate limit 超過は 403（または 429）で返る。手段は**リクエストごとに 3 回**（ref / commit / tree）、pull なら 6 回（`server/pull.js` が組み立てで load、`pull()` が `refreshRemote` で再度 load）API を呼ぶため、上限に触れる可能性はゼロではない。そのとき「トークンを置いてください」相当の誤誘導になる。429・`x-ratelimit-remaining: 0` を別 kind にする余地がある。

### R5（低）`toRepoPath` の相対パスは `..` を検査しない
- `gitHubPublicationMeans.js` 76-81: 絶対パスはコンテンツルート外を拒むが、相対パス `../x` はそのまま通り `nodePath.join(cwd, '../x')` を読む/書く。呼び出し元（ハンドラ）でパス検証済みなので現状は到達しないが、絶対と相対で防御の非対称がある。`nodePath.resolve(cwd, filePath)` に一本化してから相対化すれば両方同じ検査で済む。

### R6（低）初回接触の揃えは O(N) 回のファイル全体書き込み
- `reconcileOnFirstContact`（59-62）は remote の全ファイルについて `observe` → `advance` → `save()`（毎回 JSON 全体を書いて rename）。1,000 ファイルなら 1,000 回の全体書き込み。正しさには影響しないが、初回のサイドバー表示が目に見えて遅くなりうる。`advance` を束ねる `advanceAll` か、`save` の遅延が欲しい。

### R7（低）その他
- `reflect` で手元に無いファイル（記事が参照する画像が消えている等）は `readFileSync` の ENOENT がそのまま `error.message`（英語）で返る（126, 145-146 行）。git 手段でも同様の漏れがあるので退行ではないが、「git の言葉を出さない」方針と並べると生の OS エラーも隠したい。
- `writeVersion` は blob → tree → commit → ref の 4 段で、途中失敗すると孤児オブジェクトが残る（GitHub 側で GC される。実害なし）。
- `readContent` の `encoding !== 'base64'` 分岐（110 行）は到達しない（Git Data API は常に base64）。害はないが未テスト。
- 認証情報は平文 JSON（`.blog/credentials.json`）。git の無いマシンでは漏れないが、同じフォルダを後日 git 管理下に置いたときの事故は `.gitignore` 頼み（`docs/spec.md` に記述あり）。

### 良い点（ロバスト性）
- 組み立て時に接続が失敗しても手段は返し、参照は例外／実行は失敗に分ける方針が git 手段と同型で、`getPublicationStatus` の 'unknown' に自然に乗る（テスト 394-408 行で検証）。
- `writeVersion` の `force: false` と 422 → `remoteAdvanced` により、読み書きの間の競合で黙って上書きしない（テスト 289-306 行）。
- 認証情報提供者が呼び出しごとに読み直すため、トークン差し替えが再起動なしに効く（テスト 353-365、受け入れ US-04 s3）。
- 基点の書き込みは tmp + rename で単一書き込みとしては原子的。

## 4. 匿名の処理

「名前を持たず、振る舞いとして個別に検査されない処理」の量と代表例。

| 場所 | 量 | 判断 |
|---|---|---|
| `gitHubPublicationMeans.js` の内部クロージャ群: `load` `known` `toRepoPath` `localFingerprintOf` `remoteFingerprintOf` `observe` `reconcileOnFirstContact` `applyWritten` | 8 個、約 60 行 | 名前はあるが export されず、個別テストは無い。`observe`（同じなら基点を揃える）と `applyWritten`（書いた内容で知識を進める）は「同期の基点」の正しさを左右する中核で、`reflect`/`remove` のテスト経由で間接的にしか検証されない。`toRepoPath` のコンテンツルート外拒否（79 行）は未検証。**`observe` と `applyWritten` は振る舞いとして名指しでテストする価値がある**（例: 反映後に `refreshRemote` せず `existsInRemote`/`diffFromRemote` が新しい版を答えること）。他は妥当な粒度。 |
| `gitHubConnection.js` の `call`（57-90） | 1 個、34 行 | HTTP 呼び出し・認証付与・**HTTP ステータス → kind の変換表**（80-89）を一手に担う。`noCredential`/`unauthorized`/`unreachable`/`remoteAdvanced` は接続テストで検査されるが、`notFound`/`api` は未検査。変換表を `call` から `toConnectionError(response, method, path)` として切り出すと、表だけを単体で検査できる。正当性: 中程度（表は仕様なので名前を持つべき）。 |
| `publicationMeansResolver.js` の `registry.github`（12-25） | 1 個、14 行 | 設定検証＋接続・基点・手段の配線。resolver テスト（545-586）で 4 ケース検査済み。妥当。 |
| `packages/editor/server/*.js` の `{ ...config.publish, cwd: rootDir }` | 9 か所 | 「設定から解決器オプションを組む」処理が式のまま散っている。個別検査なし。§5-6 参照。 |
| `tests/publishing/fixtures/fakeGitHub.js` の経路分岐（45-125） | 約 80 行 | 正規表現で 8 経路を捌く。テスト用の偽物なので個別検査は不要だが、`trees` POST（96-108）は一時 index を使う実装で、失敗すると本体のバグと区別しにくい。フィクスチャとして許容範囲。 |
| `tests/acceptance/…spec.ts` の補助関数群 | 約 60 行 | 受け入れテストの補助。妥当。 |

総量: 本体で約 110 行が匿名または間接検証。中核 2 つ（`observe`, `applyWritten`）と変換表（`call` 内）を除けば正当。

## 5. 範囲内の重複

| # | どこ | 何が | 判断 |
|---|---|---|---|
| 5-1 | `gitHubPublicationMeans.js` 14 行（`toFailure`）と 136 行（`reflect`） | 文言 `'リモートが先に進んでいます。先に取り込んでから、もう一度公開してください'` が 2 か所に書かれている | **本質的な重複**。同じ利用者向けメッセージを 2 つの検出経路が返す。定数にまとめるべき。受け入れテストは `/取り込/` でしか見ていないので片方の変更漏れに気付けない。 |
| 5-2 | `gitHubConnection.js` 29 行 `BLOB_MODE = '100644'` と `gitHubPublicationMeans.js` 106 行 `'100644'` | 既定の blob mode の知識 | **本質的な重複**（小）。`RemoteVersion` に mode を含める設計なら、既定値も接続側が返すか export して共有すべき。 |
| 5-3 | `versionLineage.js` `judge`（39-47）と `gitPublicationMeans.js` `createGitLineageOf`（151-163） | 「local/remote/base の同異 → same/localAhead/remoteAhead/diverged/localOnly/deletedLocally/remoteOnly」の判定規則。157-163 行は `judge` の後半と一字違わず同じ | **本質的な重複**。`judge` を純関数として切り出したのに、既存の git 手段は自前の分岐を残している。git 手段は HEAD の知識で `deletedLocally` を先読みできる差があるが、それは `judge` を呼ぶ前の前処理で吸収できる。判定規則を将来変えるとき（例: リモートで消されたものの伝播）2 か所を同時に変える必要が生じる。 |
| 5-4 | `credential.js` `readCredential`（37-46）と `syncBase.js` `load`（29-37） | 「存在確認 → JSON.parse → try/catch → 既定値」の JSON 読み込み | 偶然の一致寄り（形の一致だが意味も既定値も違う）。`readJsonOr(location, fallback)` に寄せてもよいが優先度は低い。 |
| 5-5 | `gitHubPublicationMeans.js` の `reflect`/`remove`/`takeFromRemote` の `try{…}catch(e){return toFailure(e)}`（121-182）と `gitPublicationMeans.js` の同形（`error.stderr \|\| error.message`） | 実行系の失敗を `{success:false,error}` に畳む枠 | 半ば本質的。手段ごとに失敗の言い換え方針が違うので完全共通化は難しいが、手段内では `guarded(async () => …)` にまとめられる。可読性のトレードオフなので必須ではない。 |
| 5-6 | `packages/editor/server/` 9 ファイル | `resolvePublicationMeans({ ...config.publish, cwd: rootDir })` / `resolveRemoteState({ ...config.publish, cwd: rootDir })` | **本質的な重複**（今回の diff で形が変わり、9 か所を同時に触っている事実がそれを示す）。`resolveConfiguredMeans()` / `resolveConfiguredRemoteState()` を editor 側に 1 つ置けば、次に解決器の引数が変わったとき 1 か所で済む。 |
| 5-7 | `tests/publishing/gitHubPublicationMeans.test.js` 236-246, 257-266, 291-294, 311-314, 320-323 | `setupBareRemote()` → `clone` → `createFakeGitHub` → `createGitHubConnection` の 4 行 | テスト内の本質的重複。`setupMeans` があるのに接続テストは手組みしている。`setupConnection()` を 1 つ足せば 5 か所が縮む。 |
| 5-8 | 同テスト 27-31 行（seed の commit）と `pushA`（39-44）、resolver テスト 551 行 | `add . / commit / push` の 3 連 | 小。`pushA` を seed にも使えば消える。 |
| 5-9 | `gitHubPublicationMeans.js` 83-86 `localFingerprintOf` と 126-127 行（`reflect` 内の read + compute） | 手元ファイルの読み取りと指紋計算 | 偶然の一致（`reflect` は内容そのものも要る）。放置でよい。 |

## 6. テストの評価

### 強い点
- 偽 GitHub の裏が本物の bare リポジトリで、`rev-parse HEAD^{tree}` の一致（132-146 行）や `pull --ff-only` で追いつけること、`log --merges` が空であることを直接見ている。「git 運用と見分けがつかない」という要件をこれ以上ないほど直接検証している。
- 指紋の検証を `git hash-object --stdin` と突き合わせている（410-425 行）。
- 「基点はプロセスをまたいで効く」（489-496 行）と「認証情報の置き直しが効く」を、インスタンスの作り直しで検証している。
- 受け入れテストは git 無し PATH でサーバーを起動し、UI から publish/unpublish/delete/pull を通し、リモート（bare）の中身と機械 A の作業ツリーの両方で結果を確認している。US-03 で執筆内容の保全（diverged の見送り・localAhead が見送りにならない・削除が戻らない）まで押さえている。

### 足りない点
- R1（同一プロセス内の複数インスタンスによる基点の消失）を再現するテストが無い。
- R2（`remove` とリモート先行）の振る舞いが未定義。
- `GitHubConnectionError` の `notFound` / `api`、`toRepoPath` のルート外拒否、`refreshRemote` の失敗戻り値（192 行）が未検証。
- `applyWritten` の正しさ（反映後に再読み無しで `remoteState` が新しい版を答える）は 2 度目の `reflect` が通ることで間接的にしか見ていない。`existsInRemote`/`diffFromRemote` の即時反映を明示的に見ると、`version` の更新漏れを直接捕まえられる。
- 受け入れテストは `commitCountInOrigin() === before + 1`（US-01 s5）で「一度の反映」を確認しているが、`unpublish` 側（記事＋画像の GC 除去）が何コミットになるかは見ていない。`syncImagePublicationState` は画像ごとに `means.remove` を呼ぶので、GitHub 手段では画像 1 枚につき 1 コミット増える（`imagePublicationSyncer.js` 44, 60 行）。git 手段でも同じ回数 push が起きるので退行ではないが、「一度の反映でまとめる」思想と非公開側の実態のずれは記録しておくべき。

## 7. 推奨する対応（優先順）

1. **R1**: `syncBase.save()` を「書く直前に再読込して差分適用」にする（`advance`/`forget` の履歴を保持し、保存時にファイルへ合成）。あわせて基点が無い場合の脱出路（明示的な上書き公開、または取り込みで「リモートを採用」）を検討する。
2. **R2**: `remove` にも `reflect` と同じ「リモートが基点と違えば拒む」検査を入れるか、入れない理由をコメントとテストで固定する。
3. **5-1 / 5-3 / 5-6**: メッセージ定数化、git 手段の `createGitLineageOf` を `judge` に寄せる、editor 側に設定つき解決の関数を 1 つ置く。
4. **R3**: `handlePublish` の 'unknown' 文言から git 固有の助言を外し、`remoteState` の例外メッセージを伝える。
5. **可読性**: `createGitHubPublicationMeans` の組み立て手順を末尾にまとめる／`known` の改名／二系統の「進んでいる」検出にコメントを付ける。`RemoteState` の JSDoc に「手段によっては読みで基点を揃える副作用を持つ」旨を書くか、副作用を `lineageOf` 側だけに限定する。
6. **R4 / R5 / R6**: rate limit の kind 追加、`toRepoPath` の相対 `..` 検査、初回接触の書き込みの束ね。
