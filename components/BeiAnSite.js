import { siteConfig } from '@/lib/config'

/**
 * 站点域名备案
 * @returns
 */
export default function BeiAnSite({ className } = {}) {
  const beian = siteConfig('BEI_AN')
  const beianLink = siteConfig('BEI_AN_LINK')
  if (!beian) {
    return null
  }
  return (
    <span className={className}>
      <i className='fas fa-shield-alt' />
      <a href={beianLink} className='mx-1'>
        {beian}
      </a>
      <br />
    </span>
  )
}
