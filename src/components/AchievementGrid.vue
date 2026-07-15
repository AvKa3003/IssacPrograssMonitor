<template>
  <p v-if="showEmpty" class="grid-empty">
    В этой вкладке всё выполнено
  </p>
  <div v-else class="grid-wrap">
    <div
      class="grid"
      :class="{ 'headers-hidden': showHeaders && onlyLocked }"
      :style="{
        gridTemplateColumns: showHeaders
          ? `40px repeat(${COLS}, 90px)`
          : `repeat(${COLS}, 90px)`,
      }"
    >
      <template v-if="showHeaders">
        <div class="corner" />
        <div
          v-for="col in COLS"
          :key="'h' + col"
          class="col-header"
        >
          {{ col }}
        </div>
      </template>

      <template v-for="(row, rowIndex) in rows" :key="'r' + rowIndex">
        <div v-if="showHeaders" class="row-header">
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
        v-for="win in openWindows"
        :key="win.key"
        :ref="(el) => setPopupEl(win.key, el)"
        class="popup"
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
        <template v-if="flatById[win.key]">
          <div class="popup-header">
            <span class="popup-id">#{{ flatById[win.key].id }}</span>
            <n-tag
              size="small"
              :type="flatById[win.key].unlocked ? 'success' : 'error'"
            >
              {{ flatById[win.key].unlocked ? 'Открыто' : 'Закрыто' }}
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
              :is="flatById[win.key].unlockUrl ? 'a' : 'div'"
              class="popup-icon-wrap"
              :href="flatById[win.key].unlockUrl || undefined"
              :target="flatById[win.key].unlockUrl ? '_blank' : undefined"
              :rel="
                flatById[win.key].unlockUrl ? 'noopener noreferrer' : undefined
              "
              :title="flatById[win.key].unlockTitle || undefined"
            >
              <img
                v-if="flatById[win.key].icon"
                class="popup-icon"
                :src="flatById[win.key].icon"
                :alt="flatById[win.key].nameRu || `#${flatById[win.key].id}`"
              />
              <span v-else class="popup-icon-fallback">
                {{ flatById[win.key].id }}
              </span>
            </component>

            <div class="popup-info">
              <div v-if="flatById[win.key].nameRu" class="name-ru">
                {{ flatById[win.key].nameRu }}
              </div>
              <div v-if="flatById[win.key].nameEn" class="name-en">
                {{ flatById[win.key].nameEn }}
              </div>
              <div
                v-if="
                  flatById[win.key].unlockTitle || flatById[win.key].unlockUrl
                "
                class="meta-row"
              >
                <span class="label">Открывает</span>
                <a
                  v-if="flatById[win.key].unlockUrl"
                  :href="flatById[win.key].unlockUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{
                    flatById[win.key].unlockTitle ||
                    flatById[win.key].unlockUrl
                  }}
                </a>
                <span v-else>{{ flatById[win.key].unlockTitle }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="
              flatById[win.key].conditionHtml || flatById[win.key].condition
            "
            class="popup-condition"
          >
            <div class="label">Как получить</div>
            <div
              v-if="flatById[win.key].conditionHtml"
              class="condition-html"
              v-html="flatById[win.key].conditionHtml"
            />
            <div v-else class="condition-text">
              {{ flatById[win.key].condition }}
            </div>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import PopupDragBar from './PopupDragBar.vue'
import { useAnchoredPopup } from '../composables/useAnchoredPopup.js'
import { buildAchievementItems } from '../utils/achievements.js'

const COLS = 10

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
  /** Если задано — только эти ID, в этом порядке */
  ids: {
    type: Array,
    default: null,
  },
})

const {
  openWindows,
  openKeys,
  hoverKey,
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

function buildItems() {
  const built = buildAchievementItems(props.achievements, props.metaById, {
    onlyLocked: false,
    baseUrl: import.meta.env.BASE_URL,
  })
  if (!props.ids?.length) {
    return props.onlyLocked ? built.filter((i) => !i.unlocked) : built
  }
  const byId = new Map(built.map((item) => [item.id, item]))
  const out = []
  for (const id of props.ids) {
    const item = byId.get(id)
    if (item) out.push(item)
  }
  return props.onlyLocked ? out.filter((i) => !i.unlocked) : out
}

const items = computed(() => buildItems())

/** Номера строк/столбцов только для полного списка, не для групп. */
const showHeaders = computed(() => !props.ids?.length)

const rows = computed(() => {
  const list = items.value
  const result = []
  for (let i = 0; i < list.length; i += COLS) {
    const slice = list.slice(i, i + COLS)
    while (slice.length < COLS) slice.push(null)
    result.push(slice)
  }
  return result
})

const showEmpty = computed(
  () => props.onlyLocked && items.value.length === 0,
)

watch(
  () => props.onlyLocked,
  () => clearAll(),
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

function cellClass(cell) {
  if (!cell) return 'empty'
  return {
    yes: cell.unlocked,
    no: !cell.unlocked,
    active: openKeys.value.includes(cell.id) || hoverKey.value === cell.id,
    pinned: isPinnedKey(cell.id),
  }
}

function onCellEnter(cell, event) {
  if (!cell) return
  onAnchorEnter(cell.id, event)
}

function onCellLeave() {
  onAnchorLeave()
}

function onCellClick(cell, event) {
  if (!cell) return
  onAnchorClick(cell.id, event)
}

</script>

<style scoped>
.grid-empty {
  margin: 24px 0;
  color: #9ca3af;
  font-size: 0.95rem;
  text-align: center;
}

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

/* Место под заголовки сохраняем, чтобы сетка не прыгала */
.grid.headers-hidden .corner,
.grid.headers-hidden .col-header,
.grid.headers-hidden .row-header {
  visibility: hidden;
  pointer-events: none;
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
  overflow-x: hidden;
  padding: 12px;
  border-radius: 10px;
  background: #2a2d33;
  border: 1px solid #48484e;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  color: #e8e8e8;
  font-size: 0.875rem;
  line-height: 1.4;
  pointer-events: none;
  opacity: 0;
  max-width: min(320px, calc(100vw - 16px));
  max-height: min(var(--popup-max-h, 100dvh), calc(100dvh - 16px));
}

.popup.ready {
  opacity: 1;
}

.popup.pinned {
  border-color: #63e2b7;
  pointer-events: auto;
}

.popup.ephemeral .popup-drag-bar {
  pointer-events: none;
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
  visibility: hidden;
}

.pin-hint.visible {
  visibility: visible;
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
