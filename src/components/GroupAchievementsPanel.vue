<template>
  <div>
    <div class="stats groups-filters">
      <n-checkbox v-model:checked="onlyLockedProxy">
        Только неоткрытые
      </n-checkbox>
      <n-button-group class="view-switch">
        <n-button
          size="small"
          :type="viewModeProxy === 'grid' ? 'primary' : 'default'"
          @click="viewModeProxy = 'grid'"
        >
          Сетка
        </n-button>
        <n-button
          size="small"
          :type="viewModeProxy === 'cards' ? 'primary' : 'default'"
          @click="viewModeProxy = 'cards'"
        >
          Карточки
        </n-button>
      </n-button-group>
    </div>

    <AchievementGrid
      v-if="viewModeProxy === 'grid'"
      :achievements="achievements"
      :meta-by-id="metaById"
      :ids="ids"
      :only-locked="onlyLockedProxy"
    />
    <AchievementCards
      v-else
      :achievements="achievements"
      :meta-by-id="metaById"
      :ids="ids"
      :only-locked="onlyLockedProxy"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AchievementGrid from './AchievementGrid.vue'
import AchievementCards from './AchievementCards.vue'

const props = defineProps({
  achievements: {
    type: Array,
    required: true,
  },
  metaById: {
    type: Object,
    default: () => ({}),
  },
  ids: {
    type: Array,
    required: true,
  },
  onlyLocked: {
    type: Boolean,
    default: false,
  },
  viewMode: {
    type: String,
    default: 'cards',
  },
})

const emit = defineEmits(['update:onlyLocked', 'update:viewMode'])

const onlyLockedProxy = computed({
  get: () => props.onlyLocked,
  set: (v) => emit('update:onlyLocked', v),
})

const viewModeProxy = computed({
  get: () => props.viewMode,
  set: (v) => emit('update:viewMode', v),
})
</script>

<style scoped>
.groups-filters {
  margin-bottom: 8px;
}

.view-switch {
  margin-left: auto;
}

.stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
</style>
