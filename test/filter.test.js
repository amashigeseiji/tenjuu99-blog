import { test } from 'node:test';
import assert from 'node:assert';
import { replaceIfFilter, replaceScriptFilter } from '../lib/filter.js';

// ========================================
// replaceIfFilter のテスト
// ========================================

test('if文 - 真の条件（変数が存在）', () => {
  const text = '{if published}公開済み{/if}';
  const variables = { published: true };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '公開済み');
});

test('if文 - 偽の条件（変数が存在しない）', () => {
  const text = '{if published}公開済み{/if}';
  const variables = { published: false };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '');
});

test('if文 - 変数が未定義', () => {
  const text = '{if missing}表示{/if}';
  const variables = {};
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '');
});

test('if-else文 - 真の条件', () => {
  const text = '{if published}公開{else}下書き{/if}';
  const variables = { published: true };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '公開');
});

test('if-else文 - 偽の条件', () => {
  const text = '{if published}公開{else}下書き{/if}';
  const variables = { published: false };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '下書き');
});

test('if文 - == 演算子（真）', () => {
  const text = '{if status == "published"}公開中{/if}';
  const variables = { status: 'published' };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '公開中');
});

test('if文 - == 演算子（偽）', () => {
  const text = '{if status == "published"}公開中{/if}';
  const variables = { status: 'draft' };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '');
});

test('if文 - != 演算子（真）', () => {
  const text = '{if status != "draft"}公開可能{/if}';
  const variables = { status: 'published' };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '公開可能');
});

test('if文 - != 演算子（偽）', () => {
  const text = '{if status != "draft"}公開可能{/if}';
  const variables = { status: 'draft' };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '');
});

test('if文 - 数値比較 ==', () => {
  const text = '{if count == 5}5個です{/if}';
  const variables = { count: 5 };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '5個です');
});

test('if文 - HTMLタグ形式 <if>', () => {
  const text = '<if published>公開済み</if>';
  const variables = { published: true };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '公開済み');
});

test('if-else文 - HTMLタグ形式', () => {
  const text = '<if published>公開<else>下書き</if>';
  const variables = { published: false };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '下書き');
});

test('if文 - 複数のif文', () => {
  const text = '{if a}A{/if}{if b}B{/if}';
  const variables = { a: true, b: true };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, 'AB');
});

test('if文 - 複数のif文（片方のみ真）', () => {
  const text = '{if a}A{/if}{if b}B{/if}';
  const variables = { a: true, b: false };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, 'A');
});

test('if文 - コンテンツに改行を含む', () => {
  const text = `{if published}
公開済み
コンテンツ
{/if}`;
  const variables = { published: true };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '\n公開済み\nコンテンツ\n');
});

test('if文 - 真偽値の文字列比較', () => {
  const text = '{if flag == true}真{/if}';
  const variables = { flag: true };
  const result = replaceIfFilter(text, variables);
  assert.strictEqual(result, '真');
});

// ========================================
// replaceScriptFilter のテスト
// ========================================

test('script - 文字列を返す', async () => {
  const text = '{script}return "Hello"{/script}';
  const variables = {};
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, 'Hello');
});

test('script - 変数を使用', async () => {
  const text = '{script}return variables.title{/script}';
  const variables = { title: 'テストタイトル' };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, 'テストタイトル');
});

test('script - 計算結果を返す', async () => {
  const text = '{script}return variables.a + variables.b{/script}';
  const variables = { a: 10, b: 20 };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '30');
});

test('script - HTMLタグ形式', async () => {
  const text = '<script type="ssg">return "Content"</script>';
  const variables = {};
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, 'Content');
});

test('script - undefinedを返す場合', async () => {
  const text = '{script}let x;{/script}';
  const variables = {};
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '');
});

test('script - nullを返す場合', async () => {
  const text = '{script}return null{/script}';
  const variables = {};
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '');
});

test('script - 配列を文字列に変換', async () => {
  const text = '{script}return variables.tags.join(", "){/script}';
  const variables = { tags: ['javascript', 'nodejs', 'testing'] };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, 'javascript, nodejs, testing');
});

test('script - 複数のスクリプトブロック', async () => {
  const text = '{script}return "A"{/script}{script}return "B"{/script}';
  const variables = {};
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, 'AB');
});

test('script - 複数行のスクリプト', async () => {
  const text = `{script}
const a = 10;
const b = 20;
return a + b;
{/script}`;
  const variables = {};
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '30');
});

test('script - 条件分岐', async () => {
  const text = `{script}
if (variables.published) {
  return "公開中";
} else {
  return "下書き";
}
{/script}`;
  const variables = { published: true };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '公開中');
});

test('script - オブジェクトのプロパティアクセス', async () => {
  const text = '{script}return variables.author.name{/script}';
  const variables = { author: { name: '太郎', email: 'taro@example.com' } };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '太郎');
});

test('script - 真偽値を返す', async () => {
  const text = '{script}return variables.published{/script}';
  const variables = { published: true };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, 'true');
});

test('script - 数値を返す', async () => {
  const text = '{script}return variables.count * 2{/script}';
  const variables = { count: 5 };
  const result = await replaceScriptFilter(text, variables);
  assert.strictEqual(result, '10');
});
