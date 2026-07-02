import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { resolve } from '../../scripts/app-bundle/bundleManifestResolver.js'

describe('配置マッピング解決器は バンドルマニフェストをビルド成果物の実パスに解決できる', () => {
  test('マニフェストの各エントリが roots と appOutputPath を使って絶対パスに解決される', () => {
    const manifest = {
      entries: [
        { src: 'repo/lib', dest: 'Contents/Resources/app/lib' },
        { src: 'vendoredNode/bin/node', dest: 'Contents/Resources/node/bin/node' },
      ],
    }
    const roots = {
      repo: '/build/tenjuu99-blog',
      vendoredNode: '/build/node-v24',
    }
    const appOutputPath = '/build/output/tenjuu99-blog.app'

    const resolved = resolve(manifest, roots, appOutputPath)

    assert.deepEqual(resolved, [
      {
        src: path.join('/build/tenjuu99-blog', 'lib'),
        dest: path.join(appOutputPath, 'Contents/Resources/app/lib'),
      },
      {
        src: path.join('/build/node-v24', 'bin/node'),
        dest: path.join(appOutputPath, 'Contents/Resources/node/bin/node'),
      },
    ])
  })

  test('roots に存在しないルートキーを参照するエントリがあるとエラーになる', () => {
    const manifest = { entries: [{ src: 'unknownRoot/foo', dest: 'Contents/foo' }] }
    assert.throws(() => resolve(manifest, {}, '/build/output/tenjuu99-blog.app'), /unknownRoot/)
  })

  test('ルートキー自体がdestになるエントリ（相対パス部分が無い）も解決できる', () => {
    const manifest = { entries: [{ src: 'swiftBuild', dest: 'Contents/MacOS/App' }] }
    const roots = { swiftBuild: '/build/native/.build/release/App' }
    const resolved = resolve(manifest, roots, '/build/output/tenjuu99-blog.app')

    assert.deepEqual(resolved, [
      {
        src: '/build/native/.build/release/App',
        dest: path.join('/build/output/tenjuu99-blog.app', 'Contents/MacOS/App'),
      },
    ])
  })
})
