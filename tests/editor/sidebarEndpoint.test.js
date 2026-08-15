import { describe, it } from 'node:test'
import assert from 'node:assert'
import { get, path } from '../../packages/editor/server/get_sidebar.js'

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

describe('サイドバー取得エンドポイント は サイドバーツリーのHTMLを応答できる', () => {
  it('/get_sidebar はハンドラー基盤の定型で html を持つJSONを応答する', async () => {
    assert.strictEqual(path, '/get_sidebar')
    const res = makeFakeRes()
    const handled = await get({ url: '/get_sidebar' }, res)
    assert.strictEqual(handled, true)
    assert.strictEqual(res.headers['content-type'], 'application/json')
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(typeof res.body.html, 'string')
  })
})
