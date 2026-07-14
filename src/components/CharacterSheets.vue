<template>
  <div class="character-sheets">
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
              :class="{ tick: head.kind === 'tick', spacer: head.kind === 'spacer' }"
              :colspan="head.colspan || 1"
            >
              <template v-if="head.kind === 'group'">
                <div
                  class="group-icons"
                  :class="{ 'parts-2': head.parts?.length === 2 }"
                >
                  <img
                    v-for="(part, pi) in head.parts"
                    :key="pi"
                    class="milestone-icon"
                    :src="part.iconUrl"
                    :alt="part.title || ''"
                    :title="part.title || ''"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                  />
                </div>
              </template>
              <template v-else-if="head.kind === 'tick'">
                <img
                  v-if="head.iconUrl"
                  class="tick-head-icon"
                  :src="head.iconUrl"
                  :alt="head.title || ''"
                  :title="head.title || ''"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                />
              </template>
              <template v-else-if="head.iconUrl">
                <img
                  class="milestone-icon"
                  :src="head.iconUrl"
                  :alt="head.title || ''"
                  :title="head.title || ''"
                  referrerpolicy="no-referrer"
                  loading="lazy"
                />
              </template>
              <span v-else-if="head.title" class="head-label">{{ head.title }}</span>
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
        v-if="activeCell && popupMeta"
        class="sheet-popup"
        :class="{ pinned: !!pinnedId }"
        :style="popupStyle"
        @click.stop
      >
        <div class="popup-header">
          <span class="popup-id">#{{ activeCell.achievementId }}</span>
          <n-tag
            size="small"
            :type="markStatusTag(activeSheet).type"
          >
            {{ markStatusTag(activeSheet).label }}
          </n-tag>
        </div>
        <div class="popup-body">
          <component
            :is="popupUnlockUrl ? 'a' : 'div'"
            class="popup-icon-wrap"
            :href="popupUnlockUrl || undefined"
            :target="popupUnlockUrl ? '_blank' : undefined"
            :rel="popupUnlockUrl ? 'noopener noreferrer' : undefined"
            :title="popupUnlockTitle || undefined"
          >
            <img
              v-if="popupMeta.icon"
              class="popup-icon"
              :src="`${base}${popupMeta.icon}`"
              :alt="popupMeta.nameRu || ''"
            />
            <span v-else class="popup-icon-fallback">#{{ activeCell.achievementId }}</span>
          </component>
          <div class="popup-info">
            <div class="name-ru">{{ popupMeta.nameRu }}</div>
            <div v-if="popupMeta.nameEn" class="name-en">{{ popupMeta.nameEn }}</div>
            <div
              v-if="popupUnlockTitle || popupUnlockUrl"
              class="meta-row"
            >
              <span class="label">Открывает</span>
              <a
                v-if="popupUnlockUrl"
                :href="popupUnlockUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ popupUnlockTitle || popupUnlockUrl }}
              </a>
              <span v-else>{{ popupUnlockTitle }}</span>
            </div>
          </div>
        </div>
        <div
          v-if="popupMeta.conditionHtmlRu || popupMeta.conditionRu"
          class="popup-condition"
        >
          <div class="label">Как получить</div>
          <div
            v-if="popupMeta.conditionHtmlRu"
            v-html="allowFandomImages(popupMeta.conditionHtmlRu)"
          />
          <div v-else>{{ popupMeta.conditionRu }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { allowFandomImages } from '../utils/achievements.js'
import {
  CHAR_INDEX_BY_NAME,
  columnMarkSpec,
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
const hoveredId = ref(null)
const pinnedId = ref(null)
const hoverRowKey = ref(null)
const pinnedRowKey = ref(null)
const anchorRect = ref(null)

const activeId = computed(() => pinnedId.value || hoveredId.value)
const activeRowKey = computed(() => pinnedRowKey.value || hoverRowKey.value)

const activeCell = computed(() => {
  if (!activeId.value) return null
  for (const sheet of props.sheets) {
    for (const row of sheet.rows) {
      for (const cell of row.milestones) {
        if (cell.achievementId === activeId.value) return cell
      }
    }
  }
  return null
})

const popupMeta = computed(() =>
  activeId.value ? props.metaById[activeId.value] || null : null,
)

const popupUnlockUrl = computed(() => {
  const m = popupMeta.value
  if (!m) return null
  return m.unlockUrlRu || m.unlockUrlEn || null
})

const popupUnlockTitle = computed(() => {
  const m = popupMeta.value
  if (!m) return null
  return m.unlockTitleRu || m.unlockTitleEn || null
})

const popupStyle = computed(() => {
  const r = anchorRect.value
  if (!r) return { display: 'none' }
  const width = 300
  const left = Math.min(
    Math.max(8, r.right + 8),
    window.innerWidth - width - 8,
  )
  const top = Math.min(Math.max(8, r.top), window.innerHeight - 200)
  return {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    zIndex: 4000,
  }
})

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
      })
      if (sheet.id === 'tainted') {
        out.push({
          key: 'tick-heart',
          kind: 'tick',
          title: TAINTED_HEART_ICON.title,
          iconUrl: TAINTED_HEART_ICON.iconUrl,
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
        })
      }
      out.push({
        key: `ach-${col.index}`,
        kind: 'group-ach',
        title: col.title,
        iconUrl: null,
        parts: col.parts,
      })
      // Пустой заголовок над иконкой достижения — рисуем мини-группу
      out[out.length - 1].kind = 'group'
      continue
    }

    out.push({
      key: `m-${col.index}`,
      kind: 'milestone',
      title: col.title,
      iconUrl: col.iconUrl,
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
  return [frame, unlocked ? 'unlocked' : 'locked'].join(' ')
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

function markStatusTag(sheetId) {
  const cell = activeCell.value
  if (!cell) return { type: 'default', label: '—' }
  const sheet = props.sheets.find((s) => s.id === (sheetId || activeSheet.value))
  const row = sheet?.rows.find(
    (r) => rowKey(sheet.id, r) === activeRowKey.value,
  )
  if (!row) return { type: 'error', label: 'Не пройдено' }
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
  if (cell.empty || !cell.achievementId || pinnedId.value) return
  hoveredId.value = cell.achievementId
  hoverRowKey.value = event.currentTarget.dataset.rowKey || null
  anchorRect.value = event.currentTarget.getBoundingClientRect()
}

function onLeave() {
  if (pinnedId.value) return
  hoveredId.value = null
  hoverRowKey.value = null
  anchorRect.value = null
}

function onClick(cell, event) {
  if (cell.empty || !cell.achievementId) return
  const rowKeyVal = event.currentTarget.dataset.rowKey || null
  if (pinnedId.value === cell.achievementId && pinnedRowKey.value === rowKeyVal) {
    pinnedId.value = null
    pinnedRowKey.value = null
    hoveredId.value = cell.achievementId
    hoverRowKey.value = rowKeyVal
    anchorRect.value = event.currentTarget.getBoundingClientRect()
    return
  }
  pinnedId.value = cell.achievementId
  pinnedRowKey.value = rowKeyVal
  hoveredId.value = null
  hoverRowKey.value = null
  anchorRect.value = event.currentTarget.getBoundingClientRect()
}

function onDocClick() {
  if (!pinnedId.value) return
  pinnedId.value = null
  pinnedRowKey.value = null
  hoveredId.value = null
  hoverRowKey.value = null
  anchorRect.value = null
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
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

.char-cell.summary {
  width: 72px;
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
    linear-gradient(#1a3d2e, #1a3d2e) padding-box,
    linear-gradient(to right, #63e2b7 50%, #e88080 50%) border-box;
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
}
</style>

<style>
.sheet-popup {
  box-sizing: border-box;
  padding: 12px;
  border-radius: 10px;
  background: #2a2d33;
  border: 1px solid #48484e;
  color: #e8e8e8;
  font-size: 0.875rem;
  pointer-events: none;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.sheet-popup.pinned {
  pointer-events: auto;
  border-color: #63e2b7;
}

.sheet-popup .popup-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
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
