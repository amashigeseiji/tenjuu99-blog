import { describe, it } from 'node:test'
import assert from 'node:assert'
import { distributeImages, collectFiles, writeConvertedFile } from '../../lib/imageDistributor.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ─── ビルド画像配布器（ルート） ───────────────────────────────────────────────

describe('ビルド画像配布器はビルド実行時に変換設定に従い画像をdistに出力できる', () => {
  it('変換設定なしのとき元のファイルがdistにコピーされ、変換設定があるとき変換済みファイルが書き込まれる', async () => {
    // 変換なし
    const src1 = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-root-src-'))
    const dist1 = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-root-dist-'))
    fs.writeFileSync(path.join(src1, 'a.jpg'), Buffer.from('original'))
    await distributeImages(src1, dist1, { fn: null, ext: null })
    assert.ok(fs.existsSync(path.join(dist1, 'a.jpg')))

    // 変換あり
    const src2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-root-src-'))
    const dist2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-root-dist-'))
    fs.writeFileSync(path.join(src2, 'b.jpg'), Buffer.from('original'))
    await distributeImages(src2, dist2, { fn: async (buf) => Buffer.from('converted'), ext: 'webp' })
    assert.ok(fs.existsSync(path.join(dist2, 'b.webp')))
    assert.strictEqual(fs.readFileSync(path.join(dist2, 'b.webp')).toString(), 'converted')

    fs.rmSync(src1, { recursive: true }); fs.rmSync(dist1, { recursive: true })
    fs.rmSync(src2, { recursive: true }); fs.rmSync(dist2, { recursive: true })
  })
})

// ─── ビルド画像配布器は変換設定なしのとき画像をそのままdistにコピーできる ───────────────────────────────────────────────

describe('ビルド画像配布器は変換設定なしのとき画像をそのままdistにコピーできる', () => {
  it('fn が null のとき元のファイルが元の拡張子のままdistにコピーされる', async () => {
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-copy-src-'))
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-copy-dist-'))
    fs.writeFileSync(path.join(tmpSrc, 'photo.jpg'), Buffer.from('img-data'))
    await distributeImages(tmpSrc, tmpDist, { fn: null, ext: null })
    assert.ok(fs.existsSync(path.join(tmpDist, 'photo.jpg')))
    assert.strictEqual(fs.readFileSync(path.join(tmpDist, 'photo.jpg')).toString(), 'img-data')
    fs.rmSync(tmpSrc, { recursive: true })
    fs.rmSync(tmpDist, { recursive: true })
  })
})

// ─── ビルド画像配布器は変換設定があるとき変換した画像をdistに書き込める ───────────────────────────────────────────────

describe('ビルド画像配布器は変換設定があるとき変換した画像をdistに書き込める', () => {
  it('fn と ext が指定されたとき変換済みファイルがdistに書き込まれる', async () => {
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-conv-src-'))
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-conv-dist-'))
    fs.mkdirSync(path.join(tmpSrc, 'sub'), { recursive: true })
    fs.writeFileSync(path.join(tmpSrc, 'photo.jpg'), Buffer.from('img'))
    fs.writeFileSync(path.join(tmpSrc, 'sub', 'nested.png'), Buffer.from('img2'))
    const mockFn = async (buf) => Buffer.from('converted:' + buf.toString())
    await distributeImages(tmpSrc, tmpDist, { fn: mockFn, ext: 'webp' })
    assert.ok(fs.existsSync(path.join(tmpDist, 'photo.webp')))
    assert.ok(fs.existsSync(path.join(tmpDist, 'sub', 'nested.webp')))
    assert.strictEqual(fs.readFileSync(path.join(tmpDist, 'photo.webp')).toString(), 'converted:img')
    fs.rmSync(tmpSrc, { recursive: true })
    fs.rmSync(tmpDist, { recursive: true })
  })
  it('画像拡張子以外のファイルはそのままコピーされる', async () => {
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-conv-src-'))
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-conv-dist-'))
    fs.writeFileSync(path.join(tmpSrc, '.gitkeep'), Buffer.from(''))
    fs.writeFileSync(path.join(tmpSrc, 'photo.jpg'), Buffer.from('img'))
    const mockFn = async (buf) => Buffer.from('converted')
    await distributeImages(tmpSrc, tmpDist, { fn: mockFn, ext: 'webp' })
    assert.ok(fs.existsSync(path.join(tmpDist, '.gitkeep')))
    assert.ok(fs.existsSync(path.join(tmpDist, 'photo.webp')))
    fs.rmSync(tmpSrc, { recursive: true })
    fs.rmSync(tmpDist, { recursive: true })
  })

  // ─── ビルド画像配布器は変換対象の全ファイルを収集できる ───────────────────────────────────────────────

  describe('ビルド画像配布器は変換対象の全ファイルを収集できる', () => {
    it('ディレクトリ内のファイルをサブディレクトリを含めて収集する', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-test-'))
      fs.mkdirSync(path.join(tmpDir, 'a', 'b'), { recursive: true })
      fs.writeFileSync(path.join(tmpDir, 'root.jpg'), Buffer.from(''))
      fs.writeFileSync(path.join(tmpDir, 'a', 'nested.png'), Buffer.from(''))
      fs.writeFileSync(path.join(tmpDir, 'a', 'b', 'deep.gif'), Buffer.from(''))
      const files = await collectFiles(tmpDir)
      assert.ok(files.includes('root.jpg'))
      assert.ok(files.includes(path.join('a', 'nested.png')))
      assert.ok(files.includes(path.join('a', 'b', 'deep.gif')))
      assert.strictEqual(files.length, 3)
      fs.rmSync(tmpDir, { recursive: true })
    })
    it('ディレクトリが空のとき空配列を返す', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collect-empty-'))
      const files = await collectFiles(tmpDir)
      assert.deepStrictEqual(files, [])
      fs.rmSync(tmpDir, { recursive: true })
    })
  })

  // ─── ビルド画像配布器はファイルを変換してdistの対応パスに書き込める ───────────────────────────────────────────────

  describe('ビルド画像配布器はファイルを変換してdistの対応パスに書き込める', () => {
    it('fn がある場合、変換後のバッファをdistの対応パスに書き込む', async () => {
      const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'wcf-src-'))
      const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'wcf-dist-'))
      fs.writeFileSync(path.join(tmpSrc, 'img.jpg'), Buffer.from('raw'))
      const mockFn = async (buf) => Buffer.from('out:' + buf.toString())
      await writeConvertedFile(path.join(tmpSrc, 'img.jpg'), path.join(tmpDist, 'img.webp'), mockFn)
      assert.strictEqual(fs.readFileSync(path.join(tmpDist, 'img.webp')).toString(), 'out:raw')
      fs.rmSync(tmpSrc, { recursive: true })
      fs.rmSync(tmpDist, { recursive: true })
    })
    it('中間ディレクトリが存在しなければ作成する', async () => {
      const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'wcf-src-'))
      const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'wcf-dist-'))
      fs.mkdirSync(path.join(tmpSrc, 'sub'))
      fs.writeFileSync(path.join(tmpSrc, 'sub', 'img.jpg'), Buffer.from('raw'))
      await writeConvertedFile(
        path.join(tmpSrc, 'sub', 'img.jpg'),
        path.join(tmpDist, 'sub', 'img.webp'),
        async (buf) => Buffer.from('out')
      )
      assert.ok(fs.existsSync(path.join(tmpDist, 'sub', 'img.webp')))
      fs.rmSync(tmpSrc, { recursive: true })
      fs.rmSync(tmpDist, { recursive: true })
    })
  })
})
