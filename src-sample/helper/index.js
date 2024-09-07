import { allData } from '@tenjuu99/blog/lib/indexer.js'

export function additionalHelper() {
  return 'これは追加ヘルパーによって出力されているメッセージです。'
}

export function isEditorEnabled() {
  return allData.editor && allData.editor.distribute
}
