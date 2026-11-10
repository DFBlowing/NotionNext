/** @jest-environment node */
import { resolvePublishedPageIdRedirect } from '@/lib/server/pageIdRedirect'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { validateHeaderValue } from 'http'

jest.mock('@/lib/db/SiteDataApi', () => ({ fetchGlobalAllData: jest.fn() }))
const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const page = { id, type: 'Page', status: 'Published', href: '/learning/long' }

it.each([id, id.replace(/-/g, '')])(
  'redirects a published ID without loading its body: %s',
  async pageId => {
    fetchGlobalAllData.mockResolvedValue({ allPages: [page] })
    expect(
      await resolvePublishedPageIdRedirect({ pageId, locale: 'zh-CN' })
    ).toEqual({
      redirect: { destination: '/learning/long', permanent: false },
      revalidate: 60
    })
  }
)

it('leaves normal slugs on the existing article resolver', async () => {
  expect(await resolvePublishedPageIdRedirect({ pageId: 'about' })).toBeNull()
  expect(fetchGlobalAllData).not.toHaveBeenCalled()
})

it.each([
  { status: 'Draft' },
  { status: 'Invisible' },
  { password: 'protected' },
  { type: 'Menu' },
  { href: '//untrusted.invalid' },
  { href: '/\\untrusted.invalid' },
  { href: 'https://untrusted.invalid' },
  { href: `/${id.replace(/-/g, '')}` }
])(
  'does not create a redirect for an ineligible page or a redirect loop: %j',
  async patch => {
    fetchGlobalAllData.mockResolvedValue({ allPages: [{ ...page, ...patch }] })
    expect(await resolvePublishedPageIdRedirect({ pageId: id })).toBeNull()
  }
)

it('does not turn an unavailable database into a cached redirect', async () => {
  fetchGlobalAllData.mockRejectedValue(new Error('temporarily unavailable'))
  await expect(resolvePublishedPageIdRedirect({ pageId: id })).rejects.toThrow(
    'temporarily unavailable'
  )
})

it.each([
  '/技术分享/sr-paper',
  '/%E6%8A%80%E6%9C%AF%E5%88%86%E4%BA%AB/pytorch-ins'
])(
  'returns a valid HTTP Location for the canonical path %s without double encoding',
  async href => {
    fetchGlobalAllData.mockResolvedValue({ allPages: [{ ...page, href }] })
    const result = await resolvePublishedPageIdRedirect({ pageId: id })
    expect(() =>
      validateHeaderValue('Location', result.redirect.destination)
    ).not.toThrow()
    expect(result.redirect.destination).toBe(
      new URL(href, 'https://site.invalid').pathname
    )
  }
)
