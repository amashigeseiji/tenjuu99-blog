import { allData } from '@tenjuu99/blog/lib/indexer.js'
import replaceVariablesFilter from '@tenjuu99/blog/lib/replaceVariablesFilter.js'
import config from '@tenjuu99/blog/lib/config.js'

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

let indexedItemsSorted = null
export function indexedItems() {
  if (indexedItemsSorted) {
    return indexedItemsSorted
  }
  const sorted = readIndex()
    .filter(v => v.index && v.published != '1970-01-01')
    .sort((a, b) => new Date(a.published) - new Date(b.published))
  let prev, next
  for (const item of sorted) {
    if (prev) {
      prev.next = {
        name: item.name,
        published: item.published,
        url: item.url,
        title: item.title,
      }
      item.prev = {
        name: prev.name,
        published: prev.published,
        url: prev.url,
        title: prev.title,
      }
    }
    prev = item
  }
  indexedItemsSorted = sorted
  return indexedItemsSorted
}

/**
 * 配列を再帰的に順不同リストに変換する
 * @param {Array|string} arrayOrText
 * @returns {mixed}
 */
export function arrayToList(arrayOrText) {
  if (typeof arrayOrText === 'string') {
    return `<li>${arrayOrText}</li>`
  }
  if (Array.isArray(arrayOrText)) {
    let resultListText = '<ul>'
    for (const item of arrayOrText) {
      if (Array.isArray(item)) {
        resultListText += `<li>${arrayToList(item)}</li>`
      } else {
        resultListText += `<li>${item}</li>`
      }
    }
    resultListText += '</ul>'
    arrayOrText = resultListText
  }
  return arrayOrText
}

export function renderIndex(pages, nodate = 'nodate', headingTag = 'h3') {
  if (!pages) {
    pages = readIndex()
  }

  const renderList = {}
  for (const page of pages) {
    if (page.index) {
      const url = config.relative_path ? config.relative_path + page.url : page.url
      if (page.published === '1970-01-01') {
        if (!renderList[nodate]) {
          renderList[nodate] = []
        }
        renderList[nodate].push(`<a href="${url}">${page.title}</a>`)
        continue
      }
      const published = new Date(page.published)
      const year = `${published.getFullYear()}年`
      const date = `${published.getMonth() +1}月${published.getDate()}日`
      if (!renderList[year]) {
        renderList[year] = []
      }
      renderList[year].push(`<a href="${url}">${page.title}</a> (${date})`)
    }
  }

  const resultText = []
  for (const key in renderList) {
    resultText.push(`<${headingTag}>${key}</${headingTag}>`)
    if (Array.isArray(renderList[key])) {
      resultText.push(arrayToList(renderList[key]))
    } else {
      resultText.push(`<p>${renderList[key]}</p>`)
    }
  }
  return resultText.join('\n')
}

export function isEditorEnabled() {
  return allData.editor && allData.editor.distribute
}
