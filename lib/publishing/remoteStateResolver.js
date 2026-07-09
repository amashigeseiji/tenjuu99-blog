import { styleText } from 'node:util'
import { resolvePublicationMeans } from './publicationMeansResolver.js'

/**
 * @vocab リモート状態解決器
 * @test tests/publishing/publicationMeans.test.js
 * 構成にもとづいて公開手段を解決し、そのリモート状態を返す。解決に失敗した場合
 * （不明な手段名など）は、常に例外を投げるリモート状態を代わりに返し、失敗をログに出力する。
 * @param {{ means?: string, cwd: string }} options
 * @returns {Promise<import('./publicationMeans.js').RemoteState>}
 */
export async function resolveRemoteState({ means, cwd }) {
  try {
    const resolved = await resolvePublicationMeans({ means, cwd })
    return resolved.remoteState
  } catch (e) {
    console.log(styleText('red', '[publishing] 公開手段の解決に失敗したため、参照不能として扱います:'), e.message)
    return {
      existsInRemote: async () => { throw e },
      diffFromRemote: async () => { throw e },
    }
  }
}
