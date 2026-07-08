import { register } from 'node:module'

// 同梱 Node の起動時に `--import` で読み込まれ、同梱モジュール解決器をフックとして登録する配線。
// アプリ（.app）からの起動時にのみ差し込まれるため、素の npm run dev には影響しない。
register('./bundledModuleResolver.js', import.meta.url)
