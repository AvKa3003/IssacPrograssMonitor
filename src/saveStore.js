const STORAGE_KEY = 'isaac-progress:last-save'

/**
 * @typedef {{
 *   fileName: string,
 *   achievements: boolean[],
 *   unlockedCount: number,
 *   onlyLocked?: boolean,
 *   viewMode?: 'grid' | 'cards',
 *   savedAt: string,
 * }} SavedProgress
 */

/** @returns {SavedProgress | null} */
export function loadSavedProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data.achievements) || !data.fileName) return null
    return {
      fileName: data.fileName,
      achievements: data.achievements.map(Boolean),
      unlockedCount: Number(data.unlockedCount) || 0,
      onlyLocked: Boolean(data.onlyLocked),
      viewMode: data.viewMode === 'cards' ? 'cards' : 'grid',
      savedAt: data.savedAt || '',
    }
  } catch {
    return null
  }
}

/** @param {Omit<SavedProgress, 'savedAt'>} data */
export function saveProgress(data) {
  try {
    const payload = {
      fileName: data.fileName,
      achievements: data.achievements,
      unlockedCount: data.unlockedCount,
      onlyLocked: data.onlyLocked,
      viewMode: data.viewMode,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('Не удалось сохранить прогресс в localStorage:', err)
  }
}

export function clearSavedProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
