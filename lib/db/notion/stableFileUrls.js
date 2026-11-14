import { convertFileCdnUrl } from './convertFileCdnUrl'

const FILE_TYPES = new Set(['file', 'pdf', 'audio', 'video'])
const NOTION_HOSTS = new Set(['notion.so', 'www.notion.so', 'notion.com', 'www.notion.com'])

/** Resolve only Notion uploads; external media and lookalike hosts stay intact. */
export function getStableNotionFileUrl(source, block) {
  if (typeof source !== 'string' || !block?.id) return null
  let url = source
  for (let depth = 0; depth < 3; depth++) {
    if (url.startsWith('attachment:')) break
    let parsed
    try { parsed = new URL(url) } catch { return null }
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    if (NOTION_HOSTS.has(parsed.hostname) && parsed.pathname.startsWith('/signed/')) {
      try { url = decodeURIComponent(parsed.pathname.slice('/signed/'.length)) } catch { return null }
      continue
    }
    const attachment = convertFileCdnUrl(url)
    if (attachment) {
      url = attachment
      break
    }
    if (
      parsed.hostname !== 'secure.notion-static.com' &&
      !/^prod-files-secure(?:-[a-z0-9]+)?\.s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/.test(parsed.hostname)
    ) return null
    // The signed entry must contain the permanent object path, not old AWS credentials.
    parsed.search = ''
    parsed.hash = ''
    url = parsed.toString()
    break
  }
  if (!url.startsWith('attachment:') && !/^https?:\/\/(?:secure\.notion-static\.com|prod-files-secure)/.test(url)) return null
  const params = new URLSearchParams({ table: 'block', id: block.id })
  if (block.space_id) params.set('spaceId', block.space_id)
  return `https://notion.so/signed/${encodeURIComponent(url)}?${params}`
}

/** Pasted links carry the upload's permission record, not the surrounding text ID. */
export function getStableNotionFileLink(source) {
  try {
    const url = new URL(source)
    const id = url.searchParams.get('id')
    if (!/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(id || '')) return null
    if (url.searchParams.get('table') !== 'block') return null
    const stable = getStableNotionFileUrl(source, { id, space_id: url.searchParams.get('spaceId') })
    if (!stable) return null
    const result = new URL(stable)
    if (url.searchParams.has('downloadName')) result.searchParams.set('downloadName', url.searchParams.get('downloadName'))
    return result.toString()
  } catch { return null }
}

function stableRichText(value) {
  if (!Array.isArray(value)) return value
  if (value[0] === 'a' && typeof value[1] === 'string') {
    const stable = getStableNotionFileLink(value[1])
    return stable && stable !== value[1] ? ['a', stable, ...value.slice(2)] : value
  }
  const mapped = value.map(stableRichText)
  return mapped.some((item, index) => item !== value[index]) ? mapped : value
}

/** Repair old ISR/prefetch payloads while preserving cached blocks and URL tables. */
export function withStableNotionFileUrls(recordMap) {
  if (!recordMap) return recordMap
  let signedUrls
  let blocks
  for (const [id, entry] of Object.entries(recordMap.block || {})) {
    const block = entry?.value?.value || entry?.value || entry
    if (!block) continue
    let properties
    for (const [key, value] of Object.entries(block.properties || {})) {
      const stable = stableRichText(value)
      if (stable === value) continue
      properties = properties || { ...block.properties }
      properties[key] = stable
    }
    if (properties) {
      blocks = blocks || { ...recordMap.block }
      const updated = { ...block, properties }
      blocks[id] = entry?.value?.value
        ? { ...entry, value: { ...entry.value, value: updated } }
        : entry?.value ? { ...entry, value: updated } : updated
    }
    if (!FILE_TYPES.has(block?.type)) continue
    const source = block.properties?.source?.[0]?.[0] || block.file?.url
    const stable = getStableNotionFileUrl(source, block) ||
      (!source ? getStableNotionFileUrl(recordMap.signed_urls?.[block.id], block) : null)
    if (!stable || stable === recordMap.signed_urls?.[block.id]) continue
    signedUrls = signedUrls || { ...recordMap.signed_urls }
    signedUrls[block.id] = stable
  }
  if (!signedUrls && !blocks) return recordMap
  return { ...recordMap, ...(signedUrls && { signed_urls: signedUrls }), ...(blocks && { block: blocks }) }
}
