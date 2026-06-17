import { describe, it } from 'node:test'
import assert from 'node:assert'
import { resolveImagePath, createConverter, writeImageFile, handleImageUpload } from '../../packages/editor/server/image_upload.js'
import { insertImageMarkdown } from '../../packages/editor/js/image_upload.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ルートテスト
describe('インライン画像挿入 は ドラッグ&ドロップで本文への画像参照挿入ができる', () => {
  it('画像をアップロードするとMarkdown参照URLが得られ本文へ挿入できる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-image-test-'))
    const imageData = Buffer.from('fake-image-data').toString('base64')
    // コンバーターなし: 元のファイル名・拡張子のまま保存
    const { markdownUrl } = await handleImageUpload(
      { imageData, imageFilename: 'photo.jpg', mdFile: 'book/painting/claude-monet.md' },
      { converterFn: (buf) => buf, outputExt: null, baseDir: tmpDir }
    )
    // クライアント側: 受け取ったURLをカーソル位置に挿入
    const content = 'ここに画像を挿入します'
    const result = insertImageMarkdown(content, 5, markdownUrl)
    assert.strictEqual(markdownUrl, '/image/book/painting/claude-monet/photo.jpg')
    assert.ok(result.includes('![](/image/book/painting/claude-monet/photo.jpg)'))
    assert.ok(fs.existsSync(path.join(tmpDir, 'image/book/painting/claude-monet/photo.jpg')))
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── ドロップレシーバー ───────────────────────────────────────────────

describe('ドロップレシーバーはテキストエリアへの画像ドロップを受け付けできる', () => {
  describe('ドロップレシーバーはドラッグ中のデフォルト動作をキャンセルできる', () => {
    it('TODO', () => {})
  })
  describe('ドロップレシーバーはドロップされたファイルリストから画像ファイルを取り出せる', () => {
    it('TODO', () => {})
  })
})

// ─── 画像アップローダー ───────────────────────────────────────────────

describe('画像アップローダーは画像ファイルをサーバーに送信してMarkdown参照URLを受け取れる', () => {
  it('TODO', () => {})
})

// ─── アップロードエンドポイント ───────────────────────────────────────────────

describe('アップロードエンドポイントは画像を受け取り保存してMarkdown参照URLを返せる', () => {
  it('コンバーターなしのとき元の拡張子でファイルを保存しMarkdown参照URLを返す', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'))
    const imageData = Buffer.from('fake-image-data').toString('base64')
    const result = await handleImageUpload(
      { imageData, imageFilename: 'photo.jpg', mdFile: 'book/test.md' },
      { converterFn: (buf) => buf, outputExt: null, baseDir: tmpDir }
    )
    assert.strictEqual(result.markdownUrl, '/image/book/test/photo.jpg')
    assert.ok(fs.existsSync(path.join(tmpDir, 'image/book/test/photo.jpg')))
    fs.rmSync(tmpDir, { recursive: true })
  })
  it('outputExt を指定したとき指定した拡張子でファイルを保存する', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'))
    const imageData = Buffer.from('fake-image-data').toString('base64')
    const result = await handleImageUpload(
      { imageData, imageFilename: 'photo.jpg', mdFile: 'book/test.md' },
      { converterFn: (buf) => buf, outputExt: 'webp', baseDir: tmpDir }
    )
    assert.strictEqual(result.markdownUrl, '/image/book/test/photo.webp')
    assert.ok(fs.existsSync(path.join(tmpDir, 'image/book/test/photo.webp')))
    fs.rmSync(tmpDir, { recursive: true })
  })
  describe('コンバーターファクトリーは設定から画像コンバーターを生成できる', () => {
    it('設定なしのとき { fn, ext: null } を返す', async () => {
      const { fn, ext } = await createConverter()
      assert.strictEqual(typeof fn, 'function')
      assert.strictEqual(ext, null)
    })
    it('ドライバー関数を渡したとき { fn, ext: null } を返す', async () => {
      const mockDriver = async (buf) => buf
      const { fn, ext } = await createConverter(mockDriver)
      assert.strictEqual(typeof fn, 'function')
      assert.strictEqual(ext, null)
    })
  })
  describe('画像コンバーターは画像をWeb向けフォーマットに変換できる', () => {
    describe('画像コンバーターはドライバー未設定時に画像をそのまま通過させられる', () => {
      it('変換なしで同じバッファを返す', async () => {
        const { fn } = await createConverter()
        const buffer = Buffer.from('test-image-data')
        const result = await fn(buffer)
        assert.strictEqual(result, buffer)
      })
    })
    describe('画像コンバーターは変換ドライバーを通じて画像を変換できる', () => {
      it('ドライバー関数の変換結果を返す', async () => {
        const mockDriver = async (buf) => Buffer.from('converted')
        const { fn } = await createConverter(mockDriver)
        const result = await fn(Buffer.from('original'))
        assert.strictEqual(result.toString(), 'converted')
      })
    })
  })
  describe('パスリゾルバーは編集中ファイルパスから保存先パスとMarkdown参照URLを決定できる', () => {
    it('outputExt なしのとき元の拡張子を保持する', () => {
      const result = resolveImagePath('book/painting/claude-monet.md', 'photo.jpg')
      assert.deepStrictEqual(result, {
        saveSubPath: 'image/book/painting/claude-monet/photo.jpg',
        markdownUrl: '/image/book/painting/claude-monet/photo.jpg'
      })
    })
    it('outputExt を指定したとき指定した拡張子に変換する', () => {
      const result = resolveImagePath('book/painting/claude-monet.md', 'photo.jpg', 'webp')
      assert.deepStrictEqual(result, {
        saveSubPath: 'image/book/painting/claude-monet/photo.webp',
        markdownUrl: '/image/book/painting/claude-monet/photo.webp'
      })
    })
    it('ルートレベルのMDファイルパスでも動作する', () => {
      const result = resolveImagePath('index.md', 'image.png')
      assert.deepStrictEqual(result, {
        saveSubPath: 'image/index/image.png',
        markdownUrl: '/image/index/image.png'
      })
    })
    it('複数の拡張子を持つ画像ファイル名は最後の拡張子のみ対象とする', () => {
      const result = resolveImagePath('posts/entry.md', 'my.photo.jpeg', 'webp')
      assert.deepStrictEqual(result, {
        saveSubPath: 'image/posts/entry/my.photo.webp',
        markdownUrl: '/image/posts/entry/my.photo.webp'
      })
    })
    it('mdFilePath に .. が含まれる場合はエラーになる', () => {
      assert.throws(() => resolveImagePath('../../etc/passwd.md', 'photo.jpg'), /不正な mdFilePath/)
    })
    it('imageFilename にディレクトリパスが含まれる場合は basename のみを使用する', () => {
      const result = resolveImagePath('posts/entry.md', '../../../etc/malice.jpg')
      assert.deepStrictEqual(result, {
        saveSubPath: 'image/posts/entry/malice.jpg',
        markdownUrl: '/image/posts/entry/malice.jpg'
      })
    })
  })
  describe('ファイルライターは変換後の画像データを保存先パスに書き込める', () => {
    it('指定パスにデータを書き込み、中間ディレクトリが存在しなければ作成する', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-upload-test-'))
      const saveSubPath = 'image/book/painting/photo.webp'
      const data = Buffer.from('webp-data')
      writeImageFile(saveSubPath, data, tmpDir)
      const written = fs.readFileSync(path.join(tmpDir, saveSubPath))
      assert.strictEqual(written.toString(), 'webp-data')
      fs.rmSync(tmpDir, { recursive: true })
    })
    it('saveSubPath に .. が含まれ baseDir 外を指す場合はエラーになる', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-upload-test-'))
      assert.throws(
        () => writeImageFile('../../etc/malice.txt', Buffer.from('data'), tmpDir),
        /保存先パスが許可ディレクトリ外です/
      )
      fs.rmSync(tmpDir, { recursive: true })
    })
  })
})

// ─── コンバーターファクトリー（ユーザー指定パス） ───────────────────────────────────────────────

// @vocab: コンバーターファクトリー (docs/dictionary.md#コンバーターファクトリー)
describe('コンバーターファクトリー は ユーザー指定パスからコンバーターモジュールを解決できる', () => {
  it('ユーザー指定の変換モジュールを読み込み変換と出力拡張子が機能する', async () => {
    // ルートテスト — ツリーが完成するまで green にしない
    const { fn, ext } = await createConverter('./tests/editor/fixtures/test-converter.js')
    assert.strictEqual(ext, 'webp')
    const result = await fn(Buffer.from('hello'))
    assert.ok(result.toString().startsWith('converted:'))
  })

  describe('コンバーターファクトリー は プロジェクトルートを起点に相対パスを解決できる', () => {
    describe('コンバーターファクトリー は モジュールの変換関数（デフォルトエクスポート）を返せる', () => {
      it('デフォルトエクスポートの関数が変換結果を返す', async () => {
        const { fn } = await createConverter('./tests/editor/fixtures/test-converter.js')
        const result = await fn(Buffer.from('hello'))
        assert.ok(result.toString().startsWith('converted:'))
      })
    })
    describe('コンバーターファクトリー は モジュールの出力拡張子（ext エクスポート）を返せる', () => {
      it('ext エクスポートの値を返す', async () => {
        const { ext } = await createConverter('./tests/editor/fixtures/test-converter.js')
        assert.strictEqual(ext, 'webp')
      })
    })
  })

  describe('コンバーターファクトリー は 指定パスのモジュールが存在しないときパススルーにフォールバックできる', () => {
    it('存在しないパスのとき fn は入力をそのまま返し ext は null になる', async () => {
      const buf = Buffer.from('test')
      const { fn, ext } = await createConverter('./nonexistent-path.js')
      assert.strictEqual(await fn(buf), buf)
      assert.strictEqual(ext, null)
    })
  })
})

// ─── コンバーターファクトリー（ビルトイン名） ───────────────────────────────────────────────

describe('コンバーターファクトリー は ビルトイン名からビルトインコンバーターを解決できる', () => {
  it('TODO', () => {})

  describe('コンバーターファクトリー は "sharp" 指定でビルトインsharpコンバーターを読み込める', () => {
    it('TODO', () => {})
  })

  describe('コンバーターファクトリー は ビルトインコンバーターが利用不可のときパススルーにフォールバックできる', () => {
    it('存在しないビルトイン名のとき fn は入力をそのまま返し ext は null になる', async () => {
      const buf = Buffer.from('test')
      const { fn, ext } = await createConverter('nonexistent-builtin')
      assert.strictEqual(await fn(buf), buf)
      assert.strictEqual(ext, null)
    })
  })
})

// ─── Markdown挿入器 ───────────────────────────────────────────────

describe('Markdown挿入器はカーソル位置に画像参照を挿入できる', () => {
  it('カーソル位置に ![](url) 形式の画像参照を挿入する', () => {
    const result = insertImageMarkdown('前の文章後の文章', 5, '/image/photo.jpg')
    assert.strictEqual(result, '前の文章後![](/image/photo.jpg)の文章')
  })
  it('カーソルが先頭のとき文章の先頭に挿入される', () => {
    const result = insertImageMarkdown('文章', 0, '/image/photo.jpg')
    assert.strictEqual(result, '![](/image/photo.jpg)文章')
  })
  it('カーソルが末尾のとき文章の末尾に挿入される', () => {
    const result = insertImageMarkdown('文章', 2, '/image/photo.jpg')
    assert.strictEqual(result, '文章![](/image/photo.jpg)')
  })
})
