import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm, mkdir, writeFile, cp, readdir, lstat, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// このプロジェクト（plans/node-modules-destruction/）の受け入れ範囲のうち、AppKit の
// フォルダ選択ダイアログ操作は Playwright では検証できない（コンテンツルート解決は
// native/Tests/NativeShellCoreTests で単体テスト済み）。
// 一方「選択後にアプリが何をするか」は、AppDelegate が組み立てるものと同一のコマンドライン
// （node --import <同梱モジュール解決器の登録スクリプト> bin/server, cwd=コンテンツルート）で
// 完全に再現できるため、ここではそれを実行して検証する。

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..')
const registerScript = path.join(repoRoot, 'scripts/app-bundle/registerBundledModuleResolver.js')

// 実体の node_modules（囮の @tenjuu99/blog 入り）を持つ開発中プロジェクトを作る。
// 囮は allData/config を export しないため、参照が囮へ解決されるとサーバーは起動できない。
async function createProject(withRealNodeModules: boolean): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'nmd-acceptance-'))
  await cp(path.join(repoRoot, 'blog.json'), path.join(root, 'blog.json'))
  await cp(path.join(repoRoot, 'src-sample'), path.join(root, 'src-sample'), { recursive: true })
  if (withRealNodeModules) {
    const decoy = path.join(root, 'node_modules/@tenjuu99/blog')
    await mkdir(decoy, { recursive: true })
    await writeFile(path.join(decoy, 'package.json'),
      JSON.stringify({ name: '@tenjuu99/blog', version: '0.0.1', main: 'index.js' }))
    await writeFile(path.join(decoy, 'index.js'), 'export const decoy = true\n')
    await writeFile(path.join(root, 'package.json'),
      JSON.stringify({ name: 'project-under-development', dependencies: { '@tenjuu99/blog': '0.0.1' } }))
  }
  return root
}

// AppDelegate.serverArguments() と同じ形でサーバーを起動する
function launchAppServer(contentRoot: string, port: number): ChildProcess {
  return spawn(
    process.execPath,
    ['--import', registerScript, path.join(repoRoot, 'bin/server')],
    { cwd: contentRoot, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' }
  )
}

async function waitForServer(port: number): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/editor.html`)
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`server on port ${port} did not become ready`)
}

function stopServer(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    // 起動失敗などで既に exit 済みの場合、exit イベントは二度と発火しない
    if (server.exitCode !== null || server.signalCode !== null) {
      resolve()
      return
    }
    server.once('exit', () => resolve())
    server.kill('SIGTERM')
  })
}

test.describe('US-01: 開発中のプロジェクトを壊されずにアプリで使う', () => {
  test('シナリオ 1: 実体の node_modules を持つプロジェクトを選ぶ', async ({ page }) => {
    // Given: 実体の node_modules ディレクトリを持つ開発中のプロジェクトがある
    const contentRoot = await createProject(true)
    const before = (await readdir(path.join(contentRoot, 'node_modules'), { recursive: true })).sort()
    try {
      // When: 利用者がそのプロジェクトをアプリのコンテンツルートに選ぶ
      //（選択確定後にアプリが実行するのと同一のコマンドラインでサーバーを起動する）
      const server = launchAppServer(contentRoot, 8003)
      try {
        await waitForServer(8003)

        // Then: アプリとしての動作（起動〜編集）が引き続き成立する
        await page.goto('http://127.0.0.1:8003/editor.html')
        await expect(page.locator('body')).toBeVisible()
        const res = await page.request.get('http://127.0.0.1:8003/')
        expect(res.status()).toBe(200)

        // And: そのプロジェクト内の既存ファイル・ディレクトリは、利用者の同意なく削除・置換されない
        const stats = await lstat(path.join(contentRoot, 'node_modules'))
        expect(stats.isDirectory()).toBe(true)
        expect(stats.isSymbolicLink()).toBe(false)
        const after = (await readdir(path.join(contentRoot, 'node_modules'), { recursive: true })).sort()
        expect(after).toEqual(before)
        const decoy = await readFile(path.join(contentRoot, 'node_modules/@tenjuu99/blog/index.js'), 'utf8')
        expect(decoy).toBe('export const decoy = true\n')
      } finally {
        await stopServer(server)
      }
    } finally {
      await rm(contentRoot, { recursive: true, force: true })
    }
  })

  test('シナリオ 2: 動作を成立させられない場合は黙って壊さない', async () => {
    // Given: 実体の node_modules ディレクトリを持つプロジェクトがある
    // And:   その選択のままではアプリの動作を成立させられない状況である
    // When:  利用者がそのプロジェクトをコンテンツルートに選ぶ
    // Then:  アプリはプロジェクトの中身を黙って変更せず、利用者がその状況を認識できる
    test.skip(
      true,
      '解決手段（同梱モジュール解決器）の採用により、この Given の状況自体が発生しなくなった。' +
        'アプリコードへの参照の解決はコンテンツルートの node_modules の中身に依存しないため、' +
        '実体の node_modules が何を含んでいても動作が成立する（シナリオ1で検証）。' +
        'いかなる場合もプロジェクトの中身を変更しないことは、書き込み処理そのものが' +
        '存在しない（linkAppNodeModulesIntoContentRoot 削除済み）ことで保証される。'
    )
  })

  test('シナリオ 3: 配布先での初回利用は従来どおり成立する', async ({ page }) => {
    // Given: node_modules が存在しないコンテンツフォルダがある（配布先の Mac 相当）
    const contentRoot = await createProject(false)
    try {
      // When: 利用者がそのフォルダをコンテンツルートに選ぶ
      const server = launchAppServer(contentRoot, 8004)
      try {
        await waitForServer(8004)

        // Then: 従来どおりアプリが起動し、編集操作が行える
        await page.goto('http://127.0.0.1:8004/editor.html')
        await expect(page.locator('body')).toBeVisible()

        // 従来と異なり node_modules リンクはもう作られない（作る必要がない）
        const entries = await readdir(contentRoot)
        expect(entries).not.toContain('node_modules')
      } finally {
        await stopServer(server)
      }
    } finally {
      await rm(contentRoot, { recursive: true, force: true })
    }
  })
})
