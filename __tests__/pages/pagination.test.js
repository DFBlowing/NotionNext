/** @jest-environment node */

import { getStaticProps } from '@/pages/page/[page]'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'

jest.mock('@/blog.config', () => ({ THEME: 'hexo' }))
jest.mock('@/lib/config', () => ({
  siteConfig: (key, fallback) =>
    ({ POSTS_PER_PAGE: 6, POST_LIST_PREVIEW: false })[key] ?? fallback
}))
jest.mock('@/lib/db/SiteDataApi', () => ({
  fetchGlobalAllData: jest.fn(),
  getPostBlocks: jest.fn()
}))
jest.mock('@/lib/db/notion/getPostBlocks', () => ({
  formatNotionBlock: jest.fn()
}))
jest.mock('@/lib/utils/notion.util', () => ({
  adapterNotionBlockMap: jest.fn()
}))
jest.mock('@/themes/theme', () => ({ DynamicLayout: () => null }))

beforeEach(() => {
  fetchGlobalAllData.mockResolvedValue({
    allPages: Array.from({ length: 13 }, (_, i) => ({
      id: String(i),
      type: 'Post',
      status: 'Published'
    })),
    NOTION_CONFIG: {}
  })
})

it.each(['about', 'NaN', '0', '-1', '2.5', '2oops'])(
  'does not render an empty article list for invalid page %s',
  async page => {
    expect(await getStaticProps({ params: { page }, locale: 'zh-CN' })).toEqual(
      {
        notFound: true
      }
    )
    expect(fetchGlobalAllData).not.toHaveBeenCalled()
  }
)

it('keeps numeric pagination working after rejecting page slugs', async () => {
  const allPages = Array.from({ length: 13 }, (_, i) => ({
    id: String(i),
    type: 'Post',
    status: 'Published'
  }))
  fetchGlobalAllData.mockResolvedValue({ allPages, NOTION_CONFIG: {} })
  const result = await getStaticProps({
    params: { page: '2' },
    locale: 'zh-CN'
  })
  expect(result.props.posts.map(post => post.id)).toEqual([
    '6',
    '7',
    '8',
    '9',
    '10',
    '11'
  ])
  expect(result.props.allPages).toBeUndefined()
})

it('returns 404 for pagination beyond the available articles', async () => {
  fetchGlobalAllData.mockResolvedValue({ allPages: [], NOTION_CONFIG: {} })
  expect(
    await getStaticProps({ params: { page: '99' }, locale: 'zh-CN' })
  ).toEqual({
    notFound: true
  })
})
