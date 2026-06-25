import { test, expect } from '@playwright/test'
import { createConverter, handleImageUpload } from '../../packages/editor/server/image_upload.js'
import { distributeImages } from '../../lib/imageDistributor.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', '..', 'src-sample')
const testJpeg = path.join(srcDir, 'image', 'test.jpg')

// アップロードで生成されたファイルを後片付け
const cleanup = (markdownUrl: string) => {
  const filePath = path.join(srcDir, markdownUrl.slice(1))
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath)
  }
}

// ─── US-01: アップロード時の画像変換 ───────────────────────────────────────────────

test.describe('US-01: アップロード時の画像変換', () => {

  test('シナリオ 1: 編集画面からアップロードすると変換されて保存される', async ({ page, request }) => {
    // Given: blog.json に image_converter として "sharp" が設定されているサーバーが起動している
    await page.goto('/editor.html')
    await expect(page).toHaveTitle(/test/)

    // When: 編集画面から画像ファイルをアップロードする
    const imageData = fs.readFileSync(testJpeg).toString('base64')
    const response = await request.post('/upload-image', {
      data: { imageData, imageFilename: 'acceptance-test-photo.jpg', mdFile: 'acceptance/upload-test.md' }
    })

    // Then: 元のフォーマットではなく、Webに適したフォーマットに変換された画像が保存される
    expect(response.ok()).toBe(true)
    const json = await response.json()
    expect(json.markdownUrl).toMatch(/\.webp$/)
    expect(fs.existsSync(path.join(srcDir, json.markdownUrl.slice(1)))).toBe(true)

    cleanup(json.markdownUrl)
  })

  test('シナリオ 2: sharp がインストール済みなので追加作業なく変換が動作する', async () => {
    // Given: @tenjuu99/blog をインストールした環境である
    // When: blog.json に image_converter として "sharp" を設定する
    const { fn, ext } = await createConverter('sharp')

    // Then: ユーザーが別途 sharp をインストールしなくても画像変換が動作する
    // ext が 'webp' になる = sharp が正常に解決された（パススルーなら null）
    expect(ext).toBe('webp')
    expect(typeof fn).toBe('function')
  })

  test('シナリオ 3: 変換設定をしていない場合は従来どおり動作する', async () => {
    // Given: blog.json に image_converter が設定されていない
    const { fn, ext } = await createConverter(null)

    // When: 画像ファイルをアップロードする
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'us01-s3-'))
    const imageData = Buffer.from('fake-image-data').toString('base64')
    const { markdownUrl } = await handleImageUpload(
      { imageData, imageFilename: 'photo.jpg', mdFile: 'posts/test.md' },
      { converterFn: fn, outputExt: ext, baseDir: tmpDir }
    )

    // Then: 元のファイルがそのまま保存される（変換なし・従来と同じ挙動）
    expect(markdownUrl).toMatch(/\.jpg$/)
    expect(fs.existsSync(path.join(tmpDir, markdownUrl.slice(1)))).toBe(true)
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── US-02: ビルド時の画像変換 ───────────────────────────────────────────────

test.describe('US-02: ビルド時の画像変換', () => {

  test('シナリオ 1: generate するとソース画像が変換されて出力される', async () => {
    // Given: blog.json に画像変換の設定がされている（"sharp"）
    const converter = await createConverter('sharp')

    // And: src/ ディレクトリに画像ファイルが存在する
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'us02-s1-src-'))
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'us02-s1-dist-'))
    const jpegBuf = fs.readFileSync(testJpeg)
    fs.writeFileSync(path.join(tmpSrc, 'photo.jpg'), jpegBuf)

    // When: generate を実行する
    await distributeImages(tmpSrc, tmpDist, converter)

    // Then: dist/ に出力された画像が、Webに適したフォーマットに変換されている
    expect(fs.existsSync(path.join(tmpDist, 'photo.webp'))).toBe(true)
    expect(fs.existsSync(path.join(tmpDist, 'photo.jpg'))).toBe(false)
    const outputSize = fs.statSync(path.join(tmpDist, 'photo.webp')).size
    expect(outputSize).toBeGreaterThan(0)

    fs.rmSync(tmpSrc, { recursive: true })
    fs.rmSync(tmpDist, { recursive: true })
  })

  test('シナリオ 2: 変換設定がない場合は従来どおりコピーされる', async () => {
    // Given: blog.json に画像変換の設定がされていない
    const converter = { fn: null, ext: null }

    // And: src/ ディレクトリに画像ファイルが存在する
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'us02-s2-src-'))
    const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'us02-s2-dist-'))
    fs.writeFileSync(path.join(tmpSrc, 'photo.jpg'), Buffer.from('original'))

    // When: generate を実行する
    await distributeImages(tmpSrc, tmpDist, converter)

    // Then: dist/ に画像がそのままコピーされる（変換なし・従来と同じ挙動）
    expect(fs.existsSync(path.join(tmpDist, 'photo.jpg'))).toBe(true)
    expect(fs.readFileSync(path.join(tmpDist, 'photo.jpg')).toString()).toBe('original')

    fs.rmSync(tmpSrc, { recursive: true })
    fs.rmSync(tmpDist, { recursive: true })
  })
})
