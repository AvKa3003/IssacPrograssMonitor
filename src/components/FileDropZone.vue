<template>
  <div
    class="dropzone"
    :class="{ dragover: isDragover, 'has-file': hasFile }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragEnter"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="openPicker"
  >
    <input
      ref="inputRef"
      type="file"
      class="hidden-input"
      accept=".dat,application/octet-stream"
      @change="onInputChange"
    />

    <template v-if="hasFile">
      <n-icon :component="CheckmarkCircleOutline" :size="36" color="#63e2b7" />
      <p class="main-text">{{ fileName }}</p>
      <p class="hint">Перетащите другой файл или нажмите, чтобы выбрать</p>
    </template>
    <template v-else>
      <n-icon :component="CloudUploadOutline" :size="40" color="#70c0e8" />
      <p class="main-text">Перетащите или выберите файл</p>
      <p class="hint">persistentgamedata*.dat</p>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { NIcon } from 'naive-ui'
import {
  CloudUploadOutline,
  CheckmarkCircleOutline,
} from '@vicons/ionicons5'

defineProps({
  hasFile: { type: Boolean, default: false },
  fileName: { type: String, default: '' },
})

const emit = defineEmits(['file'])

const inputRef = ref(null)
const isDragover = ref(false)
let dragCounter = 0

function openPicker() {
  inputRef.value?.click()
}

function acceptFile(file) {
  if (!file) return
  emit('file', file)
}

function onInputChange(e) {
  const file = e.target.files?.[0]
  acceptFile(file)
  e.target.value = ''
}

function onDragEnter() {
  dragCounter++
  isDragover.value = true
}

function onDragLeave() {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isDragover.value = false
  }
}

function onDrop(e) {
  dragCounter = 0
  isDragover.value = false
  const file = e.dataTransfer?.files?.[0]
  acceptFile(file)
}
</script>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  padding: 28px 20px;
  border: 2px dashed #48484e;
  border-radius: 12px;
  background: #232428;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.dropzone:hover,
.dropzone.dragover {
  border-color: #70c0e8;
  background: #2a2d33;
}

.dropzone.has-file {
  border-style: solid;
  border-color: #3a3a42;
}

.hidden-input {
  display: none;
}

.main-text {
  margin: 4px 0 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: #9ca3af;
}
</style>
