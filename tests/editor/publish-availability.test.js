import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('公開可否判定器は公開ステータスから、公開ボタンを操作可能にすべきかを判定できる', () => {
  it('ステータスが unknown のときは無効化し、利用者への表示文言を返す', async () => {
    const { publishAvailability } = await import('../../packages/editor/js/publishAvailability.js')
    const result = publishAvailability('unknown')
    assert.strictEqual(result.disabled, true)
    assert.ok(result.label)
  })
  it('ステータスが new/modified/published のときは無効化しない', async () => {
    const { publishAvailability } = await import('../../packages/editor/js/publishAvailability.js')
    for (const status of ['new', 'modified', 'published']) {
      const result = publishAvailability(status)
      assert.strictEqual(result.disabled, false)
    }
  })
})
