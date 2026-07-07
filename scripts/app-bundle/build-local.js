#!/usr/bin/env node
// 手元での動作確認用のローカルビルド。CIでの本番ビルド（Node公式バイナリのvendoring、
// npm ci --omit=dev、swift build -c release の自動化）は別問題として次フェーズに回す。
// このスクリプトは「今動いているNode」をvendoredNode代わりに使う簡易版。
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { assemble } from './distributionBundleAssembler.js'

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../../..')
const vendoredNodeRoot = path.dirname(path.dirname(process.execPath))

const appOutputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repoRoot, 'dist-app', 'tenjuu99-blog.app')

await assemble({
  manifestPath: path.join(repoRoot, 'scripts/app-bundle/manifest.json'),
  roots: {
    repo: repoRoot,
    vendoredNode: vendoredNodeRoot,
    swiftBuild: path.join(repoRoot, 'native/.build/release'),
    appShell: path.join(repoRoot, 'native/AppBundleResources'),
  },
  appOutputPath,
})

console.log(`Assembled: ${appOutputPath}`)
