import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ファイルシステムを共有するためシリアル実行する
test.describe.configure({ mode: 'serial' })

const srcDir = path.join(process.cwd(), 'src-sample')
const createdPaths: string[] = []

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

test.afterAll(async () => {
  for (const p of createdPaths.splice(0)) {
    fs.rmSync(p, { force: true, recursive: true })
  }
  // image-library.json には削除済み画像のエントリが残るが、追加日時の記録なので実害はない
})

async function openImagesTab(page: Page) {
  const isClosed = await page.locator('main').evaluate(el => el.classList.contains('sidebar-close'))
  if (isClosed) {
    await page.locator('.sidebar-toggle').click()
  }
  await page.locator('.sidebar-tab[data-tab="images"]').click()
  await expect(page.locator('#sidebar-tabpanel-images')).toBeVisible()
}

// 1x1 透過 PNG（内容は問わないが、実在する画像ファイルとして置く）
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

// ─── US-01: 画像の一覧・プレビュー・メタデータ確認 ────────────────────────────────────────────────
// US-04〜US-06（追加・公開状態導出・宣言）は本セッションの実装スコープ外のため対象外。

test.describe('US-01: 画像の一覧・プレビュー・メタデータ確認', () => {
  test('シナリオ 1: 画像一覧を開くと全画像が表示される', async ({ page }) => {
    // Given: サイトに画像がアップロードされている
    const relPath = 'image/acceptance-image-library/scenario1.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))

    // When: エディタUIで画像ライブラリを開く
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)

    // Then: src/image 配下の全画像がサムネイル一覧として表示される
    await expect(page.locator(`.image-node[data-image-path="${relPath}"]`)).toBeVisible()
  })

  test('シナリオ 2: エディタ経由で追加された画像は追加日時も表示される', async ({ page, request }) => {
    // Given: 画像ライブラリに画像が一覧表示されている
    // （エディタのアップロードエンドポイントを経由して追加した画像 = 追加日時が記録される画像）
    const uploadRes = await request.post('/upload-image', {
      data: {
        imageData: TINY_PNG.toString('base64'),
        imageFilename: 'scenario2.png',
        mdFile: 'acceptance-image-library-scenario2.md',
      },
    })
    expect(uploadRes.ok()).toBeTruthy()
    const { markdownUrl } = await uploadRes.json()
    const relPath = markdownUrl.replace(/^\//, '')
    createdPaths.push(path.join(srcDir, path.dirname(relPath)))

    // When: 画像を選択・フォーカスする
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()

    // Then: その画像のファイル名・ファイルサイズ・解像度が表示される
    const meta = page.locator('.image-detail-meta')
    const metaText = await meta.textContent()
    expect(metaText).toContain(path.basename(relPath))
    expect(metaText).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB)/) // ファイルサイズ
    expect(metaText).toMatch(/\d+\s*×\s*\d+/) // 解像度
    // And: エディタ経由で追加された画像であれば追加日時も表示される（「不明」ではない）
    expect(metaText).not.toMatch(/追加日時\s*不明/)
  })

  test('シナリオ 3: エディタ導入以前からある画像は追加日時なしで表示される', async ({ page }) => {
    // Given: エディタを経由せずに配置された画像が src/image 配下に存在する
    const relPath = 'image/acceptance-image-library/legacy.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))

    // When: その画像を選択・フォーカスする
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()

    // Then: ファイル名・ファイルサイズ・解像度は表示される
    const meta = page.locator('.image-detail-meta')
    await expect(meta).toContainText('legacy.png')
    // And: 追加日時は「不明」等、記録がないことが分かる形で表示される
    await expect(meta).toContainText('不明')
  })

  // シナリオ 4「画像が1枚もない場合」は、この受け入れテストが共有する src-sample/image/ に
  // 既存の画像が多数存在するため、破壊的な削除なしには再現できない。
  // 空リスト時の描画（画像リスト表示の空状態分岐、画像リストコレクターの空配列）は
  // tests/editor/image-library.test.js のユニットテストで検証済み。
  test.skip('シナリオ 4: 画像が1枚もない場合（共有フィクスチャでは再現不可、ユニットテストで検証済み）', async () => {})
})

// ─── 画像ライブラリは画像の変化を一覧に反映し続け、記事編集画面と安全に共存できる ────────────────────────
// 実利用で発見された不具合(F-01, F-02)の回帰防止。ページ遷移を挟まない
// 同一ページ内での操作パターンを検証する(既存シナリオは gotoWithRetry で毎回遷移するため
// この種の不具合を検出できなかった)。

test.describe('画像ライブラリは画像の変化を一覧に反映し続け、記事編集画面と安全に共存できる', () => {
  test('画像リスト表示は画像タブを開くたびに最新の状態を反映できる(F-01)', async ({ page }) => {
    // Given: 記事を編集中
    const mdFile = 'acceptance-image-library-f01.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, '---\ntitle: f01\n---\nbody\n')
    createdPaths.push(mdPath)
    await gotoWithRetry(page, `/editor?md=${mdFile}`)

    // When: 記事編集画面から画像をアップロードする(ページ遷移なし)
    const markdownUrl = await page.evaluate(async (base64) => {
      const res = await fetch('/upload-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageData: base64, imageFilename: 'f01-uploaded.png', mdFile: 'acceptance-image-library-f01.md' })
      })
      return (await res.json()).markdownUrl
    }, TINY_PNG.toString('base64'))
    const relPath = markdownUrl.replace(/^\//, '')
    createdPaths.push(path.join(srcDir, path.dirname(relPath)))

    // And: リロードせずに画像タブを開く
    await openImagesTab(page)

    // Then: アップロードした画像がリロードなしで一覧に現れる
    await expect(page.locator(`.image-node[data-image-path="${relPath}"]`)).toBeVisible()
  })

  test('画像詳細表示は記事編集画面と操作エリアを共有し、画像タブを離れると自動的に閉じる(F-02)', async ({ page }) => {
    // Given: 記事を編集中で、画像ライブラリに画像が表示されている
    const relPath = 'image/acceptance-image-library-f02/scenario.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))

    const mdFile = 'acceptance-image-library-f02.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, '---\ntitle: f02\n---\nbody\n')
    createdPaths.push(mdPath)

    // When: 画像を選択して詳細表示を開く
    await gotoWithRetry(page, `/editor?md=${mdFile}`)
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()

    // Then: プレビューが表示され、操作エリア左側は画像パスに、右側は空(記事の操作ボタンなし)になる
    await expect(page.locator('#imageDetailPanel')).toBeVisible()
    await expect(page.locator('.textareaAndPreview')).toBeHidden()
    await expect(page.locator('#imageDetailFileName')).toHaveText(relPath)
    await expect(page.locator('#fileStatus')).toBeHidden()
    await expect(page.locator('#articleOptionsRight')).toBeHidden()

    // When: サイドバーの「Files」タブに切り替える(記事を選ぶ前に、タブ切り替えだけで)
    await page.locator('.sidebar-tab[data-tab="files"]').click()

    // Then: 画像詳細表示は自動的に閉じ、記事編集画面の操作エリアに戻る
    await expect(page.locator('#imageDetailPanel')).toBeHidden()
    await expect(page.locator('.textareaAndPreview')).toBeVisible()
    await expect(page.locator('#fileStatus')).toBeVisible()
    await expect(page.locator('#articleOptionsRight')).toBeVisible()
  })
})

// ─── US-02: 画像の削除 ────────────────────────────────────────────────

test.describe('US-02: 画像の削除', () => {
  test('シナリオ1: どの記事からも参照されていない画像を削除できる', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-delete/unreferenced.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageDeleteBtn').click()
    // 参照なしの確認ダイアログ（OK/キャンセル）で「OK」を押す
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')
    expect(fs.existsSync(absPath)).toBeFalsy()
    await expect(page.locator(`.image-node[data-image-path="${relPath}"]`)).toHaveCount(0)
  })

  test('シナリオ2〜3: 参照されている画像は参照記事の提示を経て「そのままにして削除」できる', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-delete/referenced-keep.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-delete-keep.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: keep\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageDeleteBtn').click()

    // Then: 削除は即座には実行されず、参照記事一覧（公開ステータス含む）が提示される
    await expect(page.locator('#confirmDialogMessage')).toContainText(mdFile)
    await page.locator('#confirmDialogActions button', { hasText: '参照はそのままにして削除' }).click()

    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')
    expect(fs.existsSync(absPath)).toBeFalsy()
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(relPath)
  })

  test('シナリオ4: 参照されている画像は「参照も除去して削除」できる', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-delete/referenced-update.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-delete-update.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: update\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageDeleteBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: '参照も除去して削除' }).click()

    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')
    expect(fs.existsSync(absPath)).toBeFalsy()
    expect(fs.readFileSync(mdPath, 'utf-8')).not.toContain(path.basename(relPath))
  })

  test('シナリオ5: 「中止」を選ぶと画像も記事も変更されない', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-delete/referenced-cancel.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-delete-cancel.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: cancel\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageDeleteBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: '中止' }).click()

    expect(fs.existsSync(absPath)).toBeTruthy()
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(relPath)
  })
})

// ─── US-03: 画像の改名 ────────────────────────────────────────────────

test.describe('US-03: 画像の改名', () => {
  test('シナリオ1: どの記事からも参照されていない画像を改名できる', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-rename/unreferenced.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const renamedPath = path.join(path.dirname(absPath), 'renamed-unreferenced.png')

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageRenameInput').fill('renamed-unreferenced.png')
    await page.locator('#imageRenameBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    await expect(page.locator('#operationFeedback')).toHaveText('改名しました')
    expect(fs.existsSync(renamedPath)).toBeTruthy()
    expect(fs.existsSync(absPath)).toBeFalsy()
  })

  test('シナリオ2〜3: 参照されている画像は参照記事の提示を経て「参照も書き換えて改名」できる', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-rename/referenced-update.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-rename-update.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: rename-update\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageRenameInput').fill('renamed-referenced.png')
    await page.locator('#imageRenameBtn').click()

    // Then: 改名は即座には実行されず、参照記事一覧が提示される
    await expect(page.locator('#confirmDialogMessage')).toContainText(mdFile)
    await page.locator('#confirmDialogActions button', { hasText: '参照も書き換えて改名' }).click()

    await expect(page.locator('#operationFeedback')).toHaveText('改名しました')
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain('renamed-referenced.png')
  })

  test('シナリオ4: 「参照はそのままにして改名」を選ぶと記事は変更されない', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-rename/referenced-keep.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-rename-keep.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: rename-keep\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageRenameInput').fill('renamed-referenced-keep.png')
    await page.locator('#imageRenameBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: '参照はそのままにして改名' }).click()

    await expect(page.locator('#operationFeedback')).toHaveText('改名しました')
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(path.basename(relPath))
  })

  test('シナリオ5: 「中止」を選ぶとファイル名も記事も変更されない', async ({ page }) => {
    const relPath = 'image/acceptance-image-library-rename/referenced-cancel.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-rename-cancel.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: rename-cancel\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageRenameInput').fill('should-not-be-used.png')
    await page.locator('#imageRenameBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: '中止' }).click()

    expect(fs.existsSync(absPath)).toBeTruthy()
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(relPath)
  })

  test('シナリオ6: すでに同名のファイルが存在する場合は改名されない', async ({ page }) => {
    const dir = 'image/acceptance-image-library-rename-dup'
    const absDir = path.join(srcDir, dir)
    fs.mkdirSync(absDir, { recursive: true })
    fs.writeFileSync(path.join(absDir, 'a.png'), TINY_PNG)
    fs.writeFileSync(path.join(absDir, 'b.png'), TINY_PNG)
    createdPaths.push(absDir)

    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${dir}/a.png"]`).click()
    await page.locator('#imageRenameInput').fill('b.png')
    await page.locator('#imageRenameBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    // Then: 改名は実行されず、重複している旨が伝わる
    await expect(page.locator('#operationFeedback')).toContainText('改名できませんでした')
    expect(fs.existsSync(path.join(absDir, 'a.png'))).toBeTruthy()
  })
})
