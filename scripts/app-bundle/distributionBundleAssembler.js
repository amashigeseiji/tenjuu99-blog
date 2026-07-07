import { readFile, symlink, rm, lstat } from 'node:fs/promises'
import path from 'node:path'
import { resolve as resolveManifest } from './bundleManifestResolver.js'
import { write as writeBundle } from './bundleWriter.js'

/**
 * @vocab: 配布物組み立て器
 * @test: tests/app-bundle/distributionBundleAssembler.test.js
 * @param {{manifestPath: string, roots: Record<string, string>, appOutputPath: string}} options
 * @returns {Promise<void>}
 */
export async function assemble({ manifestPath, roots, appOutputPath }) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const resolved = resolveManifest(manifest, roots, appOutputPath)
  await writeBundle(resolved)
  await applySymlinks(manifest.symlinks ?? [], appOutputPath)
}

/**
 * マニフェストの symlinks を適用する。npmのfile:self-reference依存のように、
 * entries のコピーだとビルド機の一時パスを指す壊れたリンクになってしまうものを、
 * .app内で完結する相対リンクに張り替えるための後処理。
 * @param {Array<{at: string, target: string}>} symlinks
 * @param {string} appOutputPath
 */
async function applySymlinks(symlinks, appOutputPath) {
  for (const { at, target } of symlinks) {
    const linkPath = path.join(appOutputPath, at)
    const existing = await lstat(linkPath).catch(() => null)
    if (existing) {
      await rm(linkPath, { recursive: true, force: true })
    }
    await symlink(target, linkPath)
  }
}
