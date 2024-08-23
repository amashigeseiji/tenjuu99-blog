import { readIndex as read, allData } from "../lib/indexer.js";
import { replaceVariablesFilter } from "../lib/filter.js";

export async function readIndex () {
  return await read()
}

export function dateFormat(dateString) {
  const date = new Date(dateString)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function render(text, variables) {
  return replaceVariablesFilter(text, variables)
}

export function getPageData(name) {
  return allData[name]
}
