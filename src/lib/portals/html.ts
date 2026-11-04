// Small helpers for reading portal pages with plain string matching, so the
// readers also run in Node against saved pages (see logis.server.ts).

const NAMED_ENTITIES = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
  ['rsquo', '’'],
  ['lsquo', '‘'],
  ['rdquo', '”'],
  ['ldquo', '“'],
  ['ndash', '–'],
  ['mdash', '—'],
  ['middot', '·'],
  ['bull', '•'],
  ['hellip', '…'],
])

// Decodes named and numeric entities, then trims and collapses whitespace.
export function decodeHtmlText(text: string) {
  return text
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, name: string) => {
      if (name.startsWith('#')) {
        const code = name[1]?.toLowerCase() === 'x'
          ? Number.parseInt(name.slice(2), 16)
          : Number.parseInt(name.slice(1), 10)

        return Number.isFinite(code) ? String.fromCodePoint(code) : entity
      }

      return NAMED_ENTITIES.get(name.toLowerCase()) ?? entity
    })
    .replace(/\s+/g, ' ')
    .trim()
}

// An HTML fragment's text, one line per paragraph, list item or line break.
// List items are marked so callers can tell them apart.
export function htmlToLines(html: string) {
  const marked = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<li[^>]*>/gi, '\n•LI ')
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  return marked
    .split('\n')
    .map((line) => {
      const isListItem = line.trimStart().startsWith('•LI ')

      const text = decodeHtmlText(line.replace('•LI ', ''))
        // Word-pasted bullets, such as "·        The City’s…".
        .replace(/^[·•▪◦o]\s+(?=\S)/u, '')

      return { text, isListItem }
    })
    .filter((line) => line.text.length > 1)
}

// The links in an HTML fragment, with their text.
export function htmlLinks(html: string, baseUrl: string) {
  const links: Array<{ label: string; url: string }> = []

  for (const [, href = '', label = ''] of html.matchAll(
    /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      const url = new URL(decodeHtmlText(href), baseUrl)

      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue

      links.push({
        label: decodeHtmlText(label.replace(/<[^>]+>/g, '')) || url.hostname,
        url: url.toString(),
      })
    } catch {
      // Not a URL; skip it.
    }
  }

  return links
}
