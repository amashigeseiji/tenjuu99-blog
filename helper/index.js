import { allData } from "../lib/indexer.js";
import { replaceVariablesFilter } from "../lib/filter.js";

export function readIndex (filter = null) {
  const data = Object.entries(allData)
    .sort((a, b) => new Date(b[1].published) - new Date(a[1].published))
  return filter
    ? data.filter(v => v[0].indexOf(filter) === 0).map(v => v[1])
    : data.map(v => v[1])
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
