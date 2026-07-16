import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, rm, mkdir, writeFile, cp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// このプロジェクト（plans/bundled-dependency-resolution/）の受け入れ範囲は、.appバンドル自体の
// ダブルクリック起動はPlaywrightでは検証できない（node-modules-destruction.spec.ts と同様）。
// 一方「選択後にアプリが何をするか」は、AppDelegate が組み立てるものと同一のコマンドライン
// （node --import <同梱モジュール解決器の登録スクリプト> bin/server, cwd=コンテンツルート）で
// 完全に再現できる。画像メタデータ読み取り機能（sharp 依存）は /get_image_library エンドポイント
// 経由でHTTPリクエストとして検証できる。

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..')
const registerScript = path.join(repoRoot, 'scripts/app-bundle/registerBundledModuleResolver.js')

async function createContentRoot(withRealNodeModules: boolean): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'bdr-acceptance-'))
  await cp(path.join(repoRoot, 'blog.json'), path.join(root, 'blog.json'))
  await cp(path.join(repoRoot, 'src-sample'), path.join(root, 'src-sample'), { recursive: true })
  if (withRealNodeModules) {
    // 実体の node_modules（囮の @tenjuu99/blog 入り）を持つ開発中プロジェクトを模す
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
    if (server.exitCode !== null || server.signalCode !== null) {
      resolve()
      return
    }
    server.once('exit', () => resolve())
    server.kill('SIGTERM')
  })
}

test.describe('US-01: コンテンツルートの状態によらず同梱機能が動作する', () => {
  test('シナリオ 1: 実体 node_modules を持たないコンテンツルートでの動作', async ({ page }) => {
    // Given: 実体の node_modules を持たない（追加インストールを一切していない）フォルダをコンテンツルートに選ぶ
    const contentRoot = await createContentRoot(false)
    try {
      // When: 配布物（`.app`）を起動し、画像メタデータ読み取り機能を使う
      const server = launchAppServer(contentRoot, 8005)
      try {
        await waitForServer(8005)
        const res = await page.request.get(`http://127.0.0.1:8005/get_image_library`)

        // Then: コンテンツルート側に何もインストールすることなく、機能が正常に動作する
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body.images)).toBe(true)
        expect(body.images.length).toBeGreaterThan(0)
        for (const image of body.images) {
          expect(image.width).not.toBeNull()
          expect(image.height).not.toBeNull()
        }
        const entries = await readdir(contentRoot)
        expect(entries).not.toContain('node_modules')
      } finally {
        await stopServer(server)
      }
    } finally {
      await rm(contentRoot, { recursive: true, force: true })
    }
  })

  test('シナリオ 2: 実体 node_modules を持つ開発中プロジェクトとの同居', async ({ page }) => {
    // Given: 実体の node_modules を持つ開発中プロジェクトをコンテンツルートに選ぶ
    const contentRoot = await createContentRoot(true)
    const before = (await readdir(path.join(contentRoot, 'node_modules'), { recursive: true })).sort()
    try {
      // When: 配布物（`.app`）を起動し、画像メタデータ読み取り機能を使う
      const server = launchAppServer(contentRoot, 8006)
      try {
        await waitForServer(8006)
        const res = await page.request.get(`http://127.0.0.1:8006/get_image_library`)

        // Then: コンテンツルート側の既存ファイル・ディレクトリが一切変更・削除されないまま、機能が正常に動作する
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body.images)).toBe(true)
        expect(body.images.length).toBeGreaterThan(0)
        for (const image of body.images) {
          expect(image.width).not.toBeNull()
          expect(image.height).not.toBeNull()
        }

        const after = (await readdir(path.join(contentRoot, 'node_modules'), { recursive: true })).sort()
        expect(after).toEqual(before)
      } finally {
        await stopServer(server)
      }
    } finally {
      await rm(contentRoot, { recursive: true, force: true })
    }
  })
})
