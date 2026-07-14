<template>
  <div class="cards">
    <article
      v-for="item in items"
      :key="item.id"
      class="card"
      :class="item.unlocked ? 'yes' : 'no'"
    >
      <div class="card-header">
        <span class="card-id">#{{ item.id }}</span>
        <n-tag
          size="small"
          :type="item.unlocked ? 'success' : 'error'"
        >
          {{ item.unlocked ? 'Открыто' : 'Закрыто' }}
        </n-tag>
      </div>

      <div class="card-body">
        <component
          :is="item.unlockUrl ? 'a' : 'div'"
          class="card-icon-wrap"
          :href="item.unlockUrl || undefined"
          :target="item.unlockUrl ? '_blank' : undefined"
          :rel="item.unlockUrl ? 'noopener noreferrer' : undefined"
          :title="item.unlockTitle || undefined"
        >
          <img
            v-if="item.icon"
            class="card-icon"
            :src="item.icon"
            :alt="item.nameRu || `#${item.id}`"
            loading="lazy"
          />
          <span v-else class="card-icon-fallback">{{ item.id }}</span>
        </component>

        <div class="card-info">
          <div v-if="item.nameRu" class="name-ru">{{ item.nameRu }}</div>
          <div v-if="item.nameEn" class="name-en">{{ item.nameEn }}</div>
          <div
            v-if="item.unlockTitle || item.unlockUrl"
            class="meta-row"
          >
            <span class="label">Открывает</span>
            <a
              v-if="item.unlockUrl"
              :href="item.unlockUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ item.unlockTitle || item.unlockUrl }}
            </a>
            <span v-else>{{ item.unlockTitle }}</span>
          </div>
        </div>
      </div>

      <div
        v-if="item.conditionHtml || item.condition"
        class="card-condition"
      >
        <div class="label">Как получить</div>
        <div
          v-if="item.conditionHtml"
          class="condition-html"
          v-html="item.conditionHtml"
        />
        <div v-else>{{ item.condition }}</div>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildAchievementItems } from '../utils/achievements.js'

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

const items = computed(() =>
  buildAchievementItems(props.achievements, props.metaById, {
    onlyLocked: props.onlyLocked,
    baseUrl: import.meta.env.BASE_URL,
  }),
)
</script>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 720px) {
  .cards {
    grid-template-columns: 1fr;
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  background: #2a2d33;
  border: 2px solid #48484e;
  color: #e8e8e8;
  font-size: 0.875rem;
  line-height: 1.4;
}

.card.yes {
  border-color: transparent;
  background: #1e2a24;
}

.card.no {
  border-color: #e88080;
  background: #2a1e1e;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.card-id {
  font-weight: 700;
  color: #70c0e8;
}

.card-body {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.card-icon-wrap {
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

a.card-icon-wrap:hover {
  outline: 1px solid #70c0e8;
}

.card-icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
  image-rendering: pixelated;
}

.card.no .card-icon {
  opacity: 0.55;
  filter: grayscale(0.5);
}

.card-icon-fallback {
  color: #9ca3af;
  font-weight: 700;
}

.card-info {
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

.label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #9ca3af;
  margin-bottom: 2px;
}

.card-condition {
  padding-top: 10px;
  border-top: 1px solid #3a3a42;
}

.condition-html :deep(a),
.meta-row a {
  color: #70c0e8;
}

.condition-html :deep(a:hover),
.meta-row a:hover {
  text-decoration: underline;
}

.condition-html :deep(img.condition-icon) {
  display: inline-block;
  height: 1.4em;
  width: auto;
  vertical-align: middle;
  margin: 0 2px;
  image-rendering: pixelated;
}
</style>
