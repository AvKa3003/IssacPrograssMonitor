<template>
  <div
    class="popup-drag-bar"
    :class="{ dragging, disabled: !interactive }"
    :title="interactive ? 'Перетащить' : undefined"
    @pointerdown="onPointerDown"
  >
    <div class="popup-drag-grip" aria-hidden="true" />
    <button
      v-if="showClose"
      type="button"
      class="popup-close"
      aria-label="Закрыть"
      title="Закрыть"
      @pointerdown.stop
      @click.stop="$emit('close')"
    >
      ×
    </button>
  </div>
</template>

<script setup>
const props = defineProps({
  showClose: {
    type: Boolean,
    default: false,
  },
  dragging: {
    type: Boolean,
    default: false,
  },
  /** false на hover-превью — ручка не перехватывает курсор */
  interactive: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['dragstart', 'close'])

function onPointerDown(event) {
  if (!props.interactive) return
  emit('dragstart', event)
}
</script>

<style scoped>
.popup-drag-bar {
  position: relative;
  flex: 0 0 auto;
  height: 28px;
  margin: -12px -12px 10px;
  border-radius: 10px 10px 0 0;
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #242424;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.45);
  border-bottom: 1px solid #1a1a1a;
}

.popup-drag-bar.disabled {
  pointer-events: none;
  cursor: default;
}

.popup-drag-bar:active:not(.disabled),
.popup-drag-bar.dragging {
  cursor: grabbing;
  background: #2a2a2a;
}

/* Вертикальные «рёбра» как в Factorio — почти на всю ширину */
.popup-drag-grip {
  width: calc(100% - 52px);
  height: 12px;
  margin: 0 26px;
  border-radius: 1px;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    90deg,
    #0d0d0d 0,
    #0d0d0d 1px,
    #2e2e2e 1px,
    #2e2e2e 2px,
    #1a1a1a 2px,
    #1a1a1a 3px
  );
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35);
  opacity: 0.95;
}

.popup-close {
  appearance: none;
  position: absolute;
  top: 50%;
  right: 5px;
  transform: translateY(-50%);
  width: 20px;
  height: 18px;
  padding: 0;
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  background: linear-gradient(180deg, #3a3a3a, #262626);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 1px 0 rgba(0, 0, 0, 0.4);
  color: #d4d4d4;
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-close:hover {
  color: #fff;
  background: linear-gradient(180deg, #454545, #303030);
}
</style>
