/**
 * Парсит локальные HTML таблиц листа достижений персонажей
 * и собирает character-sheets.json, сопоставляя ячейки с achievements.json.
 *
 *   node scripts/scrape-character-sheets.js
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const ACHIEVEMENTS_JSON = join(ROOT, 'public', 'data', 'achievements.json')
const OUT_JSON = join(ROOT, 'public', 'data', 'character-sheets.json')
const WIKI_ORIGIN = 'https://bindingofisaac.fandom.com'

const SOURCES = [
  {
    id: 'normal',
    title: 'Обычные',
    file: join(ROOT, 'Лист1.html'),
  },
  {
    id: 'tainted',
    title: 'Порченые',
    file: join(ROOT, 'Лист2.html'),
  },
]

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function absolutizeWikiHref(href) {
  if (!href) return null
  let url = href.replace(/&amp;/g, '&').trim()
  if (!url || url.startsWith('#')) return null
  if (url.startsWith('//')) url = `https:${url}`
  else if (url.startsWith('/')) url = `${WIKI_ORIGIN}${url}`
  try {
    return new URL(url).toString()
  } catch {
    return null
  }
}

function normalizeImageUrl(raw) {
  if (!raw) return null
  let url = raw.replace(/&amp;/g, '&').trim()
  if (!url || url.startsWith('data:')) return null
  if (url.startsWith('//')) url = `https:${url}`
  if (url.startsWith('/')) url = `${WIKI_ORIGIN}${url}`
  try {
    const u = new URL(url)
    u.pathname = u.pathname.replace(
      /\/revision\/latest\/scale-to-width-down\/\d+/,
      '/revision/latest',
    )
    if (u.hostname.includes('wikia.nocookie.net')) {
      u.searchParams.delete('cb')
      if (!u.searchParams.has('path-prefix')) {
        u.searchParams.set('path-prefix', 'ru')
      }
    }
    return u.toString()
  } catch {
    return null
  }
}

function wikiPathKey(href) {
  if (!href) return null
  try {
    const u = new URL(absolutizeWikiHref(href) || href, WIKI_ORIGIN)
    let path = decodeURIComponent(u.pathname)
    path = path.replace(/^\/ru\/wiki\//, '').replace(/^\/wiki\//, '')
    return path.split('#')[0] || null
  } catch {
    return null
  }
}

function parseCellMedia($, cell) {
  const $cell = $(cell)
  const link = $cell.find('a[href]').first()
  const img = $cell.find('img').first()
  const title =
    cleanText(link.attr('title') || '') ||
    cleanText($cell.find('figcaption').first().text()) ||
    cleanText(img.attr('alt') || '') ||
    cleanText($cell.text()) ||
    null
  const href = absolutizeWikiHref(link.attr('href'))
  const iconUrl = normalizeImageUrl(
    img.attr('data-src') || img.attr('src') || '',
  )
  const empty = !iconUrl && !href && !title
  return { title, href, iconUrl, pathKey: wikiPathKey(href), empty }
}

function isSummaryLabel(text) {
  if (!text) return false
  const t = text.toLowerCase().replace(/\s+/g, ' ')
  return t.includes('все') && (t.includes('обыч') || t.includes('порч'))
}

function normalizeSummaryLabel(text) {
  const t = cleanText(text).replace(/\s+/g, ' ')
  if (/все\s*обыч/i.test(t) && /порч/i.test(t)) return 'Все обыч.\nи порч.'
  if (/все\s*обыч/i.test(t)) return 'Все обычные'
  return t
}

function buildAchievementIndexes(achievements) {
  const byName = new Map()
  const byUnlockTitle = new Map()
  const byPath = new Map()

  for (const a of achievements) {
    if (a.nameRu) byName.set(a.nameRu.toLowerCase(), a)
    if (a.unlockTitleRu) byUnlockTitle.set(a.unlockTitleRu.toLowerCase(), a)
    const path = wikiPathKey(a.unlockUrlRu)
    if (path) byPath.set(path.toLowerCase(), a)
  }

  return { byName, byUnlockTitle, byPath }
}

function matchAchievement(indexes, { title, pathKey }) {
  if (title) {
    const key = title.toLowerCase()
    if (indexes.byName.has(key)) return indexes.byName.get(key)
    if (indexes.byUnlockTitle.has(key)) return indexes.byUnlockTitle.get(key)
  }
  if (pathKey) {
    const key = pathKey.toLowerCase()
    if (indexes.byPath.has(key)) return indexes.byPath.get(key)
  }
  return null
}

function parseHeaderColumns($, headerRow) {
  const columns = []
  $(headerRow)
    .children('th')
    .each((index, th) => {
      const $th = $(th)
      const links = $th.find('a[href]')
      const imgs = $th.find('img')

      // Составной заголовок (несколько боссов в одной колонке)
      if (links.length > 1 || (imgs.length > 1 && links.length >= 1)) {
        const parts = []
        links.each((_, a) => {
          const $a = $(a)
          const img = $a.find('img').first()
          parts.push({
            title: cleanText($a.attr('title') || img.attr('alt') || '') || null,
            href: absolutizeWikiHref($a.attr('href')),
            iconUrl: normalizeImageUrl(
              img.attr('data-src') || img.attr('src') || '',
            ),
          })
        })
        columns.push({
          index,
          kind: 'milestone-group',
          title: parts.map((p) => p.title).filter(Boolean).join(' / ') || null,
          parts,
          iconUrl: parts[0]?.iconUrl || null,
          href: null,
        })
        return
      }

      const media = parseCellMedia($, th)
      columns.push({
        index,
        kind: index === 0 ? 'character' : 'milestone',
        title: media.title,
        iconUrl: media.iconUrl,
        href: media.href,
      })
    })
  return columns
}

function parseSheet(html, sheetMeta, indexes) {
  const $ = cheerio.load(html)
  const table = $('table.tb-marktable, table.wikitable').first()
  if (!table.length) {
    throw new Error(`Нет таблицы в ${sheetMeta.file}`)
  }

  const rows = table.find('tr').toArray()
  if (rows.length < 2) {
    throw new Error(`Слишком мало строк в ${sheetMeta.file}`)
  }

  const columns = parseHeaderColumns($, rows[0])
  const characterRows = []
  let matched = 0
  let totalCells = 0

  for (let r = 1; r < rows.length; r++) {
    const cells = $(rows[r]).children('td').toArray()
    if (!cells.length) continue

    const characterMedia = parseCellMedia($, cells[0])
    const summary = isSummaryLabel(characterMedia.title)
    const characterAch = summary
      ? null
      : matchAchievement(indexes, characterMedia)

    const milestones = []
    for (let c = 1; c < cells.length; c++) {
      const media = parseCellMedia($, cells[c])
      if (media.empty) {
        milestones.push({
          columnIndex: c,
          empty: true,
          achievementId: null,
          nameRu: null,
          nameEn: null,
          iconUrl: null,
          wikiUrl: null,
          matched: false,
        })
        continue
      }

      totalCells++
      const ach = matchAchievement(indexes, media)
      if (ach) matched++
      milestones.push({
        columnIndex: c,
        empty: false,
        achievementId: ach?.id ?? null,
        nameRu: ach?.nameRu || media.title,
        nameEn: ach?.nameEn || null,
        iconUrl: media.iconUrl || (ach ? `achievements/${ach.id}.png` : null),
        wikiUrl: media.href || ach?.unlockUrlRu || null,
        matched: Boolean(ach),
      })
    }

    characterRows.push({
      character: {
        kind: summary ? 'summary' : 'character',
        nameRu: summary
          ? normalizeSummaryLabel(characterMedia.title)
          : characterMedia.title,
        iconUrl: summary ? null : characterMedia.iconUrl,
        wikiUrl: summary ? null : characterMedia.href,
        achievementId: characterAch?.id ?? null,
      },
      milestones,
    })
  }

  return {
    id: sheetMeta.id,
    title: sheetMeta.title,
    columns,
    rows: characterRows,
    stats: { matched, totalCells },
  }
}

async function main() {
  const achData = JSON.parse(await readFile(ACHIEVEMENTS_JSON, 'utf8'))
  const achievements = achData.achievements || []
  const indexes = buildAchievementIndexes(achievements)

  const sheets = []
  for (const src of SOURCES) {
    const html = await readFile(src.file, 'utf8')
    const sheet = parseSheet(html, src, indexes)
    sheets.push(sheet)
    console.log(
      `${sheet.title}: строк ${sheet.rows.length}, колонок ${sheet.columns.length}, ` +
        `совпадений ${sheet.stats.matched}/${sheet.stats.totalCells}`,
    )
  }

  const payload = {
    source: SOURCES.map((s) => s.file),
    scrapedAt: new Date().toISOString(),
    sheets,
  }

  await mkdir(dirname(OUT_JSON), { recursive: true })
  await writeFile(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')
  console.log(`\nJSON: ${OUT_JSON}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
