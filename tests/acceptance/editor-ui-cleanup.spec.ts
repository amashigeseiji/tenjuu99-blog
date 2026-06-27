import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ファイルシステムを共有するためシリアル実行する
test.describe.configure({ mode: 'serial' })

const srcDir = path.join(process.cwd(), 'src-sample', 'pages')
const createdFiles: string[] = []

// dev-server はファイル変更を検知して再起動するため、
// connection refused が返ったときはリトライする
async function gotoWithRetry(page: Page, url: string, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.goto(url)
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const isConnRefused = msg.includes('ERR_CONNECTION_REFUSED') ||
                            msg.includes('NS_ERROR_CONNECTION_REFUSED')
      if (!isConnRefused || attempt === maxAttempts - 1) throw e
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

// 作成ファイルはすべてのテスト完了後に削除する（途中削除はサーバー再起動を招く）
test.afterAll(async () => {
  for (const f of createdFiles.splice(0)) {
    fs.rmSync(f, { force: true })
  }
})

// ─── US-01: 新規ファイルの作成 ────────────────────────────────────────────────

test.describe('US-01: 新規ファイルの作成', () => {

  test('シナリオ 1: 新規作成ボタンからファイル名を入力できる状態になる', async ({ page }) => {
    // Given: エディタ画面が開いている
    // editor.js は initFrontmatterTemplate() (GET /get_frontmatter_templates) 完了後に
    // newFileBtn のイベントリスナーを設定するため、そのレスポンスを待つ
    const initDonePromise = page.waitForResponse(
      res => res.url().includes('/get_frontmatter_templates'),
      { timeout: 10000 }
    )
    await gotoWithRetry(page, '/editor')
    await initDonePromise

    // When: 「新規作成」ボタンを押す
    await page.locator('#newFileBtn').click()

    // Then: ファイル名を入力できる状態になる（ダイアログが開く）
    await expect(page.locator('#newFileDialog')).toBeVisible()
    await expect(page.locator('#newFileName')).toBeEditable()
  })

  test('シナリオ 2: ファイル名とテンプレートを指定して作成する（book/ ディレクトリ）', async ({ page }) => {
    const timestamp = Date.now()
    const filename = `book/acceptance-new-${timestamp}.md`
    createdFiles.push(path.join(srcDir, filename))

    // Given: 「新規作成」操作でファイル名入力の状態になっている
    const initDonePromise2 = page.waitForResponse(
      res => res.url().includes('/get_frontmatter_templates'),
      { timeout: 10000 }
    )
    await gotoWithRetry(page, '/editor')
    await initDonePromise2
    await page.locator('#newFileBtn').click()
    await expect(page.locator('#newFileDialog')).toBeVisible()

    // Given: そのディレクトリ（book/）にはテンプレートが設定されている
    await page.locator('#newFileName').fill(filename)
    await expect(page.locator('#newFileTemplate')).toContainText('テンプレート: book/')

    // When: ファイル名を入力し確定する
    await page.locator('#confirmNewFile').click()

    // Then: 指定したテンプレートの内容が挿入された状態でエディタに開かれる
    // textarea.value はJSで動的に設定されるため toHaveValue(/regex/) で .value を確認する
    await expect(page.locator('#editorTextArea')).toHaveValue(/title:/, { timeout: 10000 })
    await expect(page.locator('#editorTextArea')).toHaveValue(/price:/)

    // Then: ファイルはローカルに保存されている（ファイルシステムで確認）
    // 公開状態はインデックス更新タイミングに依存するためここでは確認しない
    expect(fs.existsSync(path.join(srcDir, filename))).toBe(true)
  })

  test('シナリオ 3: テンプレートが設定されていないディレクトリで作成する', async ({ page }) => {
    const timestamp = Date.now()
    const filename = `post/acceptance-new-${timestamp}.md`
    createdFiles.push(path.join(srcDir, filename))

    // Given: 「新規作成」操作でファイル名入力の状態になっている
    const initDonePromise3 = page.waitForResponse(
      res => res.url().includes('/get_frontmatter_templates'),
      { timeout: 10000 }
    )
    await gotoWithRetry(page, '/editor')
    await initDonePromise3
    await page.locator('#newFileBtn').click()
    await expect(page.locator('#newFileDialog')).toBeVisible()

    // Given: そのディレクトリにはテンプレートが設定されていない
    await page.locator('#newFileName').fill(filename)
    await expect(page.locator('#newFileTemplate')).toContainText('テンプレートなし')

    // When: ファイル名を入力して確定する
    await page.locator('#confirmNewFile').click()

    // Then: タイトルのみのフロントマターでエディタに開かれる
    await expect(page.locator('#editorTextArea')).toHaveValue(/title:/, { timeout: 10000 })

    // Then: ファイルはローカルに保存されている
    expect(fs.existsSync(path.join(srcDir, filename))).toBe(true)
  })
})

// ─── US-02: 書いた内容の自動保存 ───────────────────────────────────────────────

test.describe('US-02: 書いた内容の自動保存', () => {

  test('シナリオ 1: 書いた内容が自動的に保存される（save ボタン不要）', async ({ page }) => {
    const post1Path = path.join(process.cwd(), 'src-sample', 'pages', 'post', '1.md')
    const originalContent = fs.readFileSync(post1Path, 'utf-8')

    // Given: 既存のファイルがエディタに開かれている
    // setCurrentFile() が currentFileName を更新するまで待つ（fetchData 完了のシグナル）
    await gotoWithRetry(page, '/editor?md=post/1.md')
    await page.waitForFunction(
      () => {
        const el = document.getElementById('currentFileName')
        return el !== null && el.textContent === 'post/1.md'
      },
      { timeout: 15000 }
    )

    try {
      // When: テキストを書く
      const uniqueMarker = `auto-saved-${Date.now()}`
      const saveResponsePromise = page.waitForResponse(
        res => res.url().includes('/save') && res.request().method() === 'POST',
        { timeout: 10000 }
      )
      await page.locator('#editorTextArea').fill(`# ${uniqueMarker}`)

      // Then: 明示的に save ボタンを押さなくても、書いた内容がローカルに保存されている
      const res = await saveResponsePromise
      const body = await res.json()
      expect(body.success).toBe(true)

      // ファイルシステムで内容が保存されたことを確認（ナビゲーションなしで）
      const savedContent = fs.readFileSync(post1Path, 'utf-8')
      expect(savedContent).toContain(uniqueMarker)
    } finally {
      // 元の内容に戻す（ファイルシステム直接）
      fs.writeFileSync(post1Path, originalContent)
    }
  })

  test('シナリオ 2: 新規作成したファイルに書いた内容も保存される', async ({ page }) => {
    const timestamp = Date.now()
    const filename = `post/acceptance-autosave-${timestamp}.md`
    createdFiles.push(path.join(srcDir, filename))

    // Given: 新規作成したファイルがエディタに開かれている
    const initDonePromise4 = page.waitForResponse(
      res => res.url().includes('/get_frontmatter_templates'),
      { timeout: 10000 }
    )
    await gotoWithRetry(page, '/editor')
    await initDonePromise4
    await page.locator('#newFileBtn').click()
    await page.locator('#newFileName').fill(filename)
    await page.locator('#confirmNewFile').click()
    await expect(page.locator('#editorTextArea')).toHaveValue(/title:/, { timeout: 10000 })

    // When: テキストを書く
    const uniqueMarker = `autosave-new-${timestamp}`
    const saveResponsePromise = page.waitForResponse(
      res => res.url().includes('/save') && res.request().method() === 'POST',
      { timeout: 10000 }
    )
    await page.locator('#editorTextArea').fill(`---\ntitle: test\n---\n# ${uniqueMarker}`)

    // Then: 書いた内容がローカルに保存されている
    const res = await saveResponsePromise
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})

// ─── US-03: プレビューを確認しながら書く ────────────────────────────────────────

test.describe('US-03: プレビューを確認しながら書く', () => {

  test('シナリオ 1: preview ボタンが存在せず、テキスト入力でプレビューが更新される', async ({ page }) => {
    const post1Path = path.join(process.cwd(), 'src-sample', 'pages', 'post', '1.md')
    const originalContent = fs.readFileSync(post1Path, 'utf-8')

    try {
      // Given: ファイルがエディタに開かれている
      // setCurrentFile() が currentFileName を更新するまで待つ（fetchData 完了のシグナル）
      await gotoWithRetry(page, '/editor?md=post/1.md')
      await page.waitForFunction(
        () => {
          const el = document.getElementById('currentFileName')
          return el !== null && el.textContent === 'post/1.md'
        },
        { timeout: 15000 }
      )

      // Given: preview ボタンは存在しない
      await expect(page.locator('input[value="preview"]')).not.toBeAttached()

      // When: テキストを書く
      const uniqueMarker = `preview-check-${Date.now()}`
      const previewResponsePromise = page.waitForResponse(
        res => res.url().includes('/preview') && res.request().method() === 'POST',
        { timeout: 10000 }
      )
      await page.locator('#editorTextArea').fill(`## ${uniqueMarker}`)

      // Then: プレビューペインに最新の内容が反映される
      await previewResponsePromise
      // waitForResponse は HTTP レスポンス受信を知らせるが、
      // JS の response.json() 解析と setAttribute('srcdoc') は非同期のため
      // toHaveAttribute のリトライで確実に確認する
      await expect(page.locator('#previewContent iframe')).toHaveAttribute(
        'srcdoc', new RegExp(uniqueMarker), { timeout: 5000 }
      )
    } finally {
      // 元の内容に戻す（ファイルシステム直接）
      fs.writeFileSync(post1Path, originalContent)
    }
  })
})

// ─── US-04: ファイルのナビゲーション ────────────────────────────────────────────

test.describe('US-04: ファイルのナビゲーション', () => {

  test('シナリオ 1: サイドバーのファイルをクリックして開く（セレクトボックスは存在しない）', async ({ page }) => {
    // Given: エディタ画面のサイドバーにディレクトリツリーが表示されている
    const initDonePromise5 = page.waitForResponse(
      res => res.url().includes('/get_frontmatter_templates'),
      { timeout: 10000 }
    )
    await gotoWithRetry(page, '/editor')
    await initDonePromise5

    // Given: ファイル選択セレクトボックスは存在しない
    await expect(page.locator('#selectDataFile')).not.toBeAttached()

    // When: サイドバーの post/ ディレクトリを展開してファイルをクリックする
    // post ディレクトリはビューポート外にあることがあるため JS で直接クリックする
    await page.locator('.sidebar details[data-dir="post"] summary').evaluate(el => (el as HTMLElement).click())
    const fileLink = page.locator('.sidebar a[href="/editor?md=post/1.md"]')
    await expect(fileLink).toBeAttached({ timeout: 3000 })

    // リンクをクリックするとナビゲーションが起きるため先に /preview を待機登録する
    const previewLoadPromise = page.waitForResponse(
      res => res.url().includes('/preview') && res.request().method() === 'POST',
      { timeout: 10000 }
    )
    await fileLink.evaluate(el => (el as HTMLElement).click())

    // Then: そのファイルがエディタに開かれる
    await expect(page).toHaveURL(/md=post\/1\.md/)
    await previewLoadPromise
    await expect(page.locator('#editorTextArea')).toHaveValue(/.+/)
  })
})
