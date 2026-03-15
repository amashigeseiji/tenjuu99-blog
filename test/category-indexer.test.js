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
