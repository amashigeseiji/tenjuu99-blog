import sharp from 'sharp'

export const ext = 'webp'

/**
 * @param {Buffer} buffer
 * @returns {Promise<Buffer>}
 */
export default async function convert(buffer) {
  return await sharp(buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp()
    .toBuffer()
}
