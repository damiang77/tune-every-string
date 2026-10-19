import { useEffect } from 'react'
import { brand } from '../config/brand'
import { getI18n, type Locale } from '../i18n/i18n'

export function RouteMetadata({
  locale,
  privacy,
}: {
  locale: Locale
  privacy: boolean
}) {
  useEffect(() => {
    const i18n = getI18n(locale)
    document.documentElement.lang = locale
    document.title = `${brand.name} | ${i18n.t(privacy ? 'privacy.title' : 'meta.title')}`
    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.append(description)
    }
    description.content = i18n.t(
      privacy ? 'privacy.description' : 'meta.description',
    )
    const paths = privacy
      ? { en: '/privacy', pl: '/pl/prywatnosc' }
      : { en: '/', pl: '/pl' }
    document
      .querySelectorAll('link[data-route-metadata]')
      .forEach((link) => link.remove())
    for (const language of [locale, 'en', 'pl', 'x-default'] as const) {
      const link = document.createElement('link')
      link.dataset.routeMetadata = ''
      link.rel =
        language === locale && !document.querySelector('link[rel="canonical"]')
          ? 'canonical'
          : 'alternate'
      if (link.rel === 'alternate') link.hreflang = language
      link.href = new URL(
        paths[language === 'x-default' ? 'en' : language],
        window.location.origin,
      ).href
      document.head.append(link)
    }
  }, [locale, privacy])
  return null
}
