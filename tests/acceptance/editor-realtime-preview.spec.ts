import { test, expect } from '@playwright/test'

// ─── US-01: テキスト入力中にプレビューをボタン操作なしで確認できる ───────────────────

test.describe('US-01: テキスト入力中にプレビューをボタン操作なしで確認できる', () => {

  test('シナリオ 1: テキスト入力後にプレビューが自動更新される', async ({ page }) => {
    // Given: ファイルがエディタで開かれている
    await page.goto('/editor?md=post/1.md')
    await page.waitForSelector('#previewContent iframe')

    // When: テキストエリアにテキストを入力して、しばらく入力を止める
    const uniqueMarker = `acceptance-heading-${Date.now()}`
    const previewResponsePromise = page.waitForResponse(
      res => res.url().includes('/preview') && res.request().method() === 'POST'
    )
    await page.locator('#editorTextArea').fill(`## ${uniqueMarker}`)
    // debounce が 500ms なので、タイムアウトを十分に長く設定
    await previewResponsePromise

    // Then: プレビューペインが更新され、入力内容が反映される（previewボタンは押していない）
    const srcdoc = await page.locator('#previewContent iframe').getAttribute('srcdoc')
    expect(srcdoc).toContain(uniqueMarker)
  })

  test('シナリオ 2: 連続入力中はプレビューが更新されず、入力が止まってから更新される', async ({ page }) => {
    // Given: ファイルがエディタで開かれている
    await page.goto('/editor?md=post/1.md')
    await page.waitForSelector('#previewContent iframe')

    // 初期ロード由来のリクエストが落ち着くまで待機
    await page.waitForTimeout(200)

    let previewRequestCount = 0
    page.on('request', req => {
      if (req.url().includes('/preview') && req.method() === 'POST') {
        previewRequestCount++
      }
    })

    // When: テキストエリアに連続してテキストを素早く入力する（debounce 500ms より短い間隔）
    const textarea = page.locator('#editorTextArea')
    for (let i = 0; i < 5; i++) {
      await textarea.pressSequentially('x')
      await page.waitForTimeout(80)
    }

    // 入力中（400ms 経過時点）はまだプレビューが更新されていない
    expect(previewRequestCount).toBe(0)

    // Then: 入力が止まった後にプレビューが更新される（500ms debounce 経過後）
    await page.waitForResponse(
      res => res.url().includes('/preview') && res.request().method() === 'POST',
      { timeout: 2000 }
    )
    expect(previewRequestCount).toBe(1)
  })
})

// ─── US-02: 画像挿入後にプレビューでその場で確認できる ───────────────────────────────

test.describe('US-02: 画像挿入後にプレビューでその場で確認できる', () => {

  test('シナリオ 1: 画像をドロップするとプレビューが即時更新される', async ({ page }) => {
    // Given: ファイルがエディタで開かれている
    await page.goto('/editor?md=post/1.md')
    await page.waitForSelector('#previewContent iframe')

    // /upload_image をモックして markdownUrl を返す
    const droppedImageUrl = '/image/test-dropped.png'
    await page.route('**/upload-image', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ markdownUrl: droppedImageUrl })
      })
    )

    // When: 画像ファイルをテキストエリアにドロップする
    const previewResponsePromise = page.waitForResponse(
      res => res.url().includes('/preview') && res.request().method() === 'POST',
      { timeout: 3000 }
    )
    await page.locator('#editorTextArea').evaluate(textarea => {
      const file = new File(['fake image'], 'test.png', { type: 'image/png' })
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true })
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [file], items: [] }
      })
      textarea.dispatchEvent(dropEvent)
    })

    // Then: アップロード後にプレビューが即時更新される（debounce を経由しない）
    await previewResponsePromise
    const srcdoc = await page.locator('#previewContent iframe').getAttribute('srcdoc')
    expect(srcdoc).toContain(droppedImageUrl)
  })
})
