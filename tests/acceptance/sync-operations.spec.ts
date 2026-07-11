import { test, expect as baseExpect, type Page } from '@playwright/test'

// 公開・取り込みは実際の git 操作（commit/push/fetch）を伴うため、既定の 5 秒では初回に間に合わないことがある
const expect = baseExpect.configure({ timeout: 15_000 })
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { execSync, spawn, type ChildProcess } from 'node:child_process'

// 同期操作（commit + push / fetch + 取り込み）を実際に実行するため、実プロジェクトではなく
// 使い捨てのフィクスチャプロジェクトを対象にする。origin はローカルの bare リポジトリで、
// 「別のマシン」は同じ origin をクローンした第二の作業コピーで模す。外部には一切届かない。
test.describe.configure({ mode: 'serial' })

const PORT = 8200
const BASE = `http://localhost:${PORT}`
const repoRoot = process.cwd()

let fixtureRoot: string
let projectDir: string
let originDir: string
let machineB: string
let server: ChildProcess

const git = (args: string, cwd: string = projectDir) =>
  execSync(`git ${args}`, { cwd, stdio: 'pipe' }).toString()

const filesInOrigin = () => git('ls-tree -r --name-only main', originDir)
const commitCountInOrigin = () => Number(git('rev-list --count main', originDir).trim())

const articlePath = (filename: string) => path.join(projectDir, 'src-sample', 'pages', filename)

// 「別のマシン」での執筆と公開を git 操作で模す
const publishFromMachineB = (filename: string, content: string) => {
  git('pull -q', machineB)
  const abs = path.join(machineB, 'src-sample', 'pages', filename)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
  git(`add "src-sample/pages/${filename}"`, machineB)
  git('commit -q -m publish-from-b', machineB)
  git('push -q', machineB)
}

async function openArticle(page: Page, filename: string) {
  await page.goto(`${BASE}/editor?md=${filename}`)
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

// ヘッドレスの初回訪問では localStorage が空でサイドバーが閉じた状態になる。
// サイドバー上の操作（取り込みボタン・リモートのみのリンク）を検証するため、開いた状態で始める
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sidebar-is-open', 'true'))
})

test.beforeAll(async () => {
  test.setTimeout(120000)
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-operations-'))
  projectDir = path.join(fixtureRoot, 'blog')
  originDir = path.join(fixtureRoot, 'origin.git')
  machineB = path.join(fixtureRoot, 'machine-b')
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

  // 別のマシン
  execSync(`git clone -q "${originDir}" "${machineB}"`, { stdio: 'pipe' })
  git('config user.email machine-b@example.com', machineB)
  git('config user.name machine-b', machineB)

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

test.describe('US-01: 公開した記事を非公開に戻せる', () => {
  test('シナリオ 1: 公開済みの記事を非公開にする', async ({ page }) => {
    // Given: 公開済みの記事がある（手元とサイトの内容が一致している）
    const filename = 'acceptance-us01-s1.md'
    fs.writeFileSync(articlePath(filename), '# 非公開にする記事\n本文\n')
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')

    // When: 執筆者がその記事を非公開にする
    await page.locator('#unpublishBtn').click()

    // Then: 記事はサイトから取り除かれる
    await expect(page.locator('#operationFeedback')).toHaveText('非公開にしました')
    expect(filesInOrigin()).not.toContain(`src-sample/pages/${filename}`)
    // And: 原稿は手元に残っている
    expect(fs.existsSync(articlePath(filename))).toBe(true)
    // And: その記事の状態は未公開として表示される
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
  })

  test('シナリオ 2: 非公開にした記事を再公開する', async ({ page }) => {
    // Given: 一度公開して非公開に戻した記事が手元にある（シナリオ 1 の記事）
    const filename = 'acceptance-us01-s1.md'
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')

    // When: 執筆者がその記事を公開する
    await page.locator('#publishBtn').click()

    // Then: 記事は再びサイトに反映され、公開済みとして表示される
    await expect(page.locator('#operationFeedback')).toHaveText('公開しました')
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    expect(filesInOrigin()).toContain(`src-sample/pages/${filename}`)
  })

  test('シナリオ 3: 未公開の記事は非公開にできない', async ({ page }) => {
    // Given: 手元にのみ存在する、一度も公開していない記事がある
    const filename = 'acceptance-us01-s3.md'
    fs.writeFileSync(articlePath(filename), '# 未公開の記事\n')

    // When: 執筆者がその記事を見る
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')

    // Then: 非公開にする操作は行えない（操作が提供されない）
    await expect(page.locator('#unpublishBtn')).toBeHidden()
  })

  test('シナリオ 4: リモートが参照不能なときは操作できない理由が伝わる', async ({ page }) => {
    // Given: 公開手段が解決できない構成になっている（unknown 状態）
    const filename = 'acceptance-us01-s4.md'
    fs.writeFileSync(articlePath(filename), '# 参照不能時の記事\n')
    git('branch --unset-upstream')
    await openArticle(page, filename)

    // When/Then: 操作は実行されず、行えない理由が執筆者に知覚できる
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'unknown')
    await expect(page.locator('#publishBtn')).toBeDisabled()
    await expect(page.locator('#unpublishBtn')).toBeHidden()
    await expect(page.locator('#deleteBtn')).toBeHidden()

    // And: エディタの他の機能（サイドバー・編集・プレビュー）は動作を継続している
    //（ディレクトリは閉じた状態で描画されるため、リンクの存在で一覧の動作を確認する）
    expect(await page.locator('.sidebar-files a').count()).toBeGreaterThan(0)
    await expect(page.locator('#editorTextArea')).toBeEditable()
    await expect(page.locator('#previewContent iframe')).toBeAttached()

    // 後続のためにアップストリームを戻す
    git('branch -u origin/main')
  })
})

test.describe('US-02: 記事を削除できる', () => {
  test('シナリオ 1: 公開済みの記事を削除する（非公開 → 削除の誘導つき2段）', async ({ page }) => {
    // Given: 公開済みの記事がある
    const filename = 'acceptance-us02-s1.md'
    fs.writeFileSync(articlePath(filename), '# 削除する記事\n')
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    // 公開済みの間は削除は直接提供されない（先に非公開にする）
    await expect(page.locator('#deleteBtn')).toBeHidden()

    // When: 執筆者がその記事を削除する（非公開にしてから削除）
    await page.locator('#unpublishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    page.once('dialog', dialog => dialog.accept())
    await page.locator('#deleteBtn').click()

    // Then: 記事は手元のファイルシステムから消える
    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')
    expect(fs.existsSync(articlePath(filename))).toBe(false)
    // And: サイトからも取り除かれている
    expect(filesInOrigin()).not.toContain(`src-sample/pages/${filename}`)
    // And: サイドバー等の一覧にも表示されなくなる
    await expect(page.locator(`.sidebar a[href="/editor?md=${encodeURIComponent(filename)}"]`)).toHaveCount(0)
  })

  test('シナリオ 2: 未公開の記事を削除する', async ({ page }) => {
    // Given: 手元にのみ存在する未公開の記事がある
    const filename = 'acceptance-us02-s2.md'
    fs.writeFileSync(articlePath(filename), '# 未公開のまま消す記事\n')
    const before = commitCountInOrigin()
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')

    // When: 執筆者がその記事を削除する
    page.once('dialog', dialog => dialog.accept())
    await page.locator('#deleteBtn').click()

    // Then: 記事は手元から消える（サイトへの反映は発生しない）
    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')
    expect(fs.existsSync(articlePath(filename))).toBe(false)
    expect(commitCountInOrigin()).toBe(before)
  })

  test('シナリオ 3: 削除をサイトへ反映する手段が失われない', async ({ page }) => {
    // Given: 公開済みの記事の手元のファイルが、エディタを介さずにファイルシステムから削除されている
    const filename = 'acceptance-us02-s3.md'
    fs.writeFileSync(articlePath(filename), '# エディタ外で消される記事\n')
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    fs.rmSync(articlePath(filename))

    // When: 執筆者がエディタでその状態を見る
    await page.goto(`${BASE}/editor`)

    // Then: その記事がサイトには残っていることが執筆者に知覚できる（リモートのみとして表示される）
    const link = page.locator(`.sidebar a[href="/editor?md=${encodeURIComponent(filename)}"]`)
    await expect(link).toHaveAttribute('data-status', 'remote-only')

    // And: サイトからも取り除く手段が失われていない
    //（リンクから「取り込む」を断り「サイトから取り除く」を選ぶ）
    let dialogCount = 0
    page.on('dialog', dialog => {
      dialogCount += 1
      if (dialogCount === 1) dialog.dismiss()
      else dialog.accept()
    })
    await link.click()
    await expect(page.locator('#operationFeedback')).toContainText('サイトから取り除きました')
    expect(filesInOrigin()).not.toContain(`src-sample/pages/${filename}`)
  })
})

test.describe('US-03: リモートの内容を手元に取り込める', () => {
  test('シナリオ 1: 別のマシンで公開した記事を取り込む', async ({ page }) => {
    // Given: リモートに、手元には存在しない公開済みの記事がある（別のマシンから公開された）
    const filename = 'acceptance-us03-s1.md'
    publishFromMachineB(filename, '# 別のマシンの記事\n本文\n')
    expect(fs.existsSync(articlePath(filename))).toBe(false)

    // When: 執筆者が取り込みを行う
    await page.goto(`${BASE}/editor`)
    await page.locator('#pullBtn').click()

    // Then: その記事が手元に現れ、開いて執筆を続けられる
    await expect(page.locator('#operationFeedback')).toContainText('1件を取り込みました')
    expect(fs.existsSync(articlePath(filename))).toBe(true)
    await openArticle(page, filename)
    await expect(page.locator('#editorTextArea')).toHaveValue(/別のマシンの記事/)
    // And: その記事の状態は公開済みとして表示される
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
  })

  test('シナリオ 2: 別のマシンで更新された記事を取り込む', async ({ page }) => {
    // Given: 手元にもある公開済みの記事が、リモートではより新しい内容になっている
    const filename = 'acceptance-us03-s1.md'
    publishFromMachineB(filename, '# 別のマシンの記事\n更新された本文\n')

    // When: 執筆者が取り込みを行う
    await page.goto(`${BASE}/editor`)
    await page.locator('#pullBtn').click()

    // Then: 手元の記事が最新の内容になる
    await expect(page.locator('#operationFeedback')).toContainText('1件を取り込みました')
    expect(fs.readFileSync(articlePath(filename), 'utf-8')).toContain('更新された本文')
  })

  test('シナリオ 3: 手元だけが進んでいる記事は取り込みで巻き戻らない', async ({ page }) => {
    // Given: 手元の記事に、まだサイトへ反映していない変更がある（手元のほうが進んでいる）
    const filename = 'acceptance-us03-s1.md'
    fs.writeFileSync(articlePath(filename), '# 別のマシンの記事\n更新された本文\n手元だけの追記\n')

    // When: 執筆者が取り込みを行う
    await page.goto(`${BASE}/editor`)
    await page.locator('#pullBtn').click()

    // Then: 手元の執筆内容は失われない（記事は巻き戻らない）
    await expect(page.locator('#operationFeedback')).toContainText('新しく取り込むものはありませんでした')
    expect(fs.readFileSync(articlePath(filename), 'utf-8')).toContain('手元だけの追記')
  })

  test('シナリオ 4: 両側で変わっている記事では執筆内容が守られ、理由が伝わる', async ({ page }) => {
    // Given: 手元とリモートの両方で、同じ記事が異なる内容に変わっている
    const filename = 'acceptance-us03-s1.md'
    publishFromMachineB(filename, '# 別のマシンの記事\nリモート側の書き換え\n')
    // （手元にはシナリオ 3 の「手元だけの追記」が残っている）

    // When: 執筆者が取り込みを行う
    await page.goto(`${BASE}/editor`)
    await page.locator('#pullBtn').click()

    // Then: 手元の執筆内容は失われない
    const feedback = page.locator('#operationFeedback')
    await expect(feedback).toContainText('見送り')
    expect(fs.readFileSync(articlePath(filename), 'utf-8')).toContain('手元だけの追記')
    // And: 取り込めなかったこと・その理由が、git の言葉を使わずに知覚できる
    await expect(feedback).toContainText(filename)
    const text = (await feedback.textContent()) ?? ''
    expect(text).not.toMatch(/merge|conflict|マージ|コンフリクト|pull|push|fetch/i)

    // 後続のためにフィクスチャの分岐を直接解消する
    //（分岐の解決そのものは競合解決の領域で、本問題の範囲外）
    git('reset --hard origin/main')
  })

  test('シナリオ 5: 削除した記事が取り込みで復活しない', async ({ page }) => {
    // Given: 執筆者がエディタで記事を削除した（削除はサイトへ反映済み: 非公開 → 削除）
    const filename = 'acceptance-us03-s5.md'
    fs.writeFileSync(articlePath(filename), '# 削除後に復活しない記事\n')
    await openArticle(page, filename)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    await page.locator('#unpublishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    page.once('dialog', dialog => dialog.accept())
    await page.locator('#deleteBtn').click()
    await expect(page.locator('#operationFeedback')).toHaveText('削除しました')

    // And: 削除がサイトへ反映される前の状態も作る（公開済みの記事をエディタ外で削除）
    const pending = 'acceptance-us03-s5-pending.md'
    fs.writeFileSync(articlePath(pending), '# 伝播前に消された記事\n')
    await openArticle(page, pending)
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'new')
    await page.locator('#publishBtn').click()
    await expect(page.locator('#publicationStatus')).toHaveAttribute('data-status', 'published')
    fs.rmSync(articlePath(pending))

    // When: その後に取り込みを行う
    await page.goto(`${BASE}/editor`)
    await page.locator('#pullBtn').click()
    await expect(page.locator('#operationFeedback')).not.toHaveText('取り込んでいます...')

    // Then: 削除した記事は手元に復活しない（削除の意図が保たれる）
    expect(fs.existsSync(articlePath(filename))).toBe(false)
    expect(fs.existsSync(articlePath(pending))).toBe(false)
  })
})
