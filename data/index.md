---
title: INDEX
template: index.html
index: false
url: /
published: 2023-03-03 20:21
modified: 2023-03-03 20:21
---
## INDEX

{script}
return helper.readIndex()
.then((index) => {
  return index.sort((a, b) => new Date(b.published) - new Date(a.published))
}).then((index) => {
  const pages = {}
  for (const page of index) {
    if (page.index) {
      const url = variables.relative_path ? variables.relative_path + page.url : page.url
      if (page.published === '1970-01-01') {
        if (!pages['日付なし']) {
            pages['日付なし'] = []
        }
        pages['日付なし'].push(`<a href="${url}">${page.title}</a>`)
        continue
      }
      const published = new Date(page.published)
      const year = `${published.getFullYear()}年`
      const date = `${published.getMonth() +1}月${published.getDate()}日`
      if (!pages[year]) {
        pages[year] = []
      }
      pages[year].push(`<a href="${url}">${page.title}</a> (${date})`)
    }
  }
  return pages
})
{/script}
