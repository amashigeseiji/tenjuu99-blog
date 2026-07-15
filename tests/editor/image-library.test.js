import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanImages } from '../../packages/editor/server/imageScanner.js'
import { readImageMetadata } from '../../packages/editor/server/imageMetadataReader.js'
import { readLedger, recordAddition, getAddedAt, removeEntry, renameEntry } from '../../packages/editor/server/imageLedger.js'
import { collectImageLibrary } from '../../packages/editor/server/imageLibraryCollector.js'
import { handleImageUpload } from '../../packages/editor/server/image_upload.js'
import { collectArticleReferences } from '../../packages/editor/server/articleReferenceCollector.js'
import { findReferencingArticles } from '../../packages/editor/server/referencingArticleFinder.js'
import { updateReference } from '../../packages/editor/server/referenceUpdater.js'
import { deleteImage } from '../../packages/editor/server/delete_image.js'
import { renameImage } from '../../packages/editor/server/rename_image.js'

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

describe('画像ライブラリは参照している記事を考慮して画像を削除・改名することができる', () => {
  it('参照記事を公開状態つきで把握したうえで、参照の扱いの指定どおりに削除・改名できる', async () => {
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

    // 2. 改名: 参照の扱い「更新」を指定すると、参照記事の参照が新しいパスに書き換わる
    const renameResult = await renameImage(
      { imagePath: 'image/post/a.jpg', newFileName: 'renamed.jpg', referenceHandling: 'update' },
      { srcDir, pagesDir, ledgerPath }
    )
    assert.strictEqual(renameResult.success, true)
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

describe('画像改名エンドポイントは重複を避けつつ参照の扱いの指定に応じて画像を安全に改名することができる', () => {
  function setupTmp() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-image-'))
    const srcDir = path.join(tmpDir, 'src')
    const pagesDir = path.join(srcDir, 'pages')
    fs.mkdirSync(path.join(srcDir, 'image', 'post'), { recursive: true })
    fs.mkdirSync(pagesDir, { recursive: true })
    const ledgerPath = path.join(srcDir, 'image-library.json')
    return { tmpDir, srcDir, pagesDir, ledgerPath }
  }

  it('参照されていない画像は確認なしで改名でき、台帳の追加日時が新しいパスに引き継がれる', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    recordAddition(ledgerPath, 'image/post/a.jpg', '2026-07-01T00:00:00.000Z')

    const result = await renameImage({ imagePath: 'image/post/a.jpg', newFileName: 'renamed.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.newPath, 'image/post/renamed.jpg')
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'a.jpg')), false)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'renamed.jpg')), true)
    assert.strictEqual(getAddedAt(ledgerPath, 'image/post/renamed.jpg'), '2026-07-01T00:00:00.000Z')
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('referenceHandlingが"keep"のとき、参照している記事は変更せず画像だけ改名する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(pagesDir, 'hello.md'), '---\ntitle: hello\n---\n![alt](/image/post/a.jpg)\n')

    const result = await renameImage({ imagePath: 'image/post/a.jpg', newFileName: 'renamed.jpg', referenceHandling: 'keep' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.match(fs.readFileSync(path.join(pagesDir, 'hello.md'), 'utf-8'), /\/image\/post\/a\.jpg/)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('referenceHandlingが"update"のとき、参照している記事の参照が新しいパスに書き換わる', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(pagesDir, 'hello.md'), '---\ntitle: hello\n---\n![alt](/image/post/a.jpg)\n')

    const result = await renameImage({ imagePath: 'image/post/a.jpg', newFileName: 'renamed.jpg', referenceHandling: 'update' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, true)
    assert.match(fs.readFileSync(path.join(pagesDir, 'hello.md'), 'utf-8'), /\/image\/post\/renamed\.jpg/)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('改名先に同名のファイルが既に存在する場合は実行されない', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'b.jpg'), Buffer.from('y'))

    const result = await renameImage({ imagePath: 'image/post/a.jpg', newFileName: 'b.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, false)
    assert.strictEqual(fs.existsSync(path.join(srcDir, 'image', 'post', 'a.jpg')), true)
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('newFileNameにディレクトリ区切りを含む場合は拒否する', async () => {
    const { tmpDir, srcDir, pagesDir, ledgerPath } = setupTmp()
    fs.writeFileSync(path.join(srcDir, 'image', 'post', 'a.jpg'), Buffer.from('x'))

    const result = await renameImage({ imagePath: 'image/post/a.jpg', newFileName: '../escaped.jpg' }, { srcDir, pagesDir, ledgerPath })

    assert.strictEqual(result.success, false)
    fs.rmSync(tmpDir, { recursive: true })
  })
})

// ─── 画像削除UI（DOM描画・自動テストなし） ───────────────────────────────────────────────

describe('画像削除UIは画像詳細表示に削除操作を追加し、参照記事があれば確認ダイアログを経て削除を実行することができる', () => {
  it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
})

// ─── 画像改名UI（DOM描画・自動テストなし） ───────────────────────────────────────────────

describe('画像改名UIは画像詳細表示に改名操作を追加し、参照記事があれば確認ダイアログを経て改名を実行することができる', () => {
  it('TODO: DOM描画に依存するため自動テストを持たない。ステップ8で手動確認する', () => {})
})
