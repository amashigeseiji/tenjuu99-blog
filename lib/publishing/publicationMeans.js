/**
 * @vocab 公開手段
 * 公開の実現一式。リモートの内容参照（公開済み状態）・反映の実行・送る公開物の形態を
 * ひとまとまりで提供する。git / FTP / SFTP などの各手段はこの形を満たすことで
 * 「公開とは何か」を再定義せずに差し替えられる。
 *
 * @typedef {object} PublicationMeans
 * @property {PublishedState} publishedState - リモートの現在の内容を参照する読み取り専用の抽象（公開済み状態）
 * @property {(files: string[]) => Promise<{ success: boolean, error?: string }>} reflect - ローカルの公開物をリモートへ反映する
 * @property {'manuscript'|'artifact'} deliverable - 送る公開物の形態（manuscript=原稿, artifact=成果物）
 */

/**
 * @vocab 公開済み状態
 * リモートの現在の内容を参照するための読み取り専用の抽象。
 * @typedef {object} PublishedState
 * @property {(filePath: string) => Promise<boolean>} existsInRemote - ファイルがリモートに存在するか
 * @property {(filePath: string) => Promise<string>} diffFromRemote - リモートとの差分（差分なしなら空文字列）
 */

export {}
