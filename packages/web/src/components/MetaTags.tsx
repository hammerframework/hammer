import { Head } from '../index'

type RobotsParams =
  | 'noindex'
  | 'index'
  | 'follow'
  | 'nofollow'
  | 'none'
  | 'noarchive'
  | 'nocache'
  | 'nosnippet'
interface MetaTagsProps {
  /**
   * @description
   * og:image by default
   */
  tag?: `og:${string}`

  /**
   * @description
   * website by default. See https://ogp.me/#types
   */
  ogType?: string
  ogWidth?: string
  ogHeight?: string

  locale?: string

  /**
   * @description
   * Link to image/video to display when unfurled
   **/
  ogContentUrl?: string

  /**
   * @description
   * The url to link back to. This must be a canonical (absolute) URL.
   * Use `ogContentUrl` to set the actual image to be displayed
   **/
  ogUrl?: `${'http://' | 'https://'}${string}`
  contentType?: string

  /**
   * @description
   * String or array of strings to provide crawlers instructions for how to crawl or index web page content.
   **/
  robots?: RobotsParams | RobotsParams[]
  title?: string
  description?: string
  author?: string

  /**
   * @description
   * Any additional metatags
   */
  children?: React.ReactNode
}

/**
 * Add commonly used <meta> tags for unfurling/seo purposes
 * using the open graph protocol https://ogp.me/
 * @example
 * <MetaTags title="About Page" ogContentUrl="/static/about-og.png"/>
 */
export const MetaTags = (props: MetaTagsProps) => {
  const {
    tag = 'og:image',
    ogType = 'website',
    ogContentUrl,
    robots,
    contentType,
    ogWidth,
    ogHeight,
    ogUrl,
    title,
    locale,
    description,
    author,
    children,
  } = props

  return (
    <Head>
      {title && (
        <>
          <title>{title}</title>
          <meta property="og:title" content={title} key="title" />
          <meta property="twitter:title" content={title} />
        </>
      )}

      {description && (
        <>
          <meta property="description" content={description} />
          <meta property="og:description" content={description} />
          <meta property="twitter:image:alt" content={description} />
        </>
      )}

      {author && (
        <>
          <meta name="author" content={author} />
          <meta name="twitter:site" content={author} />
          <meta name="twitter:creator" content={author} />
        </>
      )}

      {ogUrl && <meta property="og:url" content={ogUrl} />}

      {/* en_US by default */}
      {locale && <meta property="og:locale" content={locale} />}

      <meta property="og:type" content={ogType} />
      <meta property={tag} content={ogContentUrl} />
      {contentType && <meta property={`${tag}:type`} content={contentType} />}

      {tag === 'og:image' && (
        <>
          {ogWidth && <meta property="image:width" content={ogWidth} />}
          {ogHeight && <meta property="image:height" content={ogHeight} />}
          <meta property="twitter:card" content="summary_large_image" />
          <meta property="twitter:image" content={ogContentUrl} />
        </>
      )}

      {robots && (
        <meta
          name="robots"
          content={Array.isArray(robots) ? robots.join(', ') : robots}
        />
      )}

      {children}
    </Head>
  )
}
