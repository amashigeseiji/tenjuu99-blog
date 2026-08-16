import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'
import { createFakeGitHub, setupBareRemote } from './fixtures/fakeGitHub.js'

/** ファイルを（必要なら親ディレクトリごと）書く */
function writeFile(root, relPath, content) {
  const abs = nodePath.join(root, relPath)
  mkdirSync(nodePath.dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

/**
 * 共有リモート（bare）＋ git 運用のマシン A（clone）＋ git の無いマシン B（GitHub公開手段）を用意する。
 * B のコンテンツルートは空のフォルダ（clone 済み相当の中身は seed で置く）。
 */
async function setupMeans({ seed = {} } = {}) {
  const { createGitHubConnection } = await import('../../lib/publishing/gitHubConnection.js')
  const { createGitHubPublicationMeans } = await import('../../lib/publishing/gitHubPublicationMeans.js')
  const { createSyncBase, defaultSyncBaseLocation } = await import('../../lib/publishing/syncBase.js')
  const remote = setupBareRemote()
  const machineA = remote.clone('machineA')
  for (const [rel, content] of Object.entries(seed)) writeFile(machineA, rel, content)
  if (Object.keys(seed).length > 0) {
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    remote.git(machineA, 'push', '-q')
  }
  const rootB = remote.contentRoot('machineB')
  for (const [rel, content] of Object.entries(seed)) writeFile(rootB, rel, content)
  const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r', token: 'tok' })
  const connection = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'main', credentialProvider: async () => ({ token: 'tok' }), fetch: gh.fetch })
  const syncBase = createSyncBase({ location: defaultSyncBaseLocation(rootB) })
  const means = await createGitHubPublicationMeans({ cwd: rootB, connection, syncBase })
  const pullA = () => remote.git(machineA, 'pull', '-q', '--ff-only')
  const pushA = (files) => {
    for (const [rel, content] of Object.entries(files)) writeFile(machineA, rel, content)
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    remote.git(machineA, 'push', '-q')
  }
  const remoteCount = () => Number(remote.git(remote.bareDir, 'rev-list', '--count', 'main').trim())
  return { remote, machineA, rootB, gh, connection, syncBase, means, pullA, pushA, remoteCount, createMeans: () => createGitHubPublicationMeans({ cwd: rootB, connection, syncBase }) }
}

// ツリー全体は plans/gitless-publication-means/test-tree.md を参照。
// root と行為層（作成者 は…できる）は受け入れテスト tests/acceptance/gitless-publication-means.spec.ts が担う。
// ここには能力層（装置主語）のノードだけを、行為層ごとの並びで置く。

// ── 行為層: 作成者 は git の無い環境で、記事と参照画像を公開・更新・非公開にできる ──

describe('GitHub公開手段は記事と画像（バイナリを含む）を一度の反映でまとめてリモートに届けられる', () => {
  it('記事と参照画像を一度の反映で届け、リモートには一つの版だけが増える', async () => {
    const { means, rootB, machineA, pullA, remoteCount } = await setupMeans()
    const before = remoteCount()
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    writeFile(rootB, 'src/pages/post/hello.md', '# hello\n![a](/image/post/a.png)\n')
    writeFile(rootB, 'src/image/post/a.png', png)
    const result = await means.reflect(['src/pages/post/hello.md', 'src/image/post/a.png'])
    assert.deepStrictEqual(result, { success: true })
    assert.strictEqual(remoteCount(), before + 1, '一度の反映＝一つの版')
    pullA()
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/post/hello.md'), 'utf-8'), '# hello\n![a](/image/post/a.png)\n')
    assert.ok(readFileSync(nodePath.join(machineA, 'src/image/post/a.png')).equals(png), '画像がバイナリのまま届く')
  })
  it('内容が変わっていないファイルだけなら、何も届けずに成功とみなす（空の版を作らない）', async () => {
    const { means, remoteCount } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    const before = remoteCount()
    assert.deepStrictEqual(await means.reflect(['src/pages/a.md']), { success: true })
    assert.strictEqual(remoteCount(), before)
  })
  it('公開物として原稿を申告する（ビルドはリモート側のデプロイに委ねる）', async () => {
    const { means } = await setupMeans()
    assert.strictEqual(means.deliverable, 'manuscript')
  })
})

describe('GitHub公開手段は反映しようとするファイルについてリモートが進んでいたら反映を拒み、先に取り込みが要ることを伝えられる', () => {
  it('揃えたあとに別のマシンで更新された記事を、古い手元の内容で公開しようとすると拒み、先に取り込むよう伝える。リモートは変わらない', async () => {
    const { means, rootB, pushA, machineA, pullA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/a.md': 'a by A\n' })
    writeFile(rootB, 'src/pages/a.md', 'a by B\n')
    await means.refreshRemote()
    const result = await means.reflect(['src/pages/a.md'])
    assert.strictEqual(result.success, false)
    assert.match(result.error, /取り込/)
    assert.doesNotMatch(result.error, /push|commit|fast.forward/i, 'git の言葉を出さない')
    pullA()
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/a.md'), 'utf-8'), 'a by A\n', 'A の公開は上書きされていない')
  })
  it('揃えたことのないファイルにリモート側で違う内容があるときも拒む（知らないうちに上書きしない）', async () => {
    const { means, rootB, syncBase, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/x.md': 'x by A\n' })
    writeFile(rootB, 'src/pages/x.md', 'x by B\n')
    await means.refreshRemote()
    assert.strictEqual(syncBase.get('src/pages/x.md'), null)
    const result = await means.reflect(['src/pages/x.md'])
    assert.strictEqual(result.success, false)
    assert.match(result.error, /取り込/)
  })
  it('別のマシンの公開が別のファイルなら、上書きは起きないので反映は通る（次の取り込みでそのファイルが来る）', async () => {
    const { means, rootB, pushA, machineA, pullA, remoteCount } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/from-a.md': 'A\n' })
    writeFile(rootB, 'src/pages/from-b.md', 'B\n')
    await means.refreshRemote()
    const before = remoteCount()
    assert.deepStrictEqual(await means.reflect(['src/pages/from-b.md']), { success: true })
    assert.strictEqual(remoteCount(), before + 1)
    pullA()
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/from-a.md'), 'utf-8'), 'A\n')
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/from-b.md'), 'utf-8'), 'B\n')
  })
  it('取り込んで揃えたあとなら、同じファイルの反映が通る', async () => {
    const { pull } = await import('../../lib/publishing/pull.js')
    const { means, rootB, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n', 'src/image/a.png': Buffer.from([1]) } })
    pushA({ 'src/image/a.png': Buffer.from([2]) })
    await means.refreshRemote()
    // 手元では記事だけ直した。参照画像は手元のまま（＝リモートで更新された古い版）なので、記事＋画像の反映は拒まれる
    writeFile(rootB, 'src/pages/a.md', 'a2\n')
    assert.strictEqual((await means.reflect(['src/pages/a.md', 'src/image/a.png'])).success, false)
    const pulled = await pull(means, { scope: 'src/' })
    assert.deepStrictEqual(pulled.applied, ['src/image/a.png'])
    assert.deepStrictEqual(pulled.skipped, [])
    assert.deepStrictEqual(await means.reflect(['src/pages/a.md', 'src/image/a.png']), { success: true })
  })
})

describe('GitHub公開手段は git 運用の反映と見分けのつかない形（履歴が一本につながり、内容が同じ）でリモートを更新できる', () => {
  it('反映後のリモートの内容一式は、git 運用のマシンが同じ内容を反映したときと同一になる', async () => {
    const { means, rootB, remote, machineA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 7, 7, 7])
    writeFile(rootB, 'src/pages/b.md', 'b\n')
    writeFile(rootB, 'src/image/b.png', png)
    assert.deepStrictEqual(await means.reflect(['src/pages/b.md', 'src/image/b.png']), { success: true })
    // 同じ親の上に、git 運用のマシンが同じ内容をコミットしたときの内容一式の識別と比べる
    writeFile(machineA, 'src/pages/b.md', 'b\n')
    writeFile(machineA, 'src/image/b.png', png)
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    const gitTree = remote.git(machineA, 'rev-parse', 'HEAD^{tree}').trim()
    const remoteTree = remote.git(remote.bareDir, 'rev-parse', 'main^{tree}').trim()
    assert.strictEqual(remoteTree, gitTree)
  })
  it('二度反映しても履歴は一本につながり、git 運用のマシンは早送りだけで追いつける', async () => {
    const { means, rootB, remote, machineA, pullA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    writeFile(rootB, 'src/pages/a.md', 'a2\n')
    assert.deepStrictEqual(await means.reflect(['src/pages/a.md']), { success: true })
    writeFile(rootB, 'src/pages/a.md', 'a3\n')
    assert.deepStrictEqual(await means.reflect(['src/pages/a.md']), { success: true })
    pullA()
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/a.md'), 'utf-8'), 'a3\n')
    assert.strictEqual(remote.git(machineA, 'log', '--merges', '--oneline').trim(), '', 'マージコミットが無い')
    assert.strictEqual(remote.git(machineA, 'status', '--porcelain').trim(), '', '取り込み後の作業ツリーが綺麗（内容が同じ）')
    // 続けて git 運用のマシンが公開できる（退行なし）
    writeFile(machineA, 'src/pages/c.md', 'c\n')
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    remote.git(machineA, 'push', '-q')
  })
})

describe('GitHub公開手段はリモートからファイルを取り除け、手元の原稿には触れない', () => {
  it('取り除くとリモートから無くなり、手元の原稿はそのまま残る', async () => {
    const { means, rootB, machineA, pullA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n', 'src/image/a.png': Buffer.from([1, 2, 3]) } })
    assert.deepStrictEqual(await means.remove(['src/pages/a.md', 'src/image/a.png']), { success: true })
    pullA()
    assert.ok(!existsSync(nodePath.join(machineA, 'src/pages/a.md')))
    assert.ok(!existsSync(nodePath.join(machineA, 'src/image/a.png')))
    assert.strictEqual(readFileSync(nodePath.join(rootB, 'src/pages/a.md'), 'utf-8'), 'a\n', '手元の原稿は残る')
    assert.strictEqual(await means.remoteState.existsInRemote('src/pages/a.md'), false)
  })
  it('コンテンツルート内の絶対パスで指定されても、リモート上の同じファイルとして取り除ける（git 手段と同じ寛容さ）', async () => {
    const { means, rootB } = await setupMeans({ seed: { 'src/image/a.png': Buffer.from([1, 2, 3]) } })
    assert.deepStrictEqual(await means.remove([nodePath.join(rootB, 'src/image/a.png')]), { success: true })
    assert.strictEqual(await means.remoteState.existsInRemote('src/image/a.png'), false)
    assert.strictEqual(await means.remoteState.existsInRemote(nodePath.join(rootB, 'src/image/a.png')), false)
  })
  it('揃えたあとに別のマシンで更新されたファイルは、取り除かず「先に取り込み」を伝える（他マシンの更新を黙って消さない）', async () => {
    const { means, pushA, machineA, pullA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/a.md': 'a by A\n' })
    await means.refreshRemote()
    const result = await means.remove(['src/pages/a.md'])
    assert.strictEqual(result.success, false)
    assert.match(result.error, /取り込/)
    pullA()
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/a.md'), 'utf-8'), 'a by A\n', 'リモートは変わっていない')
    // 取り込んで揃えれば取り除ける
    const { pull } = await import('../../lib/publishing/pull.js')
    assert.deepStrictEqual((await pull(means, { scope: 'src/' })).applied, ['src/pages/a.md'])
    assert.deepStrictEqual(await means.remove(['src/pages/a.md']), { success: true })
  })
  it('コンテンツルートの外を指す指定（相対の .. を含む）は拒む', async () => {
    const { means, rootB } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    await assert.rejects(() => means.remoteState.existsInRemote('../outside.md'), /コンテンツルートの外/)
    await assert.rejects(() => means.remoteState.existsInRemote(nodePath.join(rootB, '..', 'outside.md')), /コンテンツルートの外/)
    assert.strictEqual((await means.remove(['src/../../x.md'])).success, false)
  })
  it('リモートに無いものを取り除こうとしても、何もせず成功とみなす', async () => {
    const { means, remoteCount } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    const before = remoteCount()
    assert.deepStrictEqual(await means.remove(['src/pages/nope.md']), { success: true })
    assert.strictEqual(remoteCount(), before)
  })
})

// ★共有: 届ける向き（反映・除去）と取り込む向きの両方から使われる
describe('GitHub公開手段は反映・除去・取り込みが済んだファイルの同期の基点を進められる（除去なら消す）', () => {
  it('反映が済んだファイルの基点は届けた内容になり、除去が済めば消える', async () => {
    const { compute } = await import('../../lib/publishing/fingerprint.js')
    const { means, rootB, syncBase } = await setupMeans()
    writeFile(rootB, 'src/pages/a.md', 'a\n')
    assert.strictEqual(syncBase.get('src/pages/a.md'), null)
    await means.reflect(['src/pages/a.md'])
    assert.strictEqual(syncBase.get('src/pages/a.md'), compute(Buffer.from('a\n')))
    await means.remove(['src/pages/a.md'])
    assert.strictEqual(syncBase.get('src/pages/a.md'), null)
  })
  it('取り込みが済んだファイルの基点は取り込んだリモートの内容になる', async () => {
    const { compute } = await import('../../lib/publishing/fingerprint.js')
    const { means, syncBase, pushA } = await setupMeans()
    pushA({ 'src/pages/x.md': 'x\n' })
    await means.refreshRemote()
    assert.deepStrictEqual(await means.takeFromRemote(['src/pages/x.md']), { success: true })
    assert.strictEqual(syncBase.get('src/pages/x.md'), compute(Buffer.from('x\n')))
  })
  it('反映が拒まれたときは基点を進めない', async () => {
    const { compute } = await import('../../lib/publishing/fingerprint.js')
    const { means, rootB, syncBase, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/a.md': 'a by A\n' })
    writeFile(rootB, 'src/pages/a.md', 'a by B\n')
    await means.refreshRemote()
    assert.strictEqual((await means.reflect(['src/pages/a.md'])).success, false)
    assert.strictEqual(syncBase.get('src/pages/a.md'), compute(Buffer.from('a\n')), '揃えた時点のまま')
  })
  it('手元とリモートが同じ内容だと分かったファイルは、基点が無くてもその内容で揃えられる（clone 済み相当のフォルダの初期状態）', async () => {
    const { compute } = await import('../../lib/publishing/fingerprint.js')
    const { means, syncBase } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n', 'src/image/a.png': Buffer.from([1, 2]) } })
    // 初回接触: 基点の記録がまったく無いフォルダでは、同じ内容のファイルすべてを組み立て時に揃える
    assert.strictEqual(syncBase.get('src/pages/a.md'), compute(Buffer.from('a\n')))
    assert.strictEqual(syncBase.get('src/image/a.png'), compute(Buffer.from([1, 2])))
    // 以降: 読みの過程で同じと分かった時点で個別に揃える
    syncBase.forget('src/pages/a.md')
    assert.strictEqual(await means.remoteState.diffFromRemote('src/pages/a.md'), '')
    assert.strictEqual(syncBase.get('src/pages/a.md'), compute(Buffer.from('a\n')))
  })
})

// ★共有: GitHub公開手段のすべての読み書きが通る口
describe('GitHub接続は認証情報を添えて、リモートの現在の版とそこに含まれるファイル一覧・内容を読め、新しい版を書き込める', () => {
  it('git 運用のマシンが公開した記事と画像を、現在の版のファイル一覧（指紋つき）と内容として読める', async () => {
    const { createGitHubConnection } = await import('../../lib/publishing/gitHubConnection.js')
    const { compute } = await import('../../lib/publishing/fingerprint.js')
    const remote = setupBareRemote()
    const machineA = remote.clone('machineA')
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3])
    writeFile(machineA, 'src/pages/post/hello.md', '# hello\n')
    writeFile(machineA, 'src/image/post/a.png', png)
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    remote.git(machineA, 'push', '-q')

    const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r', token: 'tok' })
    const conn = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'main', credentialProvider: async () => ({ token: 'tok' }), fetch: gh.fetch })
    const version = await conn.readCurrentVersion()
    assert.strictEqual(version.id, remote.git(machineA, 'rev-parse', 'HEAD').trim())
    assert.deepStrictEqual([...version.files.keys()].sort(), ['src/image/post/a.png', 'src/pages/post/hello.md'])
    assert.strictEqual(version.files.get('src/pages/post/hello.md').fingerprint, compute(Buffer.from('# hello\n')))
    assert.strictEqual(version.files.get('src/image/post/a.png').fingerprint, compute(png))
    assert.strictEqual((await conn.readContent(version.files.get('src/pages/post/hello.md').fingerprint)).toString(), '# hello\n')
    assert.ok((await conn.readContent(version.files.get('src/image/post/a.png').fingerprint)).equals(png), 'バイナリが壊れず読める')
  })
  it('追加・更新・削除をまとめた新しい版を書き込むと、git 運用のマシンがそのまま取り込める', async () => {
    const { createGitHubConnection } = await import('../../lib/publishing/gitHubConnection.js')
    const remote = setupBareRemote()
    const machineA = remote.clone('machineA')
    writeFile(machineA, 'src/pages/old.md', 'old\n')
    writeFile(machineA, 'src/pages/keep.md', 'keep\n')
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    remote.git(machineA, 'push', '-q')

    const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r' })
    const conn = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'main', credentialProvider: async () => ({ token: 'x' }), fetch: gh.fetch })
    const base = await conn.readCurrentVersion()
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9])
    const next = await conn.writeVersion({
      base,
      changes: [
        { path: 'src/pages/new.md', content: Buffer.from('new\n') },
        { path: 'src/image/x.png', content: png },
        { path: 'src/pages/keep.md', content: Buffer.from('kept but changed\n') },
        { path: 'src/pages/old.md', content: null },
      ],
      message: 'publish',
    })
    assert.ok(next.id && next.id !== base.id)
    remote.git(machineA, 'pull', '-q', '--ff-only')
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/new.md'), 'utf-8'), 'new\n')
    assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/keep.md'), 'utf-8'), 'kept but changed\n')
    assert.ok(readFileSync(nodePath.join(machineA, 'src/image/x.png')).equals(png))
    assert.ok(!existsSync(nodePath.join(machineA, 'src/pages/old.md')), '削除がリモートに届いている')
    const reread = await conn.readCurrentVersion()
    assert.strictEqual(reread.id, next.id)
    assert.deepStrictEqual([...reread.files.keys()].sort(), ['src/image/x.png', 'src/pages/keep.md', 'src/pages/new.md'])
  })
  it('知っている版よりリモートが進んでいたら、書き込みを拒んでその旨を返す（黙って上書きしない）', async () => {
    const { createGitHubConnection, GitHubConnectionError } = await import('../../lib/publishing/gitHubConnection.js')
    const remote = setupBareRemote()
    const machineA = remote.clone('machineA')
    const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r' })
    const conn = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'main', credentialProvider: async () => ({ token: 'x' }), fetch: gh.fetch })
    const base = await conn.readCurrentVersion()
    writeFile(machineA, 'src/pages/a.md', 'from A\n')
    remote.git(machineA, 'add', '.')
    remote.git(machineA, 'commit', '-q', '-m', 'publish')
    remote.git(machineA, 'push', '-q')
    await assert.rejects(
      () => conn.writeVersion({ base, changes: [{ path: 'src/pages/b.md', content: Buffer.from('from B\n') }], message: 'publish' }),
      (e) => e instanceof GitHubConnectionError && e.kind === 'remoteAdvanced'
    )
    remote.git(machineA, 'pull', '-q', '--ff-only')
    assert.ok(!existsSync(nodePath.join(machineA, 'src/pages/b.md')), 'リモートは書き換わっていない')
  })

  describe('GitHub接続は届かないとき（認証情報が無い・通らない・不通）に沈黙せず誤りを返せる', () => {
    it('認証情報が無いときは、リモートへ行かずに「無い」と分かる誤りを返す', async () => {
      const { createGitHubConnection, GitHubConnectionError } = await import('../../lib/publishing/gitHubConnection.js')
      const remote = setupBareRemote()
      remote.clone('machineA')
      const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r', token: 'tok' })
      const conn = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'main', credentialProvider: async () => null, fetch: gh.fetch })
      await assert.rejects(() => conn.readCurrentVersion(), (e) => e instanceof GitHubConnectionError && e.kind === 'noCredential' && /認証情報/.test(e.message))
      assert.strictEqual(gh.calls.length, 0)
    })
    it('認証情報が通らないときは「通らない」と分かる誤りを返す', async () => {
      const { createGitHubConnection, GitHubConnectionError } = await import('../../lib/publishing/gitHubConnection.js')
      const remote = setupBareRemote()
      remote.clone('machineA')
      const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r', token: 'tok' })
      const conn = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'main', credentialProvider: async () => ({ token: 'wrong' }), fetch: gh.fetch })
      await assert.rejects(() => conn.readCurrentVersion(), (e) => e instanceof GitHubConnectionError && e.kind === 'unauthorized')
    })
    it('利用回数の上限（rate limit）は認証情報の誤りと区別して伝える', async () => {
      const { createGitHubConnection, GitHubConnectionError } = await import('../../lib/publishing/gitHubConnection.js')
      const conn = createGitHubConnection({
        owner: 'o', repo: 'r', credentialProvider: async () => ({ token: 'tok' }),
        fetch: async () => new Response(JSON.stringify({ message: 'API rate limit exceeded for user' }), { status: 403 }),
      })
      await assert.rejects(() => conn.readCurrentVersion(), (e) => e instanceof GitHubConnectionError && e.kind === 'rateLimited' && /上限/.test(e.message))
    })
    it('リモート（所有者・リポジトリ・ブランチ）が見つからないときは「見つからない」と分かる誤りを返す', async () => {
      const { createGitHubConnection, GitHubConnectionError } = await import('../../lib/publishing/gitHubConnection.js')
      const remote = setupBareRemote()
      remote.clone('machineA')
      const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r' })
      const conn = createGitHubConnection({ owner: 'o', repo: 'r', branch: 'no-such-branch', credentialProvider: async () => ({ token: 'x' }), fetch: gh.fetch })
      await assert.rejects(() => conn.readCurrentVersion(), (e) => e instanceof GitHubConnectionError && e.kind === 'notFound' && /no-such-branch/.test(e.message))
    })
    it('不通のときは「届かない」と分かる誤りを返す', async () => {
      const { createGitHubConnection, GitHubConnectionError } = await import('../../lib/publishing/gitHubConnection.js')
      const conn = createGitHubConnection({
        owner: 'o', repo: 'r', branch: 'main',
        credentialProvider: async () => ({ token: 'tok' }),
        fetch: async () => { throw new TypeError('fetch failed') },
      })
      await assert.rejects(() => conn.readCurrentVersion(), (e) => e instanceof GitHubConnectionError && e.kind === 'unreachable')
    })
  })

  describe('認証情報は手元だけの置き場所から読み出せ、無ければ無いと分かる', () => {
    it('置き場所に手段名で区切って置かれた認証情報を読み出せる', async () => {
      const { readCredential } = await import('../../lib/publishing/credential.js')
      const dir = mkdtempSync(nodePath.join(tmpdir(), 'cred-'))
      const location = nodePath.join(dir, 'credentials.json')
      writeFileSync(location, JSON.stringify({ github: { token: 'ghp_test' } }))
      assert.deepStrictEqual(readCredential(location, 'github'), { token: 'ghp_test' })
    })
    it('置き場所が無い・その手段の項目が無いときは null（無い）と分かる', async () => {
      const { readCredential } = await import('../../lib/publishing/credential.js')
      const dir = mkdtempSync(nodePath.join(tmpdir(), 'cred-'))
      assert.strictEqual(readCredential(nodePath.join(dir, 'missing.json'), 'github'), null)
      const location = nodePath.join(dir, 'credentials.json')
      writeFileSync(location, JSON.stringify({ ftp: { user: 'x' } }))
      assert.strictEqual(readCredential(location, 'github'), null)
    })
    it('認証情報提供者は、呼ばれるたびに置き場所からいま有効な値を返す（置き直しが次の呼び出しに反映される）', async () => {
      const { createCredentialProvider, defaultCredentialLocation } = await import('../../lib/publishing/credential.js')
      const root = mkdtempSync(nodePath.join(tmpdir(), 'cred-'))
      const location = defaultCredentialLocation(root)
      assert.ok(location.startsWith(root), '既定の置き場所はコンテンツルートの中')
      const provider = createCredentialProvider({ location, means: 'github' })
      assert.strictEqual(await provider(), null)
      mkdirSync(nodePath.dirname(location), { recursive: true })
      writeFileSync(location, JSON.stringify({ github: { token: 't1' } }))
      assert.deepStrictEqual(await provider(), { token: 't1' })
      writeFileSync(location, JSON.stringify({ github: { token: 't2' } }))
      assert.deepStrictEqual(await provider(), { token: 't2' })
    })
  })
})

// ── 行為層: 作成者 は git の無い環境で、記事と画像の公開ステータスを git 手段と同じ意味で読める ──

describe('GitHub公開手段はリモートのファイル一覧・存在・手元との差分の有無を示せる', () => {
  it('一覧・存在・差分の有無を、記事にも画像にも同じ確かさで示す', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 5])
    const { means, rootB } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n', 'src/image/a.png': png } })
    assert.deepStrictEqual((await means.remoteState.listRemoteFiles()).sort(), ['src/image/a.png', 'src/pages/a.md'])
    assert.strictEqual(await means.remoteState.existsInRemote('src/pages/a.md'), true)
    assert.strictEqual(await means.remoteState.existsInRemote('src/pages/nope.md'), false)
    assert.strictEqual(await means.remoteState.diffFromRemote('src/pages/a.md'), '')
    assert.strictEqual(await means.remoteState.diffFromRemote('src/image/a.png'), '')
    writeFile(rootB, 'src/pages/a.md', 'a edited\n')
    writeFile(rootB, 'src/image/a.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 6]))
    assert.strictEqual(await means.remoteState.diffFromRemote('src/pages/a.md'), 'modified')
    assert.strictEqual(await means.remoteState.diffFromRemote('src/image/a.png'), 'modified')
  })
  it('公開ステータス判定器を通すと git 手段と同じ読み（new / modified / published）になる', async () => {
    const { getPublicationStatus } = await import('../../packages/editor/server/publicationStatus.js')
    const { means, rootB } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    assert.strictEqual(await getPublicationStatus('src/pages/a.md', means.remoteState), 'published')
    writeFile(rootB, 'src/pages/a.md', 'a2\n')
    assert.strictEqual(await getPublicationStatus('src/pages/a.md', means.remoteState), 'modified')
    writeFile(rootB, 'src/pages/b.md', 'b\n')
    assert.strictEqual(await getPublicationStatus('src/pages/b.md', means.remoteState), 'new')
  })
  it('接続が届かないときは参照不能（例外）として示し、判定器を通すと unknown、反映は失敗として伝わる', async () => {
    const { createGitHubConnection } = await import('../../lib/publishing/gitHubConnection.js')
    const { createGitHubPublicationMeans } = await import('../../lib/publishing/gitHubPublicationMeans.js')
    const { createSyncBase } = await import('../../lib/publishing/syncBase.js')
    const { getPublicationStatus } = await import('../../packages/editor/server/publicationStatus.js')
    const root = mkdtempSync(nodePath.join(tmpdir(), 'gh-'))
    const connection = createGitHubConnection({ owner: 'o', repo: 'r', credentialProvider: async () => null, fetch: async () => { throw new Error('unexpected') } })
    const means = await createGitHubPublicationMeans({ cwd: root, connection, syncBase: createSyncBase({ location: nodePath.join(root, '.blog/sync-base.json') }) })
    await assert.rejects(() => means.remoteState.existsInRemote('src/pages/a.md'), /認証情報/)
    assert.strictEqual(await getPublicationStatus('src/pages/a.md', means.remoteState), 'unknown')
    writeFile(root, 'src/pages/a.md', 'a\n')
    const result = await means.reflect(['src/pages/a.md'])
    assert.strictEqual(result.success, false)
    assert.match(result.error, /認証情報/)
  })

  describe('フィンガープリントは手元のファイル内容（テキスト・バイナリ）から、リモート側の同じ内容の識別と一致する指紋を計算できる', () => {
    it('テキストの指紋は、git 運用のリモートが同じ内容に与える識別と一致する', async () => {
      const { compute } = await import('../../lib/publishing/fingerprint.js')
      const content = Buffer.from('# こんにちは\n本文\n')
      const expected = execFileSync('git', ['hash-object', '--stdin'], { input: content, encoding: 'utf-8' }).trim()
      assert.strictEqual(compute(content), expected)
    })
    it('バイナリ（画像）でも同じ内容なら同じ指紋、内容が変われば別の指紋になる', async () => {
      const { compute } = await import('../../lib/publishing/fingerprint.js')
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x10])
      const expected = execFileSync('git', ['hash-object', '--stdin'], { input: png, encoding: 'utf-8' }).trim()
      assert.strictEqual(compute(png), expected)
      assert.strictEqual(compute(Buffer.from(png)), compute(png))
      assert.notStrictEqual(compute(Buffer.from([...png, 0x01])), compute(png))
    })
  })
})

describe('GitHub公開手段はリモートの知識を最新にできる', () => {
  it('組み立てたあとに他所で公開されたものは、知識を最新にすると見えるようになる', async () => {
    const { means, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/from-a.md': 'A\n' })
    assert.strictEqual(await means.remoteState.existsInRemote('src/pages/from-a.md'), false, '構築時の知識のまま')
    assert.deepStrictEqual(await means.refreshRemote(), { success: true })
    assert.strictEqual(await means.remoteState.existsInRemote('src/pages/from-a.md'), true)
    assert.ok((await means.remoteState.listRemoteFiles()).includes('src/pages/from-a.md'))
  })
})

// ── 行為層: 作成者 は git の無い環境で、執筆内容を失わずにリモートの記事と画像を取り込める ──

describe('GitHub公開手段はリモートの内容（バイナリを含む）を手元に書き出せる', () => {
  it('リモートの記事と画像を、無かったディレクトリごと手元に書き出す', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 42])
    const { means, rootB, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    pushA({ 'src/pages/post/new.md': 'new\n', 'src/image/post/new.png': png })
    await means.refreshRemote()
    assert.deepStrictEqual(await means.takeFromRemote(['src/pages/post/new.md', 'src/image/post/new.png']), { success: true })
    assert.strictEqual(readFileSync(nodePath.join(rootB, 'src/pages/post/new.md'), 'utf-8'), 'new\n')
    assert.ok(readFileSync(nodePath.join(rootB, 'src/image/post/new.png')).equals(png))
  })
  it('リモートに無いものを書き出そうとすると失敗として伝える', async () => {
    const { means } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    const result = await means.takeFromRemote(['src/pages/nope.md'])
    assert.strictEqual(result.success, false)
  })
})

describe('GitHub公開手段は同期の基点を用いてファイルごとの版の連なりを示せる', () => {
  it('手元で編集しただけの記事は「先行」であり、取り込みで見送りにならない（基点が両側で変わったと誤認させない）', async () => {
    const { pull } = await import('../../lib/publishing/pull.js')
    const { means, rootB, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n', 'src/pages/b.md': 'b\n' } })
    // サイドバーの読みで基点が揃う（初期状態）
    await means.remoteState.diffFromRemote('src/pages/a.md')
    writeFile(rootB, 'src/pages/a.md', 'a edited locally\n')
    pushA({ 'src/pages/b.md': 'b edited remotely\n' })
    await means.refreshRemote()
    assert.strictEqual(await means.lineageOf('src/pages/a.md'), 'localAhead')
    assert.strictEqual(await means.lineageOf('src/pages/b.md'), 'remoteAhead')
    const result = await pull(means, { scope: 'src/' })
    assert.deepStrictEqual(result.applied, ['src/pages/b.md'])
    assert.deepStrictEqual(result.skipped, [])
    assert.strictEqual(readFileSync(nodePath.join(rootB, 'src/pages/a.md'), 'utf-8'), 'a edited locally\n', '執筆内容は失われない')
    assert.strictEqual(readFileSync(nodePath.join(rootB, 'src/pages/b.md'), 'utf-8'), 'b edited remotely\n')
  })
  it('両側で変わった記事は「分岐」、揃えたあとに手元で消した記事は「消された」、他所で作られた記事は「他所で作られた」', async () => {
    const { means, rootB, pushA } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n', 'src/pages/gone.md': 'gone\n' } })
    await means.remoteState.diffFromRemote('src/pages/a.md')
    await means.remoteState.diffFromRemote('src/pages/gone.md')
    writeFile(rootB, 'src/pages/a.md', 'a by B\n')
    rmSync(nodePath.join(rootB, 'src/pages/gone.md'))
    pushA({ 'src/pages/a.md': 'a by A\n', 'src/pages/new.md': 'new\n' })
    await means.refreshRemote()
    assert.strictEqual(await means.lineageOf('src/pages/a.md'), 'diverged')
    assert.strictEqual(await means.lineageOf('src/pages/gone.md'), 'deletedLocally')
    assert.strictEqual(await means.lineageOf('src/pages/new.md'), 'remoteOnly')
    writeFile(rootB, 'src/pages/only-b.md', 'only\n')
    assert.strictEqual(await means.lineageOf('src/pages/only-b.md'), 'localOnly')
  })
  it('基点はプロセスをまたいで効く: 反映したマシンで組み立て直しても、その後の手元編集は「先行」のまま', async () => {
    const { means, rootB, createMeans } = await setupMeans({ seed: { 'src/pages/a.md': 'a\n' } })
    writeFile(rootB, 'src/pages/a.md', 'a2\n')
    await means.reflect(['src/pages/a.md'])
    const reopened = await createMeans()
    writeFile(rootB, 'src/pages/a.md', 'a3\n')
    assert.strictEqual(await reopened.lineageOf('src/pages/a.md'), 'localAhead')
  })

  describe('版の連なりは手元・リモート・基点の三者の内容の同異から、先行・後行・分岐・手元に無い事情（消された・他所で作られた）を判定できる', () => {
    it('三者の指紋の同異から先行・後行・分岐・同一を判定する', async () => {
      const { judge } = await import('../../lib/publishing/versionLineage.js')
      assert.strictEqual(judge({ local: 'a', remote: 'a', base: 'a' }), 'same')
      assert.strictEqual(judge({ local: 'b', remote: 'a', base: 'a' }), 'localAhead', '手元だけ変わった')
      assert.strictEqual(judge({ local: 'a', remote: 'b', base: 'a' }), 'remoteAhead', 'リモートだけ変わった')
      assert.strictEqual(judge({ local: 'b', remote: 'c', base: 'a' }), 'diverged', '両側で変わった')
      assert.strictEqual(judge({ local: 'a', remote: 'a', base: null }), 'same', '基点が無くても同じなら同じ')
      assert.strictEqual(judge({ local: 'b', remote: 'a', base: null }), 'diverged', '基点が無ければ正直に分岐へ退化')
    })
    it('手元に無い事情を、基点の有無で「消された」と「他所で作られた」に分ける', async () => {
      const { judge } = await import('../../lib/publishing/versionLineage.js')
      assert.strictEqual(judge({ local: null, remote: 'a', base: 'a' }), 'deletedLocally', '揃えたあとに手元で消した')
      assert.strictEqual(judge({ local: null, remote: 'a', base: null }), 'remoteOnly', '揃えたことが無い＝他所で作られた')
      assert.strictEqual(judge({ local: 'a', remote: null, base: null }), 'localOnly')
      assert.strictEqual(judge({ local: 'a', remote: null, base: 'a' }), 'localOnly', 'リモートで消されたものの伝播は本問題では埋めない（git 手段と同じ読み）')
    })
  })

  describe('同期の基点はファイルごとの「揃えた時点の内容」の記録を進め・消し・参照でき、コンテンツルートごとにプロセスをまたいで保てる', () => {
    it('進めた記録を参照でき、消せば無くなる', async () => {
      const { createSyncBase } = await import('../../lib/publishing/syncBase.js')
      const root = mkdtempSync(nodePath.join(tmpdir(), 'base-'))
      const base = createSyncBase({ location: nodePath.join(root, '.blog', 'sync-base.json') })
      assert.strictEqual(base.get('src/pages/a.md'), null)
      base.advance('src/pages/a.md', 'fp1')
      assert.strictEqual(base.get('src/pages/a.md'), 'fp1')
      base.advance('src/pages/a.md', 'fp2')
      assert.strictEqual(base.get('src/pages/a.md'), 'fp2')
      base.forget('src/pages/a.md')
      assert.strictEqual(base.get('src/pages/a.md'), null)
    })
    it('別のプロセス（別のインスタンス）から同じコンテンツルートを開いても記録が残っている', async () => {
      const { createSyncBase, defaultSyncBaseLocation } = await import('../../lib/publishing/syncBase.js')
      const root = mkdtempSync(nodePath.join(tmpdir(), 'base-'))
      const location = defaultSyncBaseLocation(root)
      assert.ok(location.startsWith(root), '既定の置き場所はコンテンツルートの中')
      createSyncBase({ location }).advance('src/image/x.png', 'fpx')
      const reopened = createSyncBase({ location })
      assert.strictEqual(reopened.get('src/image/x.png'), 'fpx')
      assert.strictEqual(createSyncBase({ location: defaultSyncBaseLocation(mkdtempSync(nodePath.join(tmpdir(), 'base-'))) }).get('src/image/x.png'), null, '別のコンテンツルートには漏れない')
    })
  })
})

// ── 行為層: 作成者 は構成で手段を選ぶだけで、git 運用のマシンと同じリモートを共有でき、既存の git 運用は今までどおり続けられる ──

describe('公開手段解決器は構成に指定された手段（GitHub）を、リモートの識別と認証情報の提供者を与えて組み立てられる', () => {
  it('構成の publish.means が github なら、リモートの識別（所有者・リポジトリ・ブランチ）で GitHub公開手段を組み立てる', async () => {
    const { resolvePublicationMeans } = await import('../../lib/publishing/publicationMeansResolver.js')
    const remote = setupBareRemote()
    const machineA = remote.clone('machineA')
    writeFile(machineA, 'src/pages/a.md', 'a\n')
    remote.git(machineA, 'add', '.'); remote.git(machineA, 'commit', '-q', '-m', 'publish'); remote.git(machineA, 'push', '-q')
    const root = remote.contentRoot('machineB')
    const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r', token: 'tok' })
    const means = await resolvePublicationMeans({
      means: 'github', cwd: root,
      github: { owner: 'o', repo: 'r', branch: 'main' },
      credentialProvider: async () => ({ token: 'tok' }),
      fetch: gh.fetch,
    })
    assert.strictEqual(means.deliverable, 'manuscript')
    assert.strictEqual(await means.remoteState.existsInRemote('src/pages/a.md'), true)
  })
  it('認証情報の提供者を与えなければ、コンテンツルート内の手元だけの置き場所から読む提供者を使う', async () => {
    const { resolvePublicationMeans } = await import('../../lib/publishing/publicationMeansResolver.js')
    const { defaultCredentialLocation } = await import('../../lib/publishing/credential.js')
    const remote = setupBareRemote()
    remote.clone('machineA')
    const root = remote.contentRoot('machineB')
    const gh = createFakeGitHub({ bareDir: remote.bareDir, owner: 'o', repo: 'r', token: 'from-file' })
    const withoutFile = await resolvePublicationMeans({ means: 'github', cwd: root, github: { owner: 'o', repo: 'r' }, fetch: gh.fetch })
    await assert.rejects(() => withoutFile.remoteState.listRemoteFiles(), /認証情報/)
    writeFile(root, nodePath.relative(root, defaultCredentialLocation(root)), JSON.stringify({ github: { token: 'from-file' } }))
    const withFile = await resolvePublicationMeans({ means: 'github', cwd: root, github: { owner: 'o', repo: 'r' }, fetch: gh.fetch })
    assert.deepStrictEqual(await withFile.remoteState.listRemoteFiles(), [])
  })
  it('リモートの識別が構成に無ければ、構成の誤りとして拒否する', async () => {
    const { resolvePublicationMeans } = await import('../../lib/publishing/publicationMeansResolver.js')
    await assert.rejects(() => resolvePublicationMeans({ means: 'github', cwd: process.cwd() }), /github/)
  })
  it('手段が未指定なら従来どおり git公開手段（既存の git 運用は変わらない）', async () => {
    const { resolvePublicationMeans } = await import('../../lib/publishing/publicationMeansResolver.js')
    const means = await resolvePublicationMeans({ cwd: process.cwd() })
    assert.strictEqual(means.deliverable, 'manuscript')
    assert.strictEqual(typeof means.lineageOf, 'function')
  })
})
