/** Смещение начала блока достижений в persistentgamedata.dat */
export const ACHIEVEMENTS_OFFSET = 0x21

/** Количество достижений в актуальной версии */
export const ACHIEVEMENT_COUNT = 641

/**
 * Разбирает save-файл Isaac и возвращает массив достижений.
 * Каждый байт: 0 — не получено, != 0 — получено.
 * @param {ArrayBuffer} buffer
 * @returns {{ achievements: boolean[], unlockedCount: number, fileName: string }}
 */
export function parseAchievements(buffer) {
  const bytes = new Uint8Array(buffer)
  const end = ACHIEVEMENTS_OFFSET + ACHIEVEMENT_COUNT

  if (bytes.length < end) {
    throw new Error(
      `Файл слишком короткий: ${bytes.length} байт, нужно минимум ${end}`,
    )
  }

  const achievements = []
  let unlockedCount = 0

  for (let i = 0; i < ACHIEVEMENT_COUNT; i++) {
    const unlocked = bytes[ACHIEVEMENTS_OFFSET + i] !== 0
    achievements.push(unlocked)
    if (unlocked) unlockedCount++
  }

  return { achievements, unlockedCount }
}
