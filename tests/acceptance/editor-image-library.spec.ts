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
// US-05〜US-06（公開状態導出・宣言）は未実装のため対象外。

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
    await page.locator('#confirmDialogActions button', { hasText: /^削除$/ }).click()

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
    await page.locator('#confirmDialogActions button', { hasText: '削除(参照も除去)' }).click()

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

// ─── US-03: 画像の移動（パスの付け替え） ────────────────────────────────────────────────
// 改名（ファイル名だけの変更）は同じ置き場所への移動の特殊な場合（問題定義 v5）。
// 移動先入力（#imageMoveInput）は image/ 相対の配置パス（階層可）。

test.describe('US-03: 画像の移動（パスの付け替え）', () => {
  test('シナリオ1: どの記事からも参照されていない画像を移動できる', async ({ page }) => {
    // Given: 画像ライブラリに画像が表示されている（参照なし）
    const relPath = 'image/acceptance-image-library-move/unreferenced.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const movedRelPath = 'image/acceptance-image-library-move-dest/moved-unreferenced.png'
    const movedAbsPath = path.join(srcDir, movedRelPath)
    createdPaths.push(path.dirname(movedAbsPath))

    // When: 新しいパス（別の置き場所）を入力して移動操作を行う
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageMoveInput').fill('acceptance-image-library-move-dest/moved-unreferenced.png')
    await page.locator('#imageMoveBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    // Then: 画像ファイルが新しいパスに移り、一覧で新しいパスに表示される
    await expect(page.locator('#operationFeedback')).toHaveText('移動しました')
    expect(fs.existsSync(movedAbsPath)).toBeTruthy()
    expect(fs.existsSync(absPath)).toBeFalsy()
    await expect(page.locator(`.image-node[data-image-path="${movedRelPath}"]`)).toBeVisible()
  })

  test('シナリオ2: ファイル名だけの変更（改名）もできる', async ({ page }) => {
    // Given: 画像ライブラリに画像が表示されている（参照なし）
    const relPath = 'image/acceptance-image-library-move/rename-only.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const renamedPath = path.join(path.dirname(absPath), 'renamed-only.png')

    // When: 置き場所は変えずファイル名だけを変えて移動操作を行う
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageMoveInput').fill('acceptance-image-library-move/renamed-only.png')
    await page.locator('#imageMoveBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    // Then: 画像ファイルが新しい名前に変更され、一覧に新しいファイル名で表示される
    await expect(page.locator('#operationFeedback')).toHaveText('移動しました')
    expect(fs.existsSync(renamedPath)).toBeTruthy()
    expect(fs.existsSync(absPath)).toBeFalsy()
  })

  test('シナリオ3〜4: 参照されている画像は参照記事の提示を経て「参照も書き換えて移動」できる', async ({ page }) => {
    // Given: 1つ以上の記事がその画像を参照している
    const relPath = 'image/acceptance-image-library-move/referenced-update.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-move-update.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: move-update\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)
    const movedRelPath = 'image/acceptance-image-library-move-dest/moved-referenced.png'
    createdPaths.push(path.dirname(path.join(srcDir, movedRelPath)))

    // When: 新しいパスを入力して移動操作を行う
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageMoveInput').fill('acceptance-image-library-move-dest/moved-referenced.png')
    await page.locator('#imageMoveBtn').click()

    // Then: 移動は即座には実行されず、参照記事一覧が提示される
    await expect(page.locator('#confirmDialogMessage')).toContainText(mdFile)
    await page.locator('#confirmDialogActions button', { hasText: '移動(参照も書き換え)' }).click()

    // Then: 参照していた記事の画像参照が新しいパスに書き換えられる
    await expect(page.locator('#operationFeedback')).toHaveText('移動しました')
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(`/${movedRelPath}`)
    expect(fs.existsSync(path.join(srcDir, movedRelPath))).toBeTruthy()
  })

  test('シナリオ5: 「参照はそのままにして移動」を選ぶと記事は変更されない', async ({ page }) => {
    // Given: 1つ以上の記事がその画像を参照している
    const relPath = 'image/acceptance-image-library-move/referenced-keep.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-move-keep.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: move-keep\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    // When: 移動操作で「参照はそのままにして移動」を選ぶ
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageMoveInput').fill('acceptance-image-library-move/renamed-referenced-keep.png')
    await page.locator('#imageMoveBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: /^移動$/ }).click()

    // Then: 画像は移動し、参照していた記事は変更されない
    await expect(page.locator('#operationFeedback')).toHaveText('移動しました')
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(path.basename(relPath))
  })

  test('シナリオ6: 「中止」を選ぶとパスも記事も変更されない', async ({ page }) => {
    // Given: 1つ以上の記事がその画像を参照している
    const relPath = 'image/acceptance-image-library-move/referenced-cancel.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
    const mdFile = 'acceptance-image-library-move-cancel.md'
    const mdPath = path.join(srcDir, 'pages', mdFile)
    fs.writeFileSync(mdPath, `---\ntitle: move-cancel\n---\n![alt](/${relPath})\n`)
    createdPaths.push(mdPath)

    // When: 移動操作で「中止」を選ぶ
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageMoveInput').fill('should-not-be-used/cancel.png')
    await page.locator('#imageMoveBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: '中止' }).click()

    // Then: 画像ファイルのパスは変更されず、記事も変更されない
    expect(fs.existsSync(absPath)).toBeTruthy()
    expect(fs.readFileSync(mdPath, 'utf-8')).toContain(relPath)
  })

  test('シナリオ7: 移動先にすでに同じパスの画像が存在する場合は移動されない', async ({ page }) => {
    // Given: 画像ライブラリに画像が表示されている
    const dir = 'image/acceptance-image-library-move-dup'
    const absDir = path.join(srcDir, dir)
    fs.mkdirSync(absDir, { recursive: true })
    fs.writeFileSync(path.join(absDir, 'a.png'), TINY_PNG)
    fs.writeFileSync(path.join(absDir, 'b.png'), TINY_PNG)
    createdPaths.push(absDir)

    // When: 既存の別の画像と同じパスになる入力で移動操作を行う
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${dir}/a.png"]`).click()
    await page.locator('#imageMoveInput').fill('acceptance-image-library-move-dup/b.png')
    await page.locator('#imageMoveBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    // Then: 移動は実行されず、パスが重複している旨がユーザーに伝わる
    await expect(page.locator('#operationFeedback')).toContainText('移動できませんでした')
    expect(fs.existsSync(path.join(absDir, 'a.png'))).toBeTruthy()
  })

  test('シナリオ8: 画像がUIから管理できなくなる付け替えは受け付けられない（F-02）', async ({ page }) => {
    // Given: 画像ライブラリに画像が表示されている
    const relPath = 'image/acceptance-image-library-move/still-image.png'
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))

    // When: 画像でない拡張子（例: .md）に変わる入力で移動操作を行う
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await page.locator('#imageMoveInput').fill('acceptance-image-library-move/still-image.md')
    await page.locator('#imageMoveBtn').click()
    await page.locator('#confirmDialogActions button', { hasText: 'OK' }).click()

    // Then: 移動は実行されず、受け付けられない旨がユーザーに伝わる
    await expect(page.locator('#operationFeedback')).toContainText('移動できませんでした')
    // Then: 画像は引き続き画像ライブラリから管理できる
    expect(fs.existsSync(absPath)).toBeTruthy()
    await expect(page.locator(`.image-node[data-image-path="${relPath}"]`)).toBeVisible()
  })
})

// ─── US-04: 画像ライブラリからの画像追加 ────────────────────────────────────────────────

async function openNewFileTab(page: Page) {
  const isClosed = await page.locator('main').evaluate(el => el.classList.contains('sidebar-close'))
  if (isClosed) {
    await page.locator('.sidebar-toggle').click()
  }
  await page.locator('.sidebar-tab[data-tab="new-file"]').click()
  await expect(page.locator('#sidebar-tabpanel-new-file')).toBeVisible()
}

test.describe('US-04: 画像ライブラリからの画像追加', () => {
  test('シナリオ 1: 新規作成から画像を追加できる', async ({ page }) => {
    createdPaths.push(path.join(srcDir, 'image/acceptance-image-library-us04'))

    // Given: エディタUIを開いている
    await gotoWithRetry(page, '/editor')
    await openNewFileTab(page)

    // When: 新規作成タブで画像ファイルを選び、配置パスを指定して追加する操作を行う
    await page.locator('#newFileImage').setInputFiles({
      name: 'added.png', mimeType: 'image/png', buffer: TINY_PNG,
    })
    // ファイル名入力にベース名がプリフィルされ、画像モードではテンプレート選択が無効になる
    await expect(page.locator('#newFileName')).toHaveValue('added.png')
    await expect(page.locator('#newFileTemplate')).toBeDisabled()
    await page.locator('#newFileName').fill('acceptance-image-library-us04/added.png')
    await page.locator('#confirmNewFile').click()

    // Then: 画像が src/image/ 配下に保存される（追加した画像が表示対象になり、URLが画像を特定する）
    await expect(page.locator('#imageDetailPanel')).toBeVisible()
    const imageParam = await page.evaluate(() => new URL(location.href).searchParams.get('image'))
    expect(imageParam).toMatch(/^image\/acceptance-image-library-us04\/added\./)
    expect(fs.existsSync(path.join(srcDir, imageParam!))).toBeTruthy()

    // And: 画像ライブラリの一覧にその画像が現れる
    await expect(page.locator(`.image-node[data-image-path="${imageParam}"]`)).toBeVisible()

    // And: 追加日時が記録される（詳細メタデータの追加日時が「不明」ではない）
    const metaText = await page.locator('.image-detail-meta').textContent()
    expect(metaText).not.toMatch(/追加日時\s*不明/)
  })

  // シナリオ 2「追加しただけでは公開されない」: 公開・同期は実 git 操作を伴うため、この共有フィクスチャ
  // では検証できない（sync-operations.spec.ts と同様の使い捨てリポジトリフィクスチャが必要）。
  // 参照に連動した公開状態の導出は US-05 のスコープであり、その受け入れテストで同期フィクスチャごと扱う。
  // 現実装では追加は /upload-image で完結し、リモートに触れる経路は同期操作のみ・公開対象コレクターは
  // 記事の参照からのみ画像を収集する（tests/editor/publish.test.js で検証済み）。
  test.skip('シナリオ 2: 追加しただけでは公開されない（同期フィクスチャが必要なため US-05 の受け入れテストで扱う）', async () => {})
})

// ─── US-07: 画像も記事と同じナビゲーションで扱える ────────────────────────────────────────────────

test.describe('US-07: 画像も記事と同じナビゲーションで扱える', () => {
  const relPath = 'image/acceptance-image-library-us07/nav.png'

  test.beforeAll(() => {
    const absPath = path.join(srcDir, relPath)
    fs.mkdirSync(path.dirname(absPath), { recursive: true })
    fs.writeFileSync(absPath, TINY_PNG)
    createdPaths.push(path.dirname(absPath))
  })

  test('シナリオ 1: リロードしても同じ表示が再現される', async ({ page }) => {
    // Given: 画像ライブラリで画像を選択し、その詳細が表示されている
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await expect(page.locator('#imageDetailPanel')).toBeVisible()

    // When: ブラウザをリロードする
    await page.reload()

    // Then: 同じ画像の詳細表示が再現される
    await expect(page.locator('#imageDetailPanel')).toBeVisible()
    await expect(page.locator('#imageDetailFileName')).toHaveText(relPath)
  })

  test('シナリオ 2: URLの直打ちで画像を開ける', async ({ page }) => {
    // Given: ある画像を特定するURLがある
    const url = '/editor?image=' + encodeURIComponent(relPath)

    // When: そのURLをブラウザで直接開く
    await gotoWithRetry(page, url)

    // Then: その画像の詳細が表示される
    await expect(page.locator('#imageDetailPanel')).toBeVisible()
    await expect(page.locator('#imageDetailFileName')).toHaveText(relPath)
  })

  test('シナリオ 3: サイドバーで選択中の画像が識別できる', async ({ page }) => {
    // Given: ある画像の詳細が表示されている
    await gotoWithRetry(page, '/editor')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await expect(page.locator('#imageDetailPanel')).toBeVisible()

    // When: サイドバーの画像一覧を見る
    // Then: 表示中の画像が選択状態として識別できる（ファイル一覧のアクティブ表示と同様）
    await expect(page.locator(`.image-node[data-image-path="${relPath}"]`)).toHaveClass(/(^| )active( |$)/)
  })

  test('シナリオ 4: ブラウザの「戻る」で遷移前の表示に戻れる', async ({ page }) => {
    // Given: 記事を開いた状態から画像を選択し、画像の詳細が表示されている
    await gotoWithRetry(page, '/editor?md=index.md')
    await openImagesTab(page)
    await page.locator(`.image-node[data-image-path="${relPath}"]`).click()
    await expect(page.locator('#imageDetailPanel')).toBeVisible()

    // When: ブラウザの「戻る」を操作する
    await page.goBack()

    // Then: 遷移前の記事の表示に戻る
    await expect(page.locator('#imageDetailPanel')).toBeHidden()
    await expect(page.locator('.textareaAndPreview')).toBeVisible()
    await expect(page).toHaveURL(/md=index\.md/)
  })
})
