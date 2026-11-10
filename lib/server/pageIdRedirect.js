import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'

export async function resolvePublishedPageIdRedirect({ pageId, locale }) {
  if (
    !/^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(
      pageId || ''
    )
  ) {
    return null
  }
  const normalize = id =>
    String(id || '')
      .replace(/-/g, '')
      .toLowerCase()
  const { allPages = [] } = await fetchGlobalAllData({
    from: 'page-id-redirect',
    locale,
    requireAvailableData: true
  })
  const page = allPages.find(
    row =>
      normalize(row.id) === normalize(pageId) &&
      ['Page', 'Post'].includes(row.type) &&
      row.status === 'Published' &&
      !row.password
  )
  const destination = page?.href
  if (
    !destination?.startsWith('/') ||
    destination.startsWith('//') ||
    normalize(destination.replace(/^\/+|\/+$/g, '')) === normalize(pageId)
  ) {
    return null
  }
  return { redirect: { destination, permanent: false }, revalidate: 60 }
}
