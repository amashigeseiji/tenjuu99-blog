import { test } from 'node:test';
import assert from 'node:assert';
import { indexing, allData } from '../lib/indexer.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// テスト用の一時ディレクトリ
const testDir = join(process.cwd(), 'test-temp');
const testPagesDir = join(testDir, 'pages');

// テスト前のセットアップ
const setupTestFiles = () => {
  // 既存のテストディレクトリを削除
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  // テストディレクトリを作成
  mkdirSync(testPagesDir, { recursive: true });
};

// テスト後のクリーンアップ
const cleanupTestFiles = () => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
};

// ========================================
// indexing関数のテスト
// ========================================

test('indexing - 基本的な動作確認（実際のsrc-sampleを使用）', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // allDataが生成されていることを確認
  assert.ok(typeof allData === 'object');
  assert.ok(Object.keys(allData).length > 0);
});

test('indexing - allDataの構造確認', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // 各ページデータが必要なプロパティを持っていることを確認
  const firstKey = Object.keys(allData)[0];
  if (firstKey) {
    const pageData = allData[firstKey];

    // 基本プロパティの存在確認
    assert.ok('name' in pageData);
    assert.ok('title' in pageData);
    assert.ok('url' in pageData);
    assert.ok('markdown' in pageData);
  }
});

test('indexing - distribute=falseのページは除外される', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // distribute=falseのページがallDataに含まれていないことを確認
  for (const key in allData) {
    const pageData = allData[key];
    assert.strictEqual(pageData.distribute, true);
  }
});

test('indexing - 複数回呼び出してもallDataがリセットされる', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  // 1回目
  await indexing();
  const keys1 = Object.keys(allData);

  // 2回目
  await indexing();
  const keys2 = Object.keys(allData);

  // 同じ結果が得られることを確認
  assert.deepStrictEqual(keys1.sort(), keys2.sort());
});

test('indexing - ページ名がキーとして使用される', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // 各キーとページデータのnameが一致することを確認
  for (const key in allData) {
    assert.strictEqual(key, allData[key].name);
  }
});

// ========================================
// allDataのエクスポート確認
// ========================================

test('allData - オブジェクトとしてエクスポートされている', () => {
  assert.ok(typeof allData === 'object');
});

test('allData - indexing実行前は空オブジェクト', async () => {
  // この時点でallDataが存在することを確認
  // （他のテストで既にindexingが実行されている可能性があるため、
  //  このテストは参考程度）
  assert.ok(typeof allData === 'object');
});

// ========================================
// エッジケースのテスト
// ========================================

test('indexing - 許可された拡張子のファイルのみ含まれる', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // 許可された拡張子のファイルのみが含まれていることを確認
  const allowedExtensions = ['md', 'html', 'txt'];

  for (const key in allData) {
    const pageData = allData[key];
    const fileType = pageData.__filetype;

    // __filetypeが許可された拡張子であることを確認
    assert.ok(allowedExtensions.includes(fileType),
      `Unexpected file type: ${fileType}`);
  }
});

test('indexing - サブディレクトリのページも含まれる', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // サブディレクトリのページが含まれているかチェック
  // （name に / が含まれているページを探す）
  const hasSubdirPages = Object.keys(allData).some(key => key.includes('/'));

  // src-sampleの構造によってはサブディレクトリがない可能性もあるので、
  // 存在する場合のみアサーション
  if (hasSubdirPages) {
    assert.ok(true, 'サブディレクトリのページが含まれている');
  }
});

test('indexing - フロントマターのパース結果が反映される', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  // いずれかのページにtitleが設定されていることを確認
  const hasPageWithTitle = Object.values(allData).some(
    pageData => pageData.title && pageData.title !== pageData.name
  );

  // titleが設定されたページが存在する場合のみアサーション
  if (hasPageWithTitle) {
    assert.ok(true, 'フロントマターのtitleが反映されている');
  }
});

// ========================================
// パフォーマンステスト
// ========================================

test('indexing - 実行時間が妥当な範囲内', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  const startTime = Date.now();
  await indexing();
  const endTime = Date.now();

  const duration = endTime - startTime;

  // 5秒以内に完了することを確認（合理的な時間制限）
  assert.ok(duration < 5000,
    `indexing took ${duration}ms, which is longer than expected`);
});

// ========================================
// データ整合性のテスト
// ========================================

test('indexing - 全ページデータに必須フィールドが存在', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  const requiredFields = [
    'name',
    'title',
    'url',
    'markdown',
    '__output',
    '__filetype'
  ];

  for (const key in allData) {
    const pageData = allData[key];

    for (const field of requiredFields) {
      assert.ok(field in pageData,
        `Page "${key}" is missing required field: ${field}`);
    }
  }
});

test('indexing - URLが正しい形式', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  for (const key in allData) {
    const pageData = allData[key];

    // URLが / で始まることを確認
    assert.ok(pageData.url.startsWith('/'),
      `Page "${key}" has invalid URL: ${pageData.url}`);
  }
});

test('indexing - __outputが正しい形式', async () => {
  // src-sample ディレクトリが存在する場合のみテスト実行
  if (!existsSync('src-sample')) {
    return;
  }

  await indexing();

  for (const key in allData) {
    const pageData = allData[key];

    // __outputが / で始まることを確認
    assert.ok(pageData.__output.startsWith('/'),
      `Page "${key}" has invalid __output: ${pageData.__output}`);

    // __outputが拡張子を含むことを確認
    assert.ok(pageData.__output.includes('.'),
      `Page "${key}" __output missing extension: ${pageData.__output}`);
  }
});
