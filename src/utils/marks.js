/**
 * Индексы меток в сейве (порядок файла, не колонок вики).
 * 0 Heart, 1 Isaac, 2 Satan, 3 BossRush, 4 ???, 5 Lamb,
 * 6 MegaSatan, 7 Greed, 8 Hush, 9 Delirium, 10 Mother, 11 Beast
 */

/** @typedef {'none' | 'normal' | 'hard'} MarkLevel */

/** Solo-часть битовой маски метки */
export function soloLevel(raw) {
  const s = (raw ?? 0) & 0b11
  if (s === 0) return 0
  if (s === 1) return 1
  return 2 // 2 или 3 = hard
}

export function isDone(raw) {
  return soloLevel(raw) >= 1
}

export function isHard(raw) {
  return soloLevel(raw) >= 2
}

/** @returns {MarkLevel} */
export function markLevel(raw) {
  const s = soloLevel(raw)
  if (s >= 2) return 'hard'
  if (s >= 1) return 'normal'
  return 'none'
}

/**
 * Агрегат по нескольким меткам: hard если все hard, иначе normal если все done.
 * @param {number[]} raws
 * @returns {MarkLevel}
 */
export function aggregateLevel(raws) {
  if (!raws.length) return 'none'
  if (raws.every(isHard)) return 'hard'
  if (raws.every(isDone)) return 'normal'
  return 'none'
}

export const CHAR_INDEX_BY_NAME = {
  Исаак: 0,
  Магдалина: 1,
  Каин: 2,
  Иуда: 3,
  '???': 4,
  Ева: 5,
  Самсон: 6,
  Азазель: 7,
  Лазарь: 8,
  Эдем: 9,
  Потерянный: 10,
  Лилит: 11,
  Хранитель: 12,
  Аполлион: 13,
  Забытый: 14,
  Вифания: 15,
  'Иаков и Исав': 16,
  'Порченый Исаак': 17,
  'Порченая Магдалина': 18,
  'Порченый Каин': 19,
  'Порченый Иуда': 20,
  'Порченый ???': 21,
  'Порченая Ева': 22,
  'Порченый Самсон': 23,
  'Порченый Азазель': 24,
  'Порченый Лазарь': 25,
  'Порченый Эдем': 26,
  'Порченый Потерянный': 27,
  'Порченая Лилит': 28,
  'Порченый Хранитель': 29,
  'Порченый Аполлион': 30,
  'Порченый Забытый': 31,
  'Порченая Вифания': 32,
  'Порченый Иаков': 33,
}

/**
 * Описание колонки листа → метки сейва.
 * @typedef {{ marks: number[], mode?: 'default' | 'greed' | 'greedier' | 'full' }} ColumnMarks
 */

/** Обычные: колонка листа (1-based data) → метки */
const NORMAL_COLUMN_MARKS = {
  1: { marks: [0] }, // Heart
  2: { marks: [3] }, // Boss Rush
  3: { marks: [8] }, // Hush
  4: { marks: [1] }, // Isaac
  5: { marks: [4] }, // ???
  6: { marks: [2] }, // Satan
  7: { marks: [5] }, // Lamb
  8: { marks: [6] }, // Mega
  9: { marks: [9] }, // Delirium
  10: { marks: [10] }, // Mother
  11: { marks: [11] }, // Beast
  12: { marks: [7], mode: 'greed' }, // Ultra Greed
  13: { marks: [7], mode: 'greedier' }, // Greedier
  14: { marks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], mode: 'full' },
}

/**
 * Порченые: визуальный порядок галочек как в шапке.
 * Heart — отдельная галочка перед группами (на вики-листе колонки нет,
 * но метка нужна для Death Certificate / полного hard-листа).
 * Группа 4: Isaac, ???, Satan, Lamb
 * Группа 2: Boss Rush, Hush
 */
export const TAINTED_HEART_MARK = 0

/** Иконка Mom's Heart / It Lives для шапки галочки порченых */
export const TAINTED_HEART_ICON = {
  title: 'Оно Живое',
  iconUrl:
    'https://static.wikia.nocookie.net/bindingofisaac/images/3/3c/Blist1x.png/revision/latest?path-prefix=ru',
}

const TAINTED_COLUMN_MARKS = {
  1: { marks: [1, 4, 2, 5] },
  2: { marks: [3, 8] },
  3: { marks: [6] },
  4: { marks: [9] },
  5: { marks: [10] },
  6: { marks: [11] },
  7: { marks: [7], mode: 'greed-tainted' },
}

/**
 * @param {'normal' | 'tainted'} sheetId
 * @param {number} columnIndex
 * @returns {ColumnMarks | null}
 */
export function columnMarkSpec(sheetId, columnIndex) {
  const map = sheetId === 'tainted' ? TAINTED_COLUMN_MARKS : NORMAL_COLUMN_MARKS
  return map[columnIndex] || null
}

/**
 * Нужны ли отдельные галочки перед иконкой (группа > 1).
 * @param {ColumnMarks | null} spec
 */
export function hasTickRow(spec) {
  return Boolean(spec && spec.marks.length > 1 && !spec.mode)
}

/**
 * Уровень рамки ячейки (не трогать логику half/full).
 * @param {number[]} charMarks marks[12]
 * @param {ColumnMarks} spec
 * @returns {MarkLevel}
 */
export function resolveCellLevel(charMarks, spec) {
  const raws = spec.marks.map((i) => charMarks[i] ?? 0)
  const mode = spec.mode || 'default'

  if (mode === 'greed') {
    // обычные: Greed-колонка без половинок — done или нет
    return isDone(raws[0]) ? 'hard' : 'none'
  }
  if (mode === 'greedier') {
    return isHard(raws[0]) ? 'hard' : 'none'
  }
  if (mode === 'greed-tainted') {
    if (isHard(raws[0])) return 'hard'
    if (isDone(raws[0])) return 'normal'
    return 'none'
  }
  if (mode === 'full') {
    if (raws.every(isHard)) return 'hard'
    if (raws.every(isDone)) return 'normal'
    return 'none'
  }

  return aggregateLevel(raws)
}

/**
 * Выполнено ли условие ачивки для ячейки (видимость иконки).
 * Heart → hard; остальные метки → normal; greed/greedier — свои колонки;
 * full (все метки персонажа) → hard.
 * @param {number[]} charMarks
 * @param {ColumnMarks} spec
 */
export function isCellUnlockMet(charMarks, spec) {
  const raws = spec.marks.map((i) => charMarks[i] ?? 0)
  const mode = spec.mode || 'default'

  if (mode === 'greed') return isDone(raws[0])
  if (mode === 'greedier') return isHard(raws[0])
  // Порченые: в колонке иконка Greedier → ачивка за Greedier (hard)
  if (mode === 'greed-tainted') return isHard(raws[0])
  if (mode === 'full') return raws.every(isHard)

  // Heart (единственная метка index 0) — ачивка за hard; остальное — normal
  if (spec.marks.length === 1 && spec.marks[0] === 0) {
    return isHard(raws[0])
  }
  return raws.every(isDone)
}

/**
 * Диапазон персонажей для итоговых строк листа.
 * @param {string} nameRu
 * @returns {{ from: number, to: number } | null}
 */
export function summaryCharRange(nameRu) {
  const n = (nameRu || '').toLowerCase().replace(/\s+/g, ' ')
  if (n.includes('порч')) return { from: 0, to: 33 } // все 34
  if (n.includes('обыч')) return { from: 0, to: 16 } // 17 обычных
  return null
}

/**
 * Уровень рамки summary-строки (half/full). Не менять.
 * @param {number[][] | null} checklist
 * @param {string} nameRu
 * @param {number} columnIndex
 * @returns {MarkLevel}
 */
export function resolveSummaryCellLevel(checklist, nameRu, columnIndex) {
  if (!checklist) return 'none'
  const range = summaryCharRange(nameRu)
  if (!range) return 'none'

  const chars = checklist.slice(range.from, range.to + 1)
  if (!chars.length) return 'none'

  // Колонка Mega Satan («Мега» / Mega Blast за всех обычных)
  if (columnIndex === 8 && range.to === 16) {
    if (chars.every((m) => isHard(m[6]))) return 'hard'
    if (chars.every((m) => isDone(m[6]))) return 'normal'
    return 'none'
  }

  // FullMarks: Мегагриб (обычные) / Свидетельство (все)
  if (columnIndex === 14) {
    if (chars.every((m) => m.every(isHard))) return 'hard'
    if (chars.every((m) => m.every(isDone))) return 'normal'
    return 'none'
  }

  return 'none'
}

/**
 * Условие ачивки для summary-ячейки (видимость иконки).
 * Mega Blast → Mega Satan у всех обычных на normal.
 * Mega Mush → все метки всех обычных на hard (вики).
 * Death Certificate → все метки всех персонажей на hard.
 */
export function isSummaryUnlockMet(checklist, nameRu, columnIndex) {
  if (!checklist) return false
  const range = summaryCharRange(nameRu)
  if (!range) return false

  const chars = checklist.slice(range.from, range.to + 1)
  if (!chars.length) return false

  if (columnIndex === 8 && range.to === 16) {
    return chars.every((m) => isDone(m[6]))
  }

  if (columnIndex === 14) {
    // И Мегагриб, и Свидетельство по вики требуют hard
    return chars.every((m) => m.every(isHard))
  }

  return false
}
