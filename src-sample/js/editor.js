const sleep = waitTime => new Promise( resolve => setTimeout(resolve, waitTime) );

const fetchData = (target) => {
  return fetch(`/get_editor_target?md=${target}`)
    .then(async res => {
      if (!res.ok) {
        document.querySelector('#inputFileName').value = target
        document.querySelector('#editorTextArea').value = `${target.split('.')[0]}についての記事を作成しましょう`
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

const sidebarToggle = (e) => {
  const sidebar = document.querySelector('.sidebar')
  const main = document.querySelector('main')
  const toggle = sidebar.querySelector('.sidebar-toggle')
  toggle.addEventListener('click', (e) => {
    e.preventDefault()
    main.classList.toggle('sidebar-close')
  })
  const hamburger = document.querySelector('.hamburger-menu input[type="checkbox"]')
  hamburger.addEventListener('change', (e) => {
    main.classList.toggle('sidebar-close')
  })
}
document.addEventListener('DOMContentLoaded', (event) => {
  onloadFunction(event)
  sidebarToggle(event)
})
