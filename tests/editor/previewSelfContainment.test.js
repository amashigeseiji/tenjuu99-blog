import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { inlineStyles } from '../../packages/editor/server/preview.js'

describe('プレビュー自己完結化 は プレビューの描画結果を外部参照なしに単体で表示できる形へ変えられる', () => {
  it('ローカルのスタイルシート参照はインライン <style> に置換される', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-self-'))
    fs.writeFileSync(path.join(tmpDir, 'style.css'), 'body { color: red; }')
    const html = '<head><link rel="stylesheet" href="/style.css?v=1"></head>'
    const result = inlineStyles(html, [tmpDir])
    assert.strictEqual(result, '<head><style>body { color: red; }</style></head>')
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('外部URLのスタイルシート参照はそのまま残る', () => {
    const html = '<link rel="stylesheet" href="https://example.com/a.css">'
    assert.strictEqual(inlineStyles(html, []), html)
  })

  it('参照先が見つからないときは元のタグのまま残る', () => {
    const html = '<link rel="stylesheet" href="/missing.css">'
    assert.strictEqual(inlineStyles(html, []), html)
  })
})
