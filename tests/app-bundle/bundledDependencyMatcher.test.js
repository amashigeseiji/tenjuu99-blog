import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { matches, dependencyNames } from '../../scripts/app-bundle/bundledDependencyMatcher.js'

describe('依存パッケージ名判定器は 参照が同梱コード自身の依存パッケージへの参照かどうか判定できる', () => {
  test('依存パッケージ名一覧に完全一致する参照は判定される', () => {
    assert.equal(matches('sharp', ['sharp', 'marked']), true)
  })

  test('依存パッケージ名一覧のサブパスへの参照も判定される', () => {
    assert.equal(matches('sharp/lib/is', ['sharp', 'marked']), true)
  })

  test('依存パッケージ名一覧に無い参照は判定されない', () => {
    assert.equal(matches('chokidar', ['sharp', 'marked']), false)
  })

  test('前方一致するだけの別パッケージ名は判定されない', () => {
    assert.equal(matches('sharp-extra', ['sharp', 'marked']), false)
  })

  describe('依存パッケージ名判定器は 同梱コード自身が持つ依存パッケージ名の一覧を取得できる', () => {
    test('package.json の dependencies のキーを一覧として返す', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'bundled-dependency-matcher-'))
      try {
        await writeFile(path.join(dir, 'package.json'), JSON.stringify({
          dependencies: { sharp: '^1.0.0', marked: '^2.0.0' },
          devDependencies: { '@playwright/test': '^1.0.0' },
        }))
        const rootURL = pathToFileURL(`${dir}/`)
        assert.deepEqual(dependencyNames(rootURL).sort(), ['marked', 'sharp'])
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })

    test('dependencies が無い package.json では空配列を返す', async () => {
      const dir = await mkdtemp(path.join(tmpdir(), 'bundled-dependency-matcher-'))
      try {
        await writeFile(path.join(dir, 'package.json'), JSON.stringify({}))
        const rootURL = pathToFileURL(`${dir}/`)
        assert.deepEqual(dependencyNames(rootURL), [])
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })

    test('引数省略時は同梱コード自身（このリポジトリ）の package.json を読む', () => {
      assert.ok(dependencyNames().includes('sharp'), 'sharp はこのリポジトリ自身の依存パッケージ')
    })
  })
})
