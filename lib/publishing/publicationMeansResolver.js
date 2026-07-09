import { createGitPublicationMeans } from './gitPublicationMeans.js'

const registry = {
  git: createGitPublicationMeans,
}

/**
 * @vocab 公開手段解決器
 * @test tests/publishing/publicationMeans.test.js
 * 構成にもとづいて使う公開手段を決めて提供する。手段の差し替え点はここに一本化される。
 * @param {{ means?: string, cwd: string }} options - 構成（means 未指定時の既定は git）
 * @returns {Promise<import('./publicationMeans.js').PublicationMeans>}
 */
export async function resolvePublicationMeans({ means = 'git', cwd }) {
  const create = registry[means]
  if (!create) throw new Error(`未知の公開手段です: ${means}`)
  return await create(cwd)
}
