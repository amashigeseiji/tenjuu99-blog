import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createJsonPostHandler, createJsonGetHandler, respondJson } from '../../packages/editor/server/handlerFoundation.js'

// parseJsonBody が読むストリームイベントだけを持つフェイクリクエスト
const makeFakeReq = (payload, { url = '/x' } = {}) => {
  const handlers = {}
  return {
    url,
    destroy() {},
    on(ev, cb) {
      handlers[ev] = cb
      if (ev === 'error') {
        // ハンドラーが出揃った次のマイクロタスクでボディを流す
        queueMicrotask(() => {
          if (payload !== undefined) handlers.data(Buffer.from(payload))
          handlers.end()
        })
      }
      return this
    },
  }
}

const makeFakeRes = () => {
  const res = {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(status, headers) { res.statusCode = status; res.headers = headers },
    end(str) { res.body = JSON.parse(str) },
  }
  return res
}

describe('ハンドラー基盤 は リクエストの解釈と成功・失敗の応答の定型を引き受け、各エンドポイントに業務処理だけを書かせられる', () => {
  it('業務処理は解釈済みのボディを受け取り、返した body がJSONで応答される', async () => {
    const req = makeFakeReq(JSON.stringify({ filePath: 'a.md' }))
    const res = makeFakeRes()
    const post = createJsonPostHandler('x', async (body) => ({ body: { success: true, got: body.filePath } }))
    const handled = await post(req, res)
    assert.strictEqual(handled, true)
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.deepStrictEqual(res.body, { success: true, got: 'a.md' })
  })

  it('業務処理が status を返せば、そのステータスで応答される', async () => {
    const req = makeFakeReq('{}')
    const res = makeFakeRes()
    const post = createJsonPostHandler('x', async () => ({ status: 400, body: { success: false, error: 'ファイル名がありません' } }))
    await post(req, res)
    assert.strictEqual(res.statusCode, 400)
    assert.deepStrictEqual(res.body, { success: false, error: 'ファイル名がありません' })
  })

  it('ボディの解釈に失敗したときは 400 で応答され、業務処理は呼ばれない', async () => {
    const req = makeFakeReq('not-json')
    const res = makeFakeRes()
    let called = false
    const post = createJsonPostHandler('x', async () => { called = true })
    await post(req, res)
    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.body.success, false)
    assert.ok(res.body.error)
    assert.strictEqual(called, false)
  })

  it('ボディがサイズ上限を超えたときは 413 で応答される', async () => {
    const req = makeFakeReq(JSON.stringify({ big: 'x'.repeat(100) }))
    const res = makeFakeRes()
    const post = createJsonPostHandler('x', async () => ({ body: {} }), { maxSize: 10 })
    await post(req, res)
    assert.strictEqual(res.statusCode, 413)
  })

  it('業務処理の例外は 500 に変換され、応答の形は catchBody で差し替えられる', async () => {
    const req = makeFakeReq('{}')
    const res = makeFakeRes()
    const post = createJsonPostHandler('x', async () => { throw new Error('boom') },
      { catchBody: () => ({ message: '処理に失敗しました' }) })
    const handled = await post(req, res)
    assert.strictEqual(handled, true)
    assert.strictEqual(res.statusCode, 500)
    assert.deepStrictEqual(res.body, { message: '処理に失敗しました' })
  })

  it('解釈エラーの応答形は errorBody で差し替えられる', async () => {
    const req = makeFakeReq('not-json')
    const res = makeFakeRes()
    const post = createJsonPostHandler('x', async () => ({ body: {} }),
      { errorBody: (message) => ({ message }) })
    await post(req, res)
    assert.strictEqual(res.statusCode, 400)
    assert.ok(res.body.message)
    assert.strictEqual('success' in res.body, false)
  })

  it('GET の業務処理は解釈済みURLを受け取り、例外は 500 に変換される', async () => {
    const res1 = makeFakeRes()
    const get = createJsonGetHandler('x', async (url) => ({ body: { md: url.searchParams.get('md') } }))
    const handled = await get({ url: '/publication-status?md=a.md' }, res1)
    assert.strictEqual(handled, true)
    assert.deepStrictEqual(res1.body, { md: 'a.md' })

    const res2 = makeFakeRes()
    const failing = createJsonGetHandler('x', async () => { throw new Error('boom') })
    await failing({ url: '/x' }, res2)
    assert.strictEqual(res2.statusCode, 500)
    assert.deepStrictEqual(res2.body, { success: false, error: 'boom' })
  })

  it('respondJson はステータス・content-type・シリアライズの定型を一か所で行う', () => {
    const res = makeFakeRes()
    respondJson(res, 200, { ok: true })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.deepStrictEqual(res.body, { ok: true })
  })
})
