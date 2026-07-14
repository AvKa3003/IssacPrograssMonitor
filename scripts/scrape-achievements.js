/**
 * Парсер достижений с русской вики Binding of Isaac.
 *
 * Данные → public/data/achievements.json
 * Иконки → public/achievements/{id}.png
 *
 * Примеры:
 *   node scripts/scrape-achievements.js
 *   node scripts/scrape-achievements.js --local "./Достижения.html"
 *   node scripts/scrape-achievements.js --skip-images
 *
 * По умолчанию тянет HTML через MediaWiki API (HTML-страница у Fandom часто 403).
 */

import { createWriteStream } from 'node:fs'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_JSON = join(ROOT, 'public', 'data', 'achievements.json')
const OUT_ICONS = join(ROOT, 'public', 'achievements')

const WIKI_ORIGIN = 'https://bindingofisaac.fandom.com'
const WIKI_URL = `${WIKI_ORIGIN}/ru/wiki/%D0%94%D0%BE%D1%81%D1%82%D0%B8%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F`
const API = `${WIKI_ORIGIN}/ru/api.php`

const WIKI_PARSE_API =
  `${API}?` +
  new URLSearchParams({
    action: 'parse',
    page: 'Достижения',
    prop: 'text',
    format: 'json',
    formatversion: '2',
  }).toString()

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/json,text/html;q=0.9,image/avif,image/webp,image/*,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: WIKI_URL,
}

const args = new Set(process.argv.slice(2))
const skipImages = args.has('--skip-images')
const localIdx = process.argv.indexOf('--local')
const localPath =
  localIdx !== -1 ? process.argv[localIdx + 1] : null

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

/** Относительный /wiki/... → абсолютный URL */
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

/**
 * Ссылка на открываемый контент — <a> вокруг иконки в столбце «Иконка».
 */
function parseUnlockLink($, iconCell) {
  const link = iconCell.find('a[href]').first()
  if (!link.length) {
    return { unlockUrlRu: null, unlockTitleRu: null }
  }

  const unlockUrlRu = absolutizeWikiHref(link.attr('href'))
  const unlockTitleRu =
    cleanText(link.attr('title') || '') ||
    cleanText(link.find('img').attr('alt') || '') ||
    cleanText(link.text()) ||
    null

  return { unlockUrlRu, unlockTitleRu }
}

/**
 * Условие открытия: текст, ссылки и картинки (как на вики: img внутри <a>).
 */
function serializeCondition($, cell) {
  const clone = $(cell).clone()

  clone.find('br').replaceWith(' ')
  clone.find('script, style, noscript').remove()

  clone.find('img').each((_, el) => {
    const $img = $(el)
    const src = normalizeImageUrl(
      $img.attr('data-src') || $img.attr('src') || '',
    )
    if (!src) {
      $img.remove()
      return
    }
    const alt = $img.attr('alt') || ''
    for (const { name } of [...el.attributes]) {
      $img.removeAttr(name)
    }
    $img.attr('src', src)
    if (alt) $img.attr('alt', alt)
    $img.attr('loading', 'lazy')
    $img.attr('referrerpolicy', 'no-referrer')
    $img.attr('class', 'condition-icon')
  })

  clone.find('a[href]').each((_, el) => {
    const $a = $(el)
    const href = absolutizeWikiHref($a.attr('href'))
    if (href) $a.attr('href', href)
    $a.attr('target', '_blank')
    $a.attr('rel', 'noopener noreferrer')
    const title = $a.attr('title')
    ;['class', 'id', 'style', 'data-tracking-label'].forEach((attr) =>
      $a.removeAttr(attr),
    )
    if (title) $a.attr('title', title)
  })

  // снимаем обёртки вики, содержимое (в т.ч. a>img) оставляем
  clone.find('span, small, i, em, b, strong, sup, sub').each((_, el) => {
    $(el).replaceWith($(el).html() || $(el).text())
  })

  const html = (clone.html() || '').replace(/\s+/g, ' ').trim()
  const text = cleanText(clone.text())
  return { text, html }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Имя файла на вики: "Achievement_magdalene.png" */
function extractFileName(img) {
  const key =
    img.attr('data-image-key') ||
    img.attr('data-image-name') ||
    ''
  if (key) {
    try {
      return decodeURIComponent(key.replace(/ /g, '_'))
    } catch {
      return key.replace(/ /g, '_')
    }
  }

  const raw = img.attr('data-src') || img.attr('src') || ''
  const match = raw.match(
    /\/([^/?#]+\.(?:png|jpe?g|gif|webp))(?:\/revision\/|\?|$)/i,
  )
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Нормализует прямой URL картинки.
 * Важно: для русской вики нужен path-prefix=ru, иначе часто 404.
 */
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
    // thumb/.../64px-Name.png → лучше не трогать, path-prefix всё равно нужен
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

function extensionFromName(name) {
  const ext = extname(name || '').toLowerCase()
  return ext || '.png'
}

async function loadHtml() {
  if (localPath) {
    const { readFile } = await import('node:fs/promises')
    console.log(`Читаю локальный файл: ${localPath}`)
    return readFile(localPath, 'utf8')
  }

  console.log(`Загружаю через MediaWiki API:\n  ${WIKI_PARSE_API}`)
  const res = await fetch(WIKI_PARSE_API, { headers: BROWSER_HEADERS })
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} при загрузке вики.\n` +
        `Сохрани страницу вручную и запусти:\n` +
        `  node scripts/scrape-achievements.js --local "./Достижения.html"`,
    )
  }

  const data = await res.json()
  if (data.error) {
    throw new Error(`API error: ${data.error.info || JSON.stringify(data.error)}`)
  }

  const html = data?.parse?.text
  if (!html || typeof html !== 'string') {
    throw new Error('API не вернул HTML страницы')
  }
  return html
}

function isAchievementTable($, table) {
  const headers = $(table)
    .find('thead th, tr:first-child th')
    .map((_, el) => cleanText($(el).text()).toLowerCase())
    .get()

  return (
    headers.some((h) => h.includes('номер')) &&
    headers.some((h) => h.includes('иконка') || h.includes('название'))
  )
}

function parseRow($, row) {
  const cells = $(row).children('td')
  if (cells.length < 4) return null

  const idText = cleanText($(cells[0]).text())
  const id = Number.parseInt(idText, 10)
  if (!Number.isFinite(id)) return null

  const iconCell = $(cells[1])
  const img = iconCell.find('img').first()
  const fileName = extractFileName(img)
  const imageUrl = normalizeImageUrl(
    img.attr('data-src') || img.attr('src') || '',
  )
  const { unlockUrlRu, unlockTitleRu } = parseUnlockLink($, iconCell)

  const nameCell = $(cells[2])
  // На русской странице EN-название уже есть в <small><i>...</i></small>
  const nameRu =
    cleanText(nameCell.find('a').first().text()) ||
    cleanText(nameCell.clone().children('small, br').remove().end().text())

  const nameEn = cleanText(
    nameCell.find('small i, small em, i, em').first().text(),
  ) || null

  const { text: conditionRu, html: conditionHtmlRu } = serializeCondition(
    $,
    cells[3],
  )

  return {
    id,
    nameRu,
    nameEn,
    // EN-описание / EN-ссылка unlock — отдельным скрапом англ. вики позже
    conditionRu,
    conditionHtmlRu,
    conditionEn: null,
    conditionHtmlEn: null,
    unlockUrlRu,
    unlockTitleRu,
    unlockUrlEn: null,
    unlockTitleEn: null,
    fileName,
    imageUrl,
  }
}

function parseAchievements(html) {
  const $ = cheerio.load(html)
  const byId = new Map()

  $('table.wikitable, table.sortable').each((_, table) => {
    if (!isAchievementTable($, table)) return

    $(table)
      .find('tbody tr')
      .each((_, row) => {
        const parsed = parseRow($, row)
        if (!parsed) return
        if (byId.has(parsed.id)) {
          console.warn(`Дубликат id=${parsed.id}, оставляю первое значение`)
          return
        }
        byId.set(parsed.id, parsed)
      })
  })

  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** Резолв File:Name → прямой URL через imageinfo API */
async function resolveFileUrls(fileNames) {
  const unique = [...new Set(fileNames.filter(Boolean))]
  const map = new Map()
  const chunkSize = 40

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const titles = chunk.map((n) => `File:${n.replace(/_/g, ' ')}`).join('|')
    const url =
      `${API}?` +
      new URLSearchParams({
        action: 'query',
        titles,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
        formatversion: '2',
      }).toString()

    const res = await fetch(url, { headers: BROWSER_HEADERS })
    if (!res.ok) {
      console.warn(`  imageinfo HTTP ${res.status} для пакета ${i / chunkSize + 1}`)
      continue
    }

    const data = await res.json()
    for (const page of data?.query?.pages || []) {
      const rawTitle = (page.title || '').replace(/^File:/i, '')
      const key = rawTitle.replace(/ /g, '_')
      const infoUrl = page.imageinfo?.[0]?.url
      if (infoUrl) {
        map.set(key, normalizeImageUrl(infoUrl) || infoUrl)
        map.set(rawTitle, normalizeImageUrl(infoUrl) || infoUrl)
      }
    }

    await sleep(120)
  }

  return map
}

async function downloadImage(url, destPath) {
  try {
    await access(destPath)
    return { skipped: true }
  } catch {
    /* нет файла — качаем */
  }

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${url})`)
  }

  const type = res.headers.get('content-type') || ''
  if (type.includes('text/html')) {
    throw new Error(`получили HTML вместо картинки (${url})`)
  }

  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
  return { skipped: false }
}

async function downloadWithFallbacks(row, destPath, resolvedUrls) {
  const candidates = []

  if (row.fileName) {
    const fromApi =
      resolvedUrls.get(row.fileName) ||
      resolvedUrls.get(row.fileName.replace(/_/g, ' '))
    if (fromApi) candidates.push(fromApi)

    candidates.push(
      `${WIKI_ORIGIN}/ru/wiki/Special:FilePath/${encodeURIComponent(row.fileName)}`,
    )
  }

  if (row.imageUrl) candidates.push(row.imageUrl)

  let lastError = null
  const tried = new Set()

  for (const url of candidates) {
    if (!url || tried.has(url)) continue
    tried.add(url)
    try {
      return await downloadImage(url, destPath)
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('нет URL для скачивания')
}

async function main() {
  const html = await loadHtml()
  const rows = parseAchievements(html)

  if (rows.length === 0) {
    throw new Error('Не найдено ни одного достижения в таблицах')
  }

  console.log(`Найдено достижений: ${rows.length}`)

  await mkdir(OUT_ICONS, { recursive: true })
  await mkdir(dirname(OUT_JSON), { recursive: true })

  let resolvedUrls = new Map()
  if (!skipImages) {
    console.log('Резолвлю URL иконок через imageinfo…')
    resolvedUrls = await resolveFileUrls(rows.map((r) => r.fileName))
    console.log(`  получено URL: ${resolvedUrls.size}`)
  }

  const achievements = []
  let downloaded = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    const ext = extensionFromName(row.fileName || row.imageUrl)
    const fileName = `${row.id}${ext}`
    const iconRel = `achievements/${fileName}`
    const iconAbs = join(OUT_ICONS, fileName)

    if (!skipImages) {
      try {
        const result = await downloadWithFallbacks(row, iconAbs, resolvedUrls)
        if (result.skipped) skipped++
        else {
          downloaded++
          console.log(`  ok ${fileName}`)
          await sleep(60)
        }
      } catch (err) {
        failed++
        console.warn(`  err ${fileName}: ${err.message}`)
      }
    }

    achievements.push({
      id: row.id,
      nameRu: row.nameRu,
      nameEn: row.nameEn,
      conditionRu: row.conditionRu,
      conditionHtmlRu: row.conditionHtmlRu,
      conditionEn: row.conditionEn,
      conditionHtmlEn: row.conditionHtmlEn,
      unlockUrlRu: row.unlockUrlRu,
      unlockTitleRu: row.unlockTitleRu,
      unlockUrlEn: row.unlockUrlEn,
      unlockTitleEn: row.unlockTitleEn,
      icon: iconRel,
      wikiFile: row.fileName || null,
    })
  }

  const payload = {
    source: localPath || WIKI_URL,
    scrapedAt: new Date().toISOString(),
    count: achievements.length,
    achievements,
  }

  await writeFile(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')

  console.log('\nГотово.')
  console.log(`  JSON:   ${OUT_JSON}`)
  console.log(`  Иконки: ${OUT_ICONS}`)
  if (!skipImages) {
    console.log(
      `  Скачано: ${downloaded}, уже были: ${skipped}, ошибок: ${failed}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
