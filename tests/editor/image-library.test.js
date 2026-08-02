import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanImages } from '../../packages/editor/server/imageScanner.js'
import { readImageMetadata } from '../../packages/editor/server/imageMetadataReader.js'
import {
  readLedger, recordAddition, getAddedAt, removeEntry, renameEntry,
  setPublishedReferredBy, getPublishedReferredBy, setDeclaration, isDeclared,
  getMovedFrom, clearMovedFrom,
} from '../../packages/editor/server/imageLedger.js'
import { collectImageLibrary } from '../../packages/editor/server/imageLibraryCollector.js'
import { handleImageUpload } from '../../packages/editor/server/image_upload.js'
import { collectArticleReferences } from '../../packages/editor/server/articleReferenceCollector.js'
import { findReferencingArticles } from '../../packages/editor/server/referencingArticleFinder.js'
import { updateReference } from '../../packages/editor/server/referenceUpdater.js'
import { deleteImage } from '../../packages/editor/server/delete_image.js'
import { moveImage } from '../../packages/editor/server/move_image.js'
import { syncImagePublicationState } from '../../packages/editor/server/imagePublicationSyncer.js'
import { setImageDeclaration } from '../../packages/editor/server/image_declaration.js'
import { removeRemoteImage } from '../../packages/editor/server/remove_remote_image.js'

// ─── ルートテスト（全ツリー green になるまで green にしない） ───────────────────────────────────────────────

describe('画像ライブラリ は src/image 配下の画像を一覧でき、選択した画像の詳細を確認できる ができる', () => {
  it('台帳に記録のある画像とない画像が混在していても、それぞれ正しいメタデータで一覧できる', async () => {
    const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), 'image-library-root-'))
    const ledgerPath = path.join(tmpSrc, 'image-library.json')
    fs.mkdirSync(path.join(tmpSrc, 'image', 'post', 'hello'), { recursive: true })
    fs.writeFileSync(path.join(tmpSrc, 'image', 'post', 'hello', 'recorded.jpg'), Buffer.from('fake-image-1'))
    fs.writeFileSync(path.join(tmpSrc, 'image', 'legacy.jpg'), Buffer.from('fake-image-2'))
    recordAddition(ledgerPath, 'image/post/hello/recorded.jpg', '2026-07-01T00:00:00.000Z')

    const { images } = await collectImageLibrary({ srcDir: tmpSrc, ledgerPath })

    const recorded = images.find(e => e.path === 'image/post/hello/recorded.jpg')
    const legacy = images.find(e => e.path === 'image/legacy.jpg')
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

    const { images } = await collectImageLibrary({ srcDir: tmpSrc })

    assert.deepStrictEqual(images, [])
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

  it('エントリを削除でき、他のエントリは失われない', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-ledger-remove-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/a.jpg', '2026-07-01T00:00:00.000Z')
    recordAddition(ledgerPath, 'image/b.jpg', '2026-07-02T00:00:00.000Z')

    removeEntry(ledgerPath, 'image/a.jpg')

    assert.strictEqual(getAddedAt(ledgerPath, 'image/a.jpg'), null)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/b.jpg'), '2026-07-02T00:00:00.000Z')
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('エントリを新しいパスへ付け替えでき、追加日時は引き継がれる', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-ledger-rename-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/a.jpg', '2026-07-01T00:00:00.000Z')

    renameEntry(ledgerPath, 'image/a.jpg', 'image/renamed.jpg')

    assert.strictEqual(getAddedAt(ledgerPath, 'image/a.jpg'), null)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/renamed.jpg'), '2026-07-01T00:00:00.000Z')
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

// ─── ルートテスト（画像の削除・改名フェーズ） ───────────────────────────────────────────────

// 「改名」は問題定義 v5 で「移動（パスの付け替え）」の特殊な場合として再定義された
describe('画像ライブラリは参照している記事を考慮して画像を削除・移動することができる', () => {
  it('参照記事を公開状態つきで把握したうえで、参照の扱いの指定どおりに削除・移動できる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-library-root2-'))
    const srcDir = path.join(tmpDir, 'src')
    const pagesDir = path.join(srcDir, 'pages')
    fs.mkdirSync(path.join(srcDir, 'image', 'post'), { recursive: true })
    fs.mkdirSync(pagesDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')

    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    recordAddition(ledgerPath, 'image/post/a.jpg', '2026-07-01T00:00:00.000Z')
    fs.writeFileSync(path.join(pagesDir, 'published.md'), '---\ntitle: published\n---\n![alt](/image/post/a.jpg)\n')
    fs.writeFileSync(path.join(pagesDir, 'draft.md'), '---\ntitle: draft\n---\n![alt](/image/post/a.jpg)\n')

    // 1. 逆引き: 参照記事が公開状態つきで把握できる
    const articleReferences = collectArticleReferences(pagesDir)
    const getStatus = async (articlePath) => articlePath === 'published.md' ? 'published' : 'new'
    const referencing = await findReferencingArticles('image/post/a.jpg', articleReferences, getStatus)
    assert.deepStrictEqual(
      referencing.sort((a, b) => a.path.localeCompare(b.path)),
      [
        { path: 'draft.md', status: 'new' },
        { path: 'published.md', status: 'published' },
      ]
    )

    // 2. 移動（同じ置き場所への付け替え＝改名）: 参照の扱い「更新」を指定すると、参照記事の参照が新しいパスに書き換わる
    const moveResult = await moveImage(
      { imagePath: 'image/post/a.jpg', destPath: 'post/renamed.jpg', referenceHandling: 'update' },
      { srcDir, pagesDir, ledgerPath }
    )
    assert.strictEqual(moveResult.success, true)
    assert.match(fs.readFileSync(path.join(pagesDir, 'published.md'), 'utf-8'), /renamed\.jpg/)
    assert.match(fs.readFileSync(path.join(pagesDir, 'draft.md'), 'utf-8'), /renamed\.jpg/)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/post/renamed.jpg'), '2026-07-01T00:00:00.000Z')

    // 3. 削除: 参照の扱い「そのまま」を指定すると、画像だけが消え記事は変更されない
    const deleteResult = await deleteImage(
      { imagePath: 'image/post/renamed.jpg', referenceHandling: 'keep' },
      { srcDir, pagesDir, ledgerPath }
    )
    assert.strictEqual(deleteResult.success, true)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'renamed.jpg')), false)
    assert.match(fs.readFileSync(path.join(pagesDir, 'published.md'), 'utf-8'), /renamed\.jpg/)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/post/renamed.jpg'), null)

    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── 記事参照コレクター ───────────────────────────────────────────────

describe('記事参照コレクターは全記事を走査してそれぞれの画像参照を収集することができる', () => {
  it('本文とfrontmatter双方の画像参照を、記事ごとに正規化されたパスとして収集できる', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-reference-collector-'))
    fs.mkdirSync(path.join(tmpDir, 'post'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, 'post', 'hello.md'),
      '---\ntitle: hello\nog_image: /image/post/hello/og.jpg\n---\n![alt](/image/post/hello/a.jpg)\n'
    )
    fs.writeFileSync(path.join(tmpDir, 'no-image.md'), '---\ntitle: no-image\n---\n本文のみ\n')

    const result = collectArticleReferences(tmpDir)

    const hello = result.find(r => r.path === 'post/hello.md')
    const noImage = result.find(r => r.path === 'no-image.md')
    assert.ok(hello)
    assert.deepStrictEqual(hello.imagePaths.sort(), ['image/post/hello/a.jpg', 'image/post/hello/og.jpg'])
    assert.ok(noImage)
    assert.deepStrictEqual(noImage.imagePaths, [])

    fs.rmSync(tmpDir, { recursive: true })
  })

  it('記事ディレクトリが存在しなければ空配列を返す', () => {
    const result = collectArticleReferences(path.join(os.tmpdir(), 'does-not-exist-' + Date.now()))
    assert.deepStrictEqual(result, [])
  })
})

// ─── 参照記事逆引き器 ───────────────────────────────────────────────

describe('参照記事逆引き器は画像パスのローカル参照を記事一覧として公開状態つきで返すことができる', () => {
  it('指定した画像パスを参照している記事だけを、公開状態つきで返す', async () => {
    const articleReferences = [
      { path: 'post/hello.md', imagePaths: ['image/post/hello/a.jpg'] },
      { path: 'post/other.md', imagePaths: ['image/post/other/b.jpg'] },
      { path: 'post/hello2.md', imagePaths: ['image/post/hello/a.jpg', 'image/post/hello/c.jpg'] },
    ]
    const getStatus = async (articlePath) => articlePath === 'post/hello.md' ? 'published' : 'new'

    const result = await findReferencingArticles('image/post/hello/a.jpg', articleReferences, getStatus)

    assert.deepStrictEqual(
      result.sort((a, b) => a.path.localeCompare(b.path)),
      [
        { path: 'post/hello.md', status: 'published' },
        { path: 'post/hello2.md', status: 'new' },
      ]
    )
  })

  it('参照している記事がなければ空配列を返す', async () => {
    const result = await findReferencingArticles('image/unused.jpg', [{ path: 'post/hello.md', imagePaths: [] }], async () => 'new')
    assert.deepStrictEqual(result, [])
  })
})

// ─── 参照記事一覧エンドポイント ───────────────────────────────────────────────

describe('参照記事一覧エンドポイントは画像パスに対するローカル参照の記事一覧を提供することができる', () => {
  it('TODO: 内部で使う記事参照コレクター・参照記事逆引き器・公開ステータス判定器は個別にテスト済み。resolveRemoteStateへの実結線はエンドポイントとしてステップ8で手動確認する', () => {})
})

// ─── 参照更新器 ───────────────────────────────────────────────

describe('参照更新器は記事の内容から指定した画像参照を除去または新しいパスに書き換えることができる', () => {
  it('本文のMarkdown画像参照を新しいパスに書き換えられる', () => {
    const content = '---\ntitle: hello\n---\n本文\n![alt](/image/post/hello/a.jpg)\n続き\n'

    const result = updateReference(content, 'image/post/hello/a.jpg', 'image/post/hello/renamed.jpg')

    assert.match(result, /!\[alt\]\(\/image\/post\/hello\/renamed\.jpg\)/)
    assert.doesNotMatch(result, /a\.jpg/)
  })

  it('本文のMarkdown画像参照を除去できる', () => {
    const content = '本文\n![alt](/image/post/hello/a.jpg)\n続き\n'

    const result = updateReference(content, 'image/post/hello/a.jpg', null)

    assert.doesNotMatch(result, /a\.jpg/)
    assert.doesNotMatch(result, /!\[/)
  })

  it('frontmatterのスカラー画像参照を新しいパスに書き換えられる', () => {
    const content = '---\ntitle: hello\nog_image: /image/post/hello/og.jpg\n---\n本文\n'

    const result = updateReference(content, 'image/post/hello/og.jpg', 'image/post/hello/renamed-og.jpg')

    assert.match(result, /og_image: \/image\/post\/hello\/renamed-og\.jpg/)
  })

  it('frontmatterのスカラー画像参照を除去(行ごと削除)できる', () => {
    const content = '---\ntitle: hello\nog_image: /image/post/hello/og.jpg\n---\n本文\n'

    const result = updateReference(content, 'image/post/hello/og.jpg', null)

    assert.doesNotMatch(result, /og_image/)
    assert.match(result, /title: hello/)
  })

  it('対象と一致しない参照は変更しない', () => {
    const content = '---\ntitle: hello\nog_image: /image/post/hello/og.jpg\n---\n![alt](/image/post/hello/a.jpg)\n'

    const result = updateReference(content, 'image/unrelated.jpg', 'image/renamed.jpg')

    assert.strictEqual(result, content)
  })
})

// ─── 画像削除エンドポイント ───────────────────────────────────────────────

describe('画像削除エンドポイントは参照の扱いの指定に応じて画像を安全に削除することができる', () => {
  function setupTmp() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delete-image-'))
    const srcDir = path.join(tmpDir, 'src')
    const pagesDir = path.join(srcDir, 'pages')
    fs.mkdirSync(path.join(srcDir, 'image'), { recursive: true })
    fs.mkdirSync(pagesDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    return { tmpDir, srcDir, pagesDir, ledgerPath }
  }

  it('参照されていない画像は確認なしで削除でき、台帳のエントリも取り除かれる', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'a.jpg'), Buffer.from('x'))
    recordAddition(ledgerPath, 'image/a.jpg', '2026-07-01T00:00:00.000Z')

    const result = await deleteImage({ imagePath: 'image/a.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'a.jpg')), false)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/a.jpg'), null)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('referenceHandlingが"keep"のとき、参照している記事は変更せず画像だけ削除する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(pagesDir, 'hello.md'), '---\ntitle: hello\n---\n![alt](/image/a.jpg)\n')

    const result = await deleteImage({ imagePath: 'image/a.jpg', referenceHandling: 'keep' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'a.jpg')), false)
    assert.match(fs.readFileSync(path.join(pagesDir, 'hello.md'), 'utf-8'), /a\.jpg/)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('referenceHandlingが"update"のとき、参照している記事から参照を除去してから画像を削除する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(pagesDir, 'hello.md'), '---\ntitle: hello\n---\n![alt](/image/a.jpg)\n')

    const result = await deleteImage({ imagePath: 'image/a.jpg', referenceHandling: 'update' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'a.jpg')), false)
    assert.doesNotMatch(fs.readFileSync(path.join(pagesDir, 'hello.md'), 'utf-8'), /a\.jpg/)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('存在しない画像パスに対してはエラーを返す', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()

    const result = await deleteImage({ imagePath: 'image/missing.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, false)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('srcDirの外を指す画像パスは拒否する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()

    const result = await deleteImage({ imagePath: '../outside.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, false)
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── 画像改名エンドポイント ───────────────────────────────────────────────

// 改名（ファイル名だけの変更）は移動の特殊な場合として包含する（問題定義 v5）。
// 旧「画像改名エンドポイント」のテストはここに移動語彙で引き継いだ。
describe('画像移動エンドポイントは重複と管理下から外れる付け替えを拒みつつ、参照の扱いの指定に応じて画像を新しいパスへ移動できる', () => {
  function setupTmp() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'move-image-'))
    const srcDir = path.join(tmpDir, 'src')
    const pagesDir = path.join(srcDir, 'pages')
    fs.mkdirSync(path.join(srcDir, 'image', 'post'), { recursive: true })
    fs.mkdirSync(pagesDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    return { tmpDir, srcDir, pagesDir, ledgerPath }
  }

  it('参照されていない画像は確認なしで別の置き場所（未作成のディレクトリ階層）へ移動でき、台帳の追加日時が新しいパスに引き継がれる', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    recordAddition(ledgerPath, 'image/post/a.jpg', '2026-07-01T00:00:00.000Z')

    const result = await moveImage({ imagePath: 'image/post/a.jpg', destPath: 'photos/2026/moved.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.newPath, 'image/photos/2026/moved.jpg')
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'a.jpg')), false)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'photos', '2026', 'moved.jpg')), true)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/photos/2026/moved.jpg'), '2026-07-01T00:00:00.000Z')
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('ファイル名だけの変更（改名）は同じ置き場所への移動として実行できる', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))

    const result = await moveImage({ imagePath: 'image/post/a.jpg', destPath: 'post/renamed.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.newPath, 'image/post/renamed.jpg')
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'renamed.jpg')), true)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('referenceHandlingが"keep"のとき、参照している記事は変更せず画像だけ移動する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(pagesDir, 'hello.md'), '---\ntitle: hello\n---\n![alt](/image/post/a.jpg)\n')

    const result = await moveImage({ imagePath: 'image/post/a.jpg', destPath: 'photos/moved.jpg', referenceHandling: 'keep' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.match(fs.readFileSync(path.join(pagesDir, 'hello.md'), 'utf-8'), /\/image\/post\/a\.jpg/)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('referenceHandlingが"update"のとき、参照している記事の参照が新しいパスに書き換わる', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(pagesDir, 'hello.md'), '---\ntitle: hello\n---\n![alt](/image/post/a.jpg)\n')

    const result = await moveImage({ imagePath: 'image/post/a.jpg', destPath: 'photos/moved.jpg', referenceHandling: 'update' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.match(fs.readFileSync(path.join(pagesDir, 'hello.md'), 'utf-8'), /\/image\/photos\/moved\.jpg/)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('移動先に同じパスのファイルが既に存在する場合は実行されない', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'b.jpg'), Buffer.from('y'))

    const result = await moveImage({ imagePath: 'image/post/a.jpg', destPath: 'post/b.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, false)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'a.jpg')), true)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('管理下から外れる配置パス（トラバーサル・画像でない拡張子）は移動先検証器の判定どおり拒否する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))

    for (const destPath of ['../escaped.jpg', 'post/a.md']) {
      const result = await moveImage({ imagePath: 'image/post/a.jpg', destPath }, { srcDir, pagesDir, ledgerPath })
      assert.strictEqual(result.success, false, `"${destPath}" への移動は実行されない`)
      assert.ok(result.error, `"${destPath}" は受け付けられない旨が伝わる`)
    }
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'a.jpg')), true, '画像は引き続き管理下に残る')
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── 画像削除UI（DOM描画・自動テストなし） ───────────────────────────────────────────────

describe('画像削除UIは画像詳細表示に削除操作を追加し、参照記事があれば確認ダイアログを経て削除を実行することができる', () => {
  it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
})

// ─── 画像移動UI（旧・画像改名UI。DOM描画・自動テストなし） ───────────────────────────────────────────────
// 移動フェーズの「画像移動UIは新しい配置パスの入力を受け付け…」describe（下方）に引き継いだ。

// ─── 画像ライブラリ（削除・改名フェーズの体験改善） ───────────────────────────────────────────────

describe('画像ライブラリは削除・移動操作後も記事編集画面と確認ダイアログの見た目の整合性を保つことができる', () => {
  describe('記事再読み込み連携は参照も更新して削除・移動した後に、開いている記事を再読み込みすることができる', () => {
    it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
  })

  describe('確認ダイアログ選択肢表示は選択肢のボタンを折り返さずに表示し、中止の選択肢を視覚的に区別することができる', () => {
    it('TODO: DOM/CSSに依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
  })

  describe('画像操作ボタンは記事操作ボタンと見た目のトンマナを揃えることができる', () => {
    it('TODO: CSSに依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
  })
})

// ─── 画像詳細表示（画像詳細への参照記事一覧表示: F-05、DOM描画・自動テストなし） ───────────────────────────────────────────────

describe('画像詳細表示は選択した画像の参照記事一覧を、既存の参照記事一覧エンドポイントから取得して表示できる', () => {
  it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
})

// ─── 画像ライブラリ（画像ナビゲーション構造統一フェーズ: US-07 / F-06, F-07） ───────────────────────────────────────────────

describe('画像ライブラリは選択した画像をURLで特定し、表示をURLから再構成できる', () => {
  it('画像を特定するURLから表示対象が定まり、一覧では当該画像が選択中として識別され、リンクをたどると同じ表示対象に戻る', async () => {
    // ツリーが完成し葉から合成が終わるまで赤のまま（動的importで他テストへの影響を避ける）
    const { resolveDisplayTarget } = await import('../../packages/editor/js/displayTargetResolver.js')
    const { renderImageListHtml } = await import('../../packages/editor/js/imageListDisplay.js')

    // URL → 表示対象
    const target = resolveDisplayTarget(new URL('http://localhost/editor?image=image%2Fpost%2Fshiba.png'))
    assert.deepStrictEqual(target, { type: 'image', path: 'image/post/shiba.png' })

    // 表示対象 → 一覧描画（選択中の画像が識別できる）
    const entries = [
      { path: 'image/post/shiba.png' },
      { path: 'image/other.jpg' },
    ]
    const html = renderImageListHtml(entries, target.path)
    const activeMatch = html.match(/<a href="([^"]+)" class="[^"]*\bactive\b[^"]*"/)
    assert.ok(activeMatch, '選択中の画像が active なリンクとして描画される')

    // リンクをたどると同じ表示対象に戻る（URL → 表示 → URL の往復が閉じる）
    const roundTrip = resolveDisplayTarget(new URL(activeMatch[1].replace(/&amp;/g, '&'), 'http://localhost'))
    assert.deepStrictEqual(roundTrip, target)
  })
})

describe('表示対象解決器はURLがどの資源（記事か画像か）を特定しているかを表示対象として判別できる', () => {
  const resolve = async (urlString) => {
    const { resolveDisplayTarget } = await import('../../packages/editor/js/displayTargetResolver.js')
    return resolveDisplayTarget(new URL(urlString))
  }

  it('画像を特定するURLからは画像の表示対象を返す', async () => {
    assert.deepStrictEqual(
      await resolve('http://localhost/editor?image=image%2Fpost%2Fa.png'),
      { type: 'image', path: 'image/post/a.png' }
    )
  })

  it('記事を特定するURLからは記事の表示対象を返す', async () => {
    assert.deepStrictEqual(
      await resolve('http://localhost/editor?md=diary/hello.md'),
      { type: 'article', path: 'diary/hello.md' }
    )
  })

  it('記事と画像の両方が現れたURLでは画像を優先する（表示の一意性を保つ）', async () => {
    assert.deepStrictEqual(
      await resolve('http://localhost/editor?md=diary/hello.md&image=image%2Fa.png'),
      { type: 'image', path: 'image/a.png' }
    )
  })

  it('どの資源も特定していないURLからはnullを返す', async () => {
    assert.strictEqual(await resolve('http://localhost/editor'), null)
  })
})

describe('ツリーレンダラーは資源へのリンクの作り方を差し替えて、記事以外の資源のツリーも描画できる', () => {
  it('リンク先の組み立て・リンクの装い・ディレクトリの属性と開閉を差し替えて描画できる', async () => {
    const { buildTree, renderTreeHtml } = await import('../../packages/editor/js/tree.js')
    const tree = buildTree([{ name: 'post/a', __filetype: 'png' }])
    const html = renderTreeHtml(tree, 'post/a.png', {}, '', {
      buildHref: p => `/editor?image=${encodeURIComponent(`image/${p}`)}`,
      linkClass: 'image-node',
      fileAttrs: f => ` data-image-path="image/${f.path}"`,
      dirAttr: 'data-image-dir',
      openDirs: true,
    })
    assert.match(html, /<details data-image-dir="post" open>/)
    assert.match(html, /<a href="\/editor\?image=image%2Fpost%2Fa\.png" class="image-node active" data-image-path="image\/post\/a\.png">a\.png<\/a>/)
  })

  it('差し替えを指定しなければ従来どおり記事へのリンクとして描画する', async () => {
    const { buildTree, renderTreeHtml } = await import('../../packages/editor/js/tree.js')
    const tree = buildTree([{ name: 'diary/hello', __filetype: 'md' }])
    const html = renderTreeHtml(tree, 'diary/hello.md', {})
    assert.match(html, /<details data-dir="diary">/)
    assert.match(html, /<a href="\/editor\?md=diary%2Fhello\.md" class="active">hello\.md<\/a>/)
  })
})

describe('画像リスト表示は選択中の画像が識別できるリンクのツリーとして画像一覧を描画できる', () => {
  it('画像をリンクのツリーとして描画し、選択中の画像が識別できる', async () => {
    const { renderImageListHtml } = await import('../../packages/editor/js/imageListDisplay.js')
    const entries = [
      { path: 'image/post/shiba.png', status: 'published' },
      { path: 'image/other.jpg', status: 'new' },
    ]
    const html = renderImageListHtml(entries, 'image/post/shiba.png')
    // ディレクトリは開いた状態で描画される（従来の見た目を維持）
    assert.match(html, /<details data-image-dir="post" open>/)
    // 選択中の画像は active、他はそうでない。既存の受け入れテストが使う .image-node / data-image-path は維持
    assert.match(html, /<a href="\/editor\?image=image%2Fpost%2Fshiba\.png" class="image-node active" data-status="published" data-image-path="image\/post\/shiba\.png">shiba\.png<\/a>/)
    assert.match(html, /<a href="\/editor\?image=image%2Fother\.jpg" class="image-node" data-status="new" data-image-path="image\/other\.jpg">other\.jpg<\/a>/)
  })

  it('画像が1枚もなければ空状態のHTMLを返す', async () => {
    const { renderImageListHtml } = await import('../../packages/editor/js/imageListDisplay.js')
    assert.match(renderImageListHtml([]), /画像がありません/)
  })
})

describe('画像詳細表示はURLで特定された画像の詳細を再構成できる', () => {
  it('TODO: DOM配線に依存するため受け入れテスト（直打ち・リロード再現）で検証する', () => {})
})

describe('サイドバーは画像リンクのクリックを記事リンクと同じその場の資源切り替えとして扱える', () => {
  it('TODO: DOM配線に依存するため受け入れテストで検証する', () => {})
})

describe('画像削除UIは削除後にURLから画像の特定を取り除ける', () => {
  it('TODO: DOM配線に依存するため受け入れテストで検証する', () => {})
})

// 「画像改名UIは改名後のURLを新しい名前の画像に付け替えられる」（US-07フェーズ）は、
// 移動フェーズの「画像移動UIは…移動後のURLを付け替えられる」describe（下方）に統合した。

// ─── 移動フェーズ（US-03 移動拡張 + F-02） ───────────────────────────────────────────────
// ルートテスト（全ツリー green になるまで green にしない）

describe('画像ライブラリは参照している記事を考慮して、画像を管理下から失わずに移動（パスの付け替え）できる', () => {
  it('別の置き場所への移動で参照と台帳が追従し、管理下から外れる付け替えは拒否される', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-library-move-root-'))
    const srcDir = path.join(tmpDir, 'src')
    const pagesDir = path.join(srcDir, 'pages')
    fs.mkdirSync(path.join(srcDir, 'image', 'post'), { recursive: true })
    fs.mkdirSync(pagesDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')

    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    recordAddition(ledgerPath, 'image/post/a.jpg', '2026-07-01T00:00:00.000Z')
    fs.writeFileSync(path.join(pagesDir, 'referencing.md'), '---\ntitle: ref\n---\n![alt](/image/post/a.jpg)\n')

    // 1. 別の置き場所（未作成のディレクトリ階層）への移動: 参照の扱い「更新」で参照と台帳が追従する
    const moved = await moveImage(
      { imagePath: 'image/post/a.jpg', destPath: 'photos/2026/b.jpg', referenceHandling: 'update' },
      { srcDir, pagesDir, ledgerPath }
    )
    assert.strictEqual(moved.success, true)
    assert.strictEqual(moved.newPath, 'image/photos/2026/b.jpg')
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'photos', '2026', 'b.jpg')), true)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'a.jpg')), false)
    assert.match(fs.readFileSync(path.join(pagesDir, 'referencing.md'), 'utf-8'), /\/image\/photos\/2026\/b\.jpg/)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/photos/2026/b.jpg'), '2026-07-01T00:00:00.000Z')

    // 2. 管理下から外れる付け替え（画像でない拡張子）は実行されない（F-02）
    const rejected = await moveImage(
      { imagePath: 'image/photos/2026/b.jpg', destPath: 'photos/2026/b.md', referenceHandling: 'keep' },
      { srcDir, pagesDir, ledgerPath }
    )
    assert.strictEqual(rejected.success, false)
    assert.ok(rejected.error, '受け付けられない旨が伝わる')
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'photos', '2026', 'b.jpg')), true, '画像は引き続き管理下に残る')

    // 3. 既存の別の画像と同じパスになる移動は実行されない
    fs.writeFileSync(path.join(srcDir, 'image', 'occupied.jpg'), Buffer.from('y'))
    const duplicated = await moveImage(
      { imagePath: 'image/photos/2026/b.jpg', destPath: 'occupied.jpg', referenceHandling: 'keep' },
      { srcDir, pagesDir, ledgerPath }
    )
    assert.strictEqual(duplicated.success, false)

    fs.rmSync(tmpDir, { recursive: true })
  })
})

describe('移動先検証器は移動先の配置パスが画像ライブラリの管理下にとどまるか（画像として扱える名前か・管理領域の外へ出ないか）を判定できる', () => {
  it('画像として扱える配置パスは階層の有無にかかわらず受け付ける', async () => {
    const { validateDestination } = await import('../../packages/editor/server/moveDestinationValidator.js')
    assert.strictEqual(validateDestination('photos/2026/b.jpg').valid, true)
    assert.strictEqual(validateDestination('b.webp').valid, true)
  })

  it('画像として扱えない名前（画像でない拡張子・拡張子なし・ファイル名なし）は受け付けない', async () => {
    const { validateDestination } = await import('../../packages/editor/server/moveDestinationValidator.js')
    for (const dest of ['photos/b.md', 'b.txt', 'b', 'photos/', '']) {
      const result = validateDestination(dest)
      assert.strictEqual(result.valid, false, `"${dest}" は受け付けない`)
      assert.ok(result.error, `"${dest}" は受け付けられない旨が伝わる`)
    }
  })

  it('管理領域の外へ出る配置パス（トラバーサル・絶対パス）は受け付けない', async () => {
    const { validateDestination } = await import('../../packages/editor/server/moveDestinationValidator.js')
    for (const dest of ['../outside.jpg', 'photos/../../outside.jpg', '/etc/passwd.jpg', 'photos//b.jpg', './b.jpg']) {
      assert.strictEqual(validateDestination(dest).valid, false, `"${dest}" は受け付けない`)
    }
  })

  it('管理対象とする画像の判定基準を画像スキャナーと共有している', async () => {
    const { validateDestination } = await import('../../packages/editor/server/moveDestinationValidator.js')
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'move-dest-validator-'))
    // スキャナーが列挙する名前は検証器も受け付け、列挙しない名前は受け付けない
    fs.writeFileSync(path.join(tmpDir, 'a.avif'), Buffer.from('x'))
    fs.writeFileSync(path.join(tmpDir, 'b.md'), Buffer.from('x'))
    const scanned = scanImages(tmpDir)
    assert.deepStrictEqual(scanned, ['a.avif'])
    assert.strictEqual(validateDestination('a.avif').valid, true)
    assert.strictEqual(validateDestination('b.md').valid, false)
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// 画像移動エンドポイントのテストは旧「画像改名エンドポイント」の describe を移動語彙で
// 引き継いだ箇所（上方）にある。

describe('画像移動UIは新しい配置パスの入力を受け付け、参照記事があれば確認ダイアログを経て移動を実行し、移動後のURLを付け替えられる', () => {
  it('TODO: DOM配線に依存するため受け入れテスト・手動確認で検証する', () => {})
})

// ─── 公開状態導出・宣言フェーズ（US-05 + US-06） ───────────────────────────────────────────────
// ルートテスト（全ツリー green になるまで green にしない）

describe('画像ライブラリ は 記事からの参照の有無（またはその宣言）に応じて画像の公開状態を自動的に導出し、同期操作（公開・更新・非公開）のたびにリモートへ反映することができる', () => {
  it('参照を失うと更新公開のタイミングで画像もリモートから取り除かれ、非公開でも最後の参照の画像は道連れになる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-publication-root-'))
    const srcDir = path.join(tmpDir, 'src')
    const pagesDir = path.join(srcDir, 'pages')
    fs.mkdirSync(path.join(srcDir, 'image', 'post'), { recursive: true })
    fs.mkdirSync(pagesDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'cat.jpg'), Buffer.from('x'))
    const markdownFile = `${srcDir}/pages/post/hello.md`
    const imageFile = `${srcDir}/image/post/cat.jpg`

    const remoteFiles = new Set()
    let articleDirty = true
    const means = {
      remoteState: {
        existsInRemote: async (f) => remoteFiles.has(f),
        diffFromRemote: async (f) => (f === markdownFile && articleDirty) ? 'diff --git ...' : '',
      },
      reflect: async (files) => { files.forEach(f => remoteFiles.add(f)); articleDirty = false; return { success: true } },
      remove: async (files) => { files.forEach(f => remoteFiles.delete(f)); return { success: true } },
      deliverable: 'manuscript',
    }

    const { handlePublish } = await import('../../packages/editor/server/publish.js')
    const { handleUnpublish } = await import('../../packages/editor/server/unpublish.js')

    // 1. 画像を参照する記事を公開する: 記事・画像がともにリモートへ反映される（US-05 S1）
    await handlePublish(
      { filePath: 'post/hello.md', fileContent: '本文\n![猫](/image/post/cat.jpg)', srcDir, ledgerPath },
      means
    )
    assert.strictEqual(remoteFiles.has(imageFile), true, '画像が公開される')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/cat.jpg'), ['post/hello.md'])

    // 2. ローカルで参照を消してから更新を公開する: 唯一の参照だった画像がリモートから取り除かれる（US-05 S2）
    articleDirty = true
    await handlePublish(
      { filePath: 'post/hello.md', fileContent: '本文（画像参照なし）', srcDir, ledgerPath },
      means
    )
    assert.strictEqual(remoteFiles.has(imageFile), false, '参照を失った画像がリモートから取り除かれる')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/cat.jpg'), [])
    assert.strictEqual(remoteFiles.has(markdownFile), true, '記事自体はリモートに残る')

    // 3. 画像参照を戻して再公開したのち、記事を非公開にする: 最後の参照だった画像も道連れに取り除かれる（US-05 S5）
    articleDirty = true
    await handlePublish(
      { filePath: 'post/hello.md', fileContent: '本文\n![猫](/image/post/cat.jpg)', srcDir, ledgerPath },
      means
    )
    assert.strictEqual(remoteFiles.has(imageFile), true, '画像が再び公開される')

    await handleUnpublish({ filePath: 'post/hello.md', srcDir, ledgerPath }, means)
    assert.strictEqual(remoteFiles.has(markdownFile), false, '記事がリモートから取り除かれる')
    assert.strictEqual(remoteFiles.has(imageFile), false, '最後の参照だった画像も取り除かれる')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/cat.jpg'), [])
  })
})

describe('画像台帳は画像パスごとの公開済み参照記事一覧と検出外参照宣言を保持・更新できる', () => {
  it('公開済み参照記事一覧を記録・取得できる。記録がない画像は空配列を返す', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-published-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/a.jpg'), [])
    setPublishedReferredBy(ledgerPath, 'image/post/a.jpg', ['post/hello.md', 'post/world.md'])
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/a.jpg'), ['post/hello.md', 'post/world.md'])
  })

  it('addedAt を保持したまま公開済み参照記事一覧を更新できる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-published-addedat-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/post/a.jpg', '2026-07-01T00:00:00.000Z')
    setPublishedReferredBy(ledgerPath, 'image/post/a.jpg', ['post/hello.md'])
    assert.strictEqual(getAddedAt(ledgerPath, 'image/post/a.jpg'), '2026-07-01T00:00:00.000Z')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/a.jpg'), ['post/hello.md'])
  })

  it('検出外参照宣言を付与・解除できる。記録がない画像は false を返す', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-declared-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    assert.strictEqual(isDeclared(ledgerPath, 'image/post/a.jpg'), false)
    setDeclaration(ledgerPath, 'image/post/a.jpg', true)
    assert.strictEqual(isDeclared(ledgerPath, 'image/post/a.jpg'), true)
    setDeclaration(ledgerPath, 'image/post/a.jpg', false)
    assert.strictEqual(isDeclared(ledgerPath, 'image/post/a.jpg'), false)
  })
})

describe('画像公開同期器は記事の同期操作の結果を画像台帳の公開済み参照へ反映し、参照を失い宣言もない画像をリモートから取り除くことができる', () => {
  it('新しく参照するようになった画像を公開済み参照に加える（除去はしない）', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-add-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }
    const result = await syncImagePublicationState(
      'post/hello.md', [`${srcDir}/image/post/cat.jpg`], { srcDir, ledgerPath }, means
    )
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/cat.jpg'), ['post/hello.md'])
    assert.deepStrictEqual(removed, [])
    assert.deepStrictEqual(result.removed, [])
  })

  it('参照を失い、他に参照する記事もなく、宣言もない画像はリモートから取り除く', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-gc-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/cat.jpg', ['post/hello.md'])
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }
    const result = await syncImagePublicationState('post/hello.md', [], { srcDir, ledgerPath }, means)
    assert.deepStrictEqual(removed, [`${srcDir}/image/post/cat.jpg`])
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/cat.jpg'), [])
    assert.deepStrictEqual(result.removed, ['image/post/cat.jpg'])
  })

  it('他の記事がまだ参照している画像は取り除かない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-keep-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/cat.jpg', ['post/hello.md', 'post/world.md'])
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }
    await syncImagePublicationState('post/hello.md', [], { srcDir, ledgerPath }, means)
    assert.deepStrictEqual(removed, [])
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/cat.jpg'), ['post/world.md'])
  })

  it('検出外参照宣言のある画像は参照を失っても取り除かない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-declared-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/cat.jpg', ['post/hello.md'])
    setDeclaration(ledgerPath, 'image/post/cat.jpg', true)
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }
    await syncImagePublicationState('post/hello.md', [], { srcDir, ledgerPath }, means)
    assert.deepStrictEqual(removed, [])
  })
})

describe('公開ハンドラーは記事の公開・更新の成功後に画像公開同期器を呼び出せる', () => {
  it('TODO: ルートテストの経路として検証済み（tests/editor/publish.test.js 側にも配線の単体テストを持つ）', () => {})
})

describe('非公開にするは記事の非公開の成功後に画像公開同期器を呼び出せる', () => {
  it('TODO: ルートテストの経路として検証済み（tests/editor/sync-operations.test.js 側にも配線の単体テストを持つ）', () => {})
})

describe('検出外参照宣言エンドポイントは画像への宣言の付与・解除を受け付けて画像台帳に反映できる', () => {
  it('宣言を付与できる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'declaration-endpoint-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    const result = await setImageDeclaration({ imagePath: 'image/post/a.jpg', declared: true }, { ledgerPath })
    assert.strictEqual(result.success, true)
    assert.strictEqual(isDeclared(ledgerPath, 'image/post/a.jpg'), true)
  })

  it('宣言を解除できる', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'declaration-endpoint-off-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    setDeclaration(ledgerPath, 'image/post/a.jpg', true)
    const result = await setImageDeclaration({ imagePath: 'image/post/a.jpg', declared: false }, { ledgerPath })
    assert.strictEqual(result.success, true)
    assert.strictEqual(isDeclared(ledgerPath, 'image/post/a.jpg'), false)
  })
})

describe('画像詳細表示は宣言の付与・解除UIを表示し、宣言状態を画像台帳と同期できる', () => {
  it('TODO: DOM配線に依存するため受け入れテスト・手動確認で検証する', () => {})
})

// --- 画像自身の公開状態可視化・UI整理フェーズ（成層ツリー実験） ---
// root（作成者は…できる）と行為層（役割主語）はスケルトン化の対象外（実験ルール10）。
// 能力層（装置主語）のみをここに列挙する。

describe('画像リストコレクターは画像ごとの公開状態(リモートに存在するか)を算出して返せる', () => {
  // このノードは後続フェーズの「画像リストコレクターは画像ごとの公開ステータスを添えて一覧を返せる」に
  // 引き継がれた。#画像公開状態 の二値（published）は表示の役割から降り、リモートの実体との対応は
  // #公開ステータス が表す（設計上の決定: リモート未達の可視化・リモート残存の解消フェーズ）。
  it('TODO: 公開ステータスを添える後続ノードのテストに引き継がれた', () => {})
})

describe('画像リスト表示は一覧の各画像に公開状態を記号で示せる', () => {
  // このノードは後続フェーズの「画像リスト表示は画像の公開ステータスを記事一覧と同じ記号で示せる」に
  // 引き継がれた（記号の根拠が二値の #画像公開状態 から4状態の #公開ステータス に変わったため）。
  it('TODO: 公開ステータスを記号で示す後続ノードのテストに引き継がれた', () => {})
})

describe('画像詳細表示はファイル名・公開状態・参照記事・宣言・削除操作をひとつのメタデータ欄にまとめて示せる', () => {
  it('TODO: DOM描画に依存するため受け入れテスト・手動確認で検証する', () => {})
})

describe('検出外参照宣言UIは宣言の効果が伝わる文言で表示される', () => {
  it('TODO: DOM文言のみのため受け入れテスト・手動確認で検証する', () => {})
})

describe('インラインファイル名編集UIはクリックで編集フォームに切り替わり、保存で移動を実行し、取消でもとの表示に戻せる', () => {
  it('TODO: DOM配線に依存するため受け入れテスト・手動確認で検証する', () => {})
})

// --- リモート未達の可視化・リモート残存の解消フェーズ ---
// root（作成者は…できる）と行為層（役割主語）はスケルトン化の対象外。
// 能力層（装置主語）のみをここに列挙する。

// リモート状態の代役。remoteFiles に在るものを「リモートに存在する」、
// modifiedFiles に在るものを「リモートと差分あり」として答える。
function fakeRemoteState({ remoteFiles = [], modifiedFiles = [] } = {}) {
  const remote = new Set(remoteFiles)
  const modified = new Set(modifiedFiles)
  return {
    existsInRemote: async (filePath) => remote.has(filePath),
    diffFromRemote: async (filePath) => (modified.has(filePath) ? 'modified' : ''),
    listRemoteFiles: async () => [...remote],
  }
}

function setUpImages(prefix, relPaths) {
  const tmpSrc = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  for (const rel of relPaths) {
    const full = path.join(tmpSrc, 'image', rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, Buffer.from('fake'))
  }
  return { srcDir: tmpSrc, ledgerPath: path.join(tmpSrc, 'image-library.json') }
}

describe('画像リストコレクターは画像ごとの公開ステータスを添えて一覧を返せる', () => {
  it('リモートに無い画像は未公開、一致していれば公開済み、差分があれば更新ありになる', async () => {
    const { srcDir, ledgerPath } = setUpImages('collector-status-', ['post/new.jpg', 'post/same.jpg', 'post/diff.jpg'])
    const remoteState = fakeRemoteState({
      remoteFiles: ['src/image/post/same.jpg', 'src/image/post/diff.jpg'],
      modifiedFiles: ['src/image/post/diff.jpg'],
    })

    const { images } = await collectImageLibrary({ srcDir, ledgerPath, remoteState, srcPrefix: 'src/' })

    assert.strictEqual(images.find(e => e.path === 'image/post/new.jpg').status, 'new')
    assert.strictEqual(images.find(e => e.path === 'image/post/same.jpg').status, 'published')
    assert.strictEqual(images.find(e => e.path === 'image/post/diff.jpg').status, 'modified')
    fs.rmSync(srcDir, { recursive: true })
  })

  it('リモートを参照できないときは不明として返す（一覧そのものは返る）', async () => {
    const { srcDir, ledgerPath } = setUpImages('collector-status-unknown-', ['post/a.jpg'])
    const brokenRemoteState = {
      existsInRemote: async () => { throw new Error('upstream not configured') },
      diffFromRemote: async () => { throw new Error('upstream not configured') },
      listRemoteFiles: async () => { throw new Error('upstream not configured') },
    }

    const { images, remoteOnly } = await collectImageLibrary({ srcDir, ledgerPath, remoteState: brokenRemoteState, srcPrefix: 'src/' })

    assert.strictEqual(images.length, 1)
    assert.strictEqual(images[0].status, 'unknown')
    assert.deepStrictEqual(remoteOnly, [], 'リモートのみの検出はあきらめる')
    fs.rmSync(srcDir, { recursive: true })
  })
})

describe('公開ステータスラベルは状態ごとの表示語を一か所から返せる', () => {
  it('4つの状態それぞれに記事と共通の表示語を返す', async () => {
    const { labelFor } = await import('../../packages/editor/js/publicationStatusLabel.js')
    assert.strictEqual(labelFor('new'), '未公開')
    assert.strictEqual(labelFor('modified'), '更新あり')
    assert.strictEqual(labelFor('published'), '公開済み')
    assert.strictEqual(labelFor('remote-only'), 'リモートのみ')
  })

  it('状態が参照できないときは「不明」を返す', async () => {
    const { labelFor } = await import('../../packages/editor/js/publicationStatusLabel.js')
    assert.strictEqual(labelFor('unknown'), '不明')
  })

  it('状態が与えられていないときは表示語を持たない', async () => {
    const { labelFor } = await import('../../packages/editor/js/publicationStatusLabel.js')
    assert.strictEqual(labelFor(''), '')
    assert.strictEqual(labelFor(undefined), '')
  })
})

describe('画像リスト表示は画像の公開ステータスを記事一覧と同じ記号で示せる', () => {
  it('4つの状態がそれぞれ記事一覧と同じ data-status として現れる', async () => {
    const { renderImageListHtml } = await import('../../packages/editor/js/imageListDisplay.js')
    const entries = [
      { path: 'image/post/a.jpg', status: 'published' },
      { path: 'image/post/b.jpg', status: 'new' },
      { path: 'image/post/c.jpg', status: 'modified' },
      { path: 'image/post/d.jpg', status: 'unknown' },
    ]

    const html = renderImageListHtml(entries)

    assert.match(html, /class="image-node" data-status="published" data-image-path="image\/post\/a\.jpg"/)
    assert.match(html, /class="image-node" data-status="new" data-image-path="image\/post\/b\.jpg"/)
    assert.match(html, /class="image-node" data-status="modified" data-image-path="image\/post\/c\.jpg"/)
    assert.match(html, /class="image-node" data-status="unknown" data-image-path="image\/post\/d\.jpg"/)
  })
})

describe('画像詳細表示は画像の公開ステータスを記事と同じ言葉で示せる', () => {
  it('TODO', () => {})
})

describe('画像台帳は移動した画像に移動元パスを記録できる', () => {
  it('移動すると新しいパスのエントリに移動元パスが記録される', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-movedfrom-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/post/a.jpg', '2026-08-01T00:00:00.000Z')
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/b.jpg'), 'image/post/a.jpg')
    assert.strictEqual(getAddedAt(ledgerPath, 'image/post/b.jpg'), '2026-08-01T00:00:00.000Z', '追加日時は引き継がれる')
  })

  it('移動していない画像には移動元パスがない', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-movedfrom-none-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/post/a.jpg')
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/a.jpg'), null)
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/unknown.jpg'), null, '記録がない画像も null を返す')
  })

  it('記録を消せる（移動がリモートへ届いた時点で失われる）', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-movedfrom-clear-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/post/a.jpg')
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    clearMovedFrom(ledgerPath, 'image/post/b.jpg')
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/b.jpg'), null)
    assert.notStrictEqual(getAddedAt(ledgerPath, 'image/post/b.jpg'), null, '他のフィールドは保たれる')
  })
})

describe('画像台帳は移動を重ねても最初の移動元パスを保てる', () => {
  it('a→b→c と移動しても、リモートが知っているパス（a）を指し続ける', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-movedfrom-chain-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/post/a.jpg')
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    renameEntry(ledgerPath, 'image/post/b.jpg', 'image/post/c.jpg')
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/c.jpg'), 'image/post/a.jpg')
  })

  it('同期でいったん記録が消えたあとの移動は、その時点のパスを移動元とする', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-movedfrom-resync-'))
    const ledgerPath = path.join(tmpDir, 'image-library.json')
    recordAddition(ledgerPath, 'image/post/a.jpg')
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    clearMovedFrom(ledgerPath, 'image/post/b.jpg')
    renameEntry(ledgerPath, 'image/post/b.jpg', 'image/post/c.jpg')
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/c.jpg'), 'image/post/b.jpg')
  })
})

describe('画像リストコレクターは移動元パスがリモートに在る画像を更新ありとして読める', () => {
  it('公開済みの画像を移動すると、新しいパスの1件が更新ありになる（未公開の別物にならない）', async () => {
    const { srcDir, ledgerPath } = setUpImages('collector-movedfrom-', ['post/b.jpg'])
    recordAddition(ledgerPath, 'image/post/a.jpg')
    setPublishedReferredBy(ledgerPath, 'image/post/a.jpg', ['post/hello.md'])
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    const remoteState = fakeRemoteState({ remoteFiles: ['src/image/post/a.jpg'] })

    const { images } = await collectImageLibrary({ srcDir, ledgerPath, remoteState, srcPrefix: 'src/' })

    assert.strictEqual(images.length, 1, '移動前後で2件に分裂しない')
    assert.strictEqual(images[0].path, 'image/post/b.jpg')
    assert.strictEqual(images[0].status, 'modified')
    fs.rmSync(srcDir, { recursive: true })
  })

  it('移動元パスがリモートに無ければ（未公開の画像を移動した場合）未公開のままになる', async () => {
    const { srcDir, ledgerPath } = setUpImages('collector-movedfrom-unpublished-', ['post/b.jpg'])
    recordAddition(ledgerPath, 'image/post/a.jpg')
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    const remoteState = fakeRemoteState({ remoteFiles: [] })

    const { images } = await collectImageLibrary({ srcDir, ledgerPath, remoteState, srcPrefix: 'src/' })

    assert.strictEqual(images[0].status, 'new')
    fs.rmSync(srcDir, { recursive: true })
  })
})

describe('画像公開同期器は公開された画像の移動元パスをリモートから取り除ける', () => {
  it('移動した画像が新しいパスで公開されたら、旧パスをリモートから取り除く', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-movedfrom-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/a.jpg', ['post/hello.md'])
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }

    await syncImagePublicationState(
      'post/hello.md', [`${srcDir}/image/post/b.jpg`], { srcDir, ledgerPath }, means
    )

    assert.deepStrictEqual(removed, [`${srcDir}/image/post/a.jpg`], '旧パスだけが取り除かれる')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/b.jpg'), ['post/hello.md'])
  })

  it('参照を書き換えずに移動した（記事がまだ旧パスを参照している）場合は取り除かない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-movedfrom-keep-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/a.jpg', ['post/hello.md'])
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }

    // 記事は旧パスを参照したまま（keep を選んだ場合）
    await syncImagePublicationState(
      'post/hello.md', [`${srcDir}/image/post/a.jpg`], { srcDir, ledgerPath }, means
    )

    assert.ok(
      !removed.includes(`${srcDir}/image/post/a.jpg`),
      '公開中のサイトがまだ参照している旧パスは取り除かれない'
    )
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/b.jpg'), 'image/post/a.jpg', '記録も残る')
  })
})

describe('画像公開同期器は取り除いた移動元パスの記録を消せる', () => {
  it('取り除いたあとの再同期では、同じ旧パスをもう一度取り除こうとしない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncer-movedfrom-clear-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/a.jpg', ['post/hello.md'])
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }
    const refs = [`${srcDir}/image/post/b.jpg`]

    await syncImagePublicationState('post/hello.md', refs, { srcDir, ledgerPath }, means)
    assert.strictEqual(getMovedFrom(ledgerPath, 'image/post/b.jpg'), null, '届いた時点で記録は失われる')

    removed.length = 0
    await syncImagePublicationState('post/hello.md', refs, { srcDir, ledgerPath }, means)
    assert.deepStrictEqual(removed, [])
  })
})

describe('画像リストコレクターはリモートにのみ存在する画像をローカルの一覧とは別に返せる', () => {
  it('ローカルに実体がなくリモートに在る画像は、ローカルの一覧ではなくリモートのみの側に現れる', async () => {
    const { srcDir, ledgerPath } = setUpImages('collector-remote-only-', ['post/here.jpg'])
    const remoteState = fakeRemoteState({
      remoteFiles: ['src/image/post/here.jpg', 'src/image/post/gone.jpg', 'src/pages/post/hello.md'],
    })

    const { images, remoteOnly } = await collectImageLibrary({ srcDir, ledgerPath, remoteState, srcPrefix: 'src/' })

    assert.deepStrictEqual(images.map(e => e.path), ['image/post/here.jpg'])
    assert.deepStrictEqual(remoteOnly.map(e => e.path), ['image/post/gone.jpg'], '画像以外のリモートファイルは混ざらない')
    assert.strictEqual(remoteOnly[0].status, 'remote-only')
    assert.strictEqual(remoteOnly[0].url, '/image/post/gone.jpg')
    assert.strictEqual(remoteOnly[0].size, null, 'ローカルに実体がないメタデータは欠ける')
    fs.rmSync(srcDir, { recursive: true })
  })

  it('移動元パスはリモートのみの側に現れない（移動した画像1件として読まれるため）', async () => {
    const { srcDir, ledgerPath } = setUpImages('collector-remote-only-moved-', ['post/b.jpg'])
    recordAddition(ledgerPath, 'image/post/a.jpg')
    renameEntry(ledgerPath, 'image/post/a.jpg', 'image/post/b.jpg')
    const remoteState = fakeRemoteState({ remoteFiles: ['src/image/post/a.jpg'] })

    const { images, remoteOnly } = await collectImageLibrary({ srcDir, ledgerPath, remoteState, srcPrefix: 'src/' })

    assert.deepStrictEqual(remoteOnly, [])
    assert.strictEqual(images[0].status, 'modified')
    fs.rmSync(srcDir, { recursive: true })
  })
})

describe('リモートのみ画像表示は画像ツリーとは別の枠に一覧を示せる', () => {
  it('リモートにのみ残る画像を、画像ツリーとは別の枠として描く', async () => {
    const { renderRemoteOnlyImagesHtml } = await import('../../packages/editor/js/remoteOnlyImageDisplay.js')
    const entries = [
      { path: 'image/post/gone.jpg', status: 'remote-only' },
      { path: 'image/legacy.png', status: 'remote-only' },
    ]

    const html = renderRemoteOnlyImagesHtml(entries)

    assert.match(html, /class="remote-only-images"/, '別枠として識別できる')
    assert.match(html, /image\/post\/gone\.jpg/)
    assert.match(html, /image\/legacy\.png/)
    assert.doesNotMatch(html, /class="image-node"/, '画像ツリーのノードとしては描かれない')
  })

  it('リモートにのみ残る画像がなければ枠そのものが現れない', async () => {
    const { renderRemoteOnlyImagesHtml } = await import('../../packages/editor/js/remoteOnlyImageDisplay.js')
    assert.strictEqual(renderRemoteOnlyImagesHtml([]), '')
  })
})

describe('画像除去エンドポイントは指定した画像をリモートから取り除ける', () => {
  it('指定した画像をリモートから取り除き、台帳の記録も片付ける', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-removal-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/gone.jpg', ['post/hello.md'])
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }

    const result = await removeRemoteImage({ imagePath: 'image/post/gone.jpg' }, { srcDir, ledgerPath }, means)

    assert.strictEqual(result.success, true)
    assert.deepStrictEqual(removed, [`${srcDir}/image/post/gone.jpg`])
    assert.deepStrictEqual(readLedger(ledgerPath), {}, 'リモートから消えた画像の記録は残さない')
  })

  it('管理領域の外を指すパスは受け付けない', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-removal-traversal-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    const removed = []
    const means = { remove: async (files) => { removed.push(...files); return { success: true } } }

    const result = await removeRemoteImage({ imagePath: 'image/../pages/post/hello.md' }, { srcDir, ledgerPath }, means)

    assert.strictEqual(result.success, false)
    assert.deepStrictEqual(removed, [])
  })

  it('リモートからの除去に失敗したら、その旨を返して記録も残す', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-removal-failure-'))
    const srcDir = path.join(tmpDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    setPublishedReferredBy(ledgerPath, 'image/post/gone.jpg', ['post/hello.md'])
    const means = { remove: async () => ({ success: false, error: 'push に失敗しました' }) }

    const result = await removeRemoteImage({ imagePath: 'image/post/gone.jpg' }, { srcDir, ledgerPath }, means)

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.error, 'push に失敗しました')
    assert.deepStrictEqual(getPublishedReferredBy(ledgerPath, 'image/post/gone.jpg'), ['post/hello.md'])
  })
})

describe('リモートのみ画像表示は各画像に取り除く操作を示せる', () => {
  it('各画像に、その画像を指す取り除く操作が付く', async () => {
    const { renderRemoteOnlyImagesHtml } = await import('../../packages/editor/js/remoteOnlyImageDisplay.js')
    const entries = [{ path: 'image/post/gone.jpg', status: 'remote-only' }]

    const html = renderRemoteOnlyImagesHtml(entries)

    assert.match(html, /<button[^>]*class="remote-only-image-remove-btn"[^>]*data-image-path="image\/post\/gone\.jpg"[^>]*>/)
    assert.match(html, /取り除く/)
  })
})

describe('画像詳細表示は検出外参照の宣言を公開状態の欄の中に示せる', () => {
  it('TODO', () => {})
})

describe('画像詳細表示は削除の操作を文言に見合った大きさで示せる', () => {
  it('TODO', () => {})
})
