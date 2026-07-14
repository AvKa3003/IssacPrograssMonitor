<template>
  <div class="grid-wrap" ref="wrapRef">
    <div
      class="grid"
      :style="{
        gridTemplateColumns: `40px repeat(${COLS}, 90px)`,
      }"
    >
      <div class="corner" />
      <div
        v-for="col in COLS"
        :key="'h' + col"
        class="col-header"
      >
        {{ col }}
      </div>

      <template v-for="(row, rowIndex) in rows" :key="'r' + rowIndex">
        <div class="row-header">
          {{ row[0] ? row[0].id : rowIndex * COLS + 1 }}
        </div>
        <div
          v-for="(cell, colIndex) in row"
          :key="rowIndex * COLS + colIndex"
          class="cell"
          :class="cellClass(cell)"
          :data-id="cell?.id"
          @mouseenter="onCellEnter(cell, $event)"
          @mouseleave="onCellLeave"
          @click.stop="onCellClick(cell, $event)"
        >
          <template v-if="cell">
            <img
              v-if="cell.icon"
              class="icon"
              :src="cell.icon"
              :alt="cell.nameRu || `#${cell.id}`"
              loading="lazy"
              draggable="false"
            />
            <span v-else class="fallback">{{ cell.id }}</span>
          </template>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="activeCell"
        ref="popupRef"
        class="popup"
        :class="{ pinned: !!pinnedId }"
        :style="popupStyle"
        @mouseenter="onPopupEnter"
        @mouseleave="onPopupLeave"
        @click.stop
      >
        <div class="popup-header">
          <span class="popup-id">#{{ activeCell.id }}</span>
          <n-tag
            size="small"
            :type="activeCell.unlocked ? 'success' : 'error'"
          >
            {{ activeCell.unlocked ? 'Открыто' : 'Закрыто' }}
          </n-tag>
          <span v-if="pinnedId" class="pin-hint">закреплено · Esc / клик вне</span>
        </div>

        <div class="popup-body">
          <component
            :is="activeCell.unlockUrl ? 'a' : 'div'"
            class="popup-icon-wrap"
            :href="activeCell.unlockUrl || undefined"
            :target="activeCell.unlockUrl ? '_blank' : undefined"
            :rel="activeCell.unlockUrl ? 'noopener noreferrer' : undefined"
            :title="activeCell.unlockTitle || undefined"
          >
            <img
              v-if="activeCell.icon"
              class="popup-icon"
              :src="activeCell.icon"
              :alt="activeCell.nameRu || `#${activeCell.id}`"
            />
            <span v-else class="popup-icon-fallback">{{ activeCell.id }}</span>
          </component>

          <div class="popup-info">
            <div v-if="activeCell.nameRu" class="name-ru">
              {{ activeCell.nameRu }}
            </div>
            <div v-if="activeCell.nameEn" class="name-en">
              {{ activeCell.nameEn }}
            </div>
            <div
              v-if="activeCell.unlockTitle || activeCell.unlockUrl"
              class="meta-row"
            >
              <span class="label">Открывает</span>
              <a
                v-if="activeCell.unlockUrl"
                :href="activeCell.unlockUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ activeCell.unlockTitle || activeCell.unlockUrl }}
              </a>
              <span v-else>{{ activeCell.unlockTitle }}</span>
            </div>
          </div>
        </div>

        <div v-if="activeCell.conditionHtml || activeCell.condition" class="popup-condition">
          <div class="label">Как получить</div>
          <div
            v-if="activeCell.conditionHtml"
            class="condition-html"
            v-html="activeCell.conditionHtml"
          />
          <div v-else class="condition-text">
            {{ activeCell.condition }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { buildAchievementItems } from '../utils/achievements.js'

const COLS = 10
const HIDE_DELAY_MS = 120
const MARGIN = 8
const GAP = 8
const POPUP_WIDTH = 320

const props = defineProps({
  achievements: {
    type: Array,
    required: true,
  },
  metaById: {
    type: Object,
    default: () => ({}),
  },
  onlyLocked: {
    type: Boolean,
    default: false,
  },
})

const wrapRef = ref(null)
const popupRef = ref(null)
const hoveredId = ref(null)
const pinnedId = ref(null)
const anchorRect = ref(null)
const overPopup = ref(false)
const popupPos = ref({ left: 0, top: 0, width: POPUP_WIDTH, maxHeight: null })
let hideTimer = null
let placeRaf = 0

const rows = computed(() => {
  const items = buildAchievementItems(props.achievements, props.metaById, {
    onlyLocked: props.onlyLocked,
    baseUrl: import.meta.env.BASE_URL,
  })

  const result = []
  for (let i = 0; i < items.length; i += COLS) {
    const slice = items.slice(i, i + COLS)
    while (slice.length < COLS) slice.push(null)
    result.push(slice)
  }
  return result
})

watch(
  () => props.onlyLocked,
  () => {
    pinnedId.value = null
    hoveredId.value = null
    anchorRect.value = null
  },
)

const flatById = computed(() => {
  const map = {}
  for (const row of rows.value) {
    for (const cell of row) {
      if (cell) map[cell.id] = cell
    }
  }
  return map
})

const activeId = computed(() => pinnedId.value || hoveredId.value)
const activeCell = computed(() =>
  activeId.value ? flatById.value[activeId.value] || null : null,
)

const popupStyle = computed(() => {
  if (!anchorRect.value || !activeCell.value) return { display: 'none' }
  const { left, top, width, maxHeight } = popupPos.value
  return {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: maxHeight != null ? `${maxHeight}px` : undefined,
    zIndex: 4000,
  }
})

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/** Ставит попап рядом с ячейкой и примагничивает к краям экрана */
function placePopup() {
  const r = anchorRect.value
  const el = popupRef.value
  if (!r || !el) return

  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(POPUP_WIDTH, vw - MARGIN * 2)
  const maxHeight = vh - MARGIN * 2

  // сначала ограничиваем высоту, потом меряем реальную
  el.style.maxHeight = `${maxHeight}px`
  el.style.width = `${width}px`

  const height = el.offsetHeight

  // Горизонталь: справа от ячейки → слева → прижать к краю
  let left = r.right + GAP
  if (left + width > vw - MARGIN) {
    left = r.left - width - GAP
  }
  left = clamp(left, MARGIN, vw - MARGIN - width)

  // Вертикаль: верх ячейки, затем магнит к верху/низу экрана
  let top = r.top
  if (top + height > vh - MARGIN) {
    top = vh - MARGIN - height
  }
  top = clamp(top, MARGIN, vh - MARGIN - height)

  popupPos.value = { left, top, width, maxHeight }
}

function schedulePlace() {
  cancelAnimationFrame(placeRaf)
  placeRaf = requestAnimationFrame(() => {
    nextTick(() => placePopup())
  })
}

watch([activeId, anchorRect], () => {
  if (activeId.value && anchorRect.value) schedulePlace()
})

function cellClass(cell) {
  if (!cell) return 'empty'
  return {
    yes: cell.unlocked,
    no: !cell.unlocked,
    active: activeId.value === cell.id,
    pinned: pinnedId.value === cell.id,
  }
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function scheduleHide() {
  clearHideTimer()
  hideTimer = setTimeout(() => {
    if (pinnedId.value || overPopup.value) return
    hoveredId.value = null
    if (!pinnedId.value) anchorRect.value = null
  }, HIDE_DELAY_MS)
}

function setAnchorFromEvent(event) {
  const el = event.currentTarget
  if (!el) return
  anchorRect.value = el.getBoundingClientRect()
}

function onCellEnter(cell, event) {
  if (!cell) return
  clearHideTimer()
  if (pinnedId.value) return
  hoveredId.value = cell.id
  setAnchorFromEvent(event)
}

function onCellLeave() {
  if (pinnedId.value) return
  scheduleHide()
}

function onPopupEnter() {
  clearHideTimer()
  overPopup.value = true
}

function onPopupLeave() {
  overPopup.value = false
  if (pinnedId.value) return
  scheduleHide()
}

function onCellClick(cell, event) {
  if (!cell) return
  clearHideTimer()
  if (pinnedId.value === cell.id) {
    pinnedId.value = null
    hoveredId.value = cell.id
    setAnchorFromEvent(event)
    return
  }
  pinnedId.value = cell.id
  hoveredId.value = null
  setAnchorFromEvent(event)
}

function onDocClick(event) {
  if (!pinnedId.value) return
  const popup = popupRef.value
  if (popup && popup.contains(event.target)) return
  const cell = event.target.closest?.('.cell[data-id]')
  if (cell && Number(cell.dataset.id) === pinnedId.value) return
  pinnedId.value = null
  hoveredId.value = null
  anchorRect.value = null
}

function onKeydown(event) {
  if (event.key === 'Escape' && pinnedId.value) {
    pinnedId.value = null
    hoveredId.value = null
    anchorRect.value = null
  }
}

function onScrollOrResize() {
  if (!activeId.value) return
  const el = wrapRef.value?.querySelector(`.cell[data-id="${activeId.value}"]`)
  if (el) {
    anchorRect.value = el.getBoundingClientRect()
    schedulePlace()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
})

onUnmounted(() => {
  clearHideTimer()
  cancelAnimationFrame(placeRaf)
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
})
</script>

<style scoped>
.grid-wrap {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.grid {
  display: grid;
  gap: 3px;
  width: max-content;
  margin: 0 auto;
}

.corner,
.col-header {
  position: sticky;
  top: 0;
  z-index: 5;
  min-height: 26px;
  background: #1a1b1e;
  box-shadow: 0 1px 0 #2a2d33;
}

.col-header,
.row-header {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
}

.corner {
  z-index: 6;
}

.row-header {
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 0.7rem;
}

.cell {
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  padding: 3px;
  cursor: pointer;
  border: 2px solid transparent;
  outline: 2px solid transparent;
  outline-offset: 1px;
  transition: outline-color 0.12s;
  box-sizing: border-box;
}

.cell.yes {
  background: #1a3d2e;
  border-color: transparent;
}

.cell.no {
  background: #3d1a1a;
  border-color: #e88080;
}

.cell.no .icon {
  opacity: 0.45;
  filter: grayscale(0.65);
}

.cell.empty {
  background: transparent;
  cursor: default;
}

.cell.active {
  outline-color: #70c0e8;
}

.cell.pinned {
  outline-color: #63e2b7;
}

.icon {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
}

.fallback {
  font-size: 0.7rem;
  font-weight: 700;
  color: #9ca3af;
}
</style>

<style>
/* popup в body — без scoped */
.popup {
  box-sizing: border-box;
  overflow: auto;
  padding: 12px;
  border-radius: 10px;
  background: #2a2d33;
  border: 1px solid #48484e;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  color: #e8e8e8;
  font-size: 0.875rem;
  line-height: 1.4;
  pointer-events: none;
}

.popup.pinned {
  border-color: #63e2b7;
  pointer-events: auto;
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.popup-id {
  font-weight: 700;
  color: #70c0e8;
}

.pin-hint {
  margin-left: auto;
  font-size: 0.7rem;
  color: #9ca3af;
}

.popup-body {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.popup-icon-wrap {
  flex: 0 0 72px;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #1a1b1e;
  text-decoration: none;
  overflow: hidden;
}

a.popup-icon-wrap:hover {
  outline: 1px solid #70c0e8;
}

.popup-icon {
  width: 90px;
  height: 90px;
  object-fit: contain;
  image-rendering: pixelated;
}

.popup-icon-fallback {
  color: #9ca3af;
  font-weight: 700;
}

.popup-info {
  min-width: 0;
  flex: 1;
}

.name-ru {
  font-size: 1.05rem;
  font-weight: 700;
}

.name-en {
  color: #9ca3af;
  font-style: italic;
  margin-bottom: 6px;
}

.meta-row {
  margin-top: 4px;
  word-break: break-word;
}

.meta-row .label,
.popup-condition .label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
  margin-bottom: 2px;
}

.popup-condition {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #3a3a42;
}

.condition-html a,
.meta-row a {
  color: #70c0e8;
}

.condition-html a:hover,
.meta-row a:hover {
  text-decoration: underline;
}

.condition-html img.condition-icon,
.condition-html .condition-icon {
  display: inline-block;
  height: 32px;
  width: auto;
  vertical-align: middle;
  margin: 0 2px;
  image-rendering: pixelated;
}
</style>
