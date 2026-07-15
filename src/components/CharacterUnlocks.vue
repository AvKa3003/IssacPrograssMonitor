<template>
  <div class="char-unlocks">
    <div class="wheel-wrap">
      <div class="wheel-legend">
        <span class="legend-normal">внутри — обычные</span>
        <span class="legend-sep">·</span>
        <span class="legend-tainted">снаружи — порченые</span>
      </div>

      <div
        class="wheel"
        :style="{
          width: `${wheelSize}px`,
          height: `${wheelSize}px`,
        }"
      >
        <div
          class="wheel-ring wheel-ring-inner"
          :style="ringStyle(R_INNER)"
          aria-hidden="true"
        />
        <div
          class="wheel-ring wheel-ring-outer"
          :style="ringStyle(R_OUTER)"
          aria-hidden="true"
        />
        <div class="wheel-hubs" aria-hidden="true">
          <div class="wheel-hub hub-unlock">
            <span class="hub-label">Открыто</span>
            <span class="hub-count">{{ unlockedCount }}</span>
            <span class="hub-total">/ {{ totalCount }}</span>
          </div>
          <div class="wheel-hub hub-complete">
            <span class="hub-label">Пройдено</span>
            <span class="hub-count">{{ completedCount }}</span>
            <span class="hub-total">/ {{ completedTotal }}</span>
          </div>
        </div>

        <div
          v-for="(pair, index) in visiblePairs"
          :key="'line-' + pair.key"
          class="spoke-line"
          :style="spokeLineStyle(index)"
          aria-hidden="true"
        />

        <template v-for="(pair, index) in visiblePairs" :key="pair.key">
          <button
            type="button"
            class="portrait inner"
            :class="portraitClass(pair.normal)"
            :style="portraitStyle(pair.normal, index, 'inner')"
            :title="portraitTitle(pair.normal)"
            @mouseenter="onAnchorEnter(pair.normal.key, $event)"
            @mouseleave="onAnchorLeave"
            @click.stop="onAnchorClick(pair.normal.key, $event)"
          >
            <img
              v-if="pair.normal.portraitUrl"
              class="portrait-img"
              :src="pair.normal.portraitUrl"
              :alt="pair.normal.nameRu"
              referrerpolicy="no-referrer"
              loading="lazy"
              draggable="false"
            />
            <img
              v-else-if="pair.normal.icon"
              class="portrait-img"
              :src="pair.normal.icon"
              :alt="pair.normal.nameRu"
              loading="lazy"
              draggable="false"
            />
            <span v-else class="portrait-fallback">?</span>
          </button>

          <button
            type="button"
            class="portrait outer"
            :class="portraitClass(pair.tainted)"
            :style="portraitStyle(pair.tainted, index, 'outer')"
            :title="portraitTitle(pair.tainted)"
            @mouseenter="onAnchorEnter(pair.tainted.key, $event)"
            @mouseleave="onAnchorLeave"
            @click.stop="onAnchorClick(pair.tainted.key, $event)"
          >
            <img
              v-if="pair.tainted.portraitUrl"
              class="portrait-img"
              :src="pair.tainted.portraitUrl"
              :alt="pair.tainted.nameRu"
              referrerpolicy="no-referrer"
              loading="lazy"
              draggable="false"
            />
            <img
              v-else-if="pair.tainted.icon"
              class="portrait-img"
              :src="pair.tainted.icon"
              :alt="pair.tainted.nameRu"
              loading="lazy"
              draggable="false"
            />
            <span v-else class="portrait-fallback">?</span>
          </button>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-for="win in openWindows"
        :key="win.key"
        :ref="(el) => setPopupEl(win.key, el)"
        class="char-unlock-popup"
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
        <div class="popup-header">
          <span v-if="itemFor(win.key)?.achievementId" class="popup-id">
            #{{ itemFor(win.key).achievementId }}
          </span>
          <span v-else class="popup-id">старт</span>
          <n-tag
            size="small"
            :type="itemFor(win.key)?.unlocked ? 'success' : 'error'"
          >
            {{ itemFor(win.key)?.unlocked ? 'Открыто' : 'Закрыто' }}
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
            :is="itemFor(win.key)?.unlockUrl ? 'a' : 'div'"
            class="popup-icon-wrap"
            :href="itemFor(win.key)?.unlockUrl || undefined"
            :target="itemFor(win.key)?.unlockUrl ? '_blank' : undefined"
            :rel="itemFor(win.key)?.unlockUrl ? 'noopener noreferrer' : undefined"
            :title="itemFor(win.key)?.unlockTitle || undefined"
          >
            <img
              v-if="itemFor(win.key)?.icon || itemFor(win.key)?.portraitUrl"
              class="popup-icon"
              :src="itemFor(win.key)?.icon || itemFor(win.key)?.portraitUrl"
              :alt="itemFor(win.key)?.nameRu || ''"
              referrerpolicy="no-referrer"
            />
          </component>
          <div class="popup-info">
            <div class="name-ru">{{ itemFor(win.key)?.nameRu }}</div>
            <div v-if="itemFor(win.key)?.nameEn" class="name-en">
              {{ itemFor(win.key).nameEn }}
            </div>
            <div
              v-if="itemFor(win.key)?.unlockTitle || itemFor(win.key)?.unlockUrl"
              class="meta-row"
            >
              <span class="label">Открывает</span>
              <a
                v-if="itemFor(win.key)?.unlockUrl"
                :href="itemFor(win.key).unlockUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ itemFor(win.key).unlockTitle || itemFor(win.key).unlockUrl }}
              </a>
              <span v-else>{{ itemFor(win.key)?.unlockTitle }}</span>
            </div>
            <div class="meta-row">
              <span class="label">Хард-метки</span>
              <span>{{ itemFor(win.key)?.hardDone }}/{{ MARKS_PER_CHARACTER }}</span>
            </div>
          </div>
        </div>

        <div v-if="marksFor(win.key).length" class="popup-marks">
          <div class="label">Метки листа</div>
          <div class="marks-grid">
            <component
              :is="mark.href ? 'a' : 'div'"
              v-for="mark in marksFor(win.key)"
              :key="mark.key"
              class="mark-chip"
              :class="mark.level"
              :href="mark.href || undefined"
              :target="mark.href ? '_blank' : undefined"
              :rel="mark.href ? 'noopener noreferrer' : undefined"
              :title="markTitle(mark)"
              @click.stop
            >
              <img
                v-if="mark.iconUrl"
                class="mark-icon"
                :src="mark.iconUrl"
                :alt="mark.title"
                referrerpolicy="no-referrer"
                loading="lazy"
                draggable="false"
              />
              <span v-else class="mark-fallback">?</span>
            </component>
          </div>
        </div>

        <div
          v-if="
            itemFor(win.key)?.conditionHtml ||
            itemFor(win.key)?.condition ||
            !itemFor(win.key)?.achievementId
          "
          class="popup-condition"
        >
          <div class="label">Как получить</div>
          <div
            v-if="itemFor(win.key)?.conditionHtml"
            class="condition-html"
            v-html="itemFor(win.key).conditionHtml"
          />
          <div v-else-if="itemFor(win.key)?.condition">
            {{ itemFor(win.key).condition }}
          </div>
          <div v-else>Доступен с начала игры</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PopupDragBar from './PopupDragBar.vue'
import { useAnchoredPopup } from '../composables/useAnchoredPopup.js'
import { allowFandomImages } from '../utils/achievements.js'
import {
  MARKS_PER_CHARACTER,
  NORMAL_CHARACTER_COUNT,
  TAINTED_HEART_ICON,
  TAINTED_HEART_MARK,
  columnMarkSpec,
  countFullyCompletedCharacters,
  hasTickRow,
  isHard,
  markLevel,
  resolveCellLevel,
} from '../utils/marks.js'
import {
  CHARACTER_UNLOCK_PAIRS,
  TAINTED_UNLOCK_ID_BY_NAME,
} from '../utils/ungroupedAchievements.js'

const WHEEL_SIZE = 820
const R_INNER = 250
const R_OUTER = 340

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
  isPinnedKey,
} = useAnchoredPopup({
  width: 360,
})

const props = defineProps({
  achievements: {
    type: Array,
    required: true,
  },
  metaById: {
    type: Object,
    default: () => ({}),
  },
  sheets: {
    type: Array,
    default: () => [],
  },
  checklist: {
    type: Array,
    default: null,
  },
})

const base = import.meta.env.BASE_URL

function sheetPortrait(sheetId, index) {
  const sheet = props.sheets.find((s) => s.id === sheetId)
  const row = sheet?.rows?.filter((r) => r.character?.kind === 'character')[index]
  return row?.character || null
}

function isUnlocked(achId) {
  if (achId == null) return true
  return Boolean(props.achievements[achId - 1])
}

function countHardMarks(charIndex) {
  const marks = props.checklist?.[charIndex]
  if (!marks) return 0
  let n = 0
  for (let m = 0; m < MARKS_PER_CHARACTER; m++) {
    if (isHard(marks[m])) n++
  }
  return n
}

function buildSlot(achId, sheetChar, tainted, charIndex) {
  const meta = achId != null ? props.metaById[achId] || {} : {}
  const unlocked = isUnlocked(achId)
  const hardDone = countHardMarks(charIndex)
  const nameRu =
    sheetChar?.nameRu ||
    meta.unlockTitleRu ||
    meta.nameRu ||
    (achId != null ? `#${achId}` : 'Исаак')
  const rawHtml = meta.conditionHtmlRu || meta.conditionHtml || null
  return {
    key: `${tainted ? 't' : 'n'}-${achId ?? 'free'}`,
    achievementId: achId,
    charIndex,
    sheetId: tainted ? 'tainted' : 'normal',
    unlocked,
    hardDone,
    progress: Math.round((hardDone / MARKS_PER_CHARACTER) * 100),
    nameRu,
    nameEn: meta.nameEn || null,
    portraitUrl: sheetChar?.iconUrl || null,
    icon: meta.icon ? `${base}${meta.icon}` : null,
    unlockUrl: meta.unlockUrlRu || meta.unlockUrlEn || sheetChar?.wikiUrl || null,
    unlockTitle:
      meta.unlockTitleRu || meta.unlockTitleEn || sheetChar?.nameRu || null,
    condition: meta.conditionRu || meta.condition || null,
    conditionHtml: allowFandomImages(rawHtml),
  }
}

const pairs = computed(() =>
  CHARACTER_UNLOCK_PAIRS.map((pair, index) => {
    const normalChar = sheetPortrait('normal', index)
    const taintedChar = sheetPortrait('tainted', index)
    const taintedAchId =
      (taintedChar && TAINTED_UNLOCK_ID_BY_NAME[taintedChar.nameRu]) ||
      pair.taintedAchId
    return {
      key: pair.key,
      normal: buildSlot(pair.normalAchId, normalChar, false, index),
      tainted: buildSlot(
        taintedAchId,
        taintedChar,
        true,
        NORMAL_CHARACTER_COUNT + index,
      ),
    }
  }),
)

const totalCount = computed(() => CHARACTER_UNLOCK_PAIRS.length * 2)

const unlockedCount = computed(() => {
  let n = 0
  for (const pair of pairs.value) {
    if (pair.normal.unlocked) n++
    if (pair.tainted.unlocked) n++
  }
  return n
})

const completedStats = computed(() =>
  countFullyCompletedCharacters(props.checklist),
)
const completedCount = computed(() => completedStats.value.done)
const completedTotal = computed(() => completedStats.value.total)

const visiblePairs = computed(() => pairs.value)

function portraitClass(slot) {
  return {
    yes: slot.unlocked,
    no: !slot.unlocked,
    full: slot.unlocked && slot.progress >= 100,
    pinned: isPinnedKey(slot.key),
  }
}

function portraitTitle(slot) {
  if (!slot.unlocked) return slot.nameRu
  return `${slot.nameRu} · хард ${slot.hardDone}/${MARKS_PER_CHARACTER}`
}

function portraitStyle(slot, index, ring) {
  return {
    ...slotStyle(index, ring),
    '--progress': String(slot.progress ?? 0),
  }
}

const wheelSize = WHEEL_SIZE

function spokeAngle(index) {
  const n = Math.max(visiblePairs.value.length, 1)
  return -Math.PI / 2 + (index * 2 * Math.PI) / n
}

function slotStyle(index, ring) {
  const angle = spokeAngle(index)
  const r = ring === 'inner' ? R_INNER : R_OUTER
  const cx = WHEEL_SIZE / 2
  const cy = WHEEL_SIZE / 2
  return {
    left: `${cx + r * Math.cos(angle)}px`,
    top: `${cy + r * Math.sin(angle)}px`,
  }
}

function spokeLineStyle(index) {
  const angle = spokeAngle(index)
  const cx = WHEEL_SIZE / 2
  const cy = WHEEL_SIZE / 2
  const length = R_OUTER - R_INNER
  const mid = (R_INNER + R_OUTER) / 2
  const deg = (angle * 180) / Math.PI + 90
  return {
    left: `${cx + mid * Math.cos(angle)}px`,
    top: `${cy + mid * Math.sin(angle)}px`,
    width: '2px',
    height: `${length}px`,
    transform: `translate(-50%, -50%) rotate(${deg}deg)`,
  }
}

function ringStyle(radius) {
  const size = radius * 2
  return {
    width: `${size}px`,
    height: `${size}px`,
  }
}

const itemsByKey = computed(() => {
  const map = new Map()
  for (const pair of pairs.value) {
    map.set(pair.normal.key, pair.normal)
    map.set(pair.tainted.key, pair.tainted)
  }
  return map
})

function itemFor(key) {
  return itemsByKey.value.get(key) || null
}

function marksFor(key) {
  const item = itemFor(key)
  return item ? buildSheetMarks(item) : []
}

function buildSheetMarks(slot) {
  const sheet = props.sheets.find((s) => s.id === slot.sheetId)
  if (!sheet) return []
  const marks = props.checklist?.[slot.charIndex] || null
  const items = []

  if (slot.sheetId === 'tainted') {
    items.push({
      key: 'heart',
      title: TAINTED_HEART_ICON.title,
      iconUrl: TAINTED_HEART_ICON.iconUrl,
      href: TAINTED_HEART_ICON.href || null,
      level: marks ? markLevel(marks[TAINTED_HEART_MARK]) : 'none',
    })
  }

  for (const col of sheet.columns) {
    if (col.kind === 'character') continue
    const spec = columnMarkSpec(slot.sheetId, col.index)
    if (!spec || spec.mode === 'full' || spec.mode === 'greedier') continue

    if (hasTickRow(spec) && col.parts?.length) {
      for (let i = 0; i < spec.marks.length; i++) {
        const part = col.parts[i]
        const raw = marks ? marks[spec.marks[i]] : 0
        items.push({
          key: `${col.index}-${i}`,
          title: part?.title || col.title,
          iconUrl: part?.iconUrl || col.iconUrl || null,
          href: part?.href || col.href || null,
          level: marks ? markLevel(raw) : 'none',
        })
      }
      continue
    }

    // Greed: одна ячейка, half = Greed, hard = Greedier
    if (spec.mode === 'greed' || spec.mode === 'greed-tainted') {
      const raw = marks ? marks[spec.marks[0]] : 0
      items.push({
        key: 'greed',
        title: col.title,
        iconUrl: col.iconUrl || null,
        href: col.href || null,
        isGreed: true,
        level: marks ? markLevel(raw) : 'none',
      })
      continue
    }

    items.push({
      key: String(col.index),
      title: col.title,
      iconUrl: col.iconUrl || null,
      href: col.href || null,
      level: marks && spec ? resolveCellLevel(marks, spec) : 'none',
    })
  }

  return items
}

function markTitle(mark) {
  if (mark.isGreed) {
    if (mark.level === 'hard') return `${mark.title} · Greedier`
    if (mark.level === 'normal') return `${mark.title} · Greed`
    return `${mark.title} · не пройдено`
  }
  if (mark.level === 'hard') return `${mark.title} · Hard`
  if (mark.level === 'normal') return `${mark.title} · Normal`
  return `${mark.title} · не пройдено`
}

</script>

<style scoped>
.char-unlocks {
  width: 100%;
  user-select: none;
  -webkit-user-select: none;
}

.wheel-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  overflow-x: auto;
  padding-bottom: 8px;
}

.wheel-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9ca3af;
}

.legend-normal {
  color: #7dd3b0;
}

.legend-tainted {
  color: #c4a0d8;
}

.legend-sep {
  opacity: 0.5;
}

.wheel {
  position: relative;
  flex: 0 0 auto;
  margin: 0 auto;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 45%, rgba(90, 70, 110, 0.22), transparent 42%),
    radial-gradient(circle at 50% 50%, #1c1d22 0%, #141518 70%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 16px 40px rgba(0, 0, 0, 0.35);
  animation: wheel-in 0.55s ease-out both;
}

@keyframes wheel-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.wheel-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  pointer-events: none;
  border: 1px dashed rgba(255, 255, 255, 0.08);
}

.wheel-ring-outer {
  border-color: rgba(196, 160, 216, 0.16);
}

.wheel-hubs {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  z-index: 1;
}

.wheel-hub {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: radial-gradient(circle at 40% 35%, #2a2d35, #17181c 70%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 24px rgba(0, 0, 0, 0.35);
}

.hub-unlock {
  animation: hub-pulse-green 2.8s ease-in-out infinite;
}

.hub-complete {
  animation: hub-pulse-gold 2.8s ease-in-out infinite;
  border-color: rgba(240, 192, 96, 0.28);
}

.hub-label {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
}

@keyframes hub-pulse-green {
  0%,
  100% {
    box-shadow: 0 0 16px rgba(99, 226, 183, 0.08);
  }
  50% {
    box-shadow: 0 0 26px rgba(99, 226, 183, 0.2);
  }
}

@keyframes hub-pulse-gold {
  0%,
  100% {
    box-shadow: 0 0 16px rgba(240, 192, 96, 0.08);
  }
  50% {
    box-shadow: 0 0 26px rgba(240, 192, 96, 0.22);
  }
}

.hub-count {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  color: #e8e8e8;
}

.hub-complete .hub-count {
  color: #f0c060;
}

.hub-total {
  font-size: 0.75rem;
  color: #9ca3af;
}

.spoke-line {
  position: absolute;
  border-radius: 999px;
  background: linear-gradient(
    to bottom,
    rgba(99, 226, 183, 0.35),
    rgba(196, 160, 216, 0.45)
  );
  opacity: 0.55;
  pointer-events: none;
  z-index: 0;
}

.portrait {
  appearance: none;
  position: absolute;
  z-index: 1;
  border: 2px solid transparent;
  border-radius: 50%;
  background: #232428;
  padding: 0;
  width: 78px;
  height: 78px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transform: translate(-50%, -50%);
  transition:
    border-color 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
  box-sizing: border-box;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.portrait:hover {
  z-index: 3;
  transform: translate(-50%, -50%) scale(1.1);
}

.portrait.yes {
  /* заливка + кольцо: золото = хард-метки, зелёный = остаток */
  border-color: transparent;
  background:
    conic-gradient(
      from 0deg,
      #3d3018 calc(var(--progress, 0) * 1%),
      #1a3d2e 0
    )
      padding-box,
    conic-gradient(
      from 0deg,
      #f0c060 calc(var(--progress, 0) * 1%),
      #63e2b7 0
    )
      border-box;
  background-origin: border-box;
  background-clip: padding-box, border-box;
  box-shadow: 0 0 0 1px rgba(99, 226, 183, 0.25), 0 4px 14px rgba(0, 0, 0, 0.35);
}

.portrait.yes.full {
  box-shadow: 0 0 0 1px rgba(240, 192, 96, 0.35), 0 4px 14px rgba(0, 0, 0, 0.35);
}

.portrait.no {
  background: #3d1a1a;
  border-color: #e88080;
}

.portrait.no .portrait-img {
  opacity: 0.4;
  filter: grayscale(0.8);
}

.portrait.outer {
  width: 86px;
  height: 86px;
}

.portrait-img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  image-rendering: pixelated;
  pointer-events: none;
}

.portrait.outer .portrait-img {
  width: 64px;
  height: 64px;
}

.portrait-fallback {
  width: 58px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-weight: 700;
}

@media (max-width: 960px) {
  .wheel-wrap {
    --wheel-scale: 0.78;
  }

  .wheel {
    margin-bottom: calc((1 - var(--wheel-scale)) * -820px * 0.5);
    transform: scale(var(--wheel-scale));
    transform-origin: top center;
    animation: none;
    opacity: 1;
  }
}

@media (max-width: 720px) {
  .wheel-wrap {
    --wheel-scale: 0.58;
  }
}
</style>

<style>
.char-unlock-popup {
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
  user-select: none;
  -webkit-user-select: none;
  opacity: 0;
  max-width: min(360px, calc(100vw - 16px));
  max-height: min(var(--popup-max-h, 100dvh), calc(100dvh - 16px));
}

.char-unlock-popup.ready {
  opacity: 1;
}

.char-unlock-popup.pinned {
  border-color: #63e2b7;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
}

.char-unlock-popup.ephemeral .popup-drag-bar {
  pointer-events: none;
}

.char-unlock-popup .popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.char-unlock-popup .popup-id {
  font-weight: 700;
  color: #70c0e8;
}

.char-unlock-popup .pin-hint {
  margin-left: auto;
  font-size: 0.7rem;
  color: #9ca3af;
  visibility: hidden;
}

.char-unlock-popup .pin-hint.visible {
  visibility: visible;
}

.char-unlock-popup .popup-body {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}

.char-unlock-popup .popup-icon-wrap {
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

.char-unlock-popup a.popup-icon-wrap:hover {
  outline: 1px solid #70c0e8;
}

.char-unlock-popup .popup-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
  image-rendering: pixelated;
}

.char-unlock-popup .popup-info {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.char-unlock-popup .name-ru {
  font-size: 1.05rem;
  font-weight: 700;
}

.char-unlock-popup .name-en {
  color: #9ca3af;
  font-style: italic;
  margin-bottom: 6px;
}

.char-unlock-popup .meta-row {
  margin-top: 4px;
  word-break: break-word;
}

.char-unlock-popup .meta-row .label,
.char-unlock-popup .popup-condition .label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
  margin-bottom: 2px;
}

.char-unlock-popup .popup-marks {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #3a3a42;
}

.char-unlock-popup .popup-marks .label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
  margin-bottom: 8px;
}

.char-unlock-popup .marks-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

.char-unlock-popup .mark-chip {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 2px solid #e88080;
  background: #e8d4d4;
  overflow: hidden;
  box-sizing: border-box;
  text-decoration: none;
  color: inherit;
  cursor: default;
}

.char-unlock-popup a.mark-chip {
  cursor: pointer;
}

.char-unlock-popup a.mark-chip:hover {
  outline: 1px solid #70c0e8;
  outline-offset: 1px;
}

.char-unlock-popup .mark-chip.normal {
  border: 2px solid transparent;
  background:
    linear-gradient(45deg, #d4e8df 50%, #e8d4d4 50%) padding-box,
    linear-gradient(45deg, #63e2b7 50%, #e88080 50%) border-box;
  background-origin: border-box;
  background-clip: padding-box, border-box;
}

.char-unlock-popup .mark-chip.hard {
  border-color: #63e2b7;
  background: #d4e8df;
}

.char-unlock-popup .mark-icon {
  width: 78%;
  height: 78%;
  object-fit: contain;
  image-rendering: pixelated;
}

.char-unlock-popup .mark-fallback {
  color: #9ca3af;
  font-weight: 700;
  font-size: 0.75rem;
}

.char-unlock-popup .popup-condition {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #3a3a42;
}

.char-unlock-popup .condition-html a,
.char-unlock-popup .meta-row a {
  color: #70c0e8;
}

.char-unlock-popup .condition-html a:hover,
.char-unlock-popup .meta-row a:hover {
  text-decoration: underline;
}

.char-unlock-popup .condition-html img.condition-icon,
.char-unlock-popup .condition-html .condition-icon {
  display: inline-block;
  height: 32px;
  width: auto;
  vertical-align: middle;
  margin: 0 2px;
  image-rendering: pixelated;
}
</style>
