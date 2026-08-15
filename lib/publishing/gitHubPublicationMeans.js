import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import nodePath from 'node:path'
import { compute } from './fingerprint.js'
import { judge } from './versionLineage.js'
import { BLOB_MODE, GitHubConnectionError } from './gitHubConnection.js'

/** 反映・除去しようとするファイルについてリモートが進んでいたときに作成者へ伝える言葉（git の語彙を含まない） */
const REMOTE_ADVANCED_MESSAGE = 'リモートが先に進んでいます。先に取り込んでから、もう一度公開してください'

/**
 * 接続の誤りを、作成者に伝わる言葉の失敗に変える。
 * @param {unknown} error
 * @returns {{ success: false, error: string }}
 */
function toFailure(error) {
  if (error instanceof GitHubConnectionError && error.kind === 'remoteAdvanced') {
    return { success: false, error: REMOTE_ADVANCED_MESSAGE }
  }
  return { success: false, error: error?.message ?? String(error) }
}

/**
 * @vocab GitHub公開手段
 * @test tests/publishing/gitHubPublicationMeans.test.js
 * 公開手段の、GitHub がホストするリモートに GitHub がネットワーク越しに提供する手段で届く実現。
 * 手元に git を要求しない。原稿と参照画像を公開物として一度の反映でまとめてリモートへ届け
 * （反映・除去しようとするファイルについてリモートが進んでいれば拒む）、除去・取り込み・
 * リモート状態の参照を GitHub接続 越しに行う。git の履歴が担っていた「前回揃えた時点」の
 * 知識は 同期の基点 として自身が保持し、フィンガープリント で手元とリモートの同異を判定する。
 *
 * 「リモートが進んでいる」の検出は二段ある:
 * - ファイル単位の事前検査（この手段）: 反映・除去しようとするファイルについて、リモートの内容が
 *   手元とも同期の基点とも違う（揃えたあとにリモート側で変わった／揃えたことが無い）なら、
 *   何も書かずに拒む。他マシンの公開を上書き・消去しないための、作成者に見える意味の判定
 * - 版の書き込みの原子性（接続）: 書き込みの直前にリモートが動いた競合を接続が拒む（remoteAdvanced）。
 *   こちらは同時書き込みの安全弁で、日常の運用で当たることは稀
 *
 * リモートの知識は組み立て時に読み、refreshRemote で最新にする（git 手段の fetch と同じ位置づけ）。
 * 組み立て時に接続が届かなかった場合も手段は返し、参照は例外・実行は失敗として伝える
 * （公開ステータス判定器が 'unknown' を返せるようにするため。git 手段の upstream 未設定と同型）。
 *
 * remoteState は読み取りだが、読みの過程で手元とリモートが同じ内容だと分かったファイルは
 * 同期の基点をその内容で揃える（基点は「揃えたと分かった時点」の知識であり、読みはその機会になる）。
 *
 * @param {object} options
 * @param {string} options.cwd - コンテンツルート（リモートのパスはここからの相対）
 * @param {ReturnType<import('./gitHubConnection.js').createGitHubConnection>} options.connection
 * @param {ReturnType<import('./syncBase.js').createSyncBase>} options.syncBase
 * @returns {Promise<import('./publicationMeans.js').PublicationMeans>}
 */
export async function createGitHubPublicationMeans({ cwd, connection, syncBase }) {
  // ---- リモートの知識 ----

  /** @type {import('./gitHubConnection.js').RemoteVersion|null} */
  let version = null
  /** @type {Error|null} */
  let loadError = null

  const load = async () => {
    try {
      version = await connection.readCurrentVersion()
      loadError = null
    } catch (e) {
      version = null
      loadError = e
    }
  }

  /** いま知っているリモートの版。知識が無ければ、組み立て時（または最後の更新時）の誤りを投げる */
  const currentVersion = () => {
    if (!version) throw loadError ?? new Error('リモートの知識がありません')
    return version
  }

  /** 新しい版を書き込んだあと、知識を書き込んだ内容で進める（読み直しは不要） */
  const applyWritten = (written, changes) => {
    const files = new Map(currentVersion().files)
    for (const change of changes) {
      if (change.content === null) files.delete(change.path)
      else files.set(change.path, { fingerprint: change.fingerprint, mode: files.get(change.path)?.mode ?? BLOB_MODE })
    }
    version = { id: written.id, treeId: written.treeId, files }
  }

  // ---- パスと指紋 ----

  /**
   * ファイルの指定をコンテンツルートからの相対パス（リモート上のパスと同じ形）に揃える。
   * git 手段が絶対パスも相対パスも受け付ける（git がリポジトリ内なら区別しない）のと同じ寛容さを保ち、
   * コンテンツルートの外を指すものは拒む。
   */
  const toRepoPath = (filePath) => {
    const rel = nodePath.relative(cwd, nodePath.resolve(cwd, filePath))
    if (rel === '' || rel.startsWith('..') || nodePath.isAbsolute(rel)) {
      throw new Error(`コンテンツルートの外のファイルです: ${filePath}`)
    }
    return rel.split(nodePath.sep).join('/')
  }

  const localFingerprintOf = (repoPath) => {
    const abs = nodePath.join(cwd, repoPath)
    return existsSync(abs) ? compute(readFileSync(abs)) : null
  }
  const remoteFingerprintOf = (repoPath) => currentVersion().files.get(repoPath)?.fingerprint ?? null

  // ---- 同期の基点 ----

  /**
   * 手元とリモートの指紋を見て、同じ内容だと分かった時点で基点をその内容で揃える。
   * clone 済み相当のフォルダの初期状態（基点の記録が無い）を、読みの過程で自然に埋めるため。
   */
  const observe = (repoPath) => {
    const local = localFingerprintOf(repoPath)
    const remote = remoteFingerprintOf(repoPath)
    if (local !== null && local === remote) syncBase.advance(repoPath, local)
    return { local, remote }
  }

  /**
   * 初回接触（基点の記録がまったく無い＝clone 済み相当のフォルダを初めて開いた）では、
   * リモートにあって手元と同じ内容のファイルすべての基点をこの時点で揃える。
   * 以降は読み（diffFromRemote / lineageOf）で同じと分かった時点で個別に揃える。
   */
  const reconcileOnFirstContact = () => {
    if (!version || syncBase.entries().length > 0) return
    for (const repoPath of version.files.keys()) observe(repoPath)
  }

  /**
   * そのファイルについてリモートが進んでいるか（リモートの内容が、手元とも同期の基点とも違う）。
   * 反映・除去の前に問い、進んでいれば何も書かずに拒む。
   */
  const remoteAdvancedFor = (repoPath, localFingerprint) => {
    const remote = remoteFingerprintOf(repoPath)
    return remote !== null && remote !== localFingerprint && remote !== syncBase.get(repoPath)
  }

  await load()
  reconcileOnFirstContact()

  // ---- 公開手段の各操作 ----

  const remoteState = {
    existsInRemote: async (filePath) => currentVersion().files.has(toRepoPath(filePath)),
    diffFromRemote: async (filePath) => {
      const { local, remote } = observe(toRepoPath(filePath))
      if (remote === null) return ''
      return local === remote ? '' : 'modified'
    },
    listRemoteFiles: async () => [...currentVersion().files.keys()],
  }

  const reflect = async (files) => {
    try {
      const base = currentVersion()
      const changes = []
      for (const repoPath of files.map(toRepoPath)) {
        const content = readFileSync(nodePath.join(cwd, repoPath))
        const fingerprint = compute(content)
        if (remoteFingerprintOf(repoPath) === fingerprint) {
          syncBase.advance(repoPath, fingerprint)
          continue
        }
        if (remoteAdvancedFor(repoPath, fingerprint)) return { success: false, error: REMOTE_ADVANCED_MESSAGE }
        changes.push({ path: repoPath, content, fingerprint })
      }
      if (changes.length === 0) return { success: true }
      const written = await connection.writeVersion({ base, changes, message: 'publish' })
      applyWritten(written, changes)
      for (const change of changes) syncBase.advance(change.path, change.fingerprint)
      return { success: true }
    } catch (error) {
      return toFailure(error)
    }
  }

  const remove = async (files) => {
    try {
      const base = currentVersion()
      const repoPaths = files.map(toRepoPath)
      const changes = []
      for (const repoPath of repoPaths) {
        if (!base.files.has(repoPath)) continue
        if (remoteAdvancedFor(repoPath, localFingerprintOf(repoPath))) return { success: false, error: REMOTE_ADVANCED_MESSAGE }
        changes.push({ path: repoPath, content: null })
      }
      if (changes.length > 0) {
        const written = await connection.writeVersion({ base, changes, message: 'unpublish' })
        applyWritten(written, changes)
      }
      for (const repoPath of repoPaths) syncBase.forget(repoPath)
      return { success: true }
    } catch (error) {
      return toFailure(error)
    }
  }

  const takeFromRemote = async (files) => {
    try {
      const current = currentVersion()
      for (const repoPath of files.map(toRepoPath)) {
        const entry = current.files.get(repoPath)
        if (!entry) return { success: false, error: `リモートにありません: ${repoPath}` }
        const content = await connection.readContent(entry.fingerprint)
        const abs = nodePath.join(cwd, repoPath)
        mkdirSync(nodePath.dirname(abs), { recursive: true })
        writeFileSync(abs, content)
        syncBase.advance(repoPath, entry.fingerprint)
      }
      return { success: true }
    } catch (error) {
      return toFailure(error)
    }
  }

  const lineageOf = async (filePath) => {
    const repoPath = toRepoPath(filePath)
    const { local, remote } = observe(repoPath)
    return judge({ local, remote, base: syncBase.get(repoPath) })
  }

  const refreshRemote = async () => {
    await load()
    return loadError ? toFailure(loadError) : { success: true }
  }

  return { remoteState, reflect, remove, takeFromRemote, lineageOf, refreshRemote, deliverable: 'manuscript' }
}
