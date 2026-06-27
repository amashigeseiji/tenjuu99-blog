/**
 * @vocab ChangeReflector (plans/editor-publish/dictionary.md#変更反映器)
 * @test tests/editor/publish.test.js
 */
export async function reflect(files, publishedState) {
  await publishedState.commit(files)
  return await publishedState.push()
}
