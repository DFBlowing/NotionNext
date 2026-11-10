import BLOG from '@/blog.config'
import { getOrSetDataWithCache } from '@/lib/cache/cache_manager'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { getPriorityPages, prefetchAllBlockMaps } from '@/lib/build/prefetch'
import { isExport } from '@/lib/utils/buildMode'

const inProcessAllPagesPromises = new Map()

function getStaticPathsCacheKey({ pageId = BLOG.NOTION_PAGE_ID, locale }) {
  const safePageId = String(pageId || BLOG.NOTION_PAGE_ID).replace(
    /[^a-z0-9,_:-]/gi,
    '_'
  )
  const safeLocale = String(locale || 'default').replace(/[^a-z0-9_-]/gi, '_')
  return `build_static_paths_all_pages_${safeLocale}_${safePageId}`
}

export function getSharedAllPages({
  from = 'slug-paths',
  pageId = BLOG.NOTION_PAGE_ID,
  locale
} = {}) {
  const cacheKey = getStaticPathsCacheKey({ pageId, locale })

  if (!inProcessAllPagesPromises.has(cacheKey)) {
    const promise = getOrSetDataWithCache(cacheKey, async () => {
      const { allPages = [] } = await fetchGlobalAllData({
        pageId,
        from,
        locale
      })
      return Array.isArray(allPages) ? allPages : []
    })
    promise.catch(() => {
      inProcessAllPagesPromises.delete(cacheKey)
    })
    inProcessAllPagesPromises.set(cacheKey, promise)
  }

  return inProcessAllPagesPromises.get(cacheKey)
}

export async function getStaticPathsBase({
  filterFn = () => true,
  mapPageToParams,
  from = 'slug-paths',
  pageId = BLOG.NOTION_PAGE_ID,
  locale,
  includePageIds = false
}) {
  const allPages = await getSharedAllPages({ from, pageId, locale })

  if (isExport()) {
    await prefetchAllBlockMaps(allPages.filter(page => !page.password))
    return {
      paths: allPages.filter(filterFn).map(mapPageToParams),
      fallback: false
    }
  }

  const generateAll = BLOG.PRE_RENDER_ALL_PUBLISHED === true
  const priorityPages = generateAll
    ? allPages.filter(
        page =>
          ['Page', 'Post'].includes(page.type) && page.status === 'Published'
      )
    : getPriorityPages(allPages) || []
  const idPages =
    generateAll && includePageIds
      ? priorityPages
          .filter(
            page =>
              !page.password &&
              page.href?.startsWith('/') &&
              !page.href.startsWith('//') &&
              /^[a-f\d-]{32,36}$/i.test(page.id || '')
          )
          .map(page => ({ ...page, slug: page.id.replace(/-/g, '') }))
      : []
  const paths = [...priorityPages, ...idPages]
    .filter(filterFn)
    .map(mapPageToParams)
  const seen = new Set()
  return {
    paths: paths.filter(path => {
      const key = JSON.stringify(path)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
    fallback: 'blocking'
  }
}
