export const ext = 'webp'
export default async function convert(buffer) {
  return Buffer.from('converted:' + buffer.toString())
}
