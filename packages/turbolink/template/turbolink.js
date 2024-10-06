const transition = async (href) => {
  const destination = await fetch(href)
  if (!destination.ok) {
    document.location.href = href
    return
  }
  const doc = document.createElement('html')
  doc.innerHTML = await destination.text()
  // load stylesheets
  const headLinks = doc.getElementsByTagName('link')
  const styleSheets = [...document.styleSheets].map(s => s.href).filter(h => h)
  const newStyleSheets = [...headLinks].filter(l => l.rel === 'stylesheet').map(l => l.href)
  const diff = newStyleSheets.filter(i => styleSheets.indexOf(i) === -1)
  diff.forEach(href => {
    const addLink = document.createElement('link')
    addLink.rel = 'stylesheet'
    addLink.href = href
    document.head.appendChild(addLink)
  })
  // load style
  const styleInline = [...document.styleSheets].filter(s => !s.href)
  const newStyleInline = [...doc.getElementsByTagName('style')].filter(s => s.dataset.styleName)
  newStyleInline.forEach(s => {
    const name = s.dataset.styleName
    if (!styleInline.find(si => si.ownerNode.dataset.styleName === name)) {
      document.head.appendChild(s)
    }
  })
  // set body
  document.body = doc.getElementsByTagName('body')[0]
  // set header
  document.title = doc.getElementsByTagName('title')[0].textContent
  const canonical = document.head.querySelector('link[rel=canonical]').href = doc.querySelector('link[rel=canonical]').href

  const metas = [...document.head.querySelectorAll('meta')]
  metas.forEach(meta => {
    if (
      (meta.getAttribute('property') && meta.getAttribute('property').startsWith('og:')) ||
      (meta.getAttribute('name') && meta.getAttribute('name').startsWith('twitter:'))
    ) {
      meta.remove()
    }
  })
  const newMetas = [...doc.querySelectorAll('meta')]
  newMetas.forEach(meta => {
    if (
      (meta.getAttribute('property') && meta.getAttribute('property').startsWith('og:')) ||
      (meta.getAttribute('name') && meta.getAttribute('name').startsWith('twitter:'))
    ) {
      document.head.appendChild(meta)
    }
  })
}

const turbolinks = () => {
  const links = document.querySelectorAll('a')
  const current = new URL(document.location.href)
  const currentDom = document.body
  links.forEach(link => {
    const href = link.href
    const url = new URL(href)
    if (url.host === current.host) {
      link.onclick = async (e) => {
        e.preventDefault()
        if (`${url.pathname}${url.search}` === `${current.pathname}${current.search}`) {
          return;
        }
        await transition(href)
        history.pushState({}, '', href)
        turbolinks()
      }
    }
  })
}
document.body.onload = turbolinks
window.onpopstate = async (e) => {
  const href = window.location.pathname + window.location.search + window.location.hash
  await transition(href)
  turbolinks()
}
