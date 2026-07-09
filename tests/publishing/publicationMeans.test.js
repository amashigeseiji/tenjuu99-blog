import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('公開手段は公開済みの参照と公開物の反映を担い、手段を替えても公開を成立させられる', () => {
  it('git ではないインメモリの公開手段でも公開フロー（判定→反映→公開済み）が成立する', async () => {
    const { handlePublish } = await import('../../packages/editor/server/publish.js')
    const { getPublicationStatus } = await import('../../packages/editor/server/publicationStatus.js')
    const remote = new Set()
    const means = {
      publishedState: {
        existsInRemote: async (filePath) => remote.has(filePath),
        diffFromRemote: async () => '',
      },
      reflect: async (files) => { files.forEach(f => remote.add(f)); return { success: true } },
      deliverable: 'artifact',
    }
    const result = await handlePublish(
      { filePath: 'post/hello.md', fileContent: '本文', srcDir: 'src' },
      means
    )
    assert.deepStrictEqual(result, { success: true })
    assert.ok(remote.has('src/pages/post/hello.md'))
    assert.strictEqual(await getPublicationStatus('src/pages/post/hello.md', means.publishedState), 'published')
  })

  describe('git公開手段は原稿を公開物としてリモートへの反映を実現できる', () => {
    it('公開物として原稿を申告し、リモートの参照と反映の実行を提供する', async () => {
      const { createGitPublicationMeans } = await import('../../lib/publishing/gitPublicationMeans.js')
      const means = await createGitPublicationMeans(process.cwd())
      assert.strictEqual(means.deliverable, 'manuscript')
      assert.strictEqual(typeof means.publishedState.existsInRemote, 'function')
      assert.strictEqual(typeof means.publishedState.diffFromRemote, 'function')
      assert.strictEqual(typeof means.reflect, 'function')
    })
  })

  describe('公開手段解決器は構成にもとづいて使う公開手段を決められる', () => {
    it('手段が未指定なら git公開手段を既定として提供する', async () => {
      const { resolvePublicationMeans } = await import('../../lib/publishing/publicationMeansResolver.js')
      const means = await resolvePublicationMeans({ cwd: process.cwd() })
      assert.strictEqual(means.deliverable, 'manuscript')
      assert.strictEqual(typeof means.reflect, 'function')
    })
    it('未知の手段名は構成の誤りとして拒否する', async () => {
      const { resolvePublicationMeans } = await import('../../lib/publishing/publicationMeansResolver.js')
      await assert.rejects(
        () => resolvePublicationMeans({ means: 'ftp', cwd: process.cwd() }),
        /ftp/
      )
    })
  })
})
