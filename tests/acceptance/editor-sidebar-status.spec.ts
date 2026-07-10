import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ファイルシステムを共有するためシリアル実行する
test.describe.configure({ mode: 'serial' })

const srcDir = path.join(process.cwd(), 'src-sample', 'pages')
const createdFiles: string[] = []

async function gotoWithRetry(page: Page, url: string, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.goto(url)
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const isConnRefused =
        msg.includes('ERR_CONNECTION_REFUSED') ||
        msg.includes('NS_ERROR_CONNECTION_REFUSED')
      if (!isConnRefused || attempt === maxAttempts - 1) throw e
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

async function waitForSidebar(page: Page) {
  await page.waitForResponse(res => res.url().includes('/get_sidebar'), { timeout: 15000 })
}

test.afterAll(async () => {
  for (const f of createdFiles.splice(0)) {
    fs.rmSync(f, { force: true })
  }
})

test.describe('US-01: サイドバーで各ファイルの公開ステータスを識別する', () => {

  test('シナリオ 4: 公開済みファイルはステータスが変わっていないことがわかる', async ({ page }) => {
    // Given: すでに公開済みで、かつ編集されていないファイルが存在する
    await gotoWithRetry(page, '/editor')
    await waitForSidebar(page)

    // When: エディタのサイドバーを見る

    // Then: そのファイルのノードが「公開済み」の状態として表示されている（未公開・更新ありとは区別される）
    // ディレクトリ内ファイルは <details> が閉じていると非表示になるため DOM属性で検証する
    await expect(page.locator('.sidebar a[data-status="published"]')).not.toHaveCount(0)
    // ルートレベルの公開済みファイル（index.md）は常に可視
    const rootPublished = page.locator('.sidebar-files > ul > li > a[data-status="published"]')
    await expect(rootPublished.first()).toBeVisible()
  })

  test('シナリオ 1: 未公開ファイルが公開済みファイルと視覚的に区別される', async ({ page }) => {
    // Given: サイドバーに未公開のファイルと公開済みのファイルが両方存在する
    const timestamp = Date.now()
    const filename = `acceptance-sidebar-status-${timestamp}.md`
    const filepath = path.join(srcDir, filename)
    fs.writeFileSync(filepath, '# 未公開ファイル\n', 'utf-8')
    createdFiles.push(filepath)

    // サーバーがファイル追加を検知して再起動するため、gotoWithRetry で待機する
    await gotoWithRetry(page, '/editor')
    await waitForSidebar(page)

    // When: エディタのサイドバーを見る

    // Then: 未公開ファイルのノードと公開済みファイルのノードが見た目で区別できる状態で表示されている
    // 新規ファイルはルートレベル（常に可視）
    const newFile = page.locator(`.sidebar a[href*="${encodeURIComponent(filename)}"]`)
    await expect(newFile).toBeVisible()
    await expect(newFile).toHaveAttribute('data-status', 'new')

    // 公開済みファイルも存在し、data-status が "new" とは異なること
    await expect(page.locator('.sidebar a[data-status="published"]')).not.toHaveCount(0)
    await expect(newFile).not.toHaveAttribute('data-status', 'published')
  })

  test('シナリオ 2: 新規作成後に別ファイルへ移動してもどのファイルが未公開かわかる', async ({ page }) => {
    // Given: 新規作成したファイル（未公開）が存在する（シナリオ1で作成済み）
    await gotoWithRetry(page, '/editor')
    await waitForSidebar(page)

    // When: 別のファイルをサイドバーから選んで開く（index.md を直接開く）
    await gotoWithRetry(page, '/editor?md=index.md')
    await waitForSidebar(page)

    // Then: サイドバーに戻っても、新規作成したファイルのノードが公開済みのファイルと区別されて表示されている
    await expect(page.locator('.sidebar a[data-status="new"]')).not.toHaveCount(0)
    await expect(page.locator('.sidebar a[data-status="published"]')).not.toHaveCount(0)
  })

  test('シナリオ 3: 更新ありファイルが未公開・公開済みと区別される', async ({ page }) => {
    // このシナリオは「リモートに公開済みかつローカルに未コミットの変更がある」状態を要求する。
    // git commit/push 済みファイルをローカルで編集するセットアップが必要なため、手動確認とする。
    test.skip(true, '手動確認: リモート公開済みファイルをローカル編集した状態（modified）でdata-status="modified"が付与されることを確認する')
  })
})
