---
title: 投稿一覧
---
<script type="ssg">
  variables.postPages = helper.readIndex().filter(v => v.url.indexOf('/post/') === 0)
</script>
{{ renderIndex(postPages) }}
