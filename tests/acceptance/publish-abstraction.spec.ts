import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execSync, spawn, type ChildProcess } from 'node:child_process'

// 公開操作（commit + push）を実際に実行するため、実プロジェクトではなく
// 使い捨てのフィクスチャプロジェクトを対象にする。origin はローカルの bare リポジトリ
// なので push は本当に実行されるが、GitHub 等の外部には一切届かない。
test.describe.configure({ mode: 'serial' })

const PORT = 8100
const BASE = `http://localhost:${PORT}`
const repoRoot = process.cwd()

let fixtureRoot: string
let projectDir: string
let originDir: string
let server: ChildProcess

const git = (args: string, cwd: string = projectDir) =>
  execSync(`git ${args}`, { cwd, stdio: 'pipe' }).toString()

const filesInOrigin = () => git('ls-tree -r --name-only main', originDir)
const commitCountInOrigin = () => Number(git('rev-list --count main', originDir).trim())

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

test.beforeAll(async () => {
  test.setTimeout(120000)
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-abstraction-'))
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
  if (fixtureRoot) fs.rmSync(fixtureRoot, { recursive: true, force: true })
})

test.describe('US-01: 手段を意識せずに記事を公開できる', () => {
  test('シナリオ 1: 未公開の記事を公開する（git 手段・既存運用の維持）', async ({ page }) => {
    // Given: git を公開手段とするブログプロジェクトに、公開ステータスが「未公開」の記事がある
    const filename = 'acceptance-us01-s1.md'
    fs.writeFileSync(path.join(projectDir, 'src-sample', 'pages', filename), '# 未公開の記事\n本文\n')
    await page.goto(`${BASE}/editor?md=${filename}`)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')

    // When: 執筆者が公開操作を行う
    await page.locator('#publishBtn').click()

    // Then: 公開が成功したことがブラウザ上で知覚でき、記事の公開ステータスは「公開済み」になり、
    //       従来どおりサイトへの反映フローが起動する（リモートに反映されている）
    await expect(page.locator('#publishFeedback')).toHaveText('公開しました')
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
  })

  test('シナリオ 2: 公開済みの記事を編集して更新する（git 手段・既存運用の維持）', async ({ page }) => {
    // Given: git を公開手段とするブログプロジェクトに、公開ステータスが「更新あり」の記事がある
    const filename = 'acceptance-us01-s1.md'
    fs.appendFileSync(path.join(projectDir, 'src-sample', 'pages', filename), '\n追記した本文\n')
    await page.goto(`${BASE}/editor?md=${filename}`)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'modified')
    const before = commitCountInOrigin()

    // When: 執筆者が公開操作を行う
    await page.locator('#publishBtn').click()

    // Then: 更新が成功したことがブラウザ上で知覚でき、記事の公開ステータスは「公開済み」になる
    await expect(page.locator('#publishFeedback')).toHaveText('公開しました')
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    expect(commitCountInOrigin()).toBe(before + 1)
  })

  test('シナリオ 3: 公開済みの状態が参照できないとき', async ({ page }) => {
    // Given: 公開手段がリモートの現在の内容を参照できない状態にある
    git('branch --unset-upstream')
    const filename = 'acceptance-us01-s3.md'
    fs.writeFileSync(path.join(projectDir, 'src-sample', 'pages', filename), '# 参照不能時の記事\n')
    const before = commitCountInOrigin()
    await page.goto(`${BASE}/editor?md=${filename}`)

    // Then: 公開ボタンが操作不可になり、参照できない旨がブラウザ上で知覚できる
    // （公開可否判定器が unknown ステータスを検出し、クリック前に操作不可であることを伝える）
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'unknown')
    await expect(page.locator('#publishBtn')).toBeDisabled()

    // When: この状態でも公開操作は実行できない
    await page.locator('#publishBtn').click({ force: true })

    // Then: 公開は実行されない
    expect(commitCountInOrigin()).toBe(before)

    // 後続のためにアップストリームを戻す
    git('branch -u origin/main')
  })
})

test.describe('US-02: 「公開する」を手段の言葉なしで語れる', () => {
  test('シナリオ 1: 公開の語彙が手段の言葉を含まない', async () => {
    // Given: 公開に関する語彙定義がある / When: 開発者がその定義を読む
    // Then: 定義文に特定の手段の言葉が現れず、手段は実現方法の一つとして別に位置づけられている
    test.skip(
      true,
      '語彙定義の検証は設計レビュー事項。plans/publish-abstraction/dictionary.json で「公開する」「リモート状態」' +
      '「デプロイ」「変更反映器」を redefine 済み（git の言葉は git公開手段エントリと実現例の言及のみに限定）。' +
      '機械的な語句 grep は「実現例としての言及」と「定義としての依存」を区別できないため自動化しない。' +
      'docs/dictionary.json への反映は /tdd-vocab promote（ユーザー承認）で行う。'
    )
  })

  test('シナリオ 2: git による公開が「一つの実現」として位置づいている', async () => {
    // Then: git による公開は、定義の各要素（判定・実行・届けるもの）の実現として説明でき、既存運用は動作する
    test.skip(
      true,
      'コード上の対応で検証済み: 公開手段の各要素（remoteState=判定の参照 / reflect=反映の実行 / ' +
      'deliverable=届けるもの）を lib/publishing/gitPublicationMeans.js が実装し、' +
      'tests/publishing/publicationMeans.test.js のルートテスト（git ではないインメモリ手段で公開フローが成立）が green。' +
      '既存運用の動作は本ファイルの US-01 シナリオ 1〜2 が実際の commit/push で検証する。'
    )
  })

  test('シナリオ 3: 新しい公開手段の検討が定義の再訪を要求しない', async () => {
    // Then: 検討すべきことは「その手段が定義の各要素をどう実現するか」に限られる
    test.skip(
      true,
      '構造で担保: 新手段の追加は lib/publishing/ に PublicationMeans 形を満たすモジュールを書き、' +
      'publicationMeansResolver.js のレジストリに1行足すだけで、公開の定義・公開ハンドラー・エンドポイントには触れない。' +
      '未知の手段名が拒否されることは tests/publishing/publicationMeans.test.js で検証済み。'
    )
  })
})
