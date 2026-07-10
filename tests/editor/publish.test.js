import { describe, it } from 'node:test'
import assert from 'node:assert'
import { extractImageReferences } from '../../packages/editor/js/imageReferenceExtractor.js'
import { collectTarget } from '../../packages/editor/server/publishTargetCollector.js'
import { publish, update } from '../../packages/editor/server/changeReflector.js'
import { getPublicationStatus } from '../../packages/editor/server/publicationStatus.js'

describe('エディタは編集内容を公開・更新できる', () => {
  describe('公開ボタンはリクエストを送信してフィードバックを表示できる', () => {
    it.skip('手動確認のみ: ブラウザAPI・DOM依存のためテスト不可')
  })

  describe('公開ハンドラーは公開手段を通じて記事の公開・更新ができる', () => {
    it('状態が未公開のとき「公開する」遷移で公開手段に反映を委ねる', async () => {
      const { handlePublish } = await import('../../packages/editor/server/publish.js')
      const reflected = []
      const means = {
        remoteState: { existsInRemote: async () => false, diffFromRemote: async () => '' },
        reflect: async (files) => { reflected.push(...files); return { success: true } },
        deliverable: 'manuscript'
      }
      const result = await handlePublish(
        { filePath: 'post/hello.md', fileContent: '本文\n![猫](/image/post/cat.jpg)', srcDir: 'src' },
        means
      )
      assert.deepStrictEqual(reflected, ['src/pages/post/hello.md', 'src/image/post/cat.jpg'])
      assert.deepStrictEqual(result, { success: true })
    })
    it('状態が更新ありのとき「更新する」遷移で公開手段に反映を委ねる', async () => {
      const { handlePublish } = await import('../../packages/editor/server/publish.js')
      const reflected = []
      const means = {
        remoteState: { existsInRemote: async () => true, diffFromRemote: async () => 'diff --git ...' },
        reflect: async (files) => { reflected.push(...files); return { success: true } },
        deliverable: 'manuscript'
      }
      const result = await handlePublish(
        { filePath: 'post/hello.md', fileContent: '本文', srcDir: 'src' },
        means
      )
      assert.deepStrictEqual(reflected, ['src/pages/post/hello.md'])
      assert.deepStrictEqual(result, { success: true })
    })
    it('状態が公開済みのときは反映なしで成功を返す', async () => {
      const { handlePublish } = await import('../../packages/editor/server/publish.js')
      const reflected = []
      const means = {
        remoteState: { existsInRemote: async () => true, diffFromRemote: async () => '' },
        reflect: async (files) => { reflected.push(...files); return { success: true } },
        deliverable: 'manuscript'
      }
      const result = await handlePublish(
        { filePath: 'post/hello.md', fileContent: '本文', srcDir: 'src' },
        means
      )
      assert.deepStrictEqual(reflected, [])
      assert.deepStrictEqual(result, { success: true })
    })
    it('リモートの内容が参照できないときは公開せずエラーを返す', async () => {
      const { handlePublish } = await import('../../packages/editor/server/publish.js')
      const means = {
        remoteState: {
          existsInRemote: async () => { throw new Error('upstream not set') },
          diffFromRemote: async () => { throw new Error('upstream not set') }
        },
        reflect: async () => { throw new Error('参照できないときに反映してはいけない') },
        deliverable: 'manuscript'
      }
      const result = await handlePublish(
        { filePath: 'post/hello.md', fileContent: '本文', srcDir: 'src' },
        means
      )
      assert.strictEqual(result.success, false)
      assert.ok(result.error)
    })

    describe('公開対象コレクターは現ファイルと参照画像を収集できる', () => {
      it('現ファイルと参照画像をgit addできるパスで返す', () => {
        const target = collectTarget('post/hello.md', '本文\n![猫](/image/post/cat.jpg)', 'src')
        assert.deepStrictEqual(target, {
          markdownFile: 'src/pages/post/hello.md',
          imageFiles: ['src/image/post/cat.jpg']
        })
      })
      it('画像参照がない場合は imageFiles が空配列', () => {
        const target = collectTarget('post/hello.md', '画像なしの本文', 'src')
        assert.deepStrictEqual(target, { markdownFile: 'src/pages/post/hello.md', imageFiles: [] })
      })

      describe('画像参照抽出器はMarkdownから画像パスを抽出できる', () => {
        it('![](パス)形式の画像パスをすべて返す', () => {
          const md = '本文\n![猫](src/image/post/cat.jpg)\n![犬](src/image/post/dog.png)'
          assert.deepStrictEqual(
            extractImageReferences(md),
            ['src/image/post/cat.jpg', 'src/image/post/dog.png']
          )
        })
        it('画像参照がない場合は空配列を返す', () => {
          assert.deepStrictEqual(extractImageReferences('テキストのみの本文'), [])
        })
      })
    })

    describe('変更反映器は公開手段を介してリモートに反映できる', () => {
      it('「公開する」遷移はファイル群の反映を公開手段に委ね結果を返す', async () => {
        const reflected = []
        const means = {
          reflect: async (files) => { reflected.push(...files); return { success: true } }
        }
        const result = await publish(
          ['post/hello.md', 'src/image/post/cat.jpg'],
          means
        )
        assert.deepStrictEqual(reflected, ['post/hello.md', 'src/image/post/cat.jpg'])
        assert.deepStrictEqual(result, { success: true })
      })
      it('「更新する」遷移はファイル群の反映を公開手段に委ね結果を返す', async () => {
        const reflected = []
        const means = {
          reflect: async (files) => { reflected.push(...files); return { success: true } }
        }
        const result = await update(
          ['post/hello.md', 'src/image/post/cat.jpg'],
          means
        )
        assert.deepStrictEqual(reflected, ['post/hello.md', 'src/image/post/cat.jpg'])
        assert.deepStrictEqual(result, { success: true })
      })
      it('反映失敗時はエラー情報を返す', async () => {
        const means = {
          reflect: async () => ({ success: false, error: 'authentication failed' })
        }
        const result = await publish(['post/hello.md'], means)
        assert.deepStrictEqual(result, { success: false, error: 'authentication failed' })
      })
    })

    describe('公開ステータス判定器はリモート状態からステータスを導出できる', () => {
      it('ファイルがリモートに存在しない場合は「new」を返す', async () => {
        const mockRemoteState = {
          existsInRemote: async () => false,
          diffFromRemote: async () => ''
        }
        const result = await getPublicationStatus('src/pages/post/hello.md', mockRemoteState)
        assert.strictEqual(result, 'new')
      })
      it('ファイルがリモートに存在して差分がある場合は「modified」を返す', async () => {
        const mockRemoteState = {
          existsInRemote: async () => true,
          diffFromRemote: async () => 'diff --git ...'
        }
        const result = await getPublicationStatus('src/pages/post/hello.md', mockRemoteState)
        assert.strictEqual(result, 'modified')
      })
      it('ファイルがリモートに存在して差分がない場合は「published」を返す', async () => {
        const mockRemoteState = {
          existsInRemote: async () => true,
          diffFromRemote: async () => ''
        }
        const result = await getPublicationStatus('src/pages/post/hello.md', mockRemoteState)
        assert.strictEqual(result, 'published')
      })
    })
  })
})
