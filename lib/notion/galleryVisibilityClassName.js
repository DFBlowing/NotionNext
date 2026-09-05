export function galleryVisibilityClassName(collectionView) {
  if (collectionView?.type !== 'gallery') return ''

  const {
    gallery_properties,
    gallery_title_visible,
    show_page_icon,
    gallery_cover_size
  } = collectionView.format || {}
  const titleProperty = gallery_properties?.find(
    property => property.property === 'title'
  )

  // 根据gallery_cover_size设置列数类名
  const sizeClass = gallery_cover_size === 'small'
    ? 'notion-gallery-grid-size-small'
    : gallery_cover_size === 'large'
    ? 'notion-gallery-grid-size-large'
    : 'notion-gallery-grid-size-medium'

  return [
    sizeClass,
    (show_page_icon === false ||
      (show_page_icon == null && gallery_title_visible == null)) &&
      'notion-gallery-hide-page-icons',
    (titleProperty
      ? titleProperty.visible === false
      : gallery_title_visible === false) && 'notion-gallery-hide-titles'
  ]
    .filter(Boolean)
    .join(' ')
}
