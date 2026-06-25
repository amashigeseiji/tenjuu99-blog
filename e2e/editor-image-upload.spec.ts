import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, '..', 'src-sample')
const testJpeg = path.join(__dirname, '..', 'src-sample', 'image', 'test.jpg')

// アップロードで生成されたファイルを後片付け
const cleanup = (markdownUrl: string) => {
  const filePath = path.join(srcDir, markdownUrl.slice(1))
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath)
  }
}

// ─── US-01: アップロード時の画像変換 (e2e) ────────────────────────────────────
//
// blog.json に image_converter: "sharp" が設定されたサーバーを対象にする。
// 関数直呼びではなく実際の HTTP エンドポイント (/upload-image) を通してテストする。

test.describe('US-01: アップロード時の画像変換 (e2e)', () => {

  test('シナリオ 1: 編集画面からアップロードすると変換されて保存される', async ({ page, request }) => {
    // Given: blog.json に image_converter: "sharp" が設定されているサーバーが起動している
    await page.goto('/editor.html')
    await expect(page).toHaveTitle(/test/)

    // When: 編集画面から画像ファイルをアップロードする
    const imageData = fs.readFileSync(testJpeg).toString('base64')
    const response = await request.post('/upload-image', {
      data: { imageData, imageFilename: 'e2e-test-photo.jpg', mdFile: 'e2e/upload-test.md' }
    })

    // Then: WebP に変換された URL が返される
    expect(response.ok()).toBe(true)
    const json = await response.json()
    expect(json.markdownUrl).toMatch(/\.webp$/)
    expect(fs.existsSync(path.join(srcDir, json.markdownUrl.slice(1)))).toBe(true)

    cleanup(json.markdownUrl)
  })

  test('シナリオ 2: sharp が同梱されているのでサーバーが変換できる状態で起動する', async ({ page, request }) => {
    // Given: @tenjuu99/blog をインストールした環境で image_converter: "sharp" を設定する
    await page.goto('/editor.html')

    // When: 何でもよい画像をアップロードする
    const imageData = fs.readFileSync(testJpeg).toString('base64')
    const response = await request.post('/upload-image', {
      data: { imageData, imageFilename: 'e2e-sharp-check.jpg', mdFile: 'e2e/sharp-check.md' }
    })

    // Then: ext: 'webp' が解決されている（パススルーなら .jpg のまま）
    expect(response.ok()).toBe(true)
    const json = await response.json()
    expect(json.markdownUrl).toMatch(/\.webp$/)

    cleanup(json.markdownUrl)
  })

})
