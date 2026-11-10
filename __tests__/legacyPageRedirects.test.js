/** @jest-environment node */

it('redirects the old about URL before the numeric pagination route matches', async () => {
  const config = require('../next.config')
  const redirects = await config.redirects()
  expect(redirects).toContainEqual({
    source: '/page/about',
    destination: '/about',
    permanent: true
  })
  expect(redirects.some(rule => rule.source === '/feed')).toBe(true)
})

it.each([
  ['/programming', `/${encodeURIComponent('其他页面')}/programming`],
  ['/skill/sr-paper', `/${encodeURIComponent('技术分享')}/sr-paper`],
  ['/skill/pytorch-ins', `/${encodeURIComponent('技术分享')}/pytorch-ins`]
])(
  'preserves the old published article link %s',
  async (source, destination) => {
    const redirects = await require('../next.config').redirects()
    expect(redirects).toContainEqual({ source, destination, permanent: true })
  }
)
