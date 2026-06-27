import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * @vocab PublicationStatus (plans/editor-publish/dictionary.md#公開ステータス)
 * @vocab PublishedState (plans/editor-publish/dictionary.md#公開済み状態)
 */
export async function getPublicationStatus(filePath, cwd) {
  try {
    const { stdout: upstream } = await execFileAsync(
      'git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { cwd }
    )
    const ref = upstream.trim()
    try {
      await execFileAsync('git', ['cat-file', '-e', `${ref}:${filePath}`], { cwd })
    } catch {
      return 'new'
    }
    const { stdout: diff } = await execFileAsync('git', ['diff', ref, '--', filePath], { cwd })
    return diff.trim() ? 'modified' : 'published'
  } catch {
    return 'unknown'
  }
}
