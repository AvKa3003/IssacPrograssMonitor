/**
 * Парсер persistentgamedata.dat (Repentance+).
 *
 * ============================================================================
 * Completion marks (post-it) — карта памяти для правки
 * ============================================================================
 *
 * База = sections[1] (старт секции stats+marks). Считается динамически
 * через getSectionOffsets() с 0x14. На типичном файле с 641 достижением:
 *   sections[1] = 0x2AE
 *
 * Значение метки: uint16 LE (практически 1 байт + 3 нуля).
 *   0 = нет
 *   1 = solo normal
 *   2 или 3 = solo hard
 *   4/8 = online биты; 15 = hard offline+online
 *
 * Порядок 12 меток (markIndex):
 *   0 Heart, 1 Isaac, 2 Satan, 3 BossRush, 4 ???, 5 Lamb,
 *   6 MegaSatan, 7 Greed(/Greedier), 8 Hush, 9 Delirium, 10 Mother, 11 Beast
 *
 * ---------------------------------------------------------------------------
 * Старт метки Heart (первый слот персонажа), если sections[1] = 0x2AE:
 *
 *  idx  Персонаж              Heart @
 *  ---  --------------------  --------
 *   0   Исаак                 0x031A
 *   1   Магдалина             0x031E
 *   2   Каин                  0x0322
 *   3   Иуда                  0x0326
 *   4   ???                   0x032A
 *   5   Ева                   0x032E
 *   6   Самсон                0x0332
 *   7   Азазель               0x0336
 *   8   Лазарь                0x033A
 *   9   Эдем                  0x033E
 *  10   Потерянный            0x0342
 *  11   Лилит                 0x0346
 *  12   Хранитель             0x034A
 *  13   Аполлион              0x034E
 *  14   Забытый               0x05DA   (особая ветка)
 *  15   Вифания               0x0606
 *  16   Иаков и Исав          0x060A
 *  17   Порченый Исаак        0x060E
 *  18   Порченая Магдалина    0x0612
 *  19   Порченый Каин         0x0616
 *  20   Порченый Иуда         0x061A
 *  21   Порченый ???          0x061E
 *  22   Порченая Ева          0x0622
 *  23   Порченый Самсон       0x0626
 *  24   Порченый Азазель      0x062A
 *  25   Порченый Лазарь       0x062E
 *  26   Порченый Эдем         0x0632
 *  27   Порченый Потерянный   0x0636
 *  28   Порченая Лилит        0x063A
 *  29   Порченый Хранитель    0x063E
 *  30   Порченый Аполлион     0x0642
 *  31   Порченый Забытый      0x0646
 *  32   Порченая Вифания      0x064A
 *  33   Порченый Иаков        0x064E
 *
 * Формула Heart (charIndex):
 *   0..13  →  sections[1] + 0x6C  + charIndex * 4
 *   14     →  sections[1] + 0x32C
 *   15..33 →  sections[1] + 0x31C + charIndex * 4
 *
 * Следующие метки НЕ идут просто +4: между ними есть gaps
 * (см. getCharacterMarks / getMarkOffset). Точные адреса всех 12
 * слотов: node scripts/probe-checklist.js
 *
 * После ручной правки сейва нужно пересчитать checksum
 * (хвост файла), иначе игра может откатить изменения.
 * ============================================================================
 */

/** Смещение начала блока достижений в persistentgamedata.dat (fallback) */
export const ACHIEVEMENTS_OFFSET = 0x21

/** Количество достижений в актуальной версии */
export const ACHIEVEMENT_COUNT = 641

export const MARK_COUNT = 12
export const CHARACTER_COUNT = 34

const ENTRY_LENS = [1, 4, 4, 1, 1, 1, 1, 4, 4, 1]

/**
 * Динамические старты секций сейва (см. Isaac-save-manager).
 * @param {Uint8Array} bytes
 * @returns {number[]}
 */
export function getSectionOffsets(bytes) {
  let ofs = 0x14
  const sectionOffsets = Array(ENTRY_LENS.length).fill(0)
  for (let i = 0; i < ENTRY_LENS.length; i++) {
    const sectData = [0, 0, 0]
    for (let j = 0; j < 3; j++) {
      sectData[j] = bytes[ofs] | (bytes[ofs + 1] << 8)
      ofs += 4
    }
    if (sectionOffsets[i] === 0) sectionOffsets[i] = ofs
    for (let j = 0; j < sectData[2]; j++) ofs += ENTRY_LENS[i]
  }
  return sectionOffsets
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

/**
 * Абсолютный адрес метки Heart (слот 0) персонажа.
 * @param {number[]} sections
 * @param {number} charIndex 0..33
 */
export function getCharacterHeartOffset(sections, charIndex) {
  if (charIndex === 14) return sections[1] + 0x32c
  if (charIndex > 14) return sections[1] + 0x31c + charIndex * 4
  return sections[1] + 0x6c + charIndex * 4
}

/**
 * Абсолютные адреса всех 12 меток персонажа.
 * @param {number[]} sections
 * @param {number} charIndex
 * @returns {number[]}
 */
export function getMarkOffsets(sections, charIndex) {
  const offsets = Array(MARK_COUNT).fill(0)
  let base

  if (charIndex === 14) {
    base = sections[1] + 0x32c
    for (let i = 0; i < MARK_COUNT; i++) {
      offsets[i] = base + i * 4
      if (i === 8) base += 0x4
      if (i === 9) base += 0x37c
      if (i === 10) base += 0x84
    }
  } else if (charIndex > 14) {
    base = sections[1] + 0x31c
    for (let i = 0; i < MARK_COUNT; i++) {
      offsets[i] = base + charIndex * 4 + i * 19 * 4
      if (i === 8) base += 0x4c
      if (i === 9 || i === 10) base += 0x3c
    }
  } else {
    base = sections[1] + 0x6c
    for (let i = 0; i < MARK_COUNT; i++) {
      offsets[i] = base + charIndex * 4 + i * 14 * 4
      if (i === 5) base += 0x14
      if (i === 8) base += 0x3c
      if (i === 9) base += 0x3b0
      if (i === 10) base += 0x50
    }
  }

  return offsets
}

/**
 * 12 completion marks одного персонажа.
 * Логика оффсетов: isaac-save-auto-editor / Isaac-save-manager.
 * @param {Uint8Array} bytes
 * @param {number[]} sections
 * @param {number} charIndex
 * @returns {number[]}
 */
export function getCharacterMarks(bytes, sections, charIndex) {
  const offsets = getMarkOffsets(sections, charIndex)
  return offsets.map((ofs) => readU16(bytes, ofs))
}

/**
 * @param {Uint8Array} bytes
 * @returns {number[][]} marks[charIndex][markIndex]
 */
export function parseChecklist(bytes) {
  const sections = getSectionOffsets(bytes)
  const all = []
  for (let c = 0; c < CHARACTER_COUNT; c++) {
    all.push(getCharacterMarks(bytes, sections, c))
  }
  return all
}

/**
 * Разбирает save-файл Isaac.
 * Достижения: 0 — не получено, != 0 — получено.
 * @param {ArrayBuffer} buffer
 */
export function parseAchievements(buffer) {
  const bytes = new Uint8Array(buffer)
  const sections = getSectionOffsets(bytes)
  const achStart = sections[0] ?? ACHIEVEMENTS_OFFSET - 1
  // В секции слот 0 пустой — читаем 641 достижение со следующего байта
  const start = achStart + 1
  const end = start + ACHIEVEMENT_COUNT

  if (bytes.length < end) {
    throw new Error(
      `Файл слишком короткий: ${bytes.length} байт, нужно минимум ${end}`,
    )
  }

  const achievements = []
  let unlockedCount = 0

  for (let i = 0; i < ACHIEVEMENT_COUNT; i++) {
    const unlocked = bytes[start + i] !== 0
    achievements.push(unlocked)
    if (unlocked) unlockedCount++
  }

  const checklist = parseChecklist(bytes)

  return { achievements, unlockedCount, checklist, sectionOffsets: sections }
}
