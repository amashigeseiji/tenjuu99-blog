import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, writeFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'

// ツリー全体は plans/sync-operations/test-tree.md を参照。
// editor コンテキストのノード（非公開にする・削除する・コレクター・可否判定器）は
// tests/editor/sync-operations.test.js にある。

/**
 * インメモリの公開手段。リモートはパス→内容の Map、ローカルは localRoot 配下の実ファイル。
 * 版の連なりを持たないため、両側に存在して内容が異なるものは「分岐」として正直に退化する。
 */
function createInMemoryMeans(remote, localRoot) {
  return {
    remoteState: {
      existsInRemote: async (filePath) => remote.has(filePath),
      diffFromRemote: async (filePath) => {
        const local = nodePath.join(localRoot, filePath)
        if (!remote.has(filePath) || !existsSync(local)) return ''
        return readFileSync(local, 'utf-8') !== remote.get(filePath) ? 'modified' : ''
      },
      listRemoteFiles: async () => [...remote.keys()],
    },
    reflect: async (files) => {
      files.forEach(f => remote.set(f, readFileSync(nodePath.join(localRoot, f), 'utf-8')))
      return { success: true }
    },
    remove: async (files) => {
      files.forEach(f => remote.delete(f))
      return { success: true }
    },
    takeFromRemote: async (files) => {
      files.forEach(f => {
        const dest = nodePath.join(localRoot, f)
        mkdirSync(nodePath.dirname(dest), { recursive: true })
        writeFileSync(dest, remote.get(f))
      })
      return { success: true }
    },
    lineageOf: async (filePath) => {
      const local = nodePath.join(localRoot, filePath)
      const localExists = existsSync(local)
      const remoteExists = remote.has(filePath)
      if (localExists && !remoteExists) return 'localOnly'
      if (!localExists && remoteExists) return 'remoteOnly'
      if (readFileSync(local, 'utf-8') === remote.get(filePath)) return 'same'
      return 'diverged'
    },
    deliverable: 'artifact',
  }
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' })
}

function writeArticle(root, relPath, content) {
  const abs = nodePath.join(root, relPath)
  mkdirSync(nodePath.dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

/**
 * 共有リモート（bare リポジトリ）と1台目のマシン（machineA）を用意する。
 * 追加のマシンは clone() で必要になった時点で作る（その時点のリモート内容を持つ）。
 */
function setupGitPair() {
  const dir = mkdtempSync(nodePath.join(tmpdir(), 'sync-git-'))
  const remoteDir = nodePath.join(dir, 'remote.git')
  git(dir, 'init', '--bare', '-b', 'main', remoteDir)
  const configure = (repo) => {
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'user.name', 'test')
    git(repo, 'config', 'commit.gpgsign', 'false')
  }
  const clone = (name) => {
    const repo = nodePath.join(dir, name)
    git(dir, 'clone', '--quiet', remoteDir, repo)
    configure(repo)
    return repo
  }
  const machineA = clone('machine-a')
  writeFileSync(nodePath.join(machineA, '.gitkeep'), '')
  git(machineA, 'add', '.gitkeep')
  git(machineA, 'commit', '-q', '-m', 'init')
  git(machineA, 'push', '-q', '-u', 'origin', 'main')
  return { machineA, clone }
}

async function meansFor(repo) {
  const { createGitPublicationMeans } = await import('../../lib/publishing/gitPublicationMeans.js')
  return await createGitPublicationMeans(repo)
}

describe('同期はローカルとリモートの内容を、除去と取り込みを含む両向きで揃えられる', () => {
  it('公開 → 非公開 → 削除 → 別マシンの記事の取り込み、の一巡が公開手段の上で成立する', async () => {
    const { handlePublish } = await import('../../packages/editor/server/publish.js')
    const { getPublicationStatus } = await import('../../packages/editor/server/publicationStatus.js')
    const { unpublish } = await import('../../packages/editor/server/changeReflector.js')
    const { deleteArticle } = await import('../../packages/editor/server/deleteArticle.js')
    const { pull } = await import('../../lib/publishing/pull.js')

    const localRoot = mkdtempSync(nodePath.join(tmpdir(), 'sync-root-'))
    const remote = new Map()
    const means = createInMemoryMeans(remote, localRoot)
    const article = 'src/pages/post/hello.md'
    const abs = nodePath.join(localRoot, article)

    // 公開（既存の届ける向き）
    mkdirSync(nodePath.dirname(abs), { recursive: true })
    writeFileSync(abs, '本文')
    const published = await handlePublish({ filePath: 'post/hello.md', fileContent: '本文', srcDir: 'src' }, means)
    assert.deepStrictEqual(published, { success: true })
    assert.strictEqual(await getPublicationStatus(article, means.remoteState), 'published')

    // 非公開にする: リモートから消え、原稿は手元に残る
    const unpublished = await unpublish([article], means)
    assert.deepStrictEqual(unpublished, { success: true })
    assert.strictEqual(remote.has(article), false)
    assert.ok(existsSync(abs), '原稿は手元に残る')
    assert.strictEqual(await getPublicationStatus(article, means.remoteState), 'new')

    // 削除する: 未公開になった記事をローカルから取り除く
    await deleteArticle(abs)
    assert.strictEqual(existsSync(abs), false)

    // 取り込む: 別マシンで公開された記事が手元に現れる
    const other = 'src/pages/post/from-other-machine.md'
    remote.set(other, '別マシンの本文')
    const pulled = await pull(means)
    assert.strictEqual(pulled.success, true)
    assert.deepStrictEqual(pulled.applied, [other])
    assert.strictEqual(readFileSync(nodePath.join(localRoot, other), 'utf-8'), '別マシンの本文')
    assert.strictEqual(await getPublicationStatus(other, means.remoteState), 'published')

    // 削除した記事は取り込みで復活しない（リモートから先に除去されているため候補にならない）
    assert.strictEqual(existsSync(abs), false)
  })

  describe('公開手段は反映に加えて、リモートからの除去・取り込み・版の連なりの参照を提供できる', () => {
    it('git ではないインメモリの公開手段でも、除去・取り込み・版の連なりの参照が同じ形で成立する', async () => {
      const localRoot = mkdtempSync(nodePath.join(tmpdir(), 'means-shape-'))
      const means = createInMemoryMeans(new Map(), localRoot)
      assert.strictEqual(typeof means.remove, 'function')
      assert.strictEqual(typeof means.takeFromRemote, 'function')
      assert.strictEqual(typeof means.lineageOf, 'function')
      assert.strictEqual(typeof means.remoteState.listRemoteFiles, 'function')
    })

    describe('git公開手段は除去・取り込み・版の連なりの参照を実現できる', () => {
      it('除去はリモートから取り除き、手元の原稿を残す', async () => {
        const { machineA } = setupGitPair()
        writeArticle(machineA, 'src/pages/post/a.md', '本文')
        const means = await meansFor(machineA)
        assert.deepStrictEqual(await means.reflect(['src/pages/post/a.md']), { success: true })
        assert.deepStrictEqual(await means.remove(['src/pages/post/a.md']), { success: true })
        assert.ok(existsSync(nodePath.join(machineA, 'src/pages/post/a.md')), '原稿は手元に残る')
        const fresh = await meansFor(machineA)
        assert.strictEqual(await fresh.remoteState.existsInRemote('src/pages/post/a.md'), false)
      })

      it('リモートのファイル一覧を参照できる', async () => {
        const { machineA } = setupGitPair()
        writeArticle(machineA, 'src/pages/post/a.md', '本文')
        const means = await meansFor(machineA)
        await means.reflect(['src/pages/post/a.md'])
        const fresh = await meansFor(machineA)
        const files = await fresh.remoteState.listRemoteFiles()
        assert.ok(files.includes('src/pages/post/a.md'))
      })

      it('リモートの知識の更新後は、更新前に構築した一覧参照でも新しいファイルが見える', async () => {
        const { machineA, clone } = setupGitPair()
        const meansA = await meansFor(machineA) // 別のマシンの公開より前に構築
        const machineB = clone('machine-b')
        writeArticle(machineB, 'src/pages/post/from-b.md', '新規')
        const meansB = await meansFor(machineB)
        await meansB.reflect(['src/pages/post/from-b.md'])
        await meansA.refreshRemote()
        const files = await meansA.remoteState.listRemoteFiles()
        assert.ok(files.includes('src/pages/post/from-b.md'))
      })

      it('版の連なりは先行・後行・分岐と不在の事情を判定できる', async () => {
        const { machineA, clone } = setupGitPair()
        // machineA が4つの記事を公開
        for (const name of ['shared', 'keep', 'gone', 'still']) {
          writeArticle(machineA, `src/pages/post/${name}.md`, 'v1')
        }
        const meansA = await meansFor(machineA)
        await meansA.reflect(['shared', 'keep', 'gone', 'still'].map(n => `src/pages/post/${n}.md`))
        // 別のマシンが shared を更新し、新しい記事を公開
        const machineB = clone('machine-b')
        writeArticle(machineB, 'src/pages/post/shared.md', 'v2')
        writeArticle(machineB, 'src/pages/post/from-b.md', '新規')
        const meansB = await meansFor(machineB)
        await meansB.reflect(['src/pages/post/shared.md', 'src/pages/post/from-b.md'])
        // machineA 側: keep を編集、gone をエディタ外で削除、リモートの知識を更新
        writeArticle(machineA, 'src/pages/post/keep.md', 'A の編集')
        rmSync(nodePath.join(machineA, 'src/pages/post/gone.md'))
        assert.deepStrictEqual(await meansA.refreshRemote(), { success: true })
        assert.strictEqual(await meansA.lineageOf('src/pages/post/still.md'), 'same')
        assert.strictEqual(await meansA.lineageOf('src/pages/post/shared.md'), 'remoteAhead')
        assert.strictEqual(await meansA.lineageOf('src/pages/post/from-b.md'), 'remoteOnly')
        assert.strictEqual(await meansA.lineageOf('src/pages/post/keep.md'), 'localAhead')
        assert.strictEqual(await meansA.lineageOf('src/pages/post/gone.md'), 'deletedLocally')
        // shared を machineA でも編集すると分岐
        writeArticle(machineA, 'src/pages/post/shared.md', 'A も編集')
        assert.strictEqual(await meansA.lineageOf('src/pages/post/shared.md'), 'diverged')
      })

      it('取り込みはリモートの内容を手元の実ファイルに反映する', async () => {
        const { machineA, clone } = setupGitPair()
        writeArticle(machineA, 'src/pages/post/a.md', 'v1')
        const meansA = await meansFor(machineA)
        await meansA.reflect(['src/pages/post/a.md'])
        const machineB = clone('machine-b')
        writeArticle(machineB, 'src/pages/post/b.md', 'B の記事')
        const meansB = await meansFor(machineB)
        await meansB.reflect(['src/pages/post/b.md'])
        // machineA へ取り込み
        await meansA.refreshRemote()
        assert.deepStrictEqual(await meansA.takeFromRemote(['src/pages/post/b.md']), { success: true })
        assert.strictEqual(readFileSync(nodePath.join(machineA, 'src/pages/post/b.md'), 'utf-8'), 'B の記事')
        // 取り込んだ記事は公開済みとして読める
        const after = await meansFor(machineA)
        assert.strictEqual(await after.remoteState.existsInRemote('src/pages/post/b.md'), true)
        assert.strictEqual(await after.remoteState.diffFromRemote('src/pages/post/b.md'), '')
      })
    })
  })

  describe('取り込むはリモートの内容を、手元の執筆内容を失わずにローカルへ反映できる', () => {
    it('リモートで増えた記事を取り込み、分岐した記事は理由つきで見送る', async () => {
      const { pull } = await import('../../lib/publishing/pull.js')
      const localRoot = mkdtempSync(nodePath.join(tmpdir(), 'pull-'))
      const remote = new Map()
      const means = createInMemoryMeans(remote, localRoot)
      // 手元だけにある執筆中の記事
      writeArticle(localRoot, 'src/pages/post/draft.md', '下書き')
      // 両側で変わっている記事
      writeArticle(localRoot, 'src/pages/post/both.md', 'ローカル版')
      remote.set('src/pages/post/both.md', 'リモート版')
      // リモートで増えた記事
      remote.set('src/pages/post/new.md', '新しい記事')

      const result = await pull(means)
      assert.strictEqual(result.success, true)
      assert.deepStrictEqual(result.applied, ['src/pages/post/new.md'])
      assert.strictEqual(result.skipped.length, 1)
      assert.strictEqual(result.skipped[0].file, 'src/pages/post/both.md')
      assert.ok(result.skipped[0].reason, '見送りの理由が伝わる')
      assert.ok(!/(merge|conflict|マージ|コンフリクト)/i.test(result.skipped[0].reason), '理由に git の言葉を使わない')
      // 執筆内容は失われない
      assert.strictEqual(readFileSync(nodePath.join(localRoot, 'src/pages/post/both.md'), 'utf-8'), 'ローカル版')
      assert.ok(existsSync(nodePath.join(localRoot, 'src/pages/post/draft.md')))
      assert.strictEqual(readFileSync(nodePath.join(localRoot, 'src/pages/post/new.md'), 'utf-8'), '新しい記事')
    })

    it('原稿の置き場所の外にあるリモートの内容には手を出さない', async () => {
      const { pull } = await import('../../lib/publishing/pull.js')
      const localRoot = mkdtempSync(nodePath.join(tmpdir(), 'pull-scope-'))
      const remote = new Map()
      remote.set('lib/config.js', 'コード')
      remote.set('src/pages/post/a.md', '記事')
      const means = createInMemoryMeans(remote, localRoot)
      const result = await pull(means, { scope: 'src/pages/' })
      assert.deepStrictEqual(result.applied, ['src/pages/post/a.md'])
      assert.strictEqual(existsSync(nodePath.join(localRoot, 'lib/config.js')), false)
    })

    describe('版の連なりは記事ごとに先行・後行・分岐と、手元に無い記事の事情（消された・他所で作られた）を判定できる', () => {
      it('リモートが先行・リモートにのみ存在するものは取り込める', async () => {
        const { classify } = await import('../../lib/publishing/versionLineage.js')
        assert.strictEqual(classify('remoteAhead').pullable, true)
        assert.strictEqual(classify('remoteOnly').pullable, true)
      })

      it('分岐しているものは見送り、git の言葉を使わない理由を返す', async () => {
        const { classify } = await import('../../lib/publishing/versionLineage.js')
        const verdict = classify('diverged')
        assert.strictEqual(verdict.pullable, false)
        assert.ok(verdict.reason)
        assert.ok(!/(merge|conflict|マージ|コンフリクト)/i.test(verdict.reason))
      })

      it('手元で消されたものは取り込みで復活させない', async () => {
        const { classify } = await import('../../lib/publishing/versionLineage.js')
        const verdict = classify('deletedLocally')
        assert.strictEqual(verdict.pullable, false)
        assert.ok(verdict.reason)
      })

      it('一致・手元のみ・手元が先行のものは取り込みの対象にならない', async () => {
        const { classify } = await import('../../lib/publishing/versionLineage.js')
        for (const lineage of ['same', 'localOnly', 'localAhead']) {
          const verdict = classify(lineage)
          assert.strictEqual(verdict.pullable, false)
          assert.strictEqual(verdict.reason, undefined)
        }
      })
    })
  })
})
