import { test } from 'node:test';
import assert from 'node:assert';
import { afterIndexing } from '../packages/category/helper/categoryIndexer.js';

// ========================================
// afterIndexing フック関数のテスト
// ========================================

test('afterIndexing - 単一カテゴリーの仮想ページを生成する', async () => {
  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' },
    'post/2': { category: ['Tech'], title: 'Post 2' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html'
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 仮想ページが生成されていることを確認
  assert.ok(testAllData['tech/index']);
  assert.strictEqual(testAllData['tech/index'].title, 'Tech');
  assert.strictEqual(testAllData['tech/index'].url, '/tech');
  assert.strictEqual(testAllData['tech/index'].__output, '/tech/index.html');
  assert.strictEqual(testAllData['tech/index'].__is_auto_category, true);
  assert.deepStrictEqual(testAllData['tech/index'].category_pages, ['post/1', 'post/2']);
});

test('afterIndexing - 階層カテゴリーの仮想ページを生成する', async () => {
  const testAllData = {
    'post/react': { category: ['Tech', 'Frontend', 'React'], title: 'React Post' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html'
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 3階層のページが生成される
  assert.ok(testAllData['tech/index']);
  assert.ok(testAllData['tech/frontend/index']);
  assert.ok(testAllData['tech/frontend/react/index']);

  assert.strictEqual(testAllData['tech/index'].title, 'Tech');
  assert.strictEqual(testAllData['tech/frontend/index'].title, 'Frontend');
  assert.strictEqual(testAllData['tech/frontend/react/index'].title, 'React');
});

test('afterIndexing - 手動ページが存在する場合は上書きしない', async () => {
  const testAllData = {
    'tech/index': {
      name: 'tech/index',
      title: 'Manual Tech Page',
      __is_manual: true
    },
    'post/1': { category: ['Tech'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: true
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 手動ページが保持されていることを確認
  assert.strictEqual(testAllData['tech/index'].title, 'Manual Tech Page');
  assert.strictEqual(testAllData['tech/index'].__is_manual, true);
  assert.strictEqual(testAllData['tech/index'].__is_auto_category, undefined);
});

test('afterIndexing - auto_generate が false の場合は生成しない', async () => {
  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: false
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 仮想ページが生成されていないことを確認
  assert.strictEqual(testAllData['tech/index'], undefined);
});

test('afterIndexing - category_children が正しく設定される', async () => {
  const testAllData = {
    'post/react': { category: ['Tech', 'Frontend', 'React'], title: 'React' },
    'post/vue': { category: ['Tech', 'Frontend', 'Vue'], title: 'Vue' }
  };

  const testConfig = {
    category: {
      auto_generate: true
    }
  };

  await afterIndexing(testAllData, testConfig);

  // tech/frontend/index の children には react と vue が含まれる
  const frontendChildren = testAllData['tech/frontend/index'].category_children;
  assert.ok(frontendChildren.includes('/tech/frontend/react'));
  assert.ok(frontendChildren.includes('/tech/frontend/vue'));
  assert.strictEqual(frontendChildren.length, 2);
});

test('afterIndexing - カスタムテンプレートを使用する', async () => {
  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'custom-category.html'
    }
  };

  await afterIndexing(testAllData, testConfig);

  assert.strictEqual(testAllData['tech/index'].template, 'custom-category.html');
});

test('afterIndexing - 複数カテゴリーの仮想ページを生成する', async () => {
  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Tech Post' },
    'post/2': { category: ['Art'], title: 'Art Post' },
    'post/3': { category: ['Music'], title: 'Music Post' }
  };

  const testConfig = {
    category: {
      auto_generate: true
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 3つのカテゴリーページが生成される
  assert.ok(testAllData['tech/index']);
  assert.ok(testAllData['art/index']);
  assert.ok(testAllData['music/index']);

  assert.strictEqual(testAllData['tech/index'].title, 'Tech');
  assert.strictEqual(testAllData['art/index'].title, 'Art');
  assert.strictEqual(testAllData['music/index'].title, 'Music');
});

test('afterIndexing - category_path が正しく設定される', async () => {
  const testAllData = {
    'post/1': { category: ['Tech', 'Frontend', 'React'], title: 'React Post' }
  };

  const testConfig = {
    category: {
      auto_generate: true
    }
  };

  await afterIndexing(testAllData, testConfig);

  assert.deepStrictEqual(testAllData['tech/index'].category_path, ['Tech']);
  assert.deepStrictEqual(testAllData['tech/frontend/index'].category_path, ['Tech', 'Frontend']);
  assert.deepStrictEqual(testAllData['tech/frontend/react/index'].category_path, ['Tech', 'Frontend', 'React']);
});

// ========================================
// 複数カテゴリーシステム（categories 配列）のテスト
// ========================================

test('afterIndexing - categories 配列で複数カテゴリーシステムを定義できる', async () => {
  const testAllData = {
    'book/after-rain': { category: ['Art', 'Painting'], title: 'After Rain' },
    'article/news/200910': { category: ['News'], title: 'News Article' }
  };

  const testConfig = {
    categories: [
      {
        name: 'books',
        url_prefix: '/book-list',
        path_filter: 'book/',
        template: 'category.html',
        auto_generate: true
      },
      {
        name: 'articles',
        url_prefix: '/article-list',
        path_filter: 'article/',
        template: 'article-category.html',
        auto_generate: true
      }
    ]
  };

  await afterIndexing(testAllData, testConfig);

  // books カテゴリーシステム
  assert.ok(testAllData['book-list/art/index'], 'book-list/art/index should be generated');
  assert.ok(testAllData['book-list/art/painting/index'], 'book-list/art/painting/index should be generated');
  assert.strictEqual(testAllData['book-list/art/index'].template, 'category.html');

  // articles カテゴリーシステム
  assert.ok(testAllData['article-list/news/index'], 'article-list/news/index should be generated');
  assert.strictEqual(testAllData['article-list/news/index'].template, 'article-category.html');

  // カテゴリーシステムが互いに独立していることを確認
  assert.strictEqual(testAllData['article-list/art/index'], undefined, 'article-list should not contain book categories');
  assert.strictEqual(testAllData['book-list/news/index'], undefined, 'book-list should not contain article categories');
});

test('afterIndexing - path_filter で対象ページを絞り込む', async () => {
  const testAllData = {
    'book/sample': { category: ['Art'], title: 'Book' },
    'article/sample': { category: ['News'], title: 'Article' }
  };

  const testConfig = {
    categories: [
      {
        url_prefix: '/book-list',
        path_filter: 'book/',
        auto_generate: true
      }
    ]
  };

  await afterIndexing(testAllData, testConfig);

  // book/ の Art カテゴリーページは生成される
  assert.ok(testAllData['book-list/art/index'], 'book-list/art/index should be generated');

  // article/ の News カテゴリーページは生成されない（path_filter でフィルタされる）
  assert.strictEqual(testAllData['book-list/news/index'], undefined, 'book-list/news/index should NOT be generated');
  assert.strictEqual(testAllData['article-list/news/index'], undefined, 'article-list/news/index should NOT be generated');
});

test('afterIndexing - categories の auto_generate: false はスキップされる', async () => {
  const testAllData = {
    'book/sample': { category: ['Art'], title: 'Book' },
    'article/sample': { category: ['News'], title: 'Article' }
  };

  const testConfig = {
    categories: [
      {
        url_prefix: '/book-list',
        path_filter: 'book/',
        auto_generate: false
      },
      {
        url_prefix: '/article-list',
        path_filter: 'article/',
        auto_generate: true
      }
    ]
  };

  await afterIndexing(testAllData, testConfig);

  // books カテゴリーは auto_generate: false なので生成されない
  assert.strictEqual(testAllData['book-list/art/index'], undefined);

  // articles カテゴリーは生成される
  assert.ok(testAllData['article-list/news/index']);
});

test('afterIndexing - categories 配列使用時に category 単一設定は無視される', async () => {
  const testAllData = {
    'book/sample': { category: ['Art'], title: 'Book' }
  };

  const testConfig = {
    // categories が存在するので category は無視される
    categories: [
      {
        url_prefix: '/book-list',
        path_filter: 'book/',
        auto_generate: true
      }
    ],
    category: {
      auto_generate: true,
      template: 'category.html'
    }
  };

  await afterIndexing(testAllData, testConfig);

  // categories で定義されたパスでページが生成される
  assert.ok(testAllData['book-list/art/index']);

  // category 単一設定のデフォルトパス（/art）では生成されない
  assert.strictEqual(testAllData['art/index'], undefined);
});

test('afterIndexing - config.categories が空配列の場合は何も生成しない', async () => {
  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' }
  };

  const testConfig = {
    categories: []
  };

  await afterIndexing(testAllData, testConfig);

  assert.strictEqual(testAllData['tech/index'], undefined);
});

test('afterIndexing - path_filter なしの categories エントリは全ページを対象にする', async () => {
  const testAllData = {
    'book/sample': { category: ['Art'], title: 'Book' },
    'article/sample': { category: ['News'], title: 'Article' }
  };

  const testConfig = {
    categories: [
      {
        auto_generate: true,
        template: 'category.html'
      }
    ]
  };

  await afterIndexing(testAllData, testConfig);

  // path_filter なしなので全ページが対象
  assert.ok(testAllData['art/index']);
  assert.ok(testAllData['news/index']);
});

test('afterIndexing - config.category のみ設定した場合の後方互換性', async () => {
  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Tech Post' }
  };

  const testConfig = {
    category: {
      auto_generate: true,
      template: 'category.html'
    }
  };

  await afterIndexing(testAllData, testConfig);

  // 従来どおり category 単一設定でページが生成される
  assert.ok(testAllData['tech/index']);
  assert.strictEqual(testAllData['tech/index'].template, 'category.html');
  assert.strictEqual(testAllData['tech/index'].__is_auto_category, true);
});
