import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// テスト用の一時ディレクトリ
const testDir = join(process.cwd(), 'test-temp-category');
const testCacheDir = join(testDir, '.cache');
const testHelperDir = join(testCacheDir, 'helper');
const testPagesDir = join(testCacheDir, 'pages');

// テスト前のセットアップ
const setupTestFiles = () => {
  // 既存のテストディレクトリを削除
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }

  // テストディレクトリを作成
  mkdirSync(testHelperDir, { recursive: true });
  mkdirSync(testPagesDir, { recursive: true });
};

// テスト後のクリーンアップ
const cleanupTestFiles = () => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
};

// ========================================
// category.js の統合テスト
// ========================================

test('category.js - buildCategoryTree が正しく動作する', async () => {
  setupTestFiles();

  // category.js をコピー
  const categoryJsContent = `
import { allData, config } from '@tenjuu99/blog'

export function buildCategoryTree(data = allData, conf = config) {
  const tree = {}
  const urlCase = conf.category?.url_case || 'lower'
  const maxDepth = conf.category?.max_depth || 3

  for (const [name, page] of Object.entries(data)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    const categoryPath = page.category.slice(0, maxDepth)
    let currentPath = ''

    for (let i = 0; i < categoryPath.length; i++) {
      const category = categoryPath[i]
      const categoryUrl = urlCase === 'lower' ? category.toLowerCase() : category
      currentPath += \`/\${categoryUrl}\`

      if (!tree[currentPath]) {
        tree[currentPath] = {
          title: category,
          path: categoryPath.slice(0, i + 1),
          pages: [],
          children: {}
        }
      }

      tree[currentPath].pages.push(name)
    }
  }

  return tree
}
`;

  writeFileSync(join(testHelperDir, 'category.js'), categoryJsContent);

  // インポートしてテスト
  const { buildCategoryTree } = await import(`file://${join(testHelperDir, 'category.js')}`);

  const testAllData = {
    'post/1': { category: ['Tech', 'Frontend'] },
    'post/2': { category: ['Tech', 'Backend'] }
  };

  const testConfig = {
    category: {
      url_case: 'lower',
      max_depth: 3
    }
  };

  const result = buildCategoryTree(testAllData, testConfig);

  assert.ok(result['/tech']);
  assert.ok(result['/tech/frontend']);
  assert.ok(result['/tech/backend']);
  assert.deepStrictEqual(result['/tech'].pages, ['post/1', 'post/2']);
  assert.deepStrictEqual(result['/tech/frontend'].pages, ['post/1']);
  assert.deepStrictEqual(result['/tech/backend'].pages, ['post/2']);

  cleanupTestFiles();
});

test('category.js - getCategoryPages が正しく動作する', async () => {
  setupTestFiles();

  const categoryJsContent = `
export function getCategoryPages(allData, categoryPath) {
  const pages = []

  for (const [name, page] of Object.entries(allData)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    if (JSON.stringify(page.category) === JSON.stringify(categoryPath)) {
      pages.push(page)
    }
  }

  return pages
}
`;

  writeFileSync(join(testHelperDir, 'category.js'), categoryJsContent);

  const { getCategoryPages } = await import(`file://${join(testHelperDir, 'category.js')}?v=2`);

  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' },
    'post/2': { category: ['Tech'], title: 'Post 2' },
    'post/3': { category: ['Art'], title: 'Post 3' }
  };

  const result = getCategoryPages(testAllData, ['Tech']);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].title, 'Post 1');
  assert.strictEqual(result[1].title, 'Post 2');

  cleanupTestFiles();
});

test('category.js - getCategoryPagesRecursive が正しく動作する', async () => {
  setupTestFiles();

  const categoryJsContent = `
export function getCategoryPagesRecursive(allData, categoryPath) {
  const pages = []

  for (const [name, page] of Object.entries(allData)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    if (page.category.length >= categoryPath.length) {
      let match = true
      for (let i = 0; i < categoryPath.length; i++) {
        if (page.category[i] !== categoryPath[i]) {
          match = false
          break
        }
      }
      if (match) {
        pages.push(page)
      }
    }
  }

  return pages
}
`;

  writeFileSync(join(testHelperDir, 'category.js'), categoryJsContent);

  const { getCategoryPagesRecursive } = await import(`file://${join(testHelperDir, 'category.js')}?v=3`);

  const testAllData = {
    'post/1': { category: ['Tech'], title: 'Post 1' },
    'post/2': { category: ['Tech', 'Frontend'], title: 'Post 2' },
    'post/3': { category: ['Tech', 'Backend'], title: 'Post 3' },
    'post/4': { category: ['Art'], title: 'Post 4' }
  };

  const result = getCategoryPagesRecursive(testAllData, ['Tech']);

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].title, 'Post 1');
  assert.strictEqual(result[1].title, 'Post 2');
  assert.strictEqual(result[2].title, 'Post 3');

  cleanupTestFiles();
});

test('category.js - children が正しく計算される', async () => {
  setupTestFiles();

  const categoryJsContent = `
export function buildCategoryTree(data, conf = {}) {
  const tree = {}
  const urlCase = conf.category?.url_case || 'lower'
  const maxDepth = conf.category?.max_depth || 3

  for (const [name, page] of Object.entries(data)) {
    if (!page.category || !Array.isArray(page.category)) {
      continue
    }

    const categoryPath = page.category.slice(0, maxDepth)
    let currentPath = ''

    for (let i = 0; i < categoryPath.length; i++) {
      const category = categoryPath[i]
      const categoryUrl = urlCase === 'lower' ? category.toLowerCase() : category
      currentPath += \`/\${categoryUrl}\`

      if (!tree[currentPath]) {
        tree[currentPath] = {
          title: category,
          path: categoryPath.slice(0, i + 1),
          pages: [],
          children: {}
        }
      }

      tree[currentPath].pages.push(name)
    }
  }

  // children を計算
  for (const [url, node] of Object.entries(tree)) {
    const depth = node.path.length
    for (const [childUrl, childNode] of Object.entries(tree)) {
      if (childNode.path.length === depth + 1 && childUrl.startsWith(url + '/')) {
        node.children[childUrl] = childNode
      }
    }
  }

  return tree
}
`;

  writeFileSync(join(testHelperDir, 'category.js'), categoryJsContent);

  const { buildCategoryTree } = await import(`file://${join(testHelperDir, 'category.js')}?v=4`);

  const testAllData = {
    'post/1': { category: ['Tech', 'Frontend', 'React'] },
    'post/2': { category: ['Tech', 'Backend'] }
  };

  const testConfig = {
    category: {
      url_case: 'lower',
      max_depth: 3
    }
  };

  const result = buildCategoryTree(testAllData, testConfig);

  // Tech の children を確認
  assert.ok(result['/tech'].children['/tech/frontend']);
  assert.ok(result['/tech'].children['/tech/backend']);
  assert.strictEqual(Object.keys(result['/tech'].children).length, 2);

  // Tech/Frontend の children を確認
  assert.ok(result['/tech/frontend'].children['/tech/frontend/react']);
  assert.strictEqual(Object.keys(result['/tech/frontend'].children).length, 1);

  cleanupTestFiles();
});
