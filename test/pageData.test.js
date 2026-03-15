import { test } from 'node:test';
import assert from 'node:assert';
import makePageData from '../lib/pageData.js';

test('基本的なフロントマター解析', () => {
  const markdown = `<!--
title: テストページ
published: 2024-01-01
-->
# 本文

これはテストです。`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テストページ');
  assert.strictEqual(result.published, '2024-01-01');
  assert.strictEqual(result.markdown.trim(), '# 本文\n\nこれはテストです。');
});

test('フロントマターなしのMarkdown', () => {
  const markdown = `# タイトル

本文のみ`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.markdown.trim(), '# タイトル\n\n本文のみ');
  assert.strictEqual(result.name, 'test'); // デフォルト値
});

test('JSON配列形式のフロントマター', () => {
  const markdown = `<!--
title: テスト
tags: ["javascript", "nodejs", "test"]
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.deepStrictEqual(result.tags, ['javascript', 'nodejs', 'test']);
});

test('JSONオブジェクト形式のフロントマター', () => {
  const markdown = `<!--
title: テスト
author: {"name": "太郎", "email": "taro@example.com"}
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.deepStrictEqual(result.author, { name: '太郎', email: 'taro@example.com' });
});

test('空のフロントマター', () => {
  const markdown = `<!--
-->
本文のみ`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.markdown.trim(), '本文のみ');
});

test('数値のフロントマター', () => {
  const markdown = `<!--
title: テスト
count: 42
price: 3.14
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.strictEqual(result.count, 42);
  assert.strictEqual(result.price, 3.14);
});

test('真偽値のフロントマター', () => {
  const markdown = `<!--
title: テスト
published: true
draft: false
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.strictEqual(result.published, true);
  assert.strictEqual(result.draft, false);
});

test('コロンを含む値', () => {
  const markdown = `<!--
title: テスト
url: /test
time: 12:30:45
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.strictEqual(result.url, '/test');
  assert.strictEqual(result.time, '12:30:45');
});

test('引用符で囲まれた値', () => {
  const markdown = `<!--
title: "引用符付きタイトル"
description: "説明文"
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, '引用符付きタイトル');
  assert.strictEqual(result.description, '説明文');
});

test('空白を含むキーと値', () => {
  const markdown = `<!--
title:    スペース多め
tags: ["tag1", "tag2"]
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'スペース多め');
  assert.deepStrictEqual(result.tags, ['tag1', 'tag2']);
});

test('ネストしたJSONオブジェクト', () => {
  const markdown = `<!--
title: テスト
meta: {"og": {"title": "OGタイトル", "image": "og.png"}}
-->
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.deepStrictEqual(result.meta, {
    og: {
      title: 'OGタイトル',
      image: 'og.png'
    }
  });
});

test('本文が空の場合', () => {
  const markdown = `<!--
title: タイトルのみ
-->`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'タイトルのみ');
  assert.strictEqual(result.markdown.trim(), '');
});

test('--- 形式のフロントマター（基本）', () => {
  const markdown = `---
title: ハイフン形式
published: 2024-01-01
---
本文`;

  const result = makePageData('test.md', markdown);

  assert.strictEqual(result.title, 'ハイフン形式');
  assert.strictEqual(result.published, '2024-01-01');
  assert.strictEqual(result.markdown.trim(), '本文');
});

test('--- 形式でJSON配列', () => {
  const markdown = `---
title: テスト
tags: ["tag1", "tag2", "tag3"]
categories: ["programming", "nodejs"]
---
# 本文

コンテンツ`;

  const result = makePageData('article.md', markdown);

  assert.strictEqual(result.title, 'テスト');
  assert.deepStrictEqual(result.tags, ['tag1', 'tag2', 'tag3']);
  assert.deepStrictEqual(result.categories, ['programming', 'nodejs']);
  assert.strictEqual(result.markdown.trim(), '# 本文\n\nコンテンツ');
});

test('--- 形式でJSONオブジェクト', () => {
  const markdown = `---
title: ブログ記事
author: {"name": "太郎", "email": "taro@example.com"}
meta: {"description": "メタ説明", "keywords": ["js", "node"]}
---
記事本文`;

  const result = makePageData('blog.md', markdown);

  assert.strictEqual(result.title, 'ブログ記事');
  assert.deepStrictEqual(result.author, { name: '太郎', email: 'taro@example.com' });
  assert.deepStrictEqual(result.meta, { description: 'メタ説明', keywords: ['js', 'node'] });
});

test('--- 形式で複数の型が混在', () => {
  const markdown = `---
title: 混在テスト
published: 2024-03-15
draft: false
priority: 10
tags: ["javascript", "testing"]
---
本文内容`;

  const result = makePageData('mixed.md', markdown);

  assert.strictEqual(result.title, '混在テスト');
  assert.strictEqual(result.published, '2024-03-15');
  assert.strictEqual(result.draft, false);
  assert.strictEqual(result.priority, 10);
  assert.deepStrictEqual(result.tags, ['javascript', 'testing']);
});

test('--- 形式で引用符付き文字列', () => {
  const markdown = `---
title: "引用符: 付きタイトル"
description: "これは説明文です"
url: /articles/test
---
本文`;

  const result = makePageData('quoted.md', markdown);

  assert.strictEqual(result.title, '引用符: 付きタイトル');
  assert.strictEqual(result.description, 'これは説明文です');
  assert.strictEqual(result.url, '/articles/test');
});
