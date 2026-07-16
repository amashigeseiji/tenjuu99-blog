import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, symlink, readlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assemble } from '../../scripts/app-bundle/distributionBundleAssembler.js'

const REAL_MANIFEST_PATH = fileURLToPath(
  new URL('../../scripts/app-bundle/manifest.json', import.meta.url)
)
const KNOWN_ROOTS = ['repo', 'vendoredNode', 'swiftBuild', 'appShell']

let workDir

beforeEach(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'distribution-bundle-assembler-test-'))
})

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true })
})

describe('配布物組み立て器は Node本体・ネイティブ依存・ソースコード一式を.app構造に配置できる', () => {
  test('マニフェストに沿って複数の同梱物を.app構造にまとめて配置する', async () => {
    // ビルド成果物を模したソースを用意する
    const repoDir = path.join(workDir, 'repo')
    await mkdir(path.join(repoDir, 'lib'), { recursive: true })
    await writeFile(path.join(repoDir, 'lib', 'generate.js'), 'export const generate = () => {}')

    const vendoredNodeDir = path.join(workDir, 'node-v24')
    await mkdir(path.join(vendoredNodeDir, 'bin'), { recursive: true })
    await writeFile(path.join(vendoredNodeDir, 'bin', 'node'), 'fake-node-binary')

    const manifestPath = path.join(workDir, 'manifest.json')
    await writeFile(
      manifestPath,
      JSON.stringify({
        entries: [
          { src: 'repo/lib', dest: 'Contents/Resources/app/lib' },
          { src: 'vendoredNode/bin/node', dest: 'Contents/Resources/node/bin/node' },
        ],
      })
    )

    const appOutputPath = path.join(workDir, 'output', 'tenjuu99-blog.app')

    await assemble({
      manifestPath,
      roots: { repo: repoDir, vendoredNode: vendoredNodeDir },
      appOutputPath,
    })

    assert.equal(
      await readFile(path.join(appOutputPath, 'Contents/Resources/app/lib/generate.js'), 'utf8'),
      'export const generate = () => {}'
    )
    assert.equal(
      await readFile(path.join(appOutputPath, 'Contents/Resources/node/bin/node'), 'utf8'),
      'fake-node-binary'
    )
  })

  test('npmのfile:self-reference（自己参照シンボリックリンク）を含む node_modules も無限ループせずに配置でき、symlinks宣言で正しいリンクに張り替えられる', async () => {
    // repo/node_modules/@tenjuu99/blog は repo 自身を指す自己参照シンボリックリンク（npm file:self-reference の典型例）
    const repoDir = path.join(workDir, 'repo')
    await mkdir(path.join(repoDir, 'node_modules', '@tenjuu99'), { recursive: true })
    await writeFile(path.join(repoDir, 'package.json'), '{"name":"@tenjuu99/blog"}')
    await symlink(repoDir, path.join(repoDir, 'node_modules', '@tenjuu99', 'blog'), 'dir')

    const manifestPath = path.join(workDir, 'manifest.json')
    await writeFile(
      manifestPath,
      JSON.stringify({
        entries: [
          { src: 'repo/package.json', dest: 'Contents/Resources/app/package.json' },
          { src: 'repo/node_modules', dest: 'Contents/Resources/app/node_modules' },
        ],
        symlinks: [
          { at: 'Contents/Resources/app/node_modules/@tenjuu99/blog', target: '../..' },
        ],
      })
    )

    const appOutputPath = path.join(workDir, 'output', 'tenjuu99-blog.app')

    await assemble({ manifestPath, roots: { repo: repoDir }, appOutputPath })

    const linkPath = path.join(appOutputPath, 'Contents/Resources/app/node_modules/@tenjuu99/blog')
    assert.equal(await readlink(linkPath), '../..')
    // 張り替え後のリンクを辿ると .app 内で完結した package.json に到達する（外部パスに依存しない）
    assert.equal(
      await readFile(path.join(linkPath, 'package.json'), 'utf8'),
      '{"name":"@tenjuu99/blog"}'
    )
  })

  test('実際のバンドルマニフェスト（manifest.json）は既知のルートキーのみを参照する', async () => {
    const manifest = JSON.parse(await readFile(REAL_MANIFEST_PATH, 'utf8'))
    for (const { src } of manifest.entries) {
      const [rootKey] = src.split('/')
      assert.ok(KNOWN_ROOTS.includes(rootKey), `未知のルートキー: "${rootKey}"（src: "${src}"）`)
    }
  })

  test('実際のバンドルマニフェストは repo/scripts/app-bundle 配下の相対importが指すファイルを漏れなく含む', async () => {
    // bundledDependencyMatcher.js の追加をmanifest.jsonへの追記し忘れたことで、
    // .app単体では ERR_MODULE_NOT_FOUND になる不具合が実機検証で発覚したための回帰テスト
    const manifest = JSON.parse(await readFile(REAL_MANIFEST_PATH, 'utf8'))
    const appBundleEntries = manifest.entries
      .map((e) => e.src)
      .filter((src) => src.startsWith('repo/scripts/app-bundle/') && src.endsWith('.js'))
    const includedRelativePaths = new Set(
      appBundleEntries.map((src) => src.slice('repo/scripts/app-bundle/'.length))
    )
    const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

    for (const src of appBundleEntries) {
      const absPath = path.join(repoRoot, src.slice('repo/'.length))
      const content = await readFile(absPath, 'utf8')
      const importMatches = content.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)
      for (const [, relativeImport] of importMatches) {
        const importedFile = relativeImport.slice('./'.length)
        assert.ok(
          includedRelativePaths.has(importedFile),
          `"${src}" が import する "${importedFile}" がmanifestに含まれていない`
        )
      }
    }
  })
})
