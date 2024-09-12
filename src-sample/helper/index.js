import { allData, config } from '@tenjuu99/blog'

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

export function getPageData(name) {
  return allData[name]
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

export function breadcrumbList(pageName) {
  const pageData = allData[pageName]
  const breadCrumbs = ['/']
  pageData.url.split('/').reduce((prev, curr) => {
    breadCrumbs.push([`/${prev}${curr}/`, curr])
    return `${prev}${curr}/`
  })
  const last = breadCrumbs.pop()
  last[0] = last[0].substring(0, last[0].length - 1)

  const output = breadCrumbs.map(v => {
    return `<div style="margin-left: 10px;"><a href="${v[0]}">${v[0] === '/' ? 'top' : v[1]}</a> > </div>`
  }).join('') + `<div style="margin-left: 10px;">${last[1]}</div>`
  return '<div style="display: flex;flex-wrap: wrap;">'
    + output
    + '</div>'
}
