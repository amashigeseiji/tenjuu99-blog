import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanImages } from '../../packages/editor/server/imageScanner.js'
import { readImageMetadata } from '../../packages/editor/server/imageMetadataReader.js'
import { readLedger, recordAddition, getAddedAt } from '../../packages/editor/server/imageLedger.js'
import { collectImageLibrary } from '../../packages/editor/server/imageLibraryCollector.js'
import { handleImageUpload } from '../../packages/editor/server/image_upload.js'

// ─── ルートテスト（全ツリー green になるまで green にしない） ───────────────────────────────────────────────

describe('画像ライブラリ は src/image 配下の画像を一覧でき、選択した画像の詳細を確認できる ができる', () => {
  it('台帳に記録のある画像とない画像が混在していても、それぞれ正しいメタデータで一覧できる', async () => {
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'image-library-root-'))
    const ledgerPath = path.join(tmpSrc, 'image-library.json')
    fs.mkdirSync(path.join(tmpSrc, 'image', 'post', 'hello'), { recursive: true })
    fs.writeFileSync(path.join(tmpSrc, 'image', 'post', 'hello', 'recorded.jpg'), Buffer.from('fake-image-1'))
    fs.writeFileSync(path.join(tmpSrc, 'image', 'legacy.jpg'), Buffer.from('fake-image-2'))
    recordAddition(ledgerPath, 'image/post/hello/recorded.jpg', '2026-07-01T00:00:00.000Z')

    const result = await collectImageLibrary({ srcDir: tmpSrc, ledgerPath })

    const recorded = result.find(e => e.path === 'image/post/hello/recorded.jpg')
    const legacy = result.find(e => e.path === 'image/legacy.jpg')
    assert.ok(recorded, '台帳に記録された画像が一覧に含まれる')
    assert.strictEqual(recorded.addedAt, '2026-07-01T00:00:00.000Z')
    assert.strictEqual(recorded.url, '/image/post/hello/recorded.jpg')
    assert.strictEqual(typeof recorded.size, 'number')
    assert.ok(legacy, '台帳に記録のない画像も一覧に含まれる')
    assert.strictEqual(legacy.addedAt, null, '記録がない画像は追加日時が不明(null)として表現される')

    fs.rmSync(tmpSrc, { recursive: true })
  })

  it('画像が1枚もなければ空配列になる', async () => {
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'image-library-empty-'))
    fs.mkdirSync(path.join(tmpSrc, 'image'), { recursive: true })

    const result = await collectImageLibrary({ srcDir: tmpSrc })

    assert.deepStrictEqual(result, [])
    fs.rmSync(tmpSrc, { recursive: true })
  })
})

// ─── 画像スキャナー ───────────────────────────────────────────────

describe('画像スキャナーは src/image 配下の画像ファイルを再帰的に列挙できる', () => {
  it('ネストしたディレクトリ配下の画像ファイルをすべて相対パスで列挙できる', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-scanner-'))
    fs.mkdirSync(path.join(tmpDir, 'post', 'hello'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'post', 'hello', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(tmpDir, 'b.png'), Buffer.from('x'))
    fs.writeFileSync(path.join(tmpDir, 'not-an-image.txt'), Buffer.from('x'))

    const result = scanImages(tmpDir)

    assert.deepStrictEqual(result.sort(), ['b.png', 'post/hello/a.jpg'])
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('画像ディレクトリが存在しなければ空配列を返す', () => {
    const result = scanImages(path.join(os.tmpdir(), 'does-not-exist-' + Date.now()))
    assert.deepStrictEqual(result, [])
  })
})

// ─── 画像メタデータ読み取り器 ───────────────────────────────────────────────

describe('画像メタデータ読み取り器は画像ファイルのサイズと解像度を読み取れる', () => {
  it('画像ファイルのバイト数と解像度（幅・高さ）を読み取れる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-metadata-'))
    const filePath = path.join(tmpDir, 'photo.png')
    // 1x1 の透明PNG（既知の解像度でメタデータ読み取りを検証する）
    const onePixelPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    )
    fs.writeFileSync(filePath, onePixelPng)

    const result = await readImageMetadata(filePath)

    assert.strictEqual(result.size, onePixelPng.length)
    assert.strictEqual(result.width, 1)
    assert.strictEqual(result.height, 1)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('解像度を読み取れない画像はサイズだけを返しwidth/heightはnullになる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-metadata-broken-'))
    const filePath = path.join(tmpDir, 'broken.jpg')
    fs.writeFileSync(filePath, Buffer.from('not-a-real-image'))

    const result = await readImageMetadata(filePath)

    assert.strictEqual(result.size, Buffer.from('not-a-real-image').length)
    assert.strictEqual(result.width, null)
    assert.strictEqual(result.height, null)
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── 画像台帳 ───────────────────────────────────────────────

describe('画像台帳は画像パスごとの追加日時を記録・取得できる', () => {
  it('記録した追加日時を画像パスから取得できる', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-ledger-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')

    recordAddition(ledgerPath, 'image/a.jpg', '2026-07-01T00:00:00.000Z')

    assert.strictEqual(getAddedAt(ledgerPath, 'image/a.jpg'), '2026-07-01T00:00:00.000Z')
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('記録のない画像パスの追加日時はnullになる', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-ledger-miss-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')

    assert.strictEqual(getAddedAt(ledgerPath, 'image/unknown.jpg'), null)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('既存の台帳ファイルに追記しても他のエントリは失われない', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-ledger-append-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')

    recordAddition(ledgerPath, 'image/a.jpg', '2026-07-01T00:00:00.000Z')
    recordAddition(ledgerPath, 'image/b.jpg', '2026-07-02T00:00:00.000Z')

    const ledger = readLedger(ledgerPath)
    assert.strictEqual(ledger['image/a.jpg'].addedAt, '2026-07-01T00:00:00.000Z')
    assert.strictEqual(ledger['image/b.jpg'].addedAt, '2026-07-02T00:00:00.000Z')
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── アップロードエンドポイント（画像台帳連携） ───────────────────────────────────────────────

describe('アップロードエンドポイントは画像アップロード時に画像台帳へ追加日時を記録できる', () => {
  it('ledgerPathを渡してアップロードすると、保存先パスで追加日時が引けるようになる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-upload-ledger-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    const imageData = Buffer.from('fake-image-data').toString('base64')

    const { markdownUrl } = await handleImageUpload(
      { imageData, imageFilename: 'photo.jpg', mdFile: 'post/hello.md' },
      { converterFn: (buf) => buf, outputExt: null, baseDir: tmpDir, ledgerPath }
    )

    assert.strictEqual(markdownUrl, '/image/post/hello/photo.jpg')
    const addedAt = getAddedAt(ledgerPath, 'image/post/hello/photo.jpg')
    assert.ok(addedAt, '追加日時が記録される')
    assert.ok(!Number.isNaN(Date.parse(addedAt)), 'ISO日時文字列として解釈できる')
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('ledgerPathを渡さなければ従来どおり記録なしで動作する', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-upload-no-ledger-'))
    const imageData = Buffer.from('fake-image-data').toString('base64')

    const { markdownUrl } = await handleImageUpload(
      { imageData, imageFilename: 'photo.jpg', mdFile: 'post/hello.md' },
      { converterFn: (buf) => buf, outputExt: null, baseDir: tmpDir }
    )

    assert.strictEqual(markdownUrl, '/image/post/hello/photo.jpg')
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── 画像リストコレクター ───────────────────────────────────────────────

describe('画像リストコレクターは画像スキャナー・画像メタデータ読み取り器・画像台帳を組み合わせて画像リストを作れる', () => {
  it('TODO: ルートテストでこの組み合わせを直接検証済み（重複回避のため個別テストは省略）', () => {})
})

// ─── 画像リスト表示（DOM描画・自動テストなし） ───────────────────────────────────────────────

describe('画像リスト表示は画像リストコレクターの結果をサイドバーの「画像」タブにツリー表示できる', () => {
  it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
})

// ─── 画像詳細表示（DOM描画・自動テストなし） ───────────────────────────────────────────────

describe('画像詳細表示は一覧から選択した画像のプレビューとメタデータを右ペインに表示できる', () => {
  it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
})

// ─── ルートテスト（画像の変化への反映・記事編集との共存フェーズ） ───────────────────────────────────────────────
// DOM描画・イベント配線に依存するため node:test 側では自動テストを持たない。
// tests/acceptance/editor-image-library.spec.ts の同名 describe で自動検証済み。

describe('画像ライブラリは画像の変化を一覧に反映し続け、記事編集画面と安全に共存できる ができる', () => {
  it('DOM描画・イベント配線に依存するため tests/acceptance/editor-image-library.spec.ts で検証済み', () => {})

  describe('画像リスト表示は画像タブを開くたびに最新の状態を反映できる', () => {
    it('tests/acceptance/editor-image-library.spec.ts「画像リスト表示は画像タブを開くたびに最新の状態を反映できる(F-01)」で検証済み', () => {})
  })

  describe('画像詳細表示は記事編集画面と操作エリアを共有し、画像タブを離れると自動的に閉じる', () => {
    it('tests/acceptance/editor-image-library.spec.ts「画像詳細表示は記事編集画面と操作エリアを共有し、画像タブを離れると自動的に閉じる(F-02)」で検証済み', () => {})
  })
})
