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
              <p class="groups-placeholder">
                Группировка достижений по смыслу появится здесь позже.
              </p>
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
import { parseAchievements } from './parseSave.js'
import { loadSavedProgress, saveProgress, clearSavedProgress } from './saveStore.js'

const fileName = ref('')
const achievements = ref(null)
const unlockedCount = ref(0)
const activeTab = ref('achievements')
const achievementMeta = ref([])
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
    unlockedCount.value = cached.unlockedCount
    onlyLocked.value = cached.onlyLocked
    viewMode.value = cached.viewMode
    activeTab.value = 'achievements'
  }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/achievements.json`)
    if (!res.ok) return
    const data = await res.json()
    achievementMeta.value = data.achievements || []
  } catch {
    /* мета ещё не спарсена — сетка покажет номера */
  }
})

async function onFile(file) {
  try {
    const buffer = await file.arrayBuffer()
    const result = parseAchievements(buffer)
    achievements.value = result.achievements
    unlockedCount.value = result.unlockedCount
    fileName.value = file.name
    activeTab.value = 'achievements'
    persist()
  } catch (err) {
    achievements.value = null
    unlockedCount.value = 0
    fileName.value = ''
    clearSavedProgress()
    window.alert(err.message || 'Не удалось разобрать файл')
  }
}
</script>

<style scoped>
.app {
  max-width: 960px;
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
</style>

<style>
/* Naive UI: overflow:hidden на pane-wrapper ломает position:sticky у заголовков сетки */
.tabs .n-tabs-pane-wrapper,
.tabs .n-tab-pane {
  overflow: visible !important;
}
</style>
