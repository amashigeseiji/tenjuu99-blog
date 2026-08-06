import { test, expect as baseExpect, type Page } from '@playwright/test'

// 公開・非公開は実際の git 操作（commit/push）を伴うため、既定の 5 秒では初回に間に合わないことがある
const expect = baseExpect.configure({ timeout: 15_000 })
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execSync, spawn, type ChildProcess } from 'node:child_process'

// 公開・非公開を実際に実行し、リモート（origin）からの画像の出入りを検証するため、
// 実プロジェクトではなく使い捨てのフィクスチャプロジェクトを対象にする。
// origin はローカルの bare リポジトリで、外部には一切届かない。
test.describe.configure({ mode: 'serial' })

// ブラウザプロジェクトごとに並列実行されるため、ポートをワーカーごとに分ける
let PORT: number
let BASE: string
const repoRoot = process.cwd()

let fixtureRoot: string
let projectDir: string
let originDir: string
let server: ChildProcess

const git = (args: string, cwd: string = projectDir) =>
  execSync(`git ${args}`, { cwd, stdio: 'pipe' }).toString()

const filesInOrigin = () => git('ls-tree -r --name-only main', originDir)
const pathInOrigin = (relPath: string) => filesInOrigin().includes(`src-sample/${relPath}`)

const articlePath = (filename: string) => path.join(projectDir, 'src-sample', 'pages', filename)
const ledgerPath = () => path.join(projectDir, 'src-sample', 'image-library.json')
const publishedReferredBy = (imagePath: string): string[] => {
  const ledger = JSON.parse(fs.readFileSync(ledgerPath(), 'utf-8'))
  return ledger[imagePath]?.publishedReferredBy ?? []
}

// 1x1 透過 PNG（内容は問わないが、実在する画像ファイルとして置く）
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

const createImage = (relPath: string) => {
  const abs = path.join(projectDir, 'src-sample', relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, TINY_PNG)
}

async function openArticle(page: Page, filename: string) {
  await page.goto(`${BASE}/editor?md=${filename}`)
}

async function openImagesTab(page: Page) {
  const isClosed = await page.locator('main').evaluate(el => el.classList.contains('sidebar-close'))
  if (isClosed) {
    await page.locator('.sidebar-toggle').click()
  }
  await page.locator('.sidebar-tab[data-tab="images"]').click()
  await expect(page.locator('#sidebar-tabpanel-images')).toBeVisible()
}

async function publishAndExpectSuccess(page: Page, expectedStatus: string = 'new') {
  await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', expectedStatus)
  await page.locator('#publishBtn').click()
  await expect(page.locator('#operationFeedback')).toHaveText('公開しました')
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/get_sidebar`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  const log = fs.readFileSync(path.join(fixtureRoot, 'server.log'), 'utf-8').slice(-2000)
  throw new Error(`フィクスチャサーバーが起動しませんでした:\n${log}`)
}

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(120000)
  PORT = 8220 + testInfo.parallelIndex
  BASE = `http://localhost:${PORT}`
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'image-library-publication-state-'))
  projectDir = path.join(fixtureRoot, 'blog')
  originDir = path.join(fixtureRoot, 'origin.git')
  fs.mkdirSync(projectDir)
  fs.cpSync(path.join(repoRoot, 'src-sample'), path.join(projectDir, 'src-sample'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'blog.json'), path.join(projectDir, 'blog.json'))
  // インストール済みプロジェクトを模す（@tenjuu99/blog の解決に必要）
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(projectDir, 'node_modules'))
  fs.writeFileSync(path.join(projectDir, '.gitignore'), 'node_modules\n.cache\ndist\n')

  git('init -b main')
  git('config user.email acceptance@example.com')
  git('config user.name acceptance')
  git('add -A')
  git('commit -m initial')
  execSync(`git init --bare "${originDir}"`, { stdio: 'pipe' })
  git(`remote add origin "${originDir}"`)
  git('push -u origin main')

  const logFd = fs.openSync(path.join(fixtureRoot, 'server.log'), 'w')
  server = spawn('node', [path.join(repoRoot, 'bin', 'server')], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', logFd, logFd],
  })
  await waitForServer()
})

test.afterAll(async () => {
  server?.kill('SIGINT')
  if (fixtureRoot && !process.env.KEEP_FIXTURE) fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

test.describe('US-05: 参照に連動した公開状態', () => {
  test('シナリオ1: 参照する記事の公開と共に画像が公開される', async ({ page }) => {
    // Given: 未公開の画像を参照する記事がある
    const filename = 'acceptance-us05-s1.md'
    createImage('image/post/us05-s1.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: s1\n---\n![alt](/image/post/us05-s1.png)\n')

    // When: その記事を公開する
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // Then: 画像も記事と共に公開される
    expect(pathInOrigin('image/post/us05-s1.png')).toBeTruthy()
    expect(publishedReferredBy('image/post/us05-s1.png')).toContain(filename)
  })

  test('シナリオ2: 唯一の参照記事の更新公開で参照を失った画像はリモートから取り除かれる', async ({ page }) => {
    // Given: 公開済みの画像があり、それを参照する公開済みの記事が1つだけある
    const filename = 'acceptance-us05-s2.md'
    createImage('image/post/us05-s2.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: s2\n---\n![alt](/image/post/us05-s2.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    expect(pathInOrigin('image/post/us05-s2.png')).toBeTruthy()

    // When: ローカルでその記事から参照を除去し、更新を公開する
    fs.writeFileSync(articlePath(filename), '---\ntitle: s2\n---\n本文（画像参照なし）\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')

    // Then: 記事の更新がリモートに反映され（記事自体はリモートに残る）
    expect(pathInOrigin(`pages/${filename}`)).toBeTruthy()
    expect(git(`show main:src-sample/pages/${filename}`, originDir)).not.toContain('us05-s2.png')
    // And: 画像もリモートから取り除かれる
    expect(pathInOrigin('image/post/us05-s2.png')).toBeFalsy()
    expect(publishedReferredBy('image/post/us05-s2.png')).toEqual([])
  })

  test('シナリオ3: 他の公開済み記事がまだ参照していれば取り除かれない', async ({ page }) => {
    // Given: 公開済みの画像を、2つの公開済み記事が参照している
    const fileA = 'acceptance-us05-s3-a.md'
    const fileB = 'acceptance-us05-s3-b.md'
    createImage('image/post/us05-s3.png')
    fs.writeFileSync(articlePath(fileA), '---\ntitle: s3a\n---\n![alt](/image/post/us05-s3.png)\n')
    fs.writeFileSync(articlePath(fileB), '---\ntitle: s3b\n---\n![alt](/image/post/us05-s3.png)\n')
    await openArticle(page, fileA)
    await publishAndExpectSuccess(page)
    await openArticle(page, fileB)
    await publishAndExpectSuccess(page)
    expect(publishedReferredBy('image/post/us05-s3.png').sort()).toEqual([fileA, fileB].sort())

    // When: 一方の記事から参照を除去して更新を公開する
    fs.writeFileSync(articlePath(fileA), '---\ntitle: s3a\n---\n本文（画像参照なし）\n')
    await openArticle(page, fileA)
    await publishAndExpectSuccess(page, 'modified')

    // Then: 記事の更新はリモートに反映されるが、画像はリモートに残る（他方の記事がまだ参照している）
    expect(git(`show main:src-sample/pages/${fileA}`, originDir)).not.toContain('us05-s3.png')
    expect(pathInOrigin('image/post/us05-s3.png')).toBeTruthy()
    expect(publishedReferredBy('image/post/us05-s3.png')).toEqual([fileB])
  })

  test('シナリオ4: ローカルで参照を消しただけでは、他の同期操作をしても画像は残る', async ({ page }) => {
    // Given: 公開済みの画像を参照する公開済みの記事があり、ローカルで参照が除去されている（未公開の変更）
    const filename = 'acceptance-us05-s4.md'
    const otherFilename = 'acceptance-us05-s4-other.md'
    createImage('image/post/us05-s4.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: s4\n---\n![alt](/image/post/us05-s4.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    fs.writeFileSync(articlePath(filename), '---\ntitle: s4\n---\n本文（画像参照なし・未公開の変更）\n')

    // When: 別の記事の公開という、他の同期操作を行う
    fs.writeFileSync(articlePath(otherFilename), '---\ntitle: s4-other\n---\n無関係の記事\n')
    await openArticle(page, otherFilename)
    await publishAndExpectSuccess(page)

    // Then: 画像はリモートに残る（リモートの記事がまだ参照しているため）
    expect(pathInOrigin('image/post/us05-s4.png')).toBeTruthy()
    expect(publishedReferredBy('image/post/us05-s4.png')).toContain(filename)
  })

  test('シナリオ5: 記事を非公開にすると、それが最後の参照だった画像も取り除かれる', async ({ page }) => {
    // Given: 公開済みの画像を参照する公開済みの記事が1つだけある
    const filename = 'acceptance-us05-s5.md'
    createImage('image/post/us05-s5.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: s5\n---\n![alt](/image/post/us05-s5.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    expect(pathInOrigin('image/post/us05-s5.png')).toBeTruthy()

    // When: その記事を非公開にする
    await page.locator('#unpublishBtn').click()
    await expect(page.locator('#operationFeedback')).toHaveText('非公開にしました')

    // Then: 記事がリモートから取り除かれる
    expect(pathInOrigin(`pages/${filename}`)).toBeFalsy()
    // And: 画像もリモートから取り除かれる
    expect(pathInOrigin('image/post/us05-s5.png')).toBeFalsy()
    expect(publishedReferredBy('image/post/us05-s5.png')).toEqual([])
  })
})

test.describe('US-06: 検出できない参照の宣言', () => {
  test('シナリオ1〜3: 宣言を付与すると自動非公開の対象にならず、解除すると通常の導出に戻る', async ({ page }) => {
    // Given: 公開済みの画像を参照する公開済みの記事が1つだけある
    const filename = 'acceptance-us06-s1.md'
    createImage('image/post/us06-s1.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us06\n---\n![alt](/image/post/us06-s1.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    expect(pathInOrigin('image/post/us06-s1.png')).toBeTruthy()

    // When: その画像に「検出外参照」の宣言を付与する
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/us06-s1.png"]').click()
    await expect(page.locator('.image-detail-declaration-toggle')).not.toBeChecked()
    await page.locator('.image-detail-declaration-toggle').check()
    await expect(page.locator('#operationFeedback')).toHaveText('宣言を付与しました')

    // Then: 宣言が保存される
    const ledgerAfterDeclare = JSON.parse(fs.readFileSync(ledgerPath(), 'utf-8'))
    expect(ledgerAfterDeclare['image/post/us06-s1.png'].protected).toBe(true)

    // When: 記事から参照を除去して更新を公開する（唯一の参照を失う）
    fs.writeFileSync(articlePath(filename), '---\ntitle: us06\n---\n本文（画像参照なし）\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')

    // Then: 宣言された画像は自動非公開（GC）の対象にならず、リモートに残る
    expect(pathInOrigin('image/post/us06-s1.png')).toBeTruthy()

    // When: 宣言を解除する
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/us06-s1.png"]').click()
    await expect(page.locator('.image-detail-declaration-toggle')).toBeChecked()
    await page.locator('.image-detail-declaration-toggle').uncheck()
    await expect(page.locator('#operationFeedback')).toHaveText('宣言を解除しました')
    const ledgerAfterUndeclare = JSON.parse(fs.readFileSync(ledgerPath(), 'utf-8'))
    expect(ledgerAfterUndeclare['image/post/us06-s1.png'].protected).toBe(false)

    // And: 以後は通常の導出（参照の有無）に従う。参照を戻してから再度失わせ、
    // 宣言なしの通常のGC判定で取り除かれることを確認する
    fs.writeFileSync(articlePath(filename), '---\ntitle: us06\n---\n![alt](/image/post/us06-s1.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')
    expect(pathInOrigin('image/post/us06-s1.png')).toBeTruthy()
    fs.writeFileSync(articlePath(filename), '---\ntitle: us06\n---\n本文（画像参照なし）\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')
    expect(pathInOrigin('image/post/us06-s1.png')).toBeFalsy()
  })
})

test.describe('US-08: 画像自身の公開状態の確認', () => {
  test('シナリオ1: 画像自身の公開状態が確認できる', async ({ page }) => {
    // Given: 画像ライブラリに画像が表示されている
    const filename = 'acceptance-us08-s1.md'
    createImage('image/post/us08-s1.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us08-s1\n---\n![alt](/image/post/us08-s1.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // When: 画像を確認する
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/us08-s1.png"]').click()

    // Then: その画像がリモートに存在するかどうかが画面から確認できる
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')
    await expect(page.locator('.image-detail-publication-status')).toContainText('公開済み')
  })

  test('シナリオ2: 記事の公開・非公開の結果が画像の公開状態に反映されて見える', async ({ page }) => {
    // Given: 画像を参照する記事があり、その画像の公開状態を確認できる状態にある
    const filename = 'acceptance-us08-s2.md'
    createImage('image/post/us08-s2.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us08-s2\n---\n![alt](/image/post/us08-s2.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/us08-s2.png"]').click()
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')

    // When: その記事を非公開にする
    await openArticle(page, filename)
    await page.locator('#unpublishBtn').click()
    await expect(page.locator('#operationFeedback')).toHaveText('非公開にしました')
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/us08-s2.png"]').click()

    // Then: 画像の公開状態の表示が、その結果を反映して変化する
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'new')
    await expect(page.locator('.image-detail-publication-status')).toContainText('未公開')
  })

  test('シナリオ3: 画像自身の公開状態と、参照記事の公開状態を混同しない', async ({ page }) => {
    // Given: 画像の詳細に、参照している記事の一覧とその公開状態が表示されている
    const filename = 'acceptance-us08-s3.md'
    createImage('image/post/us08-s3.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us08-s3\n---\n![alt](/image/post/us08-s3.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/us08-s3.png"]').click()

    // When: 画像自身の公開状態を確認する
    // Then: 参照記事の公開状態とは区別して、画像自身の公開状態が分かる（別のdt/ddで表示される）
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')
    await expect(page.locator('.image-detail-references')).toContainText(filename)
    await expect(page.locator('.image-detail-references')).toContainText('（公開済み）')
    // 画像自身の公開状態は参照記事一覧の要素とは別のdd
    await expect(page.locator('.image-detail-publication-status')).not.toHaveText(await page.locator('.image-detail-references').textContent() ?? '__never__')
  })
})

test.describe('US-04 シナリオ2: 追加しただけでは公開されない', () => {
  test('どの記事からも参照されない画像は、他の記事を公開しても公開されない', async ({ page }) => {
    // Given: 画像ライブラリに画像が追加されている（どの記事からも参照されていない）
    createImage('image/post/us04-s2.png')

    // When: 無関係な記事を公開する（何らかの同期操作が起きても）
    const filename = 'acceptance-us04-s2-other.md'
    fs.writeFileSync(articlePath(filename), '---\ntitle: us04-s2-other\n---\n無関係の記事\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // Then: 参照されていない画像はリモートに公開されていない
    expect(pathInOrigin('image/post/us04-s2.png')).toBeFalsy()
  })
})

// ---------------------------------------------------------------------------
// US-09 / US-10（リモート未達の可視化・リモート残存の解消フェーズ）
// ---------------------------------------------------------------------------

// 画像詳細のメタデータ欄から移動（パスの付け替え）を行う。
// 参照記事があるときは3択、無いときはOK/キャンセルの確認ダイアログを経る。
async function moveImageViaUI(
  page: Page,
  imagePath: string,
  destPath: string,
  referenceHandling: 'none' | 'keep' | 'update' = 'none'
) {
  await openImagesTab(page)
  await page.locator(`.image-node[data-image-path="${imagePath}"]`).click()
  await page.locator('.image-detail-filename-edit-btn').click()
  await page.locator('.image-detail-filename-input').fill(destPath)
  await page.locator('.image-detail-filename-save-btn').click()
  const choice = referenceHandling === 'update' ? '移動(参照も書き換え)'
    : referenceHandling === 'keep' ? '移動'
    : 'OK'
  await page.locator('#confirmDialogActions button', { hasText: choice }).first().click()
  await expect(page.locator('#operationFeedback')).toHaveText('移動しました')
}

async function openImageDetail(page: Page, imagePath: string) {
  await openImagesTab(page)
  await page.locator(`.image-node[data-image-path="${imagePath}"]`).click()
}

test.describe('US-09: リモートに届いていない変更が分かる公開状態', () => {
  test('シナリオ1: 公開済みの画像を移動すると、届いていないことが分かる', async ({ page }) => {
    // Given: 公開済みの画像がある
    const filename = 'acceptance-us09-s1.md'
    createImage('image/post/us09-s1.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us09-s1\n---\n![alt](/image/post/us09-s1.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    await openImageDetail(page, 'image/post/us09-s1.png')
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')

    // When: その画像を移動する（参照はそのままにする）
    await moveImageViaUI(page, 'image/post/us09-s1.png', 'post/us09-s1-moved.png', 'keep')

    // Then: 画像の公開状態は「公開済み」のままではなくなり、
    // And:  リモートにまだ届いていない変更として、単一のエントリの「更新あり」として読める
    await openImageDetail(page, 'image/post/us09-s1-moved.png')
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'modified')
    await expect(page.locator('.image-detail-publication-status')).toContainText('更新あり')
    await expect(page.locator('.image-node[data-image-path="image/post/us09-s1.png"]')).toHaveCount(0)
  })

  test('シナリオ2: 同期すると、届いたことが分かる', async ({ page }) => {
    // Given: 移動したがまだリモートに届いていない画像がある
    const filename = 'acceptance-us09-s2.md'
    createImage('image/post/us09-s2.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us09-s2\n---\n![alt](/image/post/us09-s2.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    await moveImageViaUI(page, 'image/post/us09-s2.png', 'post/us09-s2-moved.png', 'update')
    await openImageDetail(page, 'image/post/us09-s2-moved.png')
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'modified')

    // When: その画像を参照する記事の同期操作（更新の公開）を行う
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')

    // Then: 画像の公開状態が「公開済み」になり、リモートの実体がローカルの実体と対応している
    await openImageDetail(page, 'image/post/us09-s2-moved.png')
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')
    await expect(page.locator('.image-detail-publication-status')).toContainText('公開済み')
    expect(pathInOrigin('image/post/us09-s2-moved.png')).toBeTruthy()
  })

  test('シナリオ3: 移動以外の食い違いでも同じ区別が働く', async ({ page }) => {
    // Given: 公開済みの画像がある
    const filename = 'acceptance-us09-s3.md'
    createImage('image/post/us09-s3.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us09-s3\n---\n![alt](/image/post/us09-s3.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    await openImageDetail(page, 'image/post/us09-s3.png')
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')

    // When: 同じパスに別の内容の画像を置き直す（移動を伴わない食い違い）
    fs.appendFileSync(path.join(projectDir, 'src-sample', 'image/post/us09-s3.png'), Buffer.from([0x00, 0x01]))

    // Then: リモートにまだ届いていない変更があることが分かる
    await openImageDetail(page, 'image/post/us09-s3.png')
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'modified')
    await expect(page.locator('.image-detail-publication-status')).toContainText('更新あり')
  })

  test('シナリオ4: 記事と同じ理解のされ方をする', async ({ page }) => {
    // Given: 記事と画像がそれぞれ表示されている
    const filename = 'acceptance-us09-s4.md'
    createImage('image/post/us09-s4.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us09-s4\n---\n![alt](/image/post/us09-s4.png)\n')
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveText('(未公開)')

    // When: 双方の公開状態を見る
    await openImageDetail(page, 'image/post/us09-s4.png')

    // Then: 画像の公開状態は、記事の公開ステータスと同じ言葉・同じ記号で理解できる
    await expect(page.locator('.image-detail-publication-status')).toContainText('未公開')
    await expect(page.locator('.image-node[data-image-path="image/post/us09-s4.png"]')).toHaveAttribute('data-status', 'new')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    await expect(page.locator('#publicationStatus')).toHaveText('(公開済み)')
    await openImageDetail(page, 'image/post/us09-s4.png')
    await expect(page.locator('.image-detail-publication-status')).toContainText('公開済み')
    await expect(page.locator('.image-node[data-image-path="image/post/us09-s4.png"]')).toHaveAttribute('data-status', 'published')
  })
})

test.describe('US-10: リモートにのみ存在する画像の解消', () => {
  test('シナリオ1: 移動で使われなくなった旧パスは、次の同期でリモートから取り除かれる', async ({ page }) => {
    // Given: 公開済みの画像があり、それを参照する公開済みの記事がある
    const filename = 'acceptance-us10-s1.md'
    createImage('image/post/us10-s1.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us10-s1\n---\n![alt](/image/post/us10-s1.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    expect(pathInOrigin('image/post/us10-s1.png')).toBeTruthy()

    // When: その画像を移動し、参照も新しいパスに書き換えて、記事の更新を公開する
    await moveImageViaUI(page, 'image/post/us10-s1.png', 'post/us10-s1-moved.png', 'update')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')

    // Then: 新しいパスの画像がリモートに存在し、旧パスの画像はリモートから取り除かれている
    expect(pathInOrigin('image/post/us10-s1-moved.png')).toBeTruthy()
    expect(pathInOrigin('image/post/us10-s1.png')).toBeFalsy()
  })

  test('シナリオ2: リモートにのみ存在する画像が画面で確認できる', async ({ page }) => {
    // Given: ローカルに実体がなく、リモートにのみ存在する画像がある
    // （公開したあとエディタの外でローカルの実体だけを失った状態）
    const filename = 'acceptance-us10-s2.md'
    createImage('image/post/us10-s2.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us10-s2\n---\n![alt](/image/post/us10-s2.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    expect(pathInOrigin('image/post/us10-s2.png')).toBeTruthy()
    fs.rmSync(path.join(projectDir, 'src-sample', 'image/post/us10-s2.png'))

    // When: 画像ライブラリを開く
    await page.goto(`${BASE}/editor`)
    await openImagesTab(page)

    // Then: ローカルの画像ツリーとは別の枠から、その画像の存在が確認できる
    await expect(page.locator('.remote-only-images')).toBeVisible()
    await expect(page.locator('.remote-only-image-path')).toContainText('image/post/us10-s2.png')
    // And: ローカルの実体がないことが分かる（画像ツリーには現れない）
    await expect(page.locator('.image-node[data-image-path="image/post/us10-s2.png"]')).toHaveCount(0)
  })

  test('シナリオ3: リモートにのみ存在する画像を操作できる', async ({ page }) => {
    // Given: リモートにのみ存在する画像が別枠に表示されている
    const filename = 'acceptance-us10-s3.md'
    createImage('image/post/us10-s3.png')
    fs.writeFileSync(articlePath(filename), '---\ntitle: us10-s3\n---\n![alt](/image/post/us10-s3.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    fs.rmSync(path.join(projectDir, 'src-sample', 'image/post/us10-s3.png'))
    await page.goto(`${BASE}/editor`)
    await openImagesTab(page)
    await expect(page.locator('.remote-only-image-remove-btn[data-image-path="image/post/us10-s3.png"]')).toBeVisible()

    // When: その画像を取り除く
    await page.locator('.remote-only-image-remove-btn[data-image-path="image/post/us10-s3.png"]').click()
    await page.locator('#confirmDialogActions button', { hasText: '取り除く' }).click()

    // Then: リモートからその画像が取り除かれ、別枠からも消える
    await expect(page.locator('#operationFeedback')).toContainText('取り除きました')
    expect(pathInOrigin('image/post/us10-s3.png')).toBeFalsy()
    await expect(page.locator('.remote-only-image-path', { hasText: 'image/post/us10-s3.png' })).toHaveCount(0)
  })
})
