import { test, expect as baseExpect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as http from 'node:http'
import { execSync, spawn, type ChildProcess } from 'node:child_process'
// @ts-ignore — JS のテストフィクスチャ（bare git リポジトリを裏に持つ偽 GitHub API）
import { createFakeGitHub } from '../publishing/fixtures/fakeGitHub.js'

// 出典: plans/gitless-publication-means/user-story.md（2026-08-15）
//
// 「git の無い環境」= マシン B。GitHub 手段（publish.means: github）で動くエディタのサーバーを、
// git を含まない PATH で起動する（git を呼べば失敗する）。リモートは GitHub の API を模した
// ローカルの HTTP サーバーで、実体は bare git リポジトリ。「git 運用のマシン」= マシン A は
// その bare リポジトリの clone。外部には一切届かない。
const expect = baseExpect.configure({ timeout: 15_000 })
test.describe.configure({ mode: 'serial' })

const PORT = 8210
const GITHUB_PORT = 8211
const BASE = `http://localhost:${PORT}`
const TOKEN = 'acceptance-token'
const repoRoot = process.cwd()

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

let fixtureRoot: string
let originDir: string
let machineA: string
let machineB: string
let server: ChildProcess
let fakeGitHub: http.Server

const git = (args: string, cwd: string = machineA) =>
  execSync(`git ${args}`, { cwd, stdio: 'pipe' }).toString()
const filesInOrigin = () => git('ls-tree -r --name-only main', originDir)
const commitCountInOrigin = () => Number(git('rev-list --count main', originDir).trim())

const articlePathB = (filename: string) => path.join(machineB, 'src-sample', 'pages', filename)
const articlePathA = (filename: string) => path.join(machineA, 'src-sample', 'pages', filename)
const imagePathB = (rel: string) => path.join(machineB, 'src-sample', 'image', rel)

const writeArticleB = (filename: string, content: string) => {
  fs.mkdirSync(path.dirname(articlePathB(filename)), { recursive: true })
  fs.writeFileSync(articlePathB(filename), content)
}
const writeImageB = (rel: string) => {
  fs.mkdirSync(path.dirname(imagePathB(rel)), { recursive: true })
  fs.writeFileSync(imagePathB(rel), TINY_PNG)
}

// マシン A（git 運用）での執筆と公開
const publishFromMachineA = (files: Record<string, string | Buffer>) => {
  git('pull -q --ff-only')
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(machineA, 'src-sample', rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
  git('add -A')
  git('commit -q -m publish')
  git('push -q')
}

async function openArticle(page: Page, filename: string) {
  await page.goto(`${BASE}/editor?md=${filename}`)
}
async function chooseInConfirmDialog(page: Page, label: string) {
  await page.locator('#confirmDialog').waitFor({ state: 'visible' })
  await page.locator('#confirmDialogActions').getByRole('button', { name: label, exact: true }).click()
}
async function openImagesTab(page: Page) {
  const isClosed = await page.locator('main').evaluate(el => el.classList.contains('sidebar-close'))
  if (isClosed) await page.locator('.sidebar-toggle').click()
  await page.locator('.sidebar-tab[data-tab="images"]').click()
  await expect(page.locator('#sidebar-tabpanel-images')).toBeVisible()
}
async function publishAndExpectSuccess(page: Page, expectedStatus: string = 'new') {
  await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', expectedStatus)
  await page.locator('#publishBtn').click()
  await expect(page.locator('#operationFeedback')).toHaveText('公開しました')
  await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
}
async function pull(page: Page) {
  await page.goto(`${BASE}/editor`)
  await page.locator('#pullBtn').click()
  return page.locator('#operationFeedback')
}
const NO_GIT_WORDS = /commit|push|pull|fetch|merge|SHA|コミット|プッシュ|マージ/i

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/get_sidebar`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  const log = fs.readFileSync(path.join(fixtureRoot, 'server.log'), 'utf-8').slice(-3000)
  throw new Error(`マシン B のサーバーが起動しませんでした:\n${log}`)
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sidebar-is-open', 'true'))
})

test.beforeAll(async () => {
  test.setTimeout(120000)
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gitless-means-'))
  originDir = path.join(fixtureRoot, 'origin.git')
  machineA = path.join(fixtureRoot, 'machine-a')
  machineB = path.join(fixtureRoot, 'machine-b')

  // 共有リモート（bare）と、git 運用のマシン A
  execSync(`git init -q --bare -b main "${originDir}"`, { stdio: 'pipe' })
  execSync(`git clone -q "${originDir}" "${machineA}"`, { stdio: 'pipe' })
  git('config user.email machine-a@example.com')
  git('config user.name machine-a')
  git('config commit.gpgsign false')
  git('checkout -q -b main')
  fs.cpSync(path.join(repoRoot, 'src-sample'), path.join(machineA, 'src-sample'), { recursive: true })
  const blogConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'blog.json'), 'utf-8'))
  blogConfig.url_base = BASE
  blogConfig.publish = {
    means: 'github',
    github: { owner: 'acceptance', repo: 'blog', branch: 'main', api_base: `http://127.0.0.1:${GITHUB_PORT}` },
  }
  fs.writeFileSync(path.join(machineA, 'blog.json'), JSON.stringify(blogConfig, null, 2) + '\n')
  fs.writeFileSync(path.join(machineA, '.gitignore'), 'node_modules\n.cache\ndist\n.blog\n')
  git('add -A')
  git('commit -q -m initial')
  git('push -q -u origin main')

  // git の無いマシン B: clone 済み相当のフォルダ（.git は無い）＋手元だけの認証情報
  fs.cpSync(machineA, machineB, { recursive: true, filter: (src) => !src.includes(`${path.sep}.git${path.sep}`) && !src.endsWith(`${path.sep}.git`) })
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(machineB, 'node_modules'))
  fs.mkdirSync(path.join(machineB, '.blog'))
  fs.writeFileSync(path.join(machineB, '.blog', 'credentials.json'), JSON.stringify({ github: { token: TOKEN } }))

  // GitHub を模したローカル API（実体は origin の bare リポジトリ）
  const gh = createFakeGitHub({ bareDir: originDir, owner: 'acceptance', repo: 'blog', token: TOKEN })
  fakeGitHub = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = chunks.length ? Buffer.concat(chunks).toString() : undefined
    const response = await gh.fetch(`http://127.0.0.1:${GITHUB_PORT}${req.url}`, { method: req.method, headers: req.headers as any, body })
    res.writeHead(response.status, { 'content-type': 'application/json' })
    res.end(await response.text())
  })
  await new Promise<void>(resolve => fakeGitHub.listen(GITHUB_PORT, resolve))

  // マシン B のサーバーを、git を含まない PATH で起動する（node だけが見える）
  const binDir = path.join(fixtureRoot, 'bin-without-git')
  fs.mkdirSync(binDir)
  fs.symlinkSync(process.execPath, path.join(binDir, 'node'))
  const logFd = fs.openSync(path.join(fixtureRoot, 'server.log'), 'w')
  server = spawn(process.execPath, [path.join(repoRoot, 'bin', 'server')], {
    cwd: machineB,
    env: { HOME: process.env.HOME ?? '', PATH: binDir, PORT: String(PORT) },
    stdio: ['ignore', logFd, logFd],
  })
  await waitForServer()
})

test.afterAll(async () => {
  server?.kill('SIGINT')
  await new Promise<void>(resolve => fakeGitHub ? fakeGitHub.close(() => resolve()) : resolve())
  if (fixtureRoot && !process.env.KEEP_FIXTURE) fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

test.describe('US-01: git の無い環境での同期操作', () => {
  test('シナリオ 1: 記事を公開する', async ({ page }) => {
    // Given: git がインストールされていない環境に、リモートと同期済みのコンテンツルートがあり、新しい記事を書いて保存してある
    const filename = 'gitless-us01-s1.md'
    writeArticleB(filename, '# git 無しで公開する記事\n本文\n')
    await openArticle(page, filename)

    // When: 公開の操作をする
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()

    // Then: 記事がリモートに反映され、公開済みになる
    await expect(page.locator('#operationFeedback')).toHaveText('公開しました')
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
    // And: 操作の過程で git の言葉（commit・push 等）が現れない
    expect((await page.locator('#operationFeedback').textContent()) ?? '').not.toMatch(NO_GIT_WORDS)
    expect(await page.locator('#publishBtn').textContent()).not.toMatch(NO_GIT_WORDS)
  })

  test('シナリオ 2: 公開済みの記事を非公開にする', async ({ page }) => {
    // Given: git がインストールされていない環境で、公開済みの記事がある（シナリオ 1 の記事）
    const filename = 'gitless-us01-s1.md'
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')

    // When: 非公開の操作をする
    await page.locator('#unpublishBtn').click()

    // Then: 記事がリモートから取り除かれる
    await expect(page.locator('#operationFeedback')).toHaveText('非公開にしました')
    expect(filesInOrigin()).not.toContain(`src-sample/pages/${filename}`)
    // And: 原稿は手元に残り、再公開できる
    expect(fs.existsSync(articlePathB(filename))).toBe(true)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()
    await expect(page.locator('#operationFeedback')).toHaveText('公開しました')
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
  })

  test('シナリオ 3: 記事を削除する', async ({ page }) => {
    // Given: git がインストールされていない環境で、公開済みの記事がある
    const filename = 'gitless-us01-s3.md'
    writeArticleB(filename, '# 削除する記事\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // When: 削除の操作をする（非公開にしてから削除）
    await page.locator('#unpublishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#deleteBtn').click()
    await chooseInConfirmDialog(page, 'OK')

    // Then: 記事が手元からもリモートからも無くなり、残骸が残らない
    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')
    expect(fs.existsSync(articlePathB(filename))).toBe(false)
    expect(filesInOrigin()).not.toContain(`src-sample/pages/${filename}`)
    await expect(page.locator(`.sidebar a[href="/editor?md=${encodeURIComponent(filename)}"]`)).toHaveCount(0)
  })

  test('シナリオ 4: リモートの内容を取り込む', async ({ page }) => {
    // Given: リモートには別のマシンで公開された新しい記事がある
    const filename = 'gitless-us01-s4.md'
    publishFromMachineA({ [`pages/${filename}`]: '# 別のマシンの記事\n本文\n' })
    expect(fs.existsSync(articlePathB(filename))).toBe(false)

    // When: 取り込みの操作をする
    const feedback = await pull(page)

    // Then: 新しい記事が手元に現れ、続きを書ける
    await expect(feedback).toContainText('1件を取り込みました')
    expect(fs.existsSync(articlePathB(filename))).toBe(true)
    await openArticle(page, filename)
    await expect(page.locator('#editorTextArea')).toHaveValue(/別のマシンの記事/)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    // And: 操作の過程で git の言葉（pull・merge 等）が現れない
    expect((await feedback.textContent()) ?? '').not.toMatch(NO_GIT_WORDS)
  })

  test('シナリオ 5: 画像を参照する記事を公開する', async ({ page }) => {
    // Given: 本文から画像を参照する記事を書いてある
    const filename = 'gitless-us01-s5.md'
    writeImageB('post/gitless-us01-s5.png')
    writeArticleB(filename, '---\ntitle: us01-s5\n---\n![alt](/image/post/gitless-us01-s5.png)\n')
    const before = commitCountInOrigin()
    await openArticle(page, filename)

    // When: 公開の操作をする
    await publishAndExpectSuccess(page)

    // Then: 記事と参照画像の両方がリモートに反映され、記事も画像も公開済みになる
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
    expect(filesInOrigin()).toContain('src-sample/image/post/gitless-us01-s5.png')
    await openImagesTab(page)
    await page.locator('.image-node[data-image-path="image/post/gitless-us01-s5.png"]').click()
    await expect(page.locator('.image-detail-publication-status')).toHaveAttribute('data-status', 'published')
    // And: 画像だけ・記事だけという中途半端な状態にならない（一度の反映で届く＝リモートの版は一つだけ増える）
    expect(commitCountInOrigin()).toBe(before + 1)
  })

  test('シナリオ 6: 画像の公開状態が git 手段と同じ意味で判定される', async ({ page }) => {
    // Given: 公開済みの記事が参照していた画像が、リモートにだけ残っている（手元の実体を失った）
    const filename = 'gitless-us01-s6.md'
    writeImageB('post/gitless-us01-s6.png')
    writeArticleB(filename, '---\ntitle: us01-s6\n---\n![alt](/image/post/gitless-us01-s6.png)\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    fs.rmSync(imagePathB('post/gitless-us01-s6.png'))

    // When: 画像の一覧を見る
    await page.goto(`${BASE}/editor`)
    await openImagesTab(page)

    // Then: 画像の公開状態（リモートに残存）が git 運用のマシンで見たときと同じ読みで示される
    await expect(page.locator('.remote-only-images')).toBeVisible()
    await expect(page.locator('.remote-only-image-path', { hasText: 'image/post/gitless-us01-s6.png' })).toHaveCount(1)
    await expect(page.locator('.image-node[data-image-path="image/post/gitless-us01-s6.png"]')).toHaveCount(0)
    // And: 残存している画像をリモートから取り除く操作ができる
    await page.locator('.remote-only-image-remove-btn[data-image-path="image/post/gitless-us01-s6.png"]').click()
    await page.locator('#confirmDialogActions button', { hasText: '取り除く' }).click()
    await expect(page.locator('#operationFeedback')).toContainText('取り除きました')
    expect(filesInOrigin()).not.toContain('src-sample/image/post/gitless-us01-s6.png')
    await expect(page.locator('.remote-only-image-path', { hasText: 'image/post/gitless-us01-s6.png' })).toHaveCount(0)
  })

  test('シナリオ 7: 別のマシンで公開された画像付き記事を取り込む', async ({ page }) => {
    // Given: リモートには別のマシンで公開された画像付きの記事がある
    const filename = 'gitless-us01-s7.md'
    publishFromMachineA({
      [`pages/${filename}`]: '---\ntitle: us01-s7\n---\n# 別のマシンの画像付き記事\n![alt](/image/post/gitless-us01-s7.png)\n',
      'image/post/gitless-us01-s7.png': TINY_PNG,
    })

    // When: 取り込みの操作をする
    const feedback = await pull(page)

    // Then: 記事と参照画像の両方が手元に現れ、プレビューで画像が表示される
    await expect(feedback).toContainText('2件を取り込みました')
    expect(fs.existsSync(articlePathB(filename))).toBe(true)
    expect(fs.readFileSync(imagePathB('post/gitless-us01-s7.png')).equals(TINY_PNG)).toBe(true)
    await openArticle(page, filename)
    const previewFrame = page.frameLocator('#previewContent iframe')
    await expect(previewFrame.locator('img[src*="gitless-us01-s7.png"]')).toBeAttached()
    const img = await page.request.get(`${BASE}/image/post/gitless-us01-s7.png`)
    expect(img.ok()).toBe(true)
  })
})

test.describe('US-02: git 運用のマシンとの混在', () => {
  test('シナリオ 1: git 運用のマシンで公開した記事を、git の無い環境で取り込む', async ({ page }) => {
    // Given: マシン A（git 運用）で記事を公開してある
    const filename = 'gitless-us02-s1.md'
    publishFromMachineA({ [`pages/${filename}`]: '# A で公開\n' })

    // When: マシン B（git の無い環境）で取り込みの操作をする
    const feedback = await pull(page)

    // Then: マシン A で公開した記事がマシン B の手元に現れる
    await expect(feedback).toContainText('1件を取り込みました')
    expect(fs.readFileSync(articlePathB(filename), 'utf-8')).toContain('A で公開')
  })

  test('シナリオ 2: git の無い環境で公開した記事を、git 運用のマシンで取り込む', async ({ page }) => {
    // Given: マシン B（git の無い環境）で記事を公開してある
    const filename = 'gitless-us02-s2.md'
    writeArticleB(filename, '# B で公開\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // When: マシン A（git 運用）で取り込みの操作をする
    git('pull -q --ff-only')

    // Then: マシン B で公開した記事がマシン A の手元に現れる
    expect(fs.readFileSync(articlePathA(filename), 'utf-8')).toContain('B で公開')
    // And: マシン A のその後の git 運用（公開・更新）が今まで通り機能する
    publishFromMachineA({ [`pages/${filename}`]: '# B で公開\nA で更新\n' })
    expect(git('status --porcelain').trim()).toBe('')
    expect(git('log --merges --oneline').trim()).toBe('')
  })

  test('シナリオ 3: 既存の git 運用が退行しない', async ({ page }) => {
    // Given: git 運用のマシンだけを使い続ける執筆者がいる（マシン A）
    // （git 手段そのものの受け入れは tests/acceptance/sync-operations.spec.ts が担う。ここでは
    //  GitHub 手段のマシンと同じリモートを共有していても、git 運用の一連の操作が従来どおり通ることを確認する）
    const filename = 'gitless-us02-s3.md'

    // When: 公開・非公開（除去）・取り込みの操作をする
    publishFromMachineA({ [`pages/${filename}`]: '# A だけの運用\n' })
    git(`rm -q --cached "src-sample/pages/${filename}"`)
    git('commit -q -m unpublish')
    git('push -q')
    const feedback = await pull(page)
    await expect(feedback).toBeVisible()
    git('pull -q --ff-only')

    // Then: すべて従来どおりに機能する
    expect(filesInOrigin()).not.toContain(`src-sample/pages/${filename}`)
    expect(fs.existsSync(articlePathA(filename))).toBe(true)
    expect(git('status --porcelain').trim()).toBe(`?? src-sample/pages/${filename}`)
    expect(git('log --merges --oneline').trim()).toBe('')
    fs.rmSync(articlePathA(filename))
  })
})

test.describe('US-03: 執筆内容の保全', () => {
  test('シナリオ 1: 両側で変わった記事は取り込みで上書きされない', async ({ page }) => {
    // Given: 手元で記事を編集してあり、同じ記事がリモートでも別のマシンから更新されている
    const filename = 'gitless-us03-s1.md'
    writeArticleB(filename, '# 両側で変わる記事\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    fs.writeFileSync(articlePathB(filename), '# 両側で変わる記事\n手元の編集\n')
    publishFromMachineA({ [`pages/${filename}`]: '# 両側で変わる記事\nリモート側の書き換え\n' })

    // When: 取り込みの操作をする
    const feedback = await pull(page)

    // Then: 手元の編集内容は上書きされずに残る
    await expect(feedback).toContainText('見送り')
    expect(fs.readFileSync(articlePathB(filename), 'utf-8')).toContain('手元の編集')
    // And: その記事の取り込みが見送られたことと理由が執筆者に伝わる（git の言葉を使わずに）
    await expect(feedback).toContainText(filename)
    expect((await feedback.textContent()) ?? '').not.toMatch(NO_GIT_WORDS)
  })

  test('シナリオ 2: 手元で編集しただけの記事が「見送り」になり続けない', async ({ page }) => {
    // Given: 同期済みの記事を手元で編集した（リモート側は変わっていない）
    const filename = 'gitless-us03-s2.md'
    writeArticleB(filename, '# 手元だけ編集する記事\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    fs.writeFileSync(articlePathB(filename), '# 手元だけ編集する記事\n手元の追記\n')

    // When: 取り込みの操作をする
    const feedback = await pull(page)

    // Then: 手元の編集は「両側で変わった」と誤って扱われない
    await expect(feedback).toContainText('新しく取り込むものはありませんでした')
    expect(fs.readFileSync(articlePathB(filename), 'utf-8')).toContain('手元の追記')
    // And: その後の公開の操作で、編集内容をリモートに反映できる
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')
    expect(git(`show main:src-sample/pages/${filename}`, originDir)).toContain('手元の追記')
  })

  test('シナリオ 3: 手元で削除した記事が取り込みで戻ってこない', async ({ page }) => {
    // Given: 手元で記事を削除した（削除はまだリモートに伝播していない）
    const filename = 'gitless-us03-s3.md'
    writeArticleB(filename, '# 手元で消す記事\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    fs.rmSync(articlePathB(filename))

    // When: 取り込みの操作をする
    const feedback = await pull(page)

    // Then: 削除した記事が手元に復活しない
    await expect(feedback).toBeVisible()
    expect(fs.existsSync(articlePathB(filename))).toBe(false)
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
  })
})

test.describe('US-04: GitHub がホストするリモートとの互換', () => {
  test('シナリオ 1: 反映がリモートの形式を変えない', async ({ page }) => {
    // Given: GitHub 上のリポジトリがリモートで、そこへの反映をきっかけにサイトが配信されている
    const filename = 'gitless-us04-s1.md'
    writeArticleB(filename, '# 形式を変えない\n')
    await openArticle(page, filename)

    // When: git の無い環境から記事を公開する
    await publishAndExpectSuccess(page)

    // Then: リモートは git 運用で公開したときと見分けのつかない形で更新される
    // （git 運用のマシンが早送りだけで追いつけ、履歴は一本、内容が同じ）
    git('pull -q --ff-only')
    expect(fs.readFileSync(articlePathA(filename), 'utf-8')).toBe('# 形式を変えない\n')
    expect(git('status --porcelain').trim()).toBe('')
    expect(git('log --merges --oneline').trim()).toBe('')
    expect(git('fsck --no-progress --connectivity-only', originDir)).not.toMatch(/error|missing/)
    // And: サイトの配信（デプロイ）が従来どおり起きる — 反映先のブランチの先頭が進んでいる（配信のきっかけはリモート側の責務）
    expect(git('rev-parse main', originDir).trim()).toBe(git('rev-parse HEAD').trim())
  })

  test('シナリオ 2: リモートが進んでいたら反映が拒まれる', async ({ page }) => {
    // Given: git の無い環境で記事を編集している間に、別のマシンから同じ記事の公開があった
    const filename = 'gitless-us04-s2.md'
    writeArticleB(filename, '# 先を越される記事\n')
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    publishFromMachineA({ [`pages/${filename}`]: '# 先を越される記事\nA の更新\n' })
    await openArticle(page, filename)
    await page.locator('#editorTextArea').fill('# 先を越される記事\nB の編集\n')

    // When: git の無い環境から公開の操作をする
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'modified')
    await page.locator('#publishBtn').click()

    // Then: 別のマシンの公開を上書きせずに反映が拒まれ、先に取り込みが必要であることが執筆者に伝わる
    const feedback = page.locator('#operationFeedback')
    await expect(feedback).toContainText('取り込')
    expect((await feedback.textContent()) ?? '').not.toMatch(NO_GIT_WORDS)
    expect(git(`show main:src-sample/pages/${filename}`, originDir)).toContain('A の更新')
  })

  test('シナリオ 3: リモートへ届くための資格情報が手段の中で扱われる', async ({ page }) => {
    // Given: 手元だけの置き場所に認証情報が用意されている（環境の git 設定には何も無い）
    const blogJson = fs.readFileSync(path.join(machineB, 'blog.json'), 'utf-8')
    expect(blogJson).not.toContain(TOKEN)
    expect(filesInOrigin()).not.toContain('.blog/credentials.json')
    const filename = 'gitless-us04-s3.md'
    writeArticleB(filename, '# 認証情報で届く\n')

    // When: 公開・取り込みの操作をする
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)
    const feedback = await pull(page)
    await expect(feedback).toBeVisible()

    // Then: 環境の git 設定に頼らず、その認証情報でリモートに届く
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
    // （認証情報を外すと届かず、その事情が伝わる。戻せばまた届く）
    const credPath = path.join(machineB, '.blog', 'credentials.json')
    fs.rmSync(credPath)
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'unknown')
    fs.writeFileSync(credPath, JSON.stringify({ github: { token: TOKEN } }))
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
  })
})
