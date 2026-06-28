import { describe, it } from 'node:test'
import assert from 'node:assert'

// ルートテスト: ツリーが完成するまで green にしない
describe('サイドバーは各ファイルの公開ステータスを視覚的に表示できる', () => {
  it('ファイルリストとステータスマップから、各ファイルノードにステータス識別子が付与されたHTMLが生成される', async () => {
    const { renderSidebarTree } = await import('../../packages/editor/helper/sidebarTree.js')
    const files = [
      { name: 'post/hello', __filetype: 'md', __is_auto_category: false },
      { name: 'post/world', __filetype: 'md', __is_auto_category: false },
    ]
    const statusMap = {
      'post/hello.md': 'new',
      'post/world.md': 'published',
    }
    const html = renderSidebarTree(files, statusMap)
    assert.match(html, /data-status="new"/)
    assert.match(html, /data-status="published"/)
  })

  // ─── ツリーレンダラー ──────────────────────────────────────────────

  describe('ツリーレンダラーは公開ステータス付きファイルノードをステータス識別子付きHTMLとして出力できる', () => {
    it('statusMapを渡すと各ファイルノードにステータス識別子が付与される', async () => {
      const { renderTreeHtml } = await import('../../packages/editor/js/tree.js')
      const tree = {
        dirs: {},
        files: [
          { path: 'post/hello.md', label: 'hello.md' },
          { path: 'post/world.md', label: 'world.md' },
        ]
      }
      const statusMap = { 'post/hello.md': 'new', 'post/world.md': 'published' }
      const html = renderTreeHtml(tree, '', statusMap)
      assert.match(html, /data-status="new"/)
      assert.match(html, /data-status="published"/)
    })
  })

  // ─── ファイルステータスコレクター ──────────────────────────────────

  describe('ファイルステータスコレクターはファイル群の公開ステータスをまとめて取得できる', () => {
    it('各ファイルマッピングの公開ステータスを一括取得して {treePath: status} マップを返す', async () => {
      const { collectStatuses } = await import('../../packages/editor/server/sidebarStatusCollector.js')
      const mockPublishedState = {
        existsInRemote: async (path) => path.includes('hello'),
        diffFromRemote: async () => '',
      }
      const fileMappings = [
        { treePath: 'post/hello.md', gitPath: 'src/pages/post/hello.md' },
        { treePath: 'post/world.md', gitPath: 'src/pages/post/world.md' },
      ]
      const result = await collectStatuses(fileMappings, mockPublishedState)
      assert.deepStrictEqual(result, {
        'post/hello.md': 'published',
        'post/world.md': 'new',
      })
    })

    describe('公開ステータス判定器はファイルパスから公開ステータスを返せる（既存）', () => {
      it.skip('既存実装 - tests/editor/publish.test.js にて検証済み')
    })
  })
})
