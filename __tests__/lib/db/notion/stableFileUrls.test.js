import { getStableNotionFileUrl, getStableNotionFileLink, withStableNotionFileUrls } from '@/lib/db/notion/stableFileUrls'

const id = '46224c52-8ab1-43f3-9752-5a7e35b0c466'
const space = '7743fca7-7fbe-49da-88fd-2cbe749f722f'
const cdn = `https://file.notion.com/f/f/${space}/attachment-id/%E8%B5%84%E6%96%99.zip?expirationTimestamp=1&signature=expired`
const block = { id, space_id: space, type: 'file', properties: { source: [[cdn]] } }
const decodeSource = url => decodeURIComponent(new URL(url).pathname.slice('/signed/'.length))

test.each(['file', 'pdf', 'audio', 'video'])('replaces expired %s CDN URLs without mutating cached blocks', type => {
  const original = { block: { [id]: { value: { ...block, type } } }, signed_urls: { [id]: cdn, unrelated: 'https://example.com/file' } }
  const frozen = JSON.stringify(original)
  const result = withStableNotionFileUrls(original)
  const url = new URL(result.signed_urls[id])
  expect(decodeSource(url)).toBe('attachment:attachment-id:资料.zip')
  expect(url.searchParams.get('id')).toBe(id)
  expect(url.searchParams.get('spaceId')).toBe(space)
  expect(result.signed_urls[id]).not.toContain('expirationTimestamp')
  expect(result.signed_urls.unrelated).toBe(original.signed_urls.unrelated)
  expect(result.block).toBe(original.block)
  expect(JSON.stringify(original)).toBe(frozen)
  expect(withStableNotionFileUrls(result)).toBe(result)
})

test('unwraps old signed entries and discards expired AWS credentials', () => {
  const raw = `https://prod-files-secure.s3.us-west-2.amazonaws.com/${space}/file/a.zip?X-Amz-Signature=expired&X-Amz-Expires=3600`
  const source = `https://notion.so/signed/${encodeURIComponent(raw)}?table=block&id=${id}`
  expect(decodeSource(getStableNotionFileUrl(source, block))).toBe(raw.split('?')[0])
})

test.each([
  'https://file.notion.so/f/f/space/file/a%20b.mp3?expirationTimestamp=1',
  'https://notion.so/signed/attachment%3Afile%3Aa%20b.mp3?table=block',
  'attachment:file:a b.mp3'
])('supports legacy and new Notion sources: %s', source => {
  expect(decodeSource(getStableNotionFileUrl(source, block))).toBe('attachment:file:a b.mp3')
})

test.each([
  'https://cdn.example.com/video.mp4?token=required',
  'https://file.notion.com.evil.example/f/f/space/file/a.zip',
  'https://prod-files-secure.evil.example/file.pdf',
  'https://prod-files-secure.s3.us-west-2.amazonaws.com.evil.example/file.pdf',
  'https://notion.so/signed/https%3A%2F%2Fevil.example%2Fa.zip',
  'https://notion.so/signed/%invalid',
  'javascript:alert(1)', '', null
])('does not rewrite external or malformed sources: %s', source => {
  expect(getStableNotionFileUrl(source, block)).toBeNull()
})

test('handles nested Notion records, modern file fields, and a missing source', () => {
  const result = withStableNotionFileUrls({ block: {
    [id]: { value: { value: { id, type: 'audio', file: { url: cdn } }, role: 'reader' } },
    fallback: { value: { id: 'fallback', type: 'file' } }
  }, signed_urls: { fallback: cdn } })
  expect(decodeSource(result.signed_urls[id])).toBe('attachment:attachment-id:资料.zip')
  expect(decodeSource(result.signed_urls.fallback)).toBe('attachment:attachment-id:资料.zip')
})

test('preserves external media, images, absent records, and unchanged record maps', () => {
  const external = { ...block, properties: { source: [['https://cdn.example.com/audio.mp3?token=required']] } }
  const recordMap = { block: { [id]: { value: external }, image: { value: { ...block, id: 'image', type: 'image' } } }, signed_urls: {} }
  expect(withStableNotionFileUrls(recordMap)).toBe(recordMap)
  expect(withStableNotionFileUrls(undefined)).toBeUndefined()
})

test('repairs pasted download links using the file permission ID rather than the text block ID', () => {
  const href = `${cdn}&table=block&id=${id}&spaceId=${space}&downloadName=archive.zip`
  const original = { block: { text: { value: { id: 'text', type: 'text', properties: {
    title: [['下载资料', [['b'], ['a', href]]]], caption: [['外链', [['a', 'https://example.com/file.zip']]]]
  } } } } }
  const result = withStableNotionFileUrls(original)
  const fixed = new URL(result.block.text.value.properties.title[0][1][1][1])
  expect(fixed.searchParams.get('id')).toBe(id)
  expect(fixed.searchParams.get('downloadName')).toBe('archive.zip')
  expect(fixed.href).not.toContain('expirationTimestamp')
  expect(result.block.text.value.properties.caption).toBe(original.block.text.value.properties.caption)
  expect(original.block.text.value.properties.title[0][1][1][1]).toBe(href)
})

test.each([
  `https://example.com/a.zip?table=block&id=${id}`,
  `${cdn}&table=page&id=${id}`,
  `${cdn}&table=block&id=unknown`,
  `${cdn}&table=block`
])('preserves pasted URLs without a verified Notion file record: %s', source => {
  expect(getStableNotionFileLink(source)).toBeNull()
})
