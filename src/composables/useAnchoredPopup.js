import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const DEFAULTS = {
  width: 360,
  margin: 8,
  gap: 8,
  leaveSlack: 100,
  hideDelay: 120,
}

let zCounter = 4000

/**
 * Несколько закреплённых/перетаскиваемых попапов + один hover-превью.
 * @param {object} [options]
 * @param {number} [options.width]
 * @param {number} [options.margin]
 * @param {number} [options.gap]
 * @param {number} [options.leaveSlack]
 * @param {number} [options.hideDelay]
 */
export function useAnchoredPopup(options = {}) {
  const widthOpt = options.width ?? DEFAULTS.width
  const MARGIN = options.margin ?? DEFAULTS.margin
  const GAP = options.gap ?? DEFAULTS.gap
  const LEAVE_SLACK_PX = options.leaveSlack ?? DEFAULTS.leaveSlack
  const HIDE_DELAY_MS = options.hideDelay ?? DEFAULTS.hideDelay

  /** @type {import('vue').Ref<Array<{
   *   key: string|number
   *   left: number
   *   top: number
   *   width: number
   *   maxHeight: number|null
   *   detached: boolean
   *   ready: boolean
   *   pinned: boolean
   *   anchor: { left:number, top:number, right:number, bottom:number }|null
   *   zIndex: number
   * }>>} */
  const windows = ref([])
  const hoverKey = ref(null)
  const hoverAnchor = ref(null)
  const hoverPos = ref({
    left: 0,
    top: 0,
    width: widthOpt,
    maxHeight: null,
    ready: false,
  })
  const overPopupKeys = ref(new Set())
  const draggingKey = ref(null)

  /** @type {Map<string|number, HTMLElement>} */
  const elMap = new Map()
  /** @type {Map<string|number, ResizeObserver>} */
  const roMap = new Map()

  let hideTimer = null
  let placeRaf = 0
  let placeToken = 0
  /** @type {null | { key: string|number, pointerId: number, startX: number, startY: number, origLeft: number, origTop: number }} */
  let dragState = null

  const openWindows = computed(() => {
    const list = windows.value.map((w) => ({ ...w, ephemeral: false }))
    const hk = hoverKey.value
    if (hk != null && !windows.value.some((w) => w.key === hk)) {
      list.push({
        key: hk,
        left: hoverPos.value.left,
        top: hoverPos.value.top,
        width: hoverPos.value.width,
        maxHeight: hoverPos.value.maxHeight,
        detached: false,
        ready: hoverPos.value.ready,
        pinned: false,
        anchor: hoverAnchor.value,
        zIndex: zCounter + 1,
        ephemeral: true,
      })
    }
    return list
  })

  const openKeys = computed(() => openWindows.value.map((w) => w.key))

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max)
  }

  function getViewport() {
    const vv = window.visualViewport
    if (vv) return { width: vv.width, height: vv.height }
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    }
  }

  function rectFromEl(el) {
    const r = el.getBoundingClientRect()
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    }
  }

  function waitPopupImages(el) {
    const imgs = [...el.querySelectorAll('img')]
    if (!imgs.length) return Promise.resolve()
    return Promise.all(
      imgs.map(
        (img) =>
          img.complete ||
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true })
            img.addEventListener('error', resolve, { once: true })
          }),
      ),
    )
  }

  function styleFor(win) {
    // hover-превью: none; после клика (pinned) / drag (detached): auto
    const interactive = Boolean(win.pinned || win.detached)
    return {
      position: 'fixed',
      left: `${win.left}px`,
      top: `${win.top}px`,
      width: `${win.width}px`,
      maxHeight: win.maxHeight != null ? `${win.maxHeight}px` : undefined,
      '--popup-max-h':
        win.maxHeight != null ? `${win.maxHeight}px` : 'calc(100dvh - 16px)',
      zIndex: win.zIndex,
      pointerEvents: interactive ? 'auto' : 'none',
    }
  }

  function findWindow(key) {
    return windows.value.find((w) => w.key === key) || null
  }

  function updateWindow(key, patch) {
    const i = windows.value.findIndex((w) => w.key === key)
    if (i < 0) return
    windows.value[i] = { ...windows.value[i], ...patch }
  }

  function bumpZ(key) {
    zCounter += 1
    updateWindow(key, { zIndex: zCounter })
  }

  function setPopupEl(key, el) {
    if (el) {
      elMap.set(key, el)
      bindResize(key, el)
    } else {
      elMap.delete(key)
      const ro = roMap.get(key)
      if (ro) {
        ro.disconnect()
        roMap.delete(key)
      }
    }
  }

  function bindResize(key, el) {
    if (typeof ResizeObserver === 'undefined') return
    roMap.get(key)?.disconnect()
    const ro = new ResizeObserver(() => fitKey(key))
    ro.observe(el)
    roMap.set(key, ro)
  }

  function fitKey(key) {
    const el = elMap.get(key)
    if (!el) return
    const win = findWindow(key)
    const isHover = hoverKey.value === key && !win
    if (!win && !isHover) return
    if (win && !win.ready && !win.detached) return
    if (isHover && !hoverPos.value.ready) return

    const { width: vw, height: vh } = getViewport()
    const r = el.getBoundingClientRect()
    const boxW = Math.ceil(r.width)
    const boxH = Math.ceil(r.height)

    let left = win ? win.left : hoverPos.value.left
    let top = win ? win.top : hoverPos.value.top

    if (r.right > vw - MARGIN) left = vw - boxW - MARGIN
    if (r.left < MARGIN) left = MARGIN
    if (r.bottom > vh - MARGIN) top = vh - boxH - MARGIN
    if (r.top < MARGIN) top = MARGIN

    left = clamp(left, MARGIN, Math.max(MARGIN, vw - boxW - MARGIN))
    top = clamp(top, MARGIN, Math.max(MARGIN, vh - boxH - MARGIN))

    if (win) {
      if (left !== win.left || top !== win.top) updateWindow(key, { left, top })
    } else if (
      left !== hoverPos.value.left ||
      top !== hoverPos.value.top
    ) {
      hoverPos.value = { ...hoverPos.value, left, top }
    }
  }

  async function placeNearAnchor(key, anchor, { asHover }) {
    const token = ++placeToken
    const { width: vw, height: vh } = getViewport()
    const width = Math.min(widthOpt, Math.max(160, vw - MARGIN * 2))
    const maxHeight = Math.max(120, vh - MARGIN * 2)

    const draft = {
      left: MARGIN,
      top: MARGIN,
      width,
      maxHeight,
      ready: false,
    }

    if (asHover) {
      hoverPos.value = { ...draft }
    } else {
      updateWindow(key, { ...draft, ready: false })
    }

    await nextTick()
    if (token !== placeToken) return

    // ждём появления DOM-узла
    for (let i = 0; i < 8 && !elMap.get(key); i++) {
      await new Promise((r) => requestAnimationFrame(r))
      if (token !== placeToken) return
    }
    const el = elMap.get(key)
    if (!el || !anchor) return

    await Promise.race([
      waitPopupImages(el),
      new Promise((r) => setTimeout(r, 120)),
    ])
    if (token !== placeToken) return

    const box = el.getBoundingClientRect()
    const boxW = Math.ceil(box.width)
    const boxH = Math.ceil(box.height)

    let left = anchor.right + GAP
    if (left + boxW > vw - MARGIN) left = anchor.left - GAP - boxW
    left = clamp(left, MARGIN, Math.max(MARGIN, vw - boxW - MARGIN))
    const top = clamp(
      anchor.top,
      MARGIN,
      Math.max(MARGIN, vh - boxH - MARGIN),
    )

    const placed = { left, top, width, maxHeight, ready: true }
    if (asHover) {
      if (hoverKey.value !== key) return
      hoverPos.value = { ...placed }
    } else {
      updateWindow(key, placed)
    }

    requestAnimationFrame(() => {
      if (token !== placeToken) return
      fitKey(key)
    })
  }

  function scheduleHoverPlace() {
    cancelAnimationFrame(placeRaf)
    const key = hoverKey.value
    const anchor = hoverAnchor.value
    if (key == null || !anchor) return
    if (findWindow(key)) return
    placeRaf = requestAnimationFrame(() => {
      placeNearAnchor(key, anchor, { asHover: true })
    })
  }

  function clearHideTimer() {
    if (hideTimer != null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function closeWindow(key) {
    windows.value = windows.value.filter((w) => w.key !== key)
    if (hoverKey.value === key) {
      hoverKey.value = null
      hoverAnchor.value = null
      hoverPos.value = {
        left: 0,
        top: 0,
        width: widthOpt,
        maxHeight: null,
        ready: false,
      }
    }
    if (draggingKey.value === key) {
      dragState = null
      draggingKey.value = null
    }
    elMap.delete(key)
    roMap.get(key)?.disconnect()
    roMap.delete(key)
  }

  function clearHover() {
    hoverKey.value = null
    hoverAnchor.value = null
    hoverPos.value = {
      left: 0,
      top: 0,
      width: widthOpt,
      maxHeight: null,
      ready: false,
    }
  }

  function clearAll() {
    clearHideTimer()
    dragState = null
    draggingKey.value = null
    placeToken += 1
    windows.value = []
    clearHover()
    overPopupKeys.value = new Set()
    for (const ro of roMap.values()) ro.disconnect()
    roMap.clear()
    elMap.clear()
  }

  function scheduleHideHover() {
    clearHideTimer()
    hideTimer = setTimeout(() => {
      if (hoverKey.value == null) return
      if (overPopupKeys.value.has(hoverKey.value)) return
      clearHover()
    }, HIDE_DELAY_MS)
  }

  function hasSoftPin() {
    return windows.value.some((w) => w.pinned && !w.detached)
  }

  function onAnchorEnter(key, event) {
    if (key == null) return
    // уже мягко/жёстко зафиксирован — превью не нужно
    if (findWindow(key)) return
    // мягкая фиксация: не плодим hover-превью поверх
    if (hasSoftPin()) return
    clearHideTimer()
    const el = event.currentTarget
    if (!el) return
    hoverKey.value = key
    hoverAnchor.value = rectFromEl(el)
    scheduleHoverPlace()
  }

  function onAnchorLeave() {
    scheduleHideHover()
  }

  /**
   * Клик = мягкая фиксация (pointer-events auto).
   * Закрытие: далеко от окна/якоря или Esc.
   * Drag-bar после этого → detached (пока не закроют сами).
   * @returns {'pinned'|'unpinned'|'noop'}
   */
  function onAnchorClick(key, event) {
    if (key == null) return 'noop'
    clearHideTimer()
    const el = event.currentTarget
    const anchor = el ? rectFromEl(el) : null
    const existing = findWindow(key)

    if (existing) {
      // повторный клик снимает и soft, и hard pin
      closeWindow(key)
      if (anchor) {
        hoverKey.value = key
        hoverAnchor.value = anchor
        scheduleHoverPlace()
      }
      return 'unpinned'
    }

    zCounter += 1
    const fromHover =
      hoverKey.value === key
        ? { ...hoverPos.value }
        : {
            left: MARGIN,
            top: MARGIN,
            width: widthOpt,
            maxHeight: null,
            ready: false,
          }

    windows.value.push({
      key,
      left: fromHover.left,
      top: fromHover.top,
      width: fromHover.width,
      maxHeight: fromHover.maxHeight,
      detached: false,
      ready: fromHover.ready,
      pinned: true,
      anchor,
      zIndex: zCounter,
    })
    clearHover()

    if (!fromHover.ready && anchor) {
      placeNearAnchor(key, anchor, { asHover: false })
    }
    return 'pinned'
  }

  function onPopupEnter(key) {
    const win = findWindow(key)
    // hover-превью неинтерактивно — enter не учитываем
    if (!win) return
    const next = new Set(overPopupKeys.value)
    next.add(key)
    overPopupKeys.value = next
    clearHideTimer()
    bumpZ(key)
  }

  function onPopupLeave(key) {
    const next = new Set(overPopupKeys.value)
    next.delete(key)
    overPopupKeys.value = next
  }

  function onDragStart(key, event) {
    if (event.button != null && event.button !== 0) return
    // только после клика (soft pin); с hover-превью drag недоступен
    const win = findWindow(key)
    if (!win) return
    const el = elMap.get(key)
    if (!el) return
    event.preventDefault()

    updateWindow(key, { detached: true, pinned: true, ready: true })
    bumpZ(key)

    dragState = {
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: win.left,
      origTop: win.top,
    }
    draggingKey.value = key

    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onDragMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return
    const { key } = dragState
    const el = elMap.get(key)
    const { width: vw, height: vh } = getViewport()
    const boxW = el
      ? Math.ceil(el.getBoundingClientRect().width)
      : widthOpt
    const boxH = el ? Math.ceil(el.getBoundingClientRect().height) : 120
    let left = dragState.origLeft + (event.clientX - dragState.startX)
    let top = dragState.origTop + (event.clientY - dragState.startY)
    left = clamp(left, MARGIN, Math.max(MARGIN, vw - boxW - MARGIN))
    top = clamp(top, MARGIN, Math.max(MARGIN, vh - boxH - MARGIN))
    updateWindow(key, { left, top, detached: true })
  }

  function onDragEnd(event) {
    if (!dragState) return
    if (event.pointerId != null && event.pointerId !== dragState.pointerId) {
      return
    }
    dragState = null
    draggingKey.value = null
  }

  function distToRect(x, y, rect) {
    if (!rect) return Infinity
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    return Math.hypot(dx, dy)
  }

  function onDocMove(event) {
    if (dragState) {
      onDragMove(event)
      return
    }

    const { clientX: x, clientY: y } = event

    // soft pin: далеко от попапа и якоря → закрыть (detached не трогаем)
    const toClose = []
    for (const win of windows.value) {
      if (win.detached) continue
      if (overPopupKeys.value.has(win.key)) continue
      const el = elMap.get(win.key)
      if (!el) continue
      let dist = distToRect(x, y, el.getBoundingClientRect())
      if (win.anchor) {
        dist = Math.min(dist, distToRect(x, y, win.anchor))
      }
      if (dist > LEAVE_SLACK_PX) toClose.push(win.key)
    }
    for (const key of toClose) closeWindow(key)

    // hover-превью: далеко от превью и якоря → скрыть
    if (hoverKey.value != null && !findWindow(hoverKey.value)) {
      const el = elMap.get(hoverKey.value)
      let dist = el
        ? distToRect(x, y, el.getBoundingClientRect())
        : Infinity
      if (hoverAnchor.value) {
        dist = Math.min(dist, distToRect(x, y, hoverAnchor.value))
      }
      if (dist > LEAVE_SLACK_PX) clearHover()
    }
  }

  function onKeydown(event) {
    if (event.key !== 'Escape') return
    if (hoverKey.value != null && !findWindow(hoverKey.value)) {
      clearHover()
      return
    }
    // Esc снимает soft-фиксацию; detached закрывается только крестиком / кликом по якорю
    const soft = windows.value
      .filter((w) => !w.detached)
      .sort((a, b) => b.zIndex - a.zIndex)
    if (soft[0]) closeWindow(soft[0].key)
  }

  function onViewportChange() {
    for (const win of windows.value) fitKey(win.key)
    if (hoverKey.value != null) fitKey(hoverKey.value)
  }

  onMounted(() => {
    document.addEventListener('pointermove', onDocMove, { passive: true })
    document.addEventListener('pointerup', onDragEnd)
    document.addEventListener('pointercancel', onDragEnd)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('scroll', onViewportChange)
  })

  onUnmounted(() => {
    clearHideTimer()
    cancelAnimationFrame(placeRaf)
    clearAll()
    document.removeEventListener('pointermove', onDocMove)
    document.removeEventListener('pointerup', onDragEnd)
    document.removeEventListener('pointercancel', onDragEnd)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('resize', onViewportChange)
    window.visualViewport?.removeEventListener('scroll', onViewportChange)
  })

  return {
    openWindows,
    openKeys,
    hoverKey,
    draggingKey,
    windows,
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
    clearHover,
    // совместимость со старыми именами, где удобно
    clearPopup: clearAll,
    isPinnedKey: (key) => Boolean(findWindow(key)?.pinned),
    isDetachedKey: (key) => Boolean(findWindow(key)?.detached),
  }
}
