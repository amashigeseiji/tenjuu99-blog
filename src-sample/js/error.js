document.addEventListener('DOMContentLoaded', (e) => {
})
const url = new URL(location)
if (url.pathname !== '/editor') {
  const link = document.querySelector('.editor_link')
  link.href = `/editor?md=${url.pathname.replace('/', '')}.md`
  link.innerHTML = `${url.pathname.replace('/', '')}のページを作成する`
}
