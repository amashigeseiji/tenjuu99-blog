/**
 * @vocab ChangeReflector (plans/editor-publish/dictionary.md#変更反映器)
 * @test tests/editor/publish.test.js
 */
export async function reflect(files, publishedState) {
  const committed = await publishedState.commit(files)
  if (!committed) return { success: true }
  return await publishedState.push()
}
