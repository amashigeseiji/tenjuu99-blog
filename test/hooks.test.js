import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runHooks } from '../lib/generate.js';

// テスト用の一時ディレクトリ
const testDir = join(process.cwd(), 'test-temp-hooks');
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
// runHooks関数のテスト
// ========================================

test('runHooks - 存在しないフック名で呼ばれても例外が発生しない', async () => {
  setupTestFiles();

  // テスト用のconfigを作成（hooksプロパティがない）
  const testConfig = {
    site_name: 'test',
    src_dir: join(testDir, 'src'),
    dist_dir: join(testDir, 'dist'),
  };

  const testAllData = {};

  // 例外が発生しないことを確認
  await assert.doesNotReject(async () => {
    await runHooks('nonExistentHook', testHelperDir, testAllData, testConfig);
  });

  cleanupTestFiles();
});

test('runHooks - 存在しないファイルを指定しても例外が発生しない', async () => {
  setupTestFiles();

  const testConfig = {
    hooks: {
      afterIndexing: 'nonExistentFile.js'
    }
  };

  const testAllData = {};

  // 例外が発生しないことを確認
  await assert.doesNotReject(async () => {
    await runHooks('afterIndexing', testHelperDir, testAllData, testConfig);
  });

  cleanupTestFiles();
});

test('runHooks - 正しいフック関数を実行する', async () => {
  setupTestFiles();

  // テスト用のフックファイルを作成
  const hookContent = `
export async function afterIndexing(allData, config) {
  allData.hookExecuted = true;
  allData.receivedConfig = config.site_name;
}
`;

  writeFileSync(join(testHelperDir, 'testHook.js'), hookContent);

  const testConfig = {
    site_name: 'Test Site',
    hooks: {
      afterIndexing: 'testHook.js'
    }
  };

  const testAllData = {};

  await runHooks('afterIndexing', testHelperDir, testAllData, testConfig);

  assert.strictEqual(testAllData.hookExecuted, true);
  assert.strictEqual(testAllData.receivedConfig, 'Test Site');

  cleanupTestFiles();
});

test('runHooks - 複数のフックファイルを順番に実行する', async () => {
  setupTestFiles();

  // 1つ目のフック
  const hook1Content = `
export async function afterIndexing(allData, config) {
  if (!allData.executionOrder) {
    allData.executionOrder = [];
  }
  allData.executionOrder.push('hook1');
}
`;

  // 2つ目のフック
  const hook2Content = `
export async function afterIndexing(allData, config) {
  if (!allData.executionOrder) {
    allData.executionOrder = [];
  }
  allData.executionOrder.push('hook2');
}
`;

  writeFileSync(join(testHelperDir, 'hook1.js'), hook1Content);
  writeFileSync(join(testHelperDir, 'hook2.js'), hook2Content);

  const testConfig = {
    hooks: {
      afterIndexing: ['hook1.js', 'hook2.js']
    }
  };

  const testAllData = {};

  await runHooks('afterIndexing', testHelperDir, testAllData, testConfig);

  assert.deepStrictEqual(testAllData.executionOrder, ['hook1', 'hook2']);

  cleanupTestFiles();
});

test('runHooks - allDataを変更できる', async () => {
  setupTestFiles();

  const hookContent = `
export async function afterIndexing(allData, config) {
  allData['new/page'] = {
    name: 'new/page',
    title: 'New Page',
    distribute: true
  };
}
`;

  writeFileSync(join(testHelperDir, 'modifyData.js'), hookContent);

  const testConfig = {
    hooks: {
      afterIndexing: 'modifyData.js'
    }
  };

  const testAllData = {};

  await runHooks('afterIndexing', testHelperDir, testAllData, testConfig);

  assert.ok(testAllData['new/page']);
  assert.strictEqual(testAllData['new/page'].title, 'New Page');

  cleanupTestFiles();
});

test('runHooks - フック関数が存在しない場合はスキップ', async () => {
  setupTestFiles();

  // afterIndexing関数がないモジュール
  const hookContent = `
export function someOtherFunction() {
  return 'not a hook';
}
`;

  writeFileSync(join(testHelperDir, 'noHook.js'), hookContent);

  const testConfig = {
    hooks: {
      afterIndexing: 'noHook.js'
    }
  };

  const testAllData = {};

  // 例外が発生しないことを確認
  await assert.doesNotReject(async () => {
    await runHooks('afterIndexing', testHelperDir, testAllData, testConfig);
  });

  cleanupTestFiles();
});

test('runHooks - エラーが発生するとビルドが中断される', async () => {
  setupTestFiles();

  // エラーを投げるフック
  const hookContent = `
export async function afterIndexing(allData, config) {
  throw new Error('Hook error');
}
`;

  writeFileSync(join(testHelperDir, 'errorHook.js'), hookContent);

  const testConfig = {
    hooks: {
      afterIndexing: 'errorHook.js'
    }
  };

  const testAllData = {};

  // エラーが発生すると例外が投げられる（ビルド中断）
  await assert.rejects(
    async () => {
      await runHooks('afterIndexing', testHelperDir, testAllData, testConfig);
    },
    {
      message: 'Hook error'
    }
  );

  cleanupTestFiles();
});
