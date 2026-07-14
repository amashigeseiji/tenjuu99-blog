import { test, expect as baseExpect, type Page } from '@playwright/test'

// 公開は実際の git 操作（commit/push）を伴うため、既定の 5 秒では初回に間に合わないことがある
const expect = baseExpect.configure({ timeout: 15_000 })
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execSync, spawn, type ChildProcess } from 'node:child_process'

// 公開を実際に実行するため、実プロジェクトではなく使い捨てのフィクスチャプロジェクトを対象にする。
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

const articlePath = (filename: string) => path.join(projectDir, 'src-sample', 'pages', filename)

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

// data-status の確定を待つことでエディタ JS の初期化完了（ハンドラ登録済み）を保証してからクリックする
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
  PORT = 8210 + testInfo.parallelIndex
  BASE = `http://localhost:${PORT}`
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-frontmatter-image-'))
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

test.describe('US-01: frontmatter で参照した画像の公開', () => {
  test('シナリオ 1: frontmatter で画像を参照する記事を公開すると画像も公開される', async ({ page }) => {
    // Given: frontmatter に画像パス（og_image 等）を指定した記事がある
    const filename = 'acceptance-pfi-s1.md'
    fs.writeFileSync(
      articlePath(filename),
      '---\ntitle: OGP画像つきの記事\nog_image: /image/post/pfi-s1-ogp.png\n---\n# 本文\n'
    )
    // And: その画像はローカルに存在する
    createImage('image/post/pfi-s1-ogp.png')

    // When: その記事を公開する
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await publishAndExpectSuccess(page)

    // Then: 記事がリモートに公開される
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
    // And: frontmatter で参照した画像も共に公開される
    expect(filesInOrigin()).toContain('src-sample/image/post/pfi-s1-ogp.png')
  })

  test('シナリオ 2: 本文と frontmatter の両方の参照が公開される', async ({ page }) => {
    // Given: 本文で画像Aを参照し、frontmatter で画像Bを参照する記事がある
    const filename = 'acceptance-pfi-s2.md'
    createImage('image/post/pfi-s2-body.png')
    createImage('image/post/pfi-s2-ogp.png')
    fs.writeFileSync(
      articlePath(filename),
      '---\ntitle: 両方参照の記事\nog_image: /image/post/pfi-s2-ogp.png\n---\n# 本文\n![画像A](/image/post/pfi-s2-body.png)\n'
    )

    // When: その記事を公開する
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // Then: 画像Aと画像Bの両方が記事と共に公開される
    const files = filesInOrigin()
    expect(files).toContain(`src-sample/pages/${filename}`)
    expect(files).toContain('src-sample/image/post/pfi-s2-body.png')
    expect(files).toContain('src-sample/image/post/pfi-s2-ogp.png')
  })

  test('シナリオ 3: 記事の更新でも frontmatter 参照の画像が公開される', async ({ page }) => {
    // Given: 公開済みの記事がある
    const filename = 'acceptance-pfi-s3.md'
    fs.writeFileSync(articlePath(filename), '---\ntitle: あとから画像を足す記事\n---\n# 本文\n')
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await publishAndExpectSuccess(page)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')

    // When: frontmatter に画像パスを追加して記事の更新を公開する
    createImage('image/post/pfi-s3-ogp.png')
    fs.writeFileSync(
      articlePath(filename),
      '---\ntitle: あとから画像を足す記事\nog_image: /image/post/pfi-s3-ogp.png\n---\n# 本文\n'
    )
    await openArticle(page, filename)
    await publishAndExpectSuccess(page, 'modified')

    // Then: 記事の更新がリモートに反映される
    expect(git(`show main:src-sample/pages/${filename}`, originDir)).toContain('og_image')
    // And: 追加した画像も共に公開される
    expect(filesInOrigin()).toContain('src-sample/image/post/pfi-s3-ogp.png')
  })

  test('シナリオ 4: 本文参照のみの記事の既存挙動が保たれる', async ({ page }) => {
    // Given: 本文の画像記法でのみ画像を参照する記事がある
    const filename = 'acceptance-pfi-s4.md'
    createImage('image/post/pfi-s4-body.png')
    fs.writeFileSync(articlePath(filename), '# 本文だけの記事\n![画像](/image/post/pfi-s4-body.png)\n')

    // When: その記事を公開する
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // Then: 従来どおり、参照した画像が記事と共に公開される
    const files = filesInOrigin()
    expect(files).toContain(`src-sample/pages/${filename}`)
    expect(files).toContain('src-sample/image/post/pfi-s4-body.png')
  })

  test('シナリオ 5: 画像を参照しない frontmatter 値は公開対象に影響しない', async ({ page }) => {
    // Given: frontmatter に画像パスではない値（タイトル・テンプレート名等）だけを持つ記事がある
    const filename = 'acceptance-pfi-s5.md'
    fs.writeFileSync(
      articlePath(filename),
      '---\ntitle: 画像なしの記事\ntemplate: default.html\npublished: 2026-07-15\n---\n# 本文のみ\n'
    )
    const before = new Set(filesInOrigin().split('\n'))

    // When: その記事を公開する
    await openArticle(page, filename)
    await publishAndExpectSuccess(page)

    // Then: 記事のみが公開され、余計なファイルが公開対象に含まれない
    const added = filesInOrigin().split('\n').filter(f => f && !before.has(f))
    expect(added).toEqual([`src-sample/pages/${filename}`])
  })
})
