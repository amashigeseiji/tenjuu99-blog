const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );

const fetchData = (target) => {
  return fetch(`/get_editor_target?md=${target}`)
    .then(async res => {
      if (!res.ok) {
        document.querySelector('#inputFileName').value = target
        document.querySelector('#editorTextArea').value = `---
title: ${target.split('.')[0].split('/').pop()}
---
${target.split('.')[0].split('/').pop()} についての記事を作成しましょう`
        // submit('/preview', form)
        throw new Error(`${target} does not exist.`)
      } else {
        const json = await res.json()
        return json
      }
    })
}
const onloadFunction = async (e) => {
  const form = document.querySelector('#editor')
  const textarea = form.querySelector('#editorTextArea')
  const select = form.querySelector('#selectDataFile')
  const inputFileName = form.querySelector('#inputFileName')
  const preview = document.querySelector('#previewContent')
  const url = new URL(location)
  const target = url.searchParams.get('md')
  if (target) {
    fetchData(target).then(json => {
      textarea.value = json.content
      select.value = json.filename
      inputFileName.value = json.filename
      inputFileName.setAttribute('disabled', true)
      submit('/preview', form)
    }).catch(e => {
      console.log('error!!!')
      console.log(e)
    })
  }
  select.addEventListener('change', async (event) => {
    if (select.value) {
      const json = await fetchData(select.value)
      textarea.value = json.content
      inputFileName.value = json.filename
      inputFileName.setAttribute('disabled', true)
      url.searchParams.set('md', select.value)
      submit('/preview', form)
    } else {
      inputFileName.value = ""
      inputFileName.removeAttribute('disabled')
      textarea.value = ''
      url.searchParams.set('md', "")
      const iframe = preview.querySelector('iframe')
      if (iframe) {
        iframe.srcdoc = ''
      }
    }
    history.pushState({}, "", url)
  })

  const submit = (fetchUrl, form) => {
    const formData = new FormData(form)
    const obj = {}
    formData.forEach((v, k) => {
      obj[k] = v
    })
    return fetch(fetchUrl, {
      method: 'post',
      body: JSON.stringify(obj)
    }).then(async response => {
      const json = await response.json()
      if (!response.ok) {
        alert(json.message)
        return
      }
      if (json.href) {
        await sleep(300)
        location.href = json.href
      }
      if (json.preview) {
        const iframe = document.createElement('iframe')
        iframe.setAttribute('srcdoc', json.preview)
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')
        const old = preview.querySelector('iframe')
        if (!old) {
          preview.appendChild(iframe)
        }
        old.setAttribute('srcdoc', json.preview)
      }
    }).catch(e => {
      console.log(e.message)
    })
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fetchUrl = event.submitter.dataset.url
    submit(fetchUrl, event.target)
  })
}

const SIDEBAR_OPEN_KEY = 'sidebar-is-open'
const DIR_OPEN_KEY = 'sidebar-dir-open'

const loadDirOpenState = () => {
  try {
    return JSON.parse(localStorage.getItem(DIR_OPEN_KEY) || '{}')
  } catch {
    return {}
  }
}

const saveDirOpenState = (state) => {
  localStorage.setItem(DIR_OPEN_KEY, JSON.stringify(state))
}

const initSidebarTree = (activeFile) => {
  const state = loadDirOpenState()

  // アクティブファイルの親ディレクトリを開いた状態にする
  if (activeFile) {
    const parts = activeFile.split('/')
    let path = ''
    for (let i = 0; i < parts.length - 1; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]
      state[path] = true
    }
  }

  // localStorage の状態を <details> に反映し、toggle イベントで保存する
  document.querySelectorAll('.sidebar details[data-dir]').forEach(details => {
    const dir = details.dataset.dir
    if (state[dir]) {
      details.open = true
    }
    details.addEventListener('toggle', () => {
      const current = loadDirOpenState()
      current[dir] = details.open
      saveDirOpenState(current)
    })
  })

  // アクティブファイルに class="active" を付与（SSG では静的に付与できないため JS で補完）
  if (activeFile) {
    const link = document.querySelector(`.sidebar a[href="/editor?md=${CSS.escape(activeFile)}"]`)
    if (link) {
      link.classList.add('active')
    }
  }
}

const sidebarToggle = (e) => {
  const sidebar = document.querySelector('.sidebar')
  const main = document.querySelector('main')
  const toggle = sidebar.querySelector('.sidebar-toggle')
  toggle.addEventListener('click', (e) => {
    e.preventDefault()
    main.classList.toggle('sidebar-close')
    localStorage.setItem(SIDEBAR_OPEN_KEY, !main.classList.contains('sidebar-close'))
  })
  if (localStorage.getItem(SIDEBAR_OPEN_KEY) === 'true') {
    main.classList.remove('sidebar-close')
  } else {
    main.classList.add('sidebar-close')
  }
  const hamburger = document.querySelector('.hamburger-menu input[type="checkbox"]')
  hamburger.addEventListener('change', (e) => {
    main.classList.toggle('sidebar-close')
  })
}
document.addEventListener('DOMContentLoaded', (event) => {
  const url = new URL(location)
  const activeFile = url.searchParams.get('md') || ''
  onloadFunction(event)
  sidebarToggle(event)
  initSidebarTree(activeFile)
})
