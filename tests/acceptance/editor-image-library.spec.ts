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
// US-02〜US-06（追加・削除・改名・公開状態導出・宣言）は本セッションの実装スコープ外のため対象外。

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
  // 空一覧時の描画（画像一覧表示の空状態分岐、画像一覧コレクターの空配列）は
  // tests/editor/image-library.test.js のユニットテストで検証済み。
  test.skip('シナリオ 4: 画像が1枚もない場合（共有フィクスチャでは再現不可、ユニットテストで検証済み）', async () => {})
})

// ─── 画像ライブラリは画像の変化を一覧に反映し続け、記事編集画面と安全に共存できる ────────────────────────
// 実利用で発見された不具合(F-01, F-02)の回帰防止。ページ遷移を挟まない
// 同一ページ内での操作パターンを検証する(既存シナリオは gotoWithRetry で毎回遷移するため
// この種の不具合を検出できなかった)。

test.describe('画像ライブラリは画像の変化を一覧に反映し続け、記事編集画面と安全に共存できる', () => {
  test('画像一覧は画像タブを開くたびに最新の状態を反映できる(F-01)', async ({ page }) => {
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
    await expect(page.locator('.editor-options-right')).toBeHidden()

    // When: サイドバーの「Files」タブに切り替える(記事を選ぶ前に、タブ切り替えだけで)
    await page.locator('.sidebar-tab[data-tab="files"]').click()

    // Then: 画像詳細表示は自動的に閉じ、記事編集画面の操作エリアに戻る
    await expect(page.locator('#imageDetailPanel')).toBeHidden()
    await expect(page.locator('.textareaAndPreview')).toBeVisible()
    await expect(page.locator('#fileStatus')).toBeVisible()
    await expect(page.locator('.editor-options-right')).toBeVisible()
  })
})
