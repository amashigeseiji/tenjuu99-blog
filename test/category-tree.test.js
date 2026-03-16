import { test } from 'node:test';
import assert from 'node:assert';
import { buildCategoryTree, getCategoryTree, getCategoryPages, getCategoryPagesRecursive } from '../packages/category/helper/category.js';

// ========================================
// buildCategoryTree関数のテスト
// ========================================

test('buildCategoryTree - 空のallDataで空オブジェクトを返す', () => {
  const result = buildCategoryTree({}, {});
  assert.deepStrictEqual(result, {});
});

test('buildCategoryTree - 単一カテゴリーを正しく構築する', () => {
  const allData = {
    'art/sample': {
      name: 'art/sample',
      category: ['Art']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  assert.ok(result['/art']);
  assert.strictEqual(result['/art'].title, 'Art');
  assert.deepStrictEqual(result['/art'].path, ['Art']);
  assert.deepStrictEqual(result['/art'].pages, ['art/sample']);
});

test('buildCategoryTree - 階層カテゴリーを正しく構築する', () => {
  const allData = {
    'art/painting/sample': {
      name: 'art/painting/sample',
      category: ['Art', 'Painting']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  assert.ok(result['/art']);
  assert.ok(result['/art/painting']);
  assert.strictEqual(result['/art'].title, 'Art');
  assert.strictEqual(result['/art/painting'].title, 'Painting');
  assert.deepStrictEqual(result['/art'].path, ['Art']);
  assert.deepStrictEqual(result['/art/painting'].path, ['Art', 'Painting']);
});

test('buildCategoryTree - 複数ページが同じカテゴリーに属する', () => {
  const allData = {
    'art/sample1': {
      name: 'art/sample1',
      category: ['Art']
    },
    'art/sample2': {
      name: 'art/sample2',
      category: ['Art']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  assert.ok(result['/art']);
  assert.deepStrictEqual(result['/art'].pages, ['art/sample1', 'art/sample2']);
});

test('buildCategoryTree - カテゴリーがないページは無視する', () => {
  const allData = {
    'no-category': {
      name: 'no-category'
    },
    'art/sample': {
      name: 'art/sample',
      category: ['Art']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  assert.ok(result['/art']);
  assert.strictEqual(Object.keys(result).length, 1);
});

test('buildCategoryTree - max_depth を尊重する', () => {
  const allData = {
    'deep/page': {
      name: 'deep/page',
      category: ['Level1', 'Level2', 'Level3', 'Level4']
    }
  };

  const config = {
    category: {
      max_depth: 2
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/level1']);
  assert.ok(result['/level1/level2']);
  assert.strictEqual(result['/level1/level2/level3'], undefined);
});

test('buildCategoryTree - url_case: lower でURLを小文字化する', () => {
  const allData = {
    'art/sample': {
      name: 'art/sample',
      category: ['Art', 'Painting']
    }
  };

  const config = {
    category: {
      url_case: 'lower'
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/art']);
  assert.ok(result['/art/painting']);
  assert.strictEqual(result['/Art'], undefined);
});

test('buildCategoryTree - url_case: original でURLを元のまま保持する', () => {
  const allData = {
    'art/sample': {
      name: 'art/sample',
      category: ['Art', 'Painting']
    }
  };

  const config = {
    category: {
      url_case: 'original'
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/Art']);
  assert.ok(result['/Art/Painting']);
  assert.strictEqual(result['/art'], undefined);
});

test('buildCategoryTree - 異なるカテゴリーパスが正しく分離される', () => {
  const allData = {
    'art/painting/sample1': {
      name: 'art/painting/sample1',
      category: ['Art', 'Painting']
    },
    'art/sculpture/sample2': {
      name: 'art/sculpture/sample2',
      category: ['Art', 'Sculpture']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  assert.ok(result['/art']);
  assert.ok(result['/art/painting']);
  assert.ok(result['/art/sculpture']);
  assert.deepStrictEqual(result['/art'].pages, ['art/painting/sample1', 'art/sculpture/sample2']);
  assert.deepStrictEqual(result['/art/painting'].pages, ['art/painting/sample1']);
  assert.deepStrictEqual(result['/art/sculpture'].pages, ['art/sculpture/sample2']);
});

test('buildCategoryTree - children が正しく計算される', () => {
  const allData = {
    'art/painting/sample': {
      name: 'art/painting/sample',
      category: ['Art', 'Painting']
    },
    'art/sculpture/sample': {
      name: 'art/sculpture/sample',
      category: ['Art', 'Sculpture']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  // /art の children には /art/painting と /art/sculpture が含まれるべき
  assert.ok(result['/art'].children['/art/painting']);
  assert.ok(result['/art'].children['/art/sculpture']);
  assert.strictEqual(Object.keys(result['/art'].children).length, 2);

  // /art/painting と /art/sculpture には children がない
  assert.strictEqual(Object.keys(result['/art/painting'].children).length, 0);
  assert.strictEqual(Object.keys(result['/art/sculpture'].children).length, 0);
});

test('buildCategoryTree - 深い階層の children が正しく計算される', () => {
  const allData = {
    'tech/frontend/react/sample': {
      name: 'tech/frontend/react/sample',
      category: ['Tech', 'Frontend', 'React']
    }
  };

  const config = {};
  const result = buildCategoryTree(allData, config);

  assert.ok(result['/tech'].children['/tech/frontend']);
  assert.ok(result['/tech/frontend'].children['/tech/frontend/react']);
  assert.strictEqual(Object.keys(result['/tech/frontend/react'].children).length, 0);
});

test('buildCategoryTree - スペースをハイフンに変換する（デフォルト）', () => {
  const allData = {
    'art/sample': {
      name: 'art/sample',
      category: ['Contemporary Art', 'Modern Painting']
    }
  };

  const config = {
    category: {
      url_case: 'lower'
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/contemporary-art']);
  assert.ok(result['/contemporary-art/modern-painting']);
  assert.strictEqual(result['/contemporary art'], undefined);
});

test('buildCategoryTree - url_separator でスペースの置き換え文字を変更', () => {
  const allData = {
    'art/sample': {
      name: 'art/sample',
      category: ['Contemporary Art']
    }
  };

  const config = {
    category: {
      url_case: 'lower',
      url_separator: '_'
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/contemporary_art']);
  assert.strictEqual(result['/contemporary-art'], undefined);
});

test('buildCategoryTree - url_prefix でURLにプレフィックスを追加', () => {
  const allData = {
    'book/sample': {
      name: 'book/sample',
      category: ['Art', 'Painting']
    }
  };

  const config = {
    category: {
      url_case: 'lower',
      url_prefix: '/books/category'
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/books/category/art']);
  assert.ok(result['/books/category/art/painting']);
  assert.strictEqual(result['/art'], undefined);
});

test('buildCategoryTree - url_prefix とスペース変換を組み合わせ', () => {
  const allData = {
    'book/sample': {
      name: 'book/sample',
      category: ['Contemporary Art']
    }
  };

  const config = {
    category: {
      url_case: 'lower',
      url_prefix: '/wf/book-list',
      url_separator: '-'
    }
  };

  const result = buildCategoryTree(allData, config);

  assert.ok(result['/wf/book-list/contemporary-art']);
  assert.strictEqual(result['/contemporary-art'], undefined);
  assert.strictEqual(result['/wf/book-list/contemporary art'], undefined);
});
