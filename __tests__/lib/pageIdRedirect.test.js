/** @jest-environment node */
import { resolvePublishedPageIdRedirect } from '@/lib/server/pageIdRedirect'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'

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
