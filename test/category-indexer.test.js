import { test } from 'node:test';
import assert from 'node:assert';

// ========================================
// afterIndexing フック関数のテスト
// ========================================

test('afterIndexing - 単一カテゴリーの仮想ページを生成する', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      // 上書きチェック
      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' },
    'post/2': { category: ['Tech'], title: 'Post 2' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html',
      url_case: 'lower',
      max_depth: 3
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 仮想ページが生成されたことを確認
  assert.ok(testAllData['tech/index']);
  assert.strictEqual(testAllData['tech/index'].name, 'tech/index');
  assert.strictEqual(testAllData['tech/index'].url, '/tech');
  assert.strictEqual(testAllData['tech/index'].__output, '/tech/index.html');
  assert.strictEqual(testAllData['tech/index'].title, 'Tech');
  assert.strictEqual(testAllData['tech/index'].template, 'category.html');
  assert.strictEqual(testAllData['tech/index'].__is_auto_category, true);
  assert.strictEqual(testAllData['tech/index'].distribute, true);
  assert.strictEqual(testAllData['tech/index'].index, false);
  assert.deepStrictEqual(testAllData['tech/index'].category_path, ['Tech']);
  assert.deepStrictEqual(testAllData['tech/index'].category_pages, ['post/1', 'post/2']);
});

test('afterIndexing - 階層カテゴリーの仮想ページを生成する', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Tech', 'Frontend'], title: 'Post 1' },
    'post/2': { category: ['Tech', 'Backend'], title: 'Post 2' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html',
      url_case: 'lower',
      max_depth: 3
    }
  };

  await afterIndexing(testAllData, testConfig);

  // ルートカテゴリーページ
  assert.ok(testAllData['tech/index']);
  assert.strictEqual(testAllData['tech/index'].url, '/tech');
  assert.deepStrictEqual(testAllData['tech/index'].category_path, ['Tech']);

  // サブカテゴリーページ
  assert.ok(testAllData['tech/frontend/index']);
  assert.strictEqual(testAllData['tech/frontend/index'].url, '/tech/frontend');
  assert.deepStrictEqual(testAllData['tech/frontend/index'].category_path, ['Tech', 'Frontend']);

  assert.ok(testAllData['tech/backend/index']);
  assert.strictEqual(testAllData['tech/backend/index'].url, '/tech/backend');
  assert.deepStrictEqual(testAllData['tech/backend/index'].category_path, ['Tech', 'Backend']);
});

test('afterIndexing - 既存ページを上書きしない', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' },
    'tech/index': { title: 'Custom Tech Page', url: '/tech', __output: '/tech/index.html' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html',
      url_case: 'lower',
      max_depth: 3
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 既存ページが保持されていることを確認
  assert.strictEqual(testAllData['tech/index'].title, 'Custom Tech Page');
  assert.strictEqual(testAllData['tech/index'].__is_auto_category, undefined);
});

test('afterIndexing - auto_generate: false のとき何もしない', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: false
    }
  };

  const originalKeys = Object.keys(testAllData);
  await afterIndexing(testAllData, testConfig);

  // allData が変更されていないことを確認
  assert.deepStrictEqual(Object.keys(testAllData), originalKeys);
  assert.strictEqual(testAllData['tech/index'], undefined);
});

test('afterIndexing - category_children にサブカテゴリーリストを持つ', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Tech', 'Frontend'], title: 'Post 1' },
    'post/2': { category: ['Tech', 'Backend'], title: 'Post 2' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html',
      url_case: 'lower',
      max_depth: 3
    }
  };

  await afterIndexing(testAllData, testConfig);

  // Tech カテゴリーページの children を確認
  assert.ok(testAllData['tech/index']);
  assert.ok(Array.isArray(testAllData['tech/index'].category_children));
  assert.ok(testAllData['tech/index'].category_children.includes('/tech/frontend'));
  assert.ok(testAllData['tech/index'].category_children.includes('/tech/backend'));
});

test('afterIndexing - 正しい name を持つ', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Art', 'Painting'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      url_case: 'lower'
    }
  };

  await afterIndexing(testAllData, testConfig);

  assert.strictEqual(testAllData['art/index'].name, 'art/index');
  assert.strictEqual(testAllData['art/painting/index'].name, 'art/painting/index');
});

test('afterIndexing - 正しい url を持つ', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Art', 'Painting'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      url_case: 'lower'
    }
  };

  await afterIndexing(testAllData, testConfig);

  assert.strictEqual(testAllData['art/index'].url, '/art');
  assert.strictEqual(testAllData['art/painting/index'].url, '/art/painting');
});

test('afterIndexing - 正しい __output を持つ', async () => {
  const afterIndexing = async (allData, config) => {
    if (config.category?.auto_generate === false) {
      return;
    }

    const { buildCategoryTree } = await import('../packages/category/helper/category.js');
    const tree = buildCategoryTree(allData, config);

    for (const [url, categoryData] of Object.entries(tree)) {
      const pageName = url.replace(/^\//, '') + '/index';

      if (allData[pageName]) {
        continue;
      }

      allData[pageName] = {
        name: pageName,
        url: url,
        __output: `${url}/index.html`,
        title: categoryData.title,
        template: config.category?.template || 'category.html',
        markdown: '',
        category_path: categoryData.path,
        category_pages: categoryData.pages,
        category_children: Object.keys(categoryData.children),
        __is_auto_category: true,
        distribute: true,
        index: false,
        noindex: false,
        lang: 'ja',
        published: '1970-01-01',
      };
    }
  };

  const testAllData = {
    'post/1': { category: ['Art', 'Painting'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      url_case: 'lower'
    }
  };

  await afterIndexing(testAllData, testConfig);

  assert.strictEqual(testAllData['art/index'].__output, '/art/index.html');
  assert.strictEqual(testAllData['art/painting/index'].__output, '/art/painting/index.html');
});
