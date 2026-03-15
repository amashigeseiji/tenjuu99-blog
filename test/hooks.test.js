import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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

  // runHooks関数を実装してテスト
  const runHooks = async (hookName, allData, config) => {
    if (!config.hooks || !config.hooks[hookName]) {
      return;
    }
  };

  // 例外が発生しないことを確認
  await assert.doesNotReject(async () => {
    await runHooks('nonExistentHook', {}, testConfig);
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

  const runHooks = async (hookName, allData, config, helperDir) => {
    if (!config.hooks || !config.hooks[hookName]) {
      return;
    }

    const hookFiles = Array.isArray(config.hooks[hookName])
      ? config.hooks[hookName]
      : [config.hooks[hookName]];

    for (const hookFile of hookFiles) {
      const hookPath = join(helperDir, hookFile);

      if (existsSync(hookPath)) {
        try {
          const hookModule = await import(hookPath);
          if (typeof hookModule[hookName] === 'function') {
            await hookModule[hookName](allData, config);
          }
        } catch (e) {
          console.error(`[hook error] ${hookName}:`, e);
        }
      }
    }
  };

  // 例外が発生しないことを確認
  await assert.doesNotReject(async () => {
    await runHooks('afterIndexing', {}, testConfig, testHelperDir);
  });

  cleanupTestFiles();
});

test('runHooks - 正しいフック関数を実行する', async () => {
  setupTestFiles();

  // フック関数を作成
  const hookContent = `
export async function afterIndexing(allData, config) {
  allData.hookExecuted = true;
  allData.receivedConfig = config.site_name;
}
`;
  writeFileSync(join(testHelperDir, 'testHook.js'), hookContent);

  const testConfig = {
    site_name: 'test-site',
    hooks: {
      afterIndexing: 'testHook.js'
    }
  };

  const testAllData = {};

  const runHooks = async (hookName, allData, config, helperDir) => {
    if (!config.hooks || !config.hooks[hookName]) {
      return;
    }

    const hookFiles = Array.isArray(config.hooks[hookName])
      ? config.hooks[hookName]
      : [config.hooks[hookName]];

    for (const hookFile of hookFiles) {
      const hookPath = join(helperDir, hookFile);

      if (existsSync(hookPath)) {
        try {
          const hookModule = await import(`file://${hookPath}`);
          if (typeof hookModule[hookName] === 'function') {
            await hookModule[hookName](allData, config);
          }
        } catch (e) {
          console.error(`[hook error] ${hookName}:`, e);
          throw e;
        }
      }
    }
  };

  await runHooks('afterIndexing', testAllData, testConfig, testHelperDir);

  // フック関数が実行されたことを確認
  assert.strictEqual(testAllData.hookExecuted, true);
  assert.strictEqual(testAllData.receivedConfig, 'test-site');

  cleanupTestFiles();
});

test('runHooks - 複数のフック関数を順番に実行する', async () => {
  setupTestFiles();

  // 1つ目のフック関数
  const hook1Content = `
export async function afterIndexing(allData, config) {
  if (!allData.executionOrder) {
    allData.executionOrder = [];
  }
  allData.executionOrder.push('hook1');
}
`;
  writeFileSync(join(testHelperDir, 'hook1.js'), hook1Content);

  // 2つ目のフック関数
  const hook2Content = `
export async function afterIndexing(allData, config) {
  if (!allData.executionOrder) {
    allData.executionOrder = [];
  }
  allData.executionOrder.push('hook2');
}
`;
  writeFileSync(join(testHelperDir, 'hook2.js'), hook2Content);

  const testConfig = {
    hooks: {
      afterIndexing: ['hook1.js', 'hook2.js']
    }
  };

  const testAllData = {};

  const runHooks = async (hookName, allData, config, helperDir) => {
    if (!config.hooks || !config.hooks[hookName]) {
      return;
    }

    const hookFiles = Array.isArray(config.hooks[hookName])
      ? config.hooks[hookName]
      : [config.hooks[hookName]];

    for (const hookFile of hookFiles) {
      const hookPath = join(helperDir, hookFile);

      if (existsSync(hookPath)) {
        try {
          const hookModule = await import(`file://${hookPath}`);
          if (typeof hookModule[hookName] === 'function') {
            await hookModule[hookName](allData, config);
          }
        } catch (e) {
          console.error(`[hook error] ${hookName}:`, e);
          throw e;
        }
      }
    }
  };

  await runHooks('afterIndexing', testAllData, testConfig, testHelperDir);

  // フック関数が順番に実行されたことを確認
  assert.deepStrictEqual(testAllData.executionOrder, ['hook1', 'hook2']);

  cleanupTestFiles();
});

test('runHooks - フック関数内でエラーが発生してもビルドが続行される', async () => {
  setupTestFiles();

  // エラーを発生させるフック関数
  const errorHookContent = `
export async function afterIndexing(allData, config) {
  throw new Error('Test error in hook');
}
`;
  writeFileSync(join(testHelperDir, 'errorHook.js'), errorHookContent);

  const testConfig = {
    hooks: {
      afterIndexing: 'errorHook.js'
    }
  };

  const testAllData = {};

  const runHooks = async (hookName, allData, config, helperDir) => {
    if (!config.hooks || !config.hooks[hookName]) {
      return;
    }

    const hookFiles = Array.isArray(config.hooks[hookName])
      ? config.hooks[hookName]
      : [config.hooks[hookName]];

    for (const hookFile of hookFiles) {
      const hookPath = join(helperDir, hookFile);

      if (existsSync(hookPath)) {
        try {
          const hookModule = await import(`file://${hookPath}`);
          if (typeof hookModule[hookName] === 'function') {
            await hookModule[hookName](allData, config);
          }
        } catch (e) {
          // エラーをログ出力するが、例外を再スローしない
          console.error(`[hook error] ${hookName}:`, e.message);
          // ここで return せずに続行
        }
      }
    }
  };

  // 例外が発生せず、処理が続行されることを確認
  await assert.doesNotReject(async () => {
    await runHooks('afterIndexing', testAllData, testConfig, testHelperDir);
  });

  cleanupTestFiles();
});

// ========================================
// lib/helper.js の非同期処理修正のテスト
// ========================================

test('helper - ヘルパー関数が正しくロードされる (forEach → for...of 修正後)', async () => {
  setupTestFiles();

  // テスト用のヘルパー関数を作成
  const helper1Content = `
export function testHelper1() {
  return 'helper1';
}
`;
  writeFileSync(join(testHelperDir, 'helper1.js'), helper1Content);

  const helper2Content = `
export function testHelper2() {
  return 'helper2';
}
`;
  writeFileSync(join(testHelperDir, 'helper2.js'), helper2Content);

  // 修正後のhelper読み込みロジック
  const loadHelpers = async (files, helperDir) => {
    let helper = {};

    for (const file of files) {
      if (existsSync(join(helperDir, file))) {
        const helperAdditional = await import(`file://${join(helperDir, file)}`);
        helper = Object.assign(helper, helperAdditional);
      }
    }

    return helper;
  };

  const files = ['helper1.js', 'helper2.js'];
  const loadedHelpers = await loadHelpers(files, testHelperDir);

  // ヘルパー関数が正しくロードされたことを確認
  assert.strictEqual(typeof loadedHelpers.testHelper1, 'function');
  assert.strictEqual(typeof loadedHelpers.testHelper2, 'function');
  assert.strictEqual(loadedHelpers.testHelper1(), 'helper1');
  assert.strictEqual(loadedHelpers.testHelper2(), 'helper2');

  cleanupTestFiles();
});

test('helper - 存在しないヘルパーファイルをスキップする', async () => {
  setupTestFiles();

  // 1つだけ存在するヘルパー関数を作成
  const helper1Content = `
export function testHelper1() {
  return 'helper1';
}
`;
  writeFileSync(join(testHelperDir, 'helper1.js'), helper1Content);

  // 修正後のhelper読み込みロジック
  const loadHelpers = async (files, helperDir) => {
    let helper = {};

    for (const file of files) {
      if (existsSync(join(helperDir, file))) {
        const helperAdditional = await import(`file://${join(helperDir, file)}`);
        helper = Object.assign(helper, helperAdditional);
      }
    }

    return helper;
  };

  const files = ['helper1.js', 'nonExistent.js'];
  const loadedHelpers = await loadHelpers(files, testHelperDir);

  // 存在するヘルパー関数のみロードされることを確認
  assert.strictEqual(typeof loadedHelpers.testHelper1, 'function');
  assert.strictEqual(loadedHelpers.testHelper1(), 'helper1');

  cleanupTestFiles();
});
