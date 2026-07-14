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
            <n-tab-pane name="achievements" tab="Все достижения">
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

            <n-tab-pane name="groups" tab="По группам">
              <n-tabs
                v-model:value="groupsSection"
                type="line"
                :animated="false"
                class="groups-inner-tabs"
              >
                <n-tab-pane name="characters" tab="Лист персонажей">
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
              </n-tabs>
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
import { parseAchievements } from './parseSave.js'
import { loadSavedProgress, saveProgress, clearSavedProgress } from './saveStore.js'

const fileName = ref('')
const achievements = ref(null)
const checklist = ref(null)
const unlockedCount = ref(0)
const activeTab = ref('achievements')
const groupsSection = ref('characters')
const achievementMeta = ref([])
const characterSheets = ref([])
const onlyLocked = ref(false)
const viewMode = ref('grid')

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

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/achievements.json`)
    if (res.ok) {
      const data = await res.json()
      achievementMeta.value = data.achievements || []
    }
  } catch {
    /* мета ещё не спарсена */
  }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/character-sheets.json`)
    if (res.ok) {
      const data = await res.json()
      characterSheets.value = data.sheets || []
    }
  } catch {
    /* лист ещё не спарсен */
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

.groups-inner-tabs {
  margin-top: 4px;
}

.groups-placeholder code {
  color: #70c0e8;
}
</style>

<style>
/* Naive UI: overflow:hidden на pane-wrapper ломает position:sticky у заголовков сетки */
.tabs .n-tabs-pane-wrapper,
.tabs .n-tab-pane {
  overflow: visible !important;
}
</style>
