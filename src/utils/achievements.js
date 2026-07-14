/**
 * Fandom/Wikia режет картинки по Referer с чужих сайтов.
 * Без referrer картинки открываются.
 */
export function allowFandomImages(html) {
  if (!html) return html
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    if (/\breferrerpolicy\s*=/i.test(attrs)) return full
    return `<img referrerpolicy="no-referrer"${attrs}>`
  })
}

/**
 * Собирает список достижений для сетки / карточек.
 * @param {boolean[]} achievements
 * @param {Record<number, object>} metaById
 * @param {{ onlyLocked?: boolean, baseUrl?: string }} options
 */
export function buildAchievementItems(
  achievements,
  metaById = {},
  { onlyLocked = false, baseUrl = '/' } = {},
) {
  const items = []
  for (let i = 0; i < achievements.length; i++) {
    const unlocked = achievements[i]
    if (onlyLocked && unlocked) continue
    const id = i + 1
    const meta = metaById[id] || {}
    const rawHtml = meta.conditionHtmlRu || meta.conditionHtml || null
    items.push({
      id,
      unlocked,
      nameRu: meta.nameRu || null,
      nameEn: meta.nameEn || null,
      condition: meta.conditionRu || meta.condition || null,
      conditionHtml: allowFandomImages(rawHtml),
      unlockUrl: meta.unlockUrlRu || meta.unlockUrlEn || null,
      unlockTitle: meta.unlockTitleRu || meta.unlockTitleEn || null,
      icon: meta.icon ? `${baseUrl}${meta.icon}` : null,
    })
  }
  return items
}
