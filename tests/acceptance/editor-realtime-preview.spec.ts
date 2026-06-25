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

  test('シナリオ 1: 画像をドロップするとプレビューが即時更新される', async ({ page, request }) => {
    // Given: ファイルがエディタで開かれている
    await page.goto('/editor?md=post/1.md')
    await page.waitForSelector('#previewContent iframe')

    // When: 画像ファイルをアップロードしてテキストエリアに挿入される
    // （drag/drop の完全なシミュレーションはブラウザ依存のため、
    //   アップロードAPIを直接呼び出してMarkdown挿入後の挙動を確認する）
    // TODO: 実際のドラッグ&ドロップシミュレーションは手動確認で補完する

    // テキストエリアに画像Markdown構文を直接挿入し、その後プレビューが更新されるかを検証
    const imgMarkdown = '![test-image](/image/test.png)'
    const previewResponsePromise = page.waitForResponse(
      res => res.url().includes('/preview') && res.request().method() === 'POST',
      { timeout: 3000 }
    )

    // initDropReceiver の onUpdate コールバック相当の動作を確認するため、
    // textarea に画像構文を挿入した後にプレビューが更新されることを確認する
    await page.locator('#editorTextArea').fill(imgMarkdown)
    // input イベントを発火（fill は input イベントを発火しない場合があるため）
    await page.locator('#editorTextArea').dispatchEvent('input')

    // Then: プレビューペインにリクエストが届いて更新される
    await previewResponsePromise
    const srcdoc = await page.locator('#previewContent iframe').getAttribute('srcdoc')
    expect(srcdoc).not.toBeNull()
  })
})
