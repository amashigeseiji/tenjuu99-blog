import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createOperationExecutor } from '../../packages/editor/js/operationExecutor.js'

describe('操作実行器 は 進行中の表示・結果の伝達・完了後の更新という操作の一連の流れを、一つの定型として実行できる', () => {
  it('成功時は 進行中表示 → 成功の文言 → 完了後の更新 の順で流れ、ボタンが再度押せる', async () => {
    const feedback = []
    const events = []
    const button = { disabled: false }
    let captured
    const fetchFn = async (url, opts) => {
      captured = { url, body: JSON.parse(opts.body) }
      events.push(`fetch(disabled=${button.disabled})`)
      return { ok: true, json: async () => ({ success: true, warning: 'w' }) }
    }
    const execute = createOperationExecutor((m) => feedback.push(m), fetchFn)
    await execute({
      button,
      progress: '公開中...',
      endpoint: '/publish',
      body: { filePath: 'a.md' },
      success: (json) => `公開しました（${json.warning}）`,
      failure: (json) => `公開失敗: ${json.error ?? '不明なエラー'}`,
      onSuccess: () => events.push('onSuccess'),
    })
    assert.deepStrictEqual(feedback, ['公開中...', '公開しました（w）'])
    assert.deepStrictEqual(events, ['fetch(disabled=true)', 'onSuccess'])
    assert.strictEqual(captured.url, '/publish')
    assert.deepStrictEqual(captured.body, { filePath: 'a.md' })
    assert.strictEqual(button.disabled, false)
  })

  it('失敗応答では失敗の文言が表示され、完了後の更新は呼ばれない', async () => {
    const feedback = []
    let onSuccessCalled = false
    const fetchFn = async () => ({ ok: false, json: async () => ({ error: '接続不可' }) })
    const execute = createOperationExecutor((m) => feedback.push(m), fetchFn)
    await execute({
      endpoint: '/unpublish',
      success: () => '非公開にしました',
      failure: (json) => `非公開にできませんでした: ${json.error}`,
      onSuccess: () => { onSuccessCalled = true },
    })
    assert.deepStrictEqual(feedback, ['非公開にできませんでした: 接続不可'])
    assert.strictEqual(onSuccessCalled, false)
  })

  it('実行前確認で中止されたときは何も起こらない', async () => {
    const feedback = []
    let fetched = false
    const execute = createOperationExecutor((m) => feedback.push(m), async () => { fetched = true })
    await execute({
      confirm: async () => false,
      progress: '削除しています...',
      endpoint: '/delete',
      success: () => '削除しました',
      failure: () => '削除できませんでした',
    })
    assert.deepStrictEqual(feedback, [])
    assert.strictEqual(fetched, false)
  })

  it('接続に失敗したときの文言は操作によらず一つに定まる', async () => {
    const feedback = []
    const button = { disabled: false }
    const execute = createOperationExecutor((m) => feedback.push(m), async () => { throw new Error('down') })
    await execute({
      button,
      progress: '取り込んでいます...',
      endpoint: '/pull',
      success: () => 'ok',
      failure: () => 'ng',
    })
    assert.deepStrictEqual(feedback, ['取り込んでいます...', 'サーバーに接続できませんでした。しばらくしてからお試しください。'])
    assert.strictEqual(button.disabled, false)
  })
})
