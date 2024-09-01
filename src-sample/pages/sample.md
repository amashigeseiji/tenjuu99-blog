---
title: sample article
url: /sample_article
published: 2024/03/18 00:00
modified: 2024/03/19 00:00
ifTrueVariable: true
someVariable: これは変数として定義された値です。変数定義を確認してください。
---

トップレベル見出しは `title` 変数が利用されます。  
変えたい場合は template/default.html を修正してください。

## サンプル記事

これはサンプル記事です。ブログ開始のときに削除してください。

## マークダウン

記事は、マークダウン記法で記述し、 `.md` ファイルで保存してください。

リンクは次のように記述します。  
[アンカーテキストはこちら](http://example.com)

リストは次のように記述します。
* リスト1
* リスト2
* リスト3

画像は、 `data/image/` 以下に配置して、パスを指定してください。

`data/image/sample.jpg` などがあれば、次の指定になります。  
`![代替テキストを入力してください](/image/sample.jpg)`

![placeholdの画像](https://placehold.jp/150x150.png)

## テンプレートエンジン

if 文と script が使えます。

### IF

if 文は次のような記述になります。

<pre>
---
ifTrueVariable: true
---
&lt;if ifTrueVariable>
`ifTrueVariable` が true のためこれは表示されます。
&lt;/if>
</pre>

上記の出力は以下になります。

```
<if ifTrueVariable>
`ifTrueVariable` が true のためこれは表示されます。
</if>
```

else 句を含むことができます。

<pre>
&lt;if undefinedValue>
このコンテンツは表示されません
&lt;else>
これは else 文の中身です。
&lt;/if>
</pre>

次のようになります。
```
<if undefinedValue>
このコンテンツは表示されません
<else>
これは else 文の中身です。
</if>
```

### SCRIPT

スクリプトを記述することができます。

<pre>
&lt;script type="ssg"&gt;
return (new Date()).toString()
&lt;/script&gt;
</pre>

この出力は以下のようになります。このスクリプトではビルド時の時刻が刻まれます。ビルドしなおしてみてください。

```
<script type="ssg">
return (new Date()).toString()
</script>
```

スクリプトタグ内では、当該コメントで定義した変数が `variables.定義した変数名`で利用できます。

<pre>
---
someVariable: これは変数として定義された値です。変数定義を確認してください。
---
&lt;script type="ssg">
return variables.someVariable
&lt;/script>
</pre>

以下のように出力されます。
```
{script}
return variables.someVariable
{/script}
```

## 追加ヘルパー

ヘルパー関数を作成します。
```
// src-sample/helper/index.js
export function additionalHelper() {
  return 'これは追加ヘルパーによって出力されているメッセージです。'
}
```

.env ファイルにヘルパーの位置を教えます。
```
// .env
HELPER=helper/index.js
```

追加したヘルパーを利用できます。
<pre>
// src-sample/pages/sample.md
&lt;script type="ssg">
return helper.additionalHelper()
&lt;/script>
</pre>

実際に出力させると次の行のとおりです。
```
<script type="ssg">
return helper.additionalHelper()
</script>
```
