import { test } from 'node:test';
import assert from 'node:assert';

// ========================================
// buildCategoryTree関数のテスト
// ========================================

test('buildCategoryTree - 空のallDataで空オブジェクトを返す', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    return tree;
  };

  const result = buildCategoryTree({});
  assert.deepStrictEqual(result, {});
});

test('buildCategoryTree - 単一カテゴリーを正しく構築する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Tech'] },
    'post/2': { category: ['Tech'] }
  };

  const result = buildCategoryTree(testAllData);

  assert.ok(result['/tech']);
  assert.strictEqual(result['/tech'].title, 'Tech');
  assert.deepStrictEqual(result['/tech'].path, ['Tech']);
  assert.deepStrictEqual(result['/tech'].pages, ['post/1', 'post/2']);
  assert.deepStrictEqual(result['/tech'].children, {});
});

test('buildCategoryTree - 階層カテゴリーを正しく構築する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Tech', 'Frontend'] },
    'post/2': { category: ['Tech', 'Backend'] }
  };

  const result = buildCategoryTree(testAllData);

  // ルートカテゴリー
  assert.ok(result['/tech']);
  assert.strictEqual(result['/tech'].title, 'Tech');
  assert.deepStrictEqual(result['/tech'].path, ['Tech']);
  assert.deepStrictEqual(result['/tech'].pages, ['post/1', 'post/2']);

  // サブカテゴリー
  assert.ok(result['/tech/frontend']);
  assert.strictEqual(result['/tech/frontend'].title, 'Frontend');
  assert.deepStrictEqual(result['/tech/frontend'].path, ['Tech', 'Frontend']);
  assert.deepStrictEqual(result['/tech/frontend'].pages, ['post/1']);

  assert.ok(result['/tech/backend']);
  assert.strictEqual(result['/tech/backend'].title, 'Backend');
  assert.deepStrictEqual(result['/tech/backend'].path, ['Tech', 'Backend']);
  assert.deepStrictEqual(result['/tech/backend'].pages, ['post/2']);
});

test('buildCategoryTree - 複数のルートカテゴリーを処理する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Tech'] },
    'post/2': { category: ['Art'] },
    'post/3': { category: ['Music'] }
  };

  const result = buildCategoryTree(testAllData);

  assert.ok(result['/tech']);
  assert.ok(result['/art']);
  assert.ok(result['/music']);
  assert.deepStrictEqual(result['/tech'].pages, ['post/1']);
  assert.deepStrictEqual(result['/art'].pages, ['post/2']);
  assert.deepStrictEqual(result['/music'].pages, ['post/3']);
});

test('buildCategoryTree - categoryフィールドを持たないページを無視する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Tech'] },
    'post/2': { title: 'No category' },
    'post/3': {}
  };

  const result = buildCategoryTree(testAllData);

  assert.ok(result['/tech']);
  assert.deepStrictEqual(result['/tech'].pages, ['post/1']);
  assert.strictEqual(Object.keys(result).length, 1);
});

test('buildCategoryTree - 不正なcategory値（文字列、null）をスキップする', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Tech'] },
    'post/2': { category: 'InvalidString' },
    'post/3': { category: null },
    'post/4': { category: 123 }
  };

  const result = buildCategoryTree(testAllData);

  assert.ok(result['/tech']);
  assert.deepStrictEqual(result['/tech'].pages, ['post/1']);
  assert.strictEqual(Object.keys(result).length, 1);
});

test('buildCategoryTree - max_depthを超える階層を無視する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';
    const maxDepth = config.category?.max_depth || 3;

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category.slice(0, maxDepth);
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['A', 'B', 'C', 'D', 'E'] }
  };

  const config = {
    category: {
      max_depth: 3
    }
  };

  const result = buildCategoryTree(testAllData, config);

  assert.ok(result['/a']);
  assert.ok(result['/a/b']);
  assert.ok(result['/a/b/c']);
  assert.strictEqual(result['/a/b/c/d'], undefined);
  assert.strictEqual(Object.keys(result).length, 3);
});

test('buildCategoryTree - url_case: "lower" でURLを小文字化する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Art', 'Painting'] }
  };

  const config = {
    category: {
      url_case: 'lower'
    }
  };

  const result = buildCategoryTree(testAllData, config);

  assert.ok(result['/art']);
  assert.ok(result['/art/painting']);
  assert.strictEqual(result['/Art'], undefined);
});

test('buildCategoryTree - url_case: "original" で元の大文字小文字を保持する', () => {
  const buildCategoryTree = (allData, config = {}) => {
    const tree = {};
    const urlCase = config.category?.url_case || 'lower';

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      const categoryPath = page.category;
      let currentPath = '';

      for (let i = 0; i < categoryPath.length; i++) {
        const category = categoryPath[i];
        const categoryLower = urlCase === 'lower' ? category.toLowerCase() : category;
        currentPath += `/${categoryLower}`;

        if (!tree[currentPath]) {
          tree[currentPath] = {
            title: category,
            path: categoryPath.slice(0, i + 1),
            pages: [],
            children: {}
          };
        }

        tree[currentPath].pages.push(name);
      }
    }

    return tree;
  };

  const testAllData = {
    'post/1': { category: ['Art', 'Painting'] }
  };

  const config = {
    category: {
      url_case: 'original'
    }
  };

  const result = buildCategoryTree(testAllData, config);

  assert.ok(result['/Art']);
  assert.ok(result['/Art/Painting']);
  assert.strictEqual(result['/art'], undefined);
});

// ========================================
// getCategoryPages関数のテスト
// ========================================

test('getCategoryPages - 特定カテゴリーのページを取得する', () => {
  const getCategoryPages = (allData, categoryPath) => {
    const pages = [];

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      if (JSON.stringify(page.category) === JSON.stringify(categoryPath)) {
        pages.push(page);
      }
    }

    return pages;
  };

  const testAllData = {
    'post/1': { category: ['Art'], title: 'Post 1' },
    'post/2': { category: ['Art'], title: 'Post 2' },
    'post/3': { category: ['Art', 'Painting'], title: 'Post 3' }
  };

  const result = getCategoryPages(testAllData, ['Art']);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].title, 'Post 1');
  assert.strictEqual(result[1].title, 'Post 2');
});

test('getCategoryPages - 階層カテゴリーのページを取得する', () => {
  const getCategoryPages = (allData, categoryPath) => {
    const pages = [];

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      if (JSON.stringify(page.category) === JSON.stringify(categoryPath)) {
        pages.push(page);
      }
    }

    return pages;
  };

  const testAllData = {
    'post/1': { category: ['Art', 'Painting'], title: 'Post 1' },
    'post/2': { category: ['Art', 'Painting'], title: 'Post 2' },
    'post/3': { category: ['Art'], title: 'Post 3' }
  };

  const result = getCategoryPages(testAllData, ['Art', 'Painting']);

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].title, 'Post 1');
  assert.strictEqual(result[1].title, 'Post 2');
});

test('getCategoryPages - 存在しないカテゴリーで空配列を返す', () => {
  const getCategoryPages = (allData, categoryPath) => {
    const pages = [];

    for (const [name, page] of Object.entries(allData)) {
      if (!page.category || !Array.isArray(page.category)) {
        continue;
      }

      if (JSON.stringify(page.category) === JSON.stringify(categoryPath)) {
        pages.push(page);
      }
    }

    return pages;
  };

  const testAllData = {
    'post/1': { category: ['Art'], title: 'Post 1' }
  };

  const result = getCategoryPages(testAllData, ['NonExistent']);

  assert.strictEqual(result.length, 0);
  assert.deepStrictEqual(result, []);
});
