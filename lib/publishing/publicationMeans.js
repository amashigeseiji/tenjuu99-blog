/**
 * @vocab 公開手段
 * 公開の実現一式。リモートの内容参照（リモート状態）・反映の実行・送る公開物の形態を
 * ひとまとまりで提供する。git / FTP / SFTP などの各手段はこの形を満たすことで
 * 「公開とは何か」を再定義せずに差し替えられる。
 *
 * @typedef {object} PublicationMeans
 * @property {RemoteState} remoteState - リモートの現在の内容を参照する読み取り専用の抽象（リモート状態）
 * @property {(files: string[]) => Promise<{ success: boolean, error?: string }>} reflect - ローカルの公開物をリモートへ反映する
 * @property {(files: string[]) => Promise<{ success: boolean, error?: string }>} remove - リモートからファイルを取り除く（除去のリモート向き。ローカルには関与しない）
 * @property {(files: string[]) => Promise<{ success: boolean, error?: string }>} takeFromRemote - リモートの内容をローカルへ反映する（取り込みの実行）
 * @property {(filePath: string) => Promise<Lineage>} lineageOf - ファイルごとの版の連なりの参照
 * @property {() => Promise<{ success: boolean, error?: string }>} [refreshRemote] - リモートの知識を最新にする（持たない手段は構築時の知識のまま）
 * @property {'manuscript'|'artifact'} deliverable - 送る公開物の形態（manuscript=原稿, artifact=成果物）
 */

/**
 * @vocab 版の連なり
 * 版の履歴と共通の祖先の知識から言える、ファイルごとの先後関係の読み。
 * 'deletedLocally'（手元で消された）と 'remoteOnly'（他所で作られた）の区別が
 * 不在の曖昧性の解消にあたる。手段がこの知識を持たない場合、両側に存在して
 * 内容が異なるものは 'diverged' として正直に退化する（取り込みで執筆内容を失わないため）。
 * @typedef {'same'|'localAhead'|'remoteAhead'|'diverged'|'localOnly'|'remoteOnly'|'deletedLocally'} Lineage
 */

/**
 * @vocab リモート状態
 * リモートの現在の内容を参照するための読み取り専用の抽象。
 * @typedef {object} RemoteState
 * @property {(filePath: string) => Promise<boolean>} existsInRemote - ファイルがリモートに存在するか
 * @property {(filePath: string) => Promise<string>} diffFromRemote - リモートとの差分（差分なしなら空文字列）
 * @property {() => Promise<string[]>} listRemoteFiles - リモートに存在するファイルの一覧（手元に無いものの検出に使う）
 */

export {}
