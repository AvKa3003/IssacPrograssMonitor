<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <div class="app">
        <header class="header">
          <h1 class="title">Isaac Progress</h1>
          <p class="subtitle">The Binding of Isaac: Repentance+ — просмотр прогресса</p>
        </header>

        <FileDropZone
          :has-file="!!fileName"
          :file-name="fileName"
          @file="onFile"
        />

        <template v-if="achievements">
          <n-tabs
            v-model:value="activeTab"
            type="line"
            :animated="false"
            class="tabs"
          >
            <n-tab-pane
              name="achievements"
              tab="Все достижения"
              display-directive="show"
            >
              <div class="stats">
                <n-tag type="success" size="large">
                  {{ unlockedCount }} / {{ achievements.length }}
                </n-tag>
                <n-checkbox v-model:checked="onlyLocked">
                  Только неоткрытые
                  <template v-if="onlyLocked">
                    ({{ lockedCount }})
                  </template>
                </n-checkbox>
                <n-button-group class="view-switch">
                  <n-button
                    size="small"
                    :type="viewMode === 'grid' ? 'primary' : 'default'"
                    @click="viewMode = 'grid'"
                  >
                    Сетка
                  </n-button>
                  <n-button
                    size="small"
                    :type="viewMode === 'cards' ? 'primary' : 'default'"
                    @click="viewMode = 'cards'"
                  >
                    Карточки
                  </n-button>
                </n-button-group>
              </div>
              <AchievementGrid
                v-if="viewMode === 'grid'"
                :achievements="achievements"
                :meta-by-id="metaById"
                :only-locked="onlyLocked"
              />
              <AchievementCards
                v-else
                :achievements="achievements"
                :meta-by-id="metaById"
                :only-locked="onlyLocked"
              />
            </n-tab-pane>

            <n-tab-pane
              name="characters"
              tab="Лист персонажей"
              display-directive="show"
            >
              <CharacterSheets
                v-if="characterSheets.length"
                :sheets="characterSheets"
                :achievements="achievements"
                :checklist="checklist"
                :meta-by-id="metaById"
              />
              <p v-else class="groups-placeholder">
                Нет данных листа. Выполни:
                <code>npm run scrape:sheets</code>
              </p>
            </n-tab-pane>
            <n-tab-pane
              name="char-unlocks"
              tab="Персонажи"
              display-directive="show"
            >
              <CharacterUnlocks
                :achievements="achievements"
                :meta-by-id="metaById"
                :sheets="characterSheets"
                :checklist="checklist"
              />
            </n-tab-pane>
            <n-tab-pane
              name="story-progress"
              tab="Прогресс прохождения"
              display-directive="show"
            >
              <GroupAchievementsPanel
                v-model:only-locked="groupsOnlyLocked"
                v-model:view-mode="groupsViewMode"
                :achievements="achievements"
                :meta-by-id="metaById"
                :ids="storyProgressIds"
              />
            </n-tab-pane>
            <n-tab-pane
              name="challenges"
              tab="Испытания"
              display-directive="show"
            >
              <GroupAchievementsPanel
                v-model:only-locked="groupsOnlyLocked"
                v-model:view-mode="groupsViewMode"
                :achievements="achievements"
                :meta-by-id="metaById"
                :ids="challengeIds"
              />
            </n-tab-pane>
            <n-tab-pane
              name="misc"
              tab="Разное"
              display-directive="show"
            >
              <GroupAchievementsPanel
                v-model:only-locked="groupsOnlyLocked"
                v-model:view-mode="groupsViewMode"
                :achievements="achievements"
                :meta-by-id="metaById"
                :ids="miscIds"
              />
            </n-tab-pane>
            <n-tab-pane
              name="special"
              tab="Особые условия"
              display-directive="show"
            >
              <GroupAchievementsPanel
                v-model:only-locked="groupsOnlyLocked"
                v-model:view-mode="groupsViewMode"
                :achievements="achievements"
                :meta-by-id="metaById"
                :ids="specialConditionIds"
              />
            </n-tab-pane>
            <n-tab-pane
              name="donation"
              tab="Донатные машины"
              display-directive="show"
            >
              <GroupAchievementsPanel
                v-model:only-locked="groupsOnlyLocked"
                v-model:view-mode="groupsViewMode"
                :achievements="achievements"
                :meta-by-id="metaById"
                :ids="donationIds"
              />
            </n-tab-pane>
            <n-tab-pane
              v-if="sheetsReady && ungroupedIds.length"
              name="ungrouped"
              :tab="`Вне блоков (${ungroupedIds.length})`"
              display-directive="show"
            >
              <p class="ungrouped-hint">
                Достижения, которых ещё нет ни в одном блоке групп.
                Номера помогают понять, что осталось обернуть в UI.
              </p>
              <p class="ungrouped-stats">
                В группах: {{ groupedCount }} · вне блоков:
                {{ ungroupedIds.length }} · всего:
                {{ achievements.length }}
              </p>
              <div class="ungrouped-list">
                <span
                  v-for="id in ungroupedIds"
                  :key="id"
                  class="ungrouped-id"
                  :title="metaById[id]?.nameRu || `#${id}`"
                >{{ id }}</span>
              </div>
            </n-tab-pane>
          </n-tabs>
        </template>
      </div>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { darkTheme } from 'naive-ui'
import FileDropZone from './components/FileDropZone.vue'
import AchievementGrid from './components/AchievementGrid.vue'
import AchievementCards from './components/AchievementCards.vue'
import CharacterSheets from './components/CharacterSheets.vue'
import CharacterUnlocks from './components/CharacterUnlocks.vue'
import GroupAchievementsPanel from './components/GroupAchievementsPanel.vue'
import { parseAchievements } from './parseSave.js'
import { loadSavedProgress, saveProgress, clearSavedProgress } from './saveStore.js'
import {
  STORY_PROGRESS_ACHIEVEMENT_IDS,
  CHALLENGE_ACHIEVEMENT_IDS,
  MISC_ACHIEVEMENT_IDS,
  SPECIAL_CONDITION_ACHIEVEMENT_IDS,
  DONATION_ACHIEVEMENT_IDS,
  collectGroupedAchievementIds,
  listUngroupedAchievementIds,
} from './utils/ungroupedAchievements.js'

const fileName = ref('')
const achievements = ref(null)
const checklist = ref(null)
const unlockedCount = ref(0)
const activeTab = ref('achievements')
const achievementMeta = ref([])
const characterSheets = ref([])
const sheetsReady = ref(false)
const onlyLocked = ref(false)
const groupsOnlyLocked = ref(false)
const viewMode = ref('grid')
const groupsViewMode = ref('cards')

const lockedCount = computed(() =>
  achievements.value
    ? achievements.value.length - unlockedCount.value
    : 0,
)

const metaById = computed(() => {
  const map = {}
  for (const item of achievementMeta.value) {
    map[item.id] = item
  }
  return map
})

const storyProgressIds = STORY_PROGRESS_ACHIEVEMENT_IDS
const challengeIds = CHALLENGE_ACHIEVEMENT_IDS
const miscIds = MISC_ACHIEVEMENT_IDS
const specialConditionIds = SPECIAL_CONDITION_ACHIEVEMENT_IDS
const donationIds = DONATION_ACHIEVEMENT_IDS

const groupedIds = computed(() =>
  collectGroupedAchievementIds(characterSheets.value),
)

const groupedCount = computed(() => groupedIds.value.size)

const ungroupedIds = computed(() =>
  listUngroupedAchievementIds(
    achievements.value?.length || 0,
    groupedIds.value,
  ),
)

function persist() {
  if (!achievements.value || !fileName.value) return
  saveProgress({
    fileName: fileName.value,
    achievements: achievements.value,
    checklist: checklist.value,
    unlockedCount: unlockedCount.value,
    onlyLocked: onlyLocked.value,
    viewMode: viewMode.value,
  })
}

watch([onlyLocked, viewMode], () => {
  if (achievements.value) persist()
})

onMounted(async () => {
  // Сначала статические данные: иначе при кэше сейва на долю секунды
  // «Вне блоков» считает лист пустым и раздувается.
  await Promise.all([
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/achievements.json`)
        if (res.ok) {
          const data = await res.json()
          achievementMeta.value = data.achievements || []
        }
      } catch {
        /* мета ещё не спарсена */
      }
    })(),
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}data/character-sheets.json`,
        )
        if (res.ok) {
          const data = await res.json()
          characterSheets.value = data.sheets || []
        }
      } catch {
        /* лист ещё не спарсен */
      }
    })(),
  ])
  sheetsReady.value = true

  const cached = loadSavedProgress()
  if (cached) {
    fileName.value = cached.fileName
    achievements.value = cached.achievements
    checklist.value = cached.checklist || null
    unlockedCount.value = cached.unlockedCount
    onlyLocked.value = cached.onlyLocked
    viewMode.value = cached.viewMode
    activeTab.value = 'achievements'
  }
})

async function onFile(file) {
  try {
    const buffer = await file.arrayBuffer()
    const result = parseAchievements(buffer)
    achievements.value = result.achievements
    checklist.value = result.checklist
    unlockedCount.value = result.unlockedCount
    fileName.value = file.name
    activeTab.value = 'achievements'
    persist()
  } catch (err) {
    achievements.value = null
    checklist.value = null
    unlockedCount.value = 0
    fileName.value = ''
    clearSavedProgress()
    window.alert(err.message || 'Не удалось разобрать файл')
  }
}
</script>

<style scoped>
.app {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.header {
  margin-bottom: 24px;
}

.title {
  margin: 0 0 4px;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  color: #9ca3af;
  font-size: 0.95rem;
}

.tabs {
  margin-top: 28px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.view-switch {
  margin-left: auto;
}

.groups-placeholder {
  margin: 24px 0;
  color: #9ca3af;
  font-size: 0.95rem;
}

.groups-placeholder code {
  color: #70c0e8;
}

.ungrouped-hint {
  margin: 8px 0 12px;
  color: #9ca3af;
  font-size: 0.9rem;
  max-width: 52rem;
}

.ungrouped-stats {
  margin: 0 0 14px;
  font-size: 0.9rem;
  color: #c8c8c8;
}

.ungrouped-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ungrouped-id {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  padding: 4px 6px;
  border-radius: 4px;
  background: #2a2d33;
  color: #e8e8e8;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, monospace;
}
</style>

<style>
/* Naive UI: overflow:hidden на pane-wrapper ломает position:sticky у заголовков сетки */
.tabs .n-tabs-pane-wrapper,
.tabs .n-tab-pane {
  overflow: visible !important;
}
</style>
