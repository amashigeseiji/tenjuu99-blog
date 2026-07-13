import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'

// ツリー全体は plans/sync-operations/test-tree.md を参照。
// ルート（同期）と publishing コンテキストのノードは tests/publishing/sync.test.js にある。

describe('非公開にするは公開済みの記事をリモートから取り除き、原稿を手元に残せる', () => {
  it('リモートからの除去を公開手段に委ね、結果を返す', async () => {
    const { unpublish } = await import('../../packages/editor/server/changeReflector.js')
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }
    const result = await unpublish(['src/pages/post/a.md'], means)
    assert.deepStrictEqual(result, { success: true })
    assert.deepStrictEqual(removed, ['src/pages/post/a.md'])
  })

  it('除去は一操作一場所: ローカルの原稿には関与しない', async () => {
    const { unpublish } = await import('../../packages/editor/server/changeReflector.js')
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'unpublish-'))
    const manuscript = nodePath.join(dir, 'a.md')
    writeFileSync(manuscript, '原稿')
    const means = { remove: async () => ({ success: true }) }
    await unpublish([manuscript], means)
    assert.ok(existsSync(manuscript), '原稿は手元に残る')
  })

  it('公開手段が除去に失敗したときは失敗として伝わる', async () => {
    const { unpublish } = await import('../../packages/editor/server/changeReflector.js')
    const means = { remove: async () => ({ success: false, error: '反映に失敗しました' }) }
    const result = await unpublish(['src/pages/post/a.md'], means)
    assert.strictEqual(result.success, false)
    assert.ok(result.error)
  })
})

describe('削除するは未公開の記事をローカルから取り除ける', () => {
  it('記事のファイルをローカルから取り除く', async () => {
    const { deleteArticle } = await import('../../packages/editor/server/deleteArticle.js')
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'delete-'))
    const manuscript = nodePath.join(dir, 'a.md')
    writeFileSync(manuscript, '原稿')
    await deleteArticle(manuscript)
    assert.strictEqual(existsSync(manuscript), false)
  })

  it('存在しないファイルの削除は失敗として伝わる', async () => {
    const { deleteArticle } = await import('../../packages/editor/server/deleteArticle.js')
    const dir = mkdtempSync(nodePath.join(tmpdir(), 'delete-'))
    await assert.rejects(() => deleteArticle(nodePath.join(dir, 'missing.md')))
  })
})

describe('ファイルステータスコレクターは手元に無いがリモートにあるファイルも含めて記事の状態を収集できる', () => {
  const localMappings = [{ treePath: 'post/local.md', localPath: 'src/pages/post/local.md' }]
  const remoteState = {
    existsInRemote: async (p) => ['src/pages/post/local.md', 'src/pages/post/other.md'].includes(p),
    diffFromRemote: async () => '',
    listRemoteFiles: async () => ['src/pages/post/local.md', 'src/pages/post/other.md', 'README.md'],
  }

  it('手元に無いがリモートにあるファイルを リモートのみ として収集する', async () => {
    const { collectStatuses } = await import('../../packages/editor/server/sidebarStatusCollector.js')
    const statuses = await collectStatuses(localMappings, remoteState, { pagesPrefix: 'src/pages/' })
    assert.strictEqual(statuses['post/local.md'], 'published')
    assert.strictEqual(statuses['post/other.md'], 'remote-only')
  })

  it('原稿の置き場所の外にあるリモートのファイルは収集しない', async () => {
    const { collectStatuses } = await import('../../packages/editor/server/sidebarStatusCollector.js')
    const statuses = await collectStatuses(localMappings, remoteState, { pagesPrefix: 'src/pages/' })
    assert.ok(!Object.keys(statuses).some(k => k.includes('README')))
  })

  it('一覧が参照できないときはリモートのみの検出をあきらめ、手元の収集は続ける', async () => {
    const { collectStatuses } = await import('../../packages/editor/server/sidebarStatusCollector.js')
    const broken = {
      ...remoteState,
      listRemoteFiles: async () => { throw new Error('参照不能') },
    }
    const statuses = await collectStatuses(localMappings, broken, { pagesPrefix: 'src/pages/' })
    assert.deepStrictEqual(statuses, { 'post/local.md': 'published' })
  })
})

describe('公開可否判定器は記事の状態ごとに行える操作（公開・非公開・削除・取り込み）を見分けられる', () => {
  it('未公開の記事は公開と削除ができ、非公開にはできない', async () => {
    const { resolveOperations } = await import('../../packages/editor/js/publishAvailability.js')
    assert.deepStrictEqual(resolveOperations('new'), { publish: true, unpublish: false, delete: true, pull: false })
  })

  it('公開済みの記事は非公開にでき、削除は直接はできない', async () => {
    const { resolveOperations } = await import('../../packages/editor/js/publishAvailability.js')
    assert.deepStrictEqual(resolveOperations('published'), { publish: false, unpublish: true, delete: false, pull: false })
  })

  it('更新ありの記事は公開（更新）と非公開ができる', async () => {
    const { resolveOperations } = await import('../../packages/editor/js/publishAvailability.js')
    assert.deepStrictEqual(resolveOperations('modified'), { publish: true, unpublish: true, delete: false, pull: false })
  })

  it('リモートのみの記事は取り込みとリモートからの除去ができる', async () => {
    const { resolveOperations } = await import('../../packages/editor/js/publishAvailability.js')
    assert.deepStrictEqual(resolveOperations('remote-only'), { publish: false, unpublish: true, delete: false, pull: true })
  })

  it('状態不明ではどの操作も行えない', async () => {
    const { resolveOperations } = await import('../../packages/editor/js/publishAvailability.js')
    assert.deepStrictEqual(resolveOperations('unknown'), { publish: false, unpublish: false, delete: false, pull: false })
  })
})
