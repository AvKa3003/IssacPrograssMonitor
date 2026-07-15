<template>
  <div class="character-sheets">
    <div class="marks-progress">
      <div class="marks-progress-item">
        <span class="marks-progress-label">Обычные</span>
        <n-tag type="info" size="large">
          {{ marksProgress.normal.done }} / {{ marksProgress.normal.total }}
        </n-tag>
      </div>
      <div class="marks-progress-item">
        <span class="marks-progress-label">Порченые</span>
        <n-tag type="warning" size="large">
          {{ marksProgress.tainted.done }} / {{ marksProgress.tainted.total }}
        </n-tag>
      </div>
      <div class="marks-progress-item">
        <span class="marks-progress-label">Всего</span>
        <n-tag type="success" size="large">
          {{ marksProgress.all.done }} / {{ marksProgress.all.total }}
        </n-tag>
      </div>
    </div>

    <div class="sheet-tabs-bar">
      <n-button-group size="large">
        <n-button
          v-for="sheet in sheets"
          :key="sheet.id"
          :type="activeSheet === sheet.id ? 'primary' : 'default'"
          secondary
          class="sheet-tab-btn"
          @click="activeSheet = sheet.id"
        >
          {{ sheet.title }}
        </n-button>
      </n-button-group>
    </div>

    <div
      v-for="sheet in sheets"
      v-show="activeSheet === sheet.id"
      :key="sheet.id"
      class="table-scroll"
    >
      <table class="mark-table">
        <thead>
          <tr>
            <th
              v-for="head in headerCells(sheet)"
              :key="head.key"
              class="milestone-head"
              :class="{
                tick: head.kind === 'tick',
                spacer: head.kind === 'spacer',
                character: head.kind === 'character',
              }"
              :colspan="head.colspan || 1"
            >
              <template v-if="head.kind === 'group'">
                <div
                  class="group-icons"
                  :class="{ 'parts-2': head.parts?.length === 2 }"
                >
                  <component
                    :is="part.href ? 'a' : 'span'"
                    v-for="(part, pi) in head.parts"
                    :key="pi"
                    class="icon-link"
                    :href="part.href || undefined"
                    :target="part.href ? '_blank' : undefined"
                    :rel="part.href ? 'noopener noreferrer' : undefined"
                    :title="part.title || ''"
                  >
                    <img
                      class="milestone-icon"
                      :src="part.iconUrl"
                      :alt="part.title || ''"
                      referrerpolicy="no-referrer"
                      loading="lazy"
                    />
                  </component>
                </div>
              </template>
              <template v-else-if="head.kind === 'tick'">
                <component
                  :is="head.href ? 'a' : 'span'"
                  v-if="head.iconUrl"
                  class="icon-link"
                  :href="head.href || undefined"
                  :target="head.href ? '_blank' : undefined"
                  :rel="head.href ? 'noopener noreferrer' : undefined"
                  :title="head.title || ''"
                >
                  <img
                    class="tick-head-icon"
                    :src="head.iconUrl"
                    :alt="head.title || ''"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                  />
                </component>
              </template>
              <template v-else-if="head.iconUrl">
                <component
                  :is="head.href ? 'a' : 'span'"
                  class="icon-link"
                  :href="head.href || undefined"
                  :target="head.href ? '_blank' : undefined"
                  :rel="head.href ? 'noopener noreferrer' : undefined"
                  :title="head.title || ''"
                >
                  <img
                    class="milestone-icon"
                    :src="head.iconUrl"
                    :alt="head.title || ''"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                  />
                </component>
              </template>
              <component
                :is="head.href ? 'a' : 'span'"
                v-else-if="head.title"
                class="head-label"
                :href="head.href || undefined"
                :target="head.href ? '_blank' : undefined"
                :rel="head.href ? 'noopener noreferrer' : undefined"
              >
                {{ head.title }}
              </component>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in sheet.rows" :key="rowIndex">
            <td class="char-cell" :class="{ summary: row.character.kind === 'summary' }">
              <span
                v-if="row.character.kind === 'summary'"
                class="summary-label"
              >{{ row.character.nameRu }}</span>
              <a
                v-else-if="row.character.wikiUrl"
                :href="row.character.wikiUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="icon-link"
                :title="row.character.nameRu || ''"
              >
                <img
                  v-if="row.character.iconUrl"
                  class="cell-icon"
                  :src="row.character.iconUrl"
                  :alt="row.character.nameRu || ''"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                />
              </a>
              <img
                v-else-if="row.character.iconUrl"
                class="cell-icon"
                :src="row.character.iconUrl"
                :alt="row.character.nameRu || ''"
                referrerpolicy="no-referrer"
                loading="lazy"
              />
            </td>

            <td
              v-if="sheet.id === 'tainted'"
              class="tick-cell"
              :class="tickClass(taintedHeartLevel(row))"
              :title="TAINTED_HEART_ICON.title"
            >
              <span class="tick-glyph">{{
                taintedHeartLevel(row) === 'none' ? '✕' : '✓'
              }}</span>
            </td>

            <template
              v-for="(cell, cellIndex) in row.milestones"
              :key="cellIndex"
            >
              <template v-if="!cell.empty">
                <td
                  v-for="(tick, ti) in ticksFor(sheet, row, cell)"
                  :key="`t-${cellIndex}-${ti}`"
                  class="tick-cell"
                  :class="tickClass(tick.level)"
                  :title="tick.title"
                >
                  <span class="tick-glyph">{{ tick.level === 'none' ? '✕' : '✓' }}</span>
                </td>
                <td
                  class="mark-cell"
                  :class="markCellClass(sheet, row, cell)"
                  :data-row-key="rowKey(sheet.id, row)"
                  @mouseenter="onEnter(cell, $event)"
                  @mouseleave="onLeave"
                  @click.stop="onClick(cell, $event)"
                >
                  <img
                    v-if="cell.iconUrl"
                    class="cell-icon"
                    :src="cellIcon(cell)"
                    :alt="cell.nameRu || ''"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                    draggable="false"
                  />
                </td>
              </template>
              <td v-else class="mark-cell empty" />
            </template>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-for="win in openWindows"
        :key="win.key"
        :ref="(el) => setPopupEl(win.key, el)"
        class="sheet-popup"
        :class="{
          pinned: win.pinned,
          ready: win.ready,
          detached: win.detached,
          ephemeral: win.ephemeral,
        }"
        :style="styleFor(win)"
        @mouseenter="onPopupEnter(win.key)"
        @mouseleave="onPopupLeave(win.key)"
        @click.stop
      >
        <PopupDragBar
          :show-close="win.detached"
          :interactive="win.pinned"
          :dragging="draggingKey === win.key"
          @dragstart="(e) => onDragStart(win.key, e)"
          @close="closeWindow(win.key)"
        />
        <template v-if="cellFor(win) && metaFor(win)">
          <div class="popup-header">
            <span class="popup-id">#{{ achievementIdFor(win) }}</span>
            <n-tag
              size="small"
              :type="statusForWin(win).type"
            >
              {{ statusForWin(win).label }}
            </n-tag>
            <span
              class="pin-hint"
              :class="{ visible: win.pinned && !win.detached }"
            >
              закреплено · уведи курсор / Esc
            </span>
          </div>
          <div class="popup-body">
            <component
              :is="unlockUrlFor(win) ? 'a' : 'div'"
              class="popup-icon-wrap"
              :href="unlockUrlFor(win) || undefined"
              :target="unlockUrlFor(win) ? '_blank' : undefined"
              :rel="unlockUrlFor(win) ? 'noopener noreferrer' : undefined"
              :title="unlockTitleFor(win) || undefined"
            >
              <img
                v-if="metaFor(win).icon"
                class="popup-icon"
                :src="`${base}${metaFor(win).icon}`"
                :alt="metaFor(win).nameRu || ''"
              />
              <span v-else class="popup-icon-fallback">
                #{{ achievementIdFor(win) }}
              </span>
            </component>
            <div class="popup-info">
              <div class="name-ru">{{ metaFor(win).nameRu }}</div>
              <div v-if="metaFor(win).nameEn" class="name-en">
                {{ metaFor(win).nameEn }}
              </div>
              <div
                v-if="unlockTitleFor(win) || unlockUrlFor(win)"
                class="meta-row"
              >
                <span class="label">Открывает</span>
                <a
                  v-if="unlockUrlFor(win)"
                  :href="unlockUrlFor(win)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ unlockTitleFor(win) || unlockUrlFor(win) }}
                </a>
                <span v-else>{{ unlockTitleFor(win) }}</span>
              </div>
            </div>
          </div>
          <div
            v-if="metaFor(win).conditionHtmlRu || metaFor(win).conditionRu"
            class="popup-condition"
          >
            <div class="label">Как получить</div>
            <div
              v-if="metaFor(win).conditionHtmlRu"
              v-html="allowFandomImages(metaFor(win).conditionHtmlRu)"
            />
            <div v-else>{{ metaFor(win).conditionRu }}</div>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PopupDragBar from './PopupDragBar.vue'
import { useAnchoredPopup } from '../composables/useAnchoredPopup.js'
import { allowFandomImages } from '../utils/achievements.js'
import {
  CHAR_INDEX_BY_NAME,
  columnMarkSpec,
  countMarksProgress,
  hasTickRow,
  markLevel,
  resolveCellLevel,
  resolveSummaryCellLevel,
  isCellUnlockMet,
  isSummaryUnlockMet,
  TAINTED_HEART_ICON,
  TAINTED_HEART_MARK,
} from '../utils/marks.js'

const props = defineProps({
  sheets: {
    type: Array,
    required: true,
  },
  achievements: {
    type: Array,
    required: true,
  },
  checklist: {
    type: Array,
    default: null,
  },
  metaById: {
    type: Object,
    default: () => ({}),
  },
})

const base = import.meta.env.BASE_URL
const activeSheet = ref(props.sheets[0]?.id || 'normal')
const hoverRowKey = ref(null)

const {
  openWindows,
  draggingKey,
  setPopupEl,
  styleFor,
  onAnchorEnter,
  onAnchorLeave,
  onAnchorClick,
  onPopupEnter,
  onPopupLeave,
  onDragStart,
  closeWindow,
  clearAll,
  isPinnedKey,
} = useAnchoredPopup({
  width: 320,
})

function achievementIdFor(win) {
  const id = Number(String(win.key).split('::')[0])
  return Number.isFinite(id) ? id : null
}

const marksProgress = computed(() => countMarksProgress(props.checklist))

function rowKeyForWin(win) {
  return String(win.key).split('::').slice(1).join('::') || null
}

function contextFor(win) {
  const achievementId = achievementIdFor(win)
  const targetRowKey = rowKeyForWin(win)
  if (!achievementId || !targetRowKey) return null
  for (const sheet of props.sheets) {
    for (const row of sheet.rows) {
      if (rowKey(sheet.id, row) !== targetRowKey) continue
      const cell = row.milestones.find(
        (candidate) => candidate.achievementId === achievementId,
      )
      if (cell) return { sheet, row, cell }
    }
  }
  return null
}

function cellFor(win) {
  return contextFor(win)?.cell || null
}

function metaFor(win) {
  const achievementId = achievementIdFor(win)
  return achievementId ? props.metaById[achievementId] || null : null
}

function unlockUrlFor(win) {
  const meta = metaFor(win)
  return meta?.unlockUrlRu || meta?.unlockUrlEn || null
}

function unlockTitleFor(win) {
  const meta = metaFor(win)
  return meta?.unlockTitleRu || meta?.unlockTitleEn || null
}

function cellPopupKey(cell, event) {
  const rk = event.currentTarget?.dataset?.rowKey || ''
  return `${cell.achievementId}::${rk}`
}

function charMarks(row) {
  if (!props.checklist || row.character.kind === 'summary') return null
  const idx = CHAR_INDEX_BY_NAME[row.character.nameRu]
  if (idx == null) return null
  return props.checklist[idx] || null
}

function taintedHeartLevel(row) {
  const marks = charMarks(row)
  if (!marks) return 'none'
  return markLevel(marks[TAINTED_HEART_MARK])
}

function headerCells(sheet) {
  const out = []
  for (const col of sheet.columns) {
    if (col.kind === 'character') {
      out.push({
        key: `c-${col.index}`,
        kind: 'character',
        title: col.title,
        iconUrl: col.iconUrl,
        href: col.href || null,
      })
      if (sheet.id === 'tainted') {
        out.push({
          key: 'tick-heart',
          kind: 'tick',
          title: TAINTED_HEART_ICON.title,
          iconUrl: TAINTED_HEART_ICON.iconUrl,
          href: TAINTED_HEART_ICON.href,
        })
      }
      continue
    }

    const spec = columnMarkSpec(sheet.id, col.index)
    if (col.kind === 'milestone-group' && col.parts?.length && hasTickRow(spec)) {
      for (let i = 0; i < col.parts.length; i++) {
        const part = col.parts[i]
        out.push({
          key: `tick-${col.index}-${i}`,
          kind: 'tick',
          title: part.title,
          iconUrl: part.iconUrl,
          href: part.href || null,
        })
      }
      out.push({
        key: `ach-${col.index}`,
        kind: 'group',
        title: col.title,
        iconUrl: null,
        href: null,
        parts: col.parts,
      })
      continue
    }

    out.push({
      key: `m-${col.index}`,
      kind: 'milestone',
      title: col.title,
      iconUrl: col.iconUrl,
      href: col.href || null,
    })
  }
  return out
}

function ticksFor(sheet, row, cell) {
  const spec = columnMarkSpec(sheet.id, cell.columnIndex)
  if (!hasTickRow(spec)) return []
  const marks = charMarks(row)
  const parts =
    sheet.columns.find((c) => c.index === cell.columnIndex)?.parts || []
  return spec.marks.map((markIndex, i) => {
    const raw = marks ? marks[markIndex] : 0
    return {
      level: marks ? markLevel(raw) : 'none',
      title: parts[i]?.title || `mark ${markIndex}`,
    }
  })
}

function cellLevel(sheet, row, cell) {
  if (row.character.kind === 'summary') {
    return resolveSummaryCellLevel(
      props.checklist,
      row.character.nameRu,
      cell.columnIndex,
    )
  }
  const marks = charMarks(row)
  const spec = columnMarkSpec(sheet.id, cell.columnIndex)
  if (!marks || !spec) return 'none'
  return resolveCellLevel(marks, spec)
}

function cellUnlockMet(sheet, row, cell) {
  if (cell.empty || !cell.achievementId) return false
  if (row.character.kind === 'summary') {
    return isSummaryUnlockMet(
      props.checklist,
      row.character.nameRu,
      cell.columnIndex,
    )
  }
  const marks = charMarks(row)
  const spec = columnMarkSpec(sheet.id, cell.columnIndex)
  if (!marks || !spec) return false
  return isCellUnlockMet(marks, spec)
}

function tickClass(level) {
  if (level === 'hard') return 'yes-full'
  if (level === 'normal') return 'yes-half'
  return 'no'
}

function markCellClass(sheet, row, cell) {
  if (cell.empty) return 'empty'
  if (!cell.achievementId) return 'unknown'
  const level = cellLevel(sheet, row, cell)
  const unlocked = cellUnlockMet(sheet, row, cell)
  const frame =
    level === 'hard' ? 'yes-full' : level === 'normal' ? 'yes-half' : 'no'
  return {
    [frame]: true,
    unlocked,
    locked: !unlocked,
    pinned: isPinnedKey(
      `${cell.achievementId}::${rowKey(sheet.id, row)}`,
    ),
  }
}

function cellIcon(cell) {
  if (cell.achievementId && props.metaById[cell.achievementId]?.icon) {
    return `${base}${props.metaById[cell.achievementId].icon}`
  }
  return cell.iconUrl
}

function rowKey(sheetId, row) {
  return `${sheetId}:${row.character.nameRu || 'x'}`
}

function statusForWin(win) {
  const context = contextFor(win)
  if (!context) return { type: 'default', label: '—' }
  const { sheet, row, cell } = context
  const level = cellLevel(sheet, row, cell)
  const spec =
    row.character.kind === 'summary'
      ? null
      : columnMarkSpec(sheet.id, cell.columnIndex)
  return statusTagFor(level, spec)
}

/** Подпись: Greed/Greedier — только у порченых; у обычных эти колонки просто «Пройдено». */
function statusTagFor(level, spec) {
  if (level === 'none') return { type: 'error', label: 'Не пройдено' }

  const mode = spec?.mode || 'default'
  if (mode === 'greed' || mode === 'greedier') {
    return { type: 'success', label: 'Пройдено' }
  }
  if (mode === 'greed-tainted') {
    if (level === 'hard') return { type: 'success', label: 'Пройдено Greedier' }
    return { type: 'warning', label: 'Пройдено Greed' }
  }

  if (level === 'hard') return { type: 'success', label: 'Пройдено Hard' }
  if (level === 'normal') return { type: 'warning', label: 'Пройдено Normal' }
  return { type: 'error', label: 'Не пройдено' }
}

function onEnter(cell, event) {
  if (cell.empty || !cell.achievementId) return
  const rk = event.currentTarget.dataset.rowKey || null
  hoverRowKey.value = rk
  onAnchorEnter(cellPopupKey(cell, event), event)
}

function onLeave() {
  onAnchorLeave()
  hoverRowKey.value = null
}

function onClick(cell, event) {
  if (cell.empty || !cell.achievementId) return
  const rk = event.currentTarget.dataset.rowKey || null
  const key = cellPopupKey(cell, event)
  const result = onAnchorClick(key, event)
  if (result === 'pinned') {
    hoverRowKey.value = null
  } else if (result === 'unpinned') {
    hoverRowKey.value = rk
  }
}

watch(activeSheet, () => clearAll())
</script>

<style scoped>
.marks-progress {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px 28px;
  margin-bottom: 14px;
}

.marks-progress-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.marks-progress-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ca3af;
}

.sheet-tabs-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.sheet-tab-btn {
  min-width: 140px;
  min-height: 40px;
  padding: 0 36px;
  font-size: 0.95rem;
}

.table-scroll {
  overflow-x: auto;
  padding-bottom: 8px;
}

.mark-table {
  border-collapse: separate;
  border-spacing: 3px;
  margin: 0 auto;
}

.milestone-head {
  padding: 4px;
  vertical-align: bottom;
  text-align: center;
  min-width: 44px;
  background: #fff;
  border-radius: 6px;
  line-height: 0;
}

.milestone-head.character {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
}

.milestone-head.tick {
  min-width: 52px;
  width: 52px;
  padding: 4px;
}

.group-icons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  justify-items: center;
  align-items: center;
  width: 40px;
  height: 36px;
  margin: 0 auto;
}

.group-icons .milestone-icon {
  height: 16px;
  max-width: 18px;
  margin: 0;
}

.group-icons.parts-2 {
  grid-template-columns: 1fr 1fr;
  width: 40px;
}

.milestone-icon {
  display: block;
  height: 36px;
  width: auto;
  margin: 0 auto;
  object-fit: contain;
  image-rendering: pixelated;
}

.tick-head-icon {
  display: block;
  height: 36px;
  width: auto;
  margin: 0 auto;
  object-fit: contain;
  image-rendering: pixelated;
}

.head-label {
  font-size: 0.7rem;
  line-height: 1.2;
  color: #9ca3af;
  text-decoration: none;
}

a.head-label:hover {
  color: #70c0e8;
  text-decoration: underline;
}

.milestone-head .icon-link {
  display: inline-flex;
  text-decoration: none;
  line-height: 0;
  cursor: default;
}

.milestone-head a.icon-link {
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.milestone-head a.icon-link:hover {
  outline: 1px solid #70c0e8;
  border-radius: 4px;
}

.char-cell,
.mark-cell,
.tick-cell {
  width: 52px;
  height: 52px;
  padding: 2px;
  text-align: center;
  vertical-align: middle;
  border-radius: 6px;
  background: #232428;
  line-height: 0;
  box-sizing: border-box;
}

.char-cell {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
}

.char-cell.summary {
  line-height: 1.2;
}

.summary-label {
  display: block;
  white-space: pre-line;
  font-size: 0.68rem;
  line-height: 1.2;
  color: #c8c8c8;
  font-weight: 600;
}

.mark-cell {
  cursor: pointer;
  border: 2px solid transparent;
}

.tick-cell {
  border: 2px solid transparent;
  cursor: default;
}

.tick-glyph {
  display: block;
  font-size: 1.35rem;
  line-height: 1;
  font-weight: 700;
}

.mark-cell.yes-full,
.tick-cell.yes-full {
  background: #1a3d2e;
  border-color: #63e2b7;
}

.mark-cell.yes-full .tick-glyph,
.tick-cell.yes-full .tick-glyph {
  color: #63e2b7;
}

.mark-cell.yes-half,
.tick-cell.yes-half {
  border: 2px solid transparent;
  background:
    linear-gradient(45deg, #1a3d2e 50%, #3d1a1a 50%) padding-box,
    linear-gradient(45deg, #63e2b7 50%, #e88080 50%) border-box;
  background-origin: border-box;
  background-clip: padding-box, border-box;
}

.mark-cell.yes-half .tick-glyph,
.tick-cell.yes-half .tick-glyph {
  color: #b6f0d8;
}

.mark-cell.no,
.tick-cell.no {
  background: #3d1a1a;
  border-color: #e88080;
}

.mark-cell.locked .cell-icon {
  opacity: 0.45;
  filter: grayscale(0.65);
}

.mark-cell.unlocked .cell-icon {
  opacity: 1;
  filter: none;
}

.mark-cell.no .tick-glyph,
.tick-cell.no .tick-glyph {
  color: #e88080;
}

.mark-cell.empty {
  border-color: transparent;
  cursor: default;
  width: 52px;
}

.mark-cell.unknown {
  opacity: 0.5;
  cursor: default;
}

.cell-icon {
  display: block;
  width: 44px;
  height: 44px;
  margin: 0 auto;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
}

.icon-link {
  display: inline-flex;
  text-decoration: none;
}
</style>

<style>
.sheet-popup {
  box-sizing: border-box;
  overflow: auto;
  overflow-x: hidden;
  padding: 12px;
  border-radius: 10px;
  background: #2a2d33;
  border: 1px solid #48484e;
  color: #e8e8e8;
  font-size: 0.875rem;
  pointer-events: none;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  opacity: 0;
  max-width: min(320px, calc(100vw - 16px));
  max-height: min(var(--popup-max-h, 100dvh), calc(100dvh - 16px));
  user-select: none;
}

.sheet-popup.ready {
  opacity: 1;
}

.sheet-popup.pinned {
  pointer-events: auto;
  border-color: #63e2b7;
  user-select: text;
}

.sheet-popup.ephemeral .popup-drag-bar {
  pointer-events: none;
}

.sheet-popup .popup-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.sheet-popup .pin-hint {
  margin-left: auto;
  font-size: 0.7rem;
  color: #9ca3af;
  visibility: hidden;
}

.sheet-popup .pin-hint.visible {
  visibility: visible;
}

.sheet-popup .popup-id {
  color: #70c0e8;
  font-weight: 700;
}

.sheet-popup .popup-body {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.sheet-popup .popup-icon-wrap {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #1a1b1e;
  text-decoration: none;
  overflow: hidden;
}

.sheet-popup a.popup-icon-wrap:hover {
  outline: 1px solid #70c0e8;
}

.sheet-popup .popup-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: pixelated;
}

.sheet-popup .popup-icon-fallback {
  color: #9ca3af;
  font-weight: 700;
  font-size: 0.75rem;
}

.sheet-popup .popup-info {
  min-width: 0;
  flex: 1;
}

.sheet-popup .name-ru {
  font-weight: 700;
}

.sheet-popup .name-en {
  color: #9ca3af;
  font-style: italic;
  margin-bottom: 4px;
}

.sheet-popup .meta-row {
  margin-top: 4px;
  word-break: break-word;
}

.sheet-popup .meta-row .label {
  display: block;
}

.sheet-popup .popup-condition {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #3a3a42;
}

.sheet-popup .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #9ca3af;
  margin-bottom: 2px;
}

.sheet-popup img.condition-icon {
  height: 1.4em;
  vertical-align: middle;
  margin: 0 2px;
}

.sheet-popup a {
  color: #70c0e8;
}

.sheet-popup a:hover {
  text-decoration: underline;
}
</style>
