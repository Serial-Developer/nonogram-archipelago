<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import type { Cell, Mark } from '~/utils/nonogram';

  const props = defineProps<{
    rows: number;
    cols: number;
    rowClues: number[][];
    colClues: number[][];
    player: Mark[][];
    solution?: Cell[][];
    showMistakes?: boolean;
    autoX?: boolean;
    greyCompletedHints?: boolean;
    isRowClueComplete?: (rowIndex: number, clueIndex: number) => boolean;
    isColClueComplete?: (colIndex: number, clueIndex: number) => boolean;
    showDebugGrid?: boolean;
    dragPainting?: boolean;
    isRowHintRevealed?: (rowIndex: number) => boolean;
    isColHintRevealed?: (colIndex: number) => boolean;
    mobileCellMode?: 'fill' | 'x' | 'maybe'; // For mobile mode toggle
    cursorRow?: number; // Mobile D-pad cursor cell (-1 to hide)
    cursorCol?: number;
    highlightLines?: boolean; // Highlight cursor row/column + clues
    reservedBottom?: number; // px reserved below the board (e.g. mobile D-pad) so the grid still fits
    disabled?: boolean; // Disable interactions when puzzle is failed or completed
  }>();

  const emit = defineEmits<{
    (e: 'cell', r: number, c: number, mode: 'fill' | 'x' | 'erase' | 'maybe'): void;
  }>();

  // Drag painting state
  const isDragging = ref(false);
  const dragMode = ref<'fill' | 'x' | 'erase' | 'maybe' | null>(null);
  const dragStartCell = ref<{ r: number; c: number } | null>(null);

  // Global pointer up handler for when pointer is released outside grid
  function handleGlobalPointerUp() {
    if (isDragging.value) {
      isDragging.value = false;
      dragMode.value = null;
      dragStartCell.value = null;
    }
  }

  // Track if component is mounted (client-side)
  const isMounted = ref(false);

  // Reactive window size for responsive sizing - consistent defaults for SSR
  const windowWidth = ref(520);
  const windowHeight = ref(800);
  const rootEl = ref<HTMLElement | null>(null);
  const measuredAvailH = ref(0);

  function updateWindowWidth() {
    if (typeof window !== 'undefined') {
      windowWidth.value = window.innerWidth;
      windowHeight.value = window.innerHeight;
      measureAvail();
    }
  }

  // Measure the real space from the board's top edge to the viewport bottom. Because the board is
  // top-aligned, this top is stable as the board resizes (no feedback loop), and it naturally
  // accounts for all chrome above (burger bar + Lives/Coins status bar, even when it wraps).
  function measureAvail() {
    if (typeof window === 'undefined' || !rootEl.value) return;
    const top = rootEl.value.getBoundingClientRect().top;
    measuredAvailH.value = Math.max(0, window.innerHeight - top - 12);
    measureXhair();
  }

  // Add global event listeners
  onMounted(() => {
    isMounted.value = true;
    document.addEventListener('pointerup', handleGlobalPointerUp);
    updateWindowWidth();
    window.addEventListener('resize', updateWindowWidth);
    void nextTick(measureAvail);
    void nextTick(measureXhair);
  });

  onUnmounted(() => {
    document.removeEventListener('pointerup', handleGlobalPointerUp);
    window.removeEventListener('resize', updateWindowWidth);
  });

  // Re-measure when the puzzle size changes (layout reflows).
  watch([() => props.rows, () => props.cols], () => void nextTick(measureAvail));

  const colDepth = computed(() => Math.max(1, ...props.colClues.map((c) => c.length)));
  const rowDepth = computed(() => Math.max(1, ...props.rowClues.map((r) => r.length)));
  const xhairOn = computed(
    () => (props.highlightLines ?? true) && (props.cursorRow ?? -1) >= 0 && (props.cursorCol ?? -1) >= 0,
  );

  // No hard floor: the board always fits the viewport. Cells shrink as needed so the whole grid
  // (cells + clues, both axes) stays visible without scrolling, whatever the grid size.
  const CELL_FLOOR = 6;
  const cellSize = computed(() => {
    const count = Math.max(props.rows, props.cols);
    const desktop = windowWidth.value >= 1024;

    // Width: safe small constant (no wrap risk). Height: measured from the board top to the
    // viewport bottom, so the whole grid always fits with no scroll, whatever the grid size.
    const availW = desktop ? 560 : windowWidth.value - 32;
    const availH =
      (measuredAvailH.value > 0 ? measuredAvailH.value : windowHeight.value - 180) - (props.reservedBottom ?? 0);

    // Width fit: account for the left row-clue gutter (max of its fixed-min and cell-scaled size).
    const byWidth = Math.min(
      availW / (props.cols + 0.6 * rowDepth.value),
      (availW - 16 * rowDepth.value) / props.cols,
    );
    // Height fit: account for the top col-clue header.
    const byHeight = Math.min(
      availH / (props.rows + 0.5 * colDepth.value),
      (availH - 14 * colDepth.value) / props.rows,
    );

    const cap = desktop ? 45 : count <= 10 ? 42 : 34;
    const ideal = Math.floor(Math.min(byWidth, byHeight, cap));
    return Math.max(CELL_FLOOR, ideal);
  });

  const groupSize = 5;
  const padPx = 8; // matches p-2 = 0.5rem = 8px

  const boardW = computed(() => props.cols * cellSize.value);
  const boardH = computed(() => props.rows * cellSize.value);

  function isThick(i: number) {
    return i > 0 && i % groupSize === 0;
  }

  // Prevent double event firing on mobile (touchstart then pointerdown)
  let lastTouchTime = 0;
  function onPointerDown(e: PointerEvent | TouchEvent, r: number, c: number) {
    // Ignore all clicks when disabled
    if (props.disabled) return;

    const now = Date.now();
    const mobile = window.innerWidth < 1024;
    if (mobile && e.type === 'pointerdown') {
      // On mobile, ignore pointerdown entirely (handle only touchstart)
      return;
    }
    if (e.type === 'touchstart') {
      lastTouchTime = now;
      // Start drag painting on touchstart for mobile
      if (props.dragPainting) {
        isDragging.value = true;
        dragMode.value = mobile && props.mobileCellMode ? props.mobileCellMode : 'fill';
        dragStartCell.value = { r, c };
      }
    } else if (e.type === 'pointerdown' && now - lastTouchTime < 500) {
      // Ignore pointerdown if a touch event just happened
      return;
    }
    e.preventDefault();

    // On mobile, use the toggle for mode
    let mode: 'fill' | 'x' | 'erase' | 'maybe';
    if (mobile && props.mobileCellMode) {
      mode = props.mobileCellMode;
    } else {
      const erase = (e as PointerEvent).shiftKey;
      if (erase) mode = 'erase';
      else if ((e as PointerEvent).button === 1) mode = 'maybe'; // middle click = "?" template
      else if ((e as PointerEvent).button === 2) mode = 'x';
      else mode = 'fill';
    }

    // Only start drag painting on pointerdown for desktop
    if (props.dragPainting && e.type === 'pointerdown' && !mobile) {
      isDragging.value = true;
      dragMode.value = mode;
      dragStartCell.value = { r, c };
    }

    emit('cell', r, c, mode);
  }

  // Ref for the grid container
  const gridRef = ref<HTMLElement | null>(null);
  const xhairV = ref<Record<string, string> | null>(null);
  const xhairH = ref<Record<string, string> | null>(null);
  function measureXhair() {
    if (typeof window === 'undefined' || !xhairOn.value || !rootEl.value || !gridRef.value) {
      xhairV.value = null;
      xhairH.value = null;
      return;
    }
    const g = gridRef.value.getBoundingClientRect();
    const root = rootEl.value.getBoundingClientRect();
    const cs = cellSize.value;
    const cx = g.left - root.left + (props.cursorCol ?? 0) * cs;
    const cy = g.top - root.top + (props.cursorRow ?? 0) * cs;
    xhairV.value = { left: `${cx}px`, top: '0px', width: `${cs}px`, height: `${root.height}px` };
    xhairH.value = { left: '0px', top: `${cy}px`, width: `${root.width}px`, height: `${cs}px` };
  }
  watch(
    [() => props.cursorRow, () => props.cursorCol, cellSize, xhairOn, () => props.rows, () => props.cols],
    () => void nextTick(measureXhair),
    { immediate: true },
  );

  function onTouchMove(e: TouchEvent) {
    if (!props.dragPainting || !isDragging.value || !dragMode.value) return;
    e.preventDefault();
    // Use the grid container for coordinates
    const grid = gridRef.value;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const r = Math.floor(y / cellSize.value);
    const c = Math.floor(x / cellSize.value);
    if (r >= 0 && r < props.rows && c >= 0 && c < props.cols) {
      onPointerMove(e as any, r, c);
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (props.dragPainting && isDragging.value) {
      e.preventDefault();
      isDragging.value = false;
      dragMode.value = null;
      dragStartCell.value = null;
    }
  }

  function onPointerMove(e: PointerEvent, r: number, c: number) {
    if (!props.dragPainting || !isDragging.value || !dragMode.value) return;

    e.preventDefault();

    // Paint the current cell if we've moved to a different cell
    if (!dragStartCell.value || r !== dragStartCell.value.r || c !== dragStartCell.value.c) {
      // Paint cells whose state differs from the target so you can re-drag over
      // already-treated cells; skip cells already in the target state (avoid toggling them off).
      const currentCellState = props.player[r][c];
      const shouldPaint = dragMode.value === 'erase' || currentCellState !== dragMode.value;

      if (shouldPaint) {
        emit('cell', r, c, dragMode.value);
      }

      dragStartCell.value = { r, c };
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (props.dragPainting && isDragging.value) {
      e.preventDefault();
      isDragging.value = false;
      dragMode.value = null;
      dragStartCell.value = null;
    }
  }

  function isWrongFill(r: number, c: number) {
    if (!props.showMistakes || !props.solution) return false;
    return props.player[r][c] === 'fill' && props.solution[r][c] === 0;
  }

  function isWrongX(r: number, c: number) {
    if (!props.showMistakes || !props.solution) return false;

    const isWrong = props.player[r][c] === 'x' && props.solution[r][c] === 1;

    // Debug any X cell that should be wrong
    if (props.player[r][c] === 'x') {
      console.log(`Cell [${r},${c}] (row ${r + 1}, col ${c + 1}):`, {
        playerState: props.player[r][c],
        solutionState: props.solution[r][c],
        showMistakes: props.showMistakes,
        isWrong,
      });
    }

    return isWrong;
  }

  function isColComplete(c: number): boolean {
    if (!props.solution) return false;

    // Check if all cells in the column match the solution
    for (let r = 0; r < props.rows; r++) {
      const shouldBeFilled = props.solution[r][c] === 1;
      const playerFilled = props.player[r][c] === 'fill';

      if (shouldBeFilled && !playerFilled) return false; // Missing required fill
      if (!shouldBeFilled && playerFilled) return false; // Wrong fill
    }

    return true;
  }

  function shouldAutoX(r: number, c: number): boolean {
    if (!props.autoX) return false;
    if (props.player[r][c] !== 'empty') return false;
    if (!props.solution) return false;

    // Don't auto-X if this cell should be filled
    if (props.solution[r][c] === 1) return false;

    // Auto-X if either the row or column is complete
    return isRowComplete(r) || isColComplete(c);
  }

  function isRowComplete(r: number): boolean {
    if (!props.solution) return false;

    // Check if all cells in the row match the solution
    for (let c = 0; c < props.cols; c++) {
      const shouldBeFilled = props.solution[r][c] === 1;
      const playerFilled = props.player[r][c] === 'fill';

      if (shouldBeFilled && !playerFilled) return false; // Missing required fill
      if (!shouldBeFilled && playerFilled) return false; // Wrong fill
    }

    return true;
  }

  function isRowPatternComplete(r: number): boolean {
    if (!props.solution) return false;

    // Get the actual pattern from player
    const playerRow = props.player[r];
    const solutionRow = props.solution[r];

    // Check if all required fills are present and no wrong fills
    for (let c = 0; c < props.cols; c++) {
      const shouldBeFilled = solutionRow[c] === 1;
      const playerFilled = playerRow[c] === 'fill';

      if (shouldBeFilled && !playerFilled) return false; // Missing required fill
      if (!shouldBeFilled && playerFilled) return false; // Wrong fill
    }

    return true;
  }

  function isColPatternComplete(c: number): boolean {
    if (!props.solution) return false;

    // Check if all required fills are present and no wrong fills
    for (let r = 0; r < props.rows; r++) {
      const shouldBeFilled = props.solution[r][c] === 1;
      const playerFilled = props.player[r][c] === 'fill';

      if (shouldBeFilled && !playerFilled) return false; // Missing required fill
      if (!shouldBeFilled && playerFilled) return false; // Wrong fill
    }

    return true;
  }
</script>

<template>
  <div
    ref="rootEl"
    class="select-none relative"
    :style="{
      '--cell': `${cellSize}px`,
      display: 'inline-block',
      minWidth: 'max-content',
      touchAction: 'none', // Always prevent scrolling on grid for mobile drag
    }"
  >
    <!-- Whole thing is a 2x2 grid: [corner | col clues] / [row clues | board] -->
    <div
      class="grid gap-1 sm:gap-2 relative z-[1]"
      :style="{
        gridTemplateColumns: `auto auto`,
        gridTemplateRows: `auto auto`,
      }"
    >
      <!-- corner: sized by rowDepth and colDepth so clue grids align -->
      <div
        class="bg-neutral-950/40 border border-neutral-900 invisible"
        :style="{
          width: `calc(${rowDepth} * max(16px, ${cellSize * 0.6}px))`,
          height: `calc(${colDepth} * max(14px, ${cellSize * 0.5}px))`,
        }"
      />

      <!-- column clues (grid: rows=colDepth, cols=cols) -->
      <div :style="{ paddingLeft: padPx + 'px' }">
        <div
          class="grid"
          :style="{
            gridTemplateColumns: `repeat(${cols}, var(--cell))`,
            gridTemplateRows: `repeat(${colDepth}, minmax(14px, calc(var(--cell) * 0.5)))`,
          }"
        >
          <template v-for="i in colDepth" :key="`row-${i}`">
            <div
              v-for="c in cols"
              :key="`col-${c}-r-${i}`"
              class="flex items-end justify-center text-[11px] leading-none"
              :class="[
                (() => {
                  const clueArray = colClues[c - 1];
                  if (!clueArray) return 'clue-text-default';
                  const clueIndex = i - 1 - (colDepth - clueArray.length);
                  if (clueIndex >= 0 && clueIndex < clueArray.length) {
                    const isComplete = props.greyCompletedHints && props.isColClueComplete?.(c - 1, clueIndex);
                    return isComplete ? 'clue-text-complete' : 'clue-text-default';
                  }
                  return 'clue-text-default';
                })(),
                { 'xhair-clue': xhairOn && c - 1 === cursorCol },
              ]"
            >
              <!-- show from bottom, hide 0 clues -->
              {{
                (() => {
                  const clueArray = colClues[c - 1];
                  if (!clueArray) return '';
                  const clueIndex = i - 1 - (colDepth - clueArray.length);
                  if (clueIndex >= 0 && clueIndex < clueArray.length) {
                    const clueValue = clueArray[clueIndex];
                    if (clueValue === 0) return ''; // Hide 0 clues
                    const isRevealed = props.isColHintRevealed?.(c - 1) ?? true;
                    return isRevealed ? clueValue : '?';
                  }
                  return '';
                })()
              }}
            </div>
          </template>
        </div>
      </div>

      <!-- row clues (grid: rows=rows, cols=rowDepth) -->
      <div class="overflow-hidden" :style="{ paddingTop: padPx + 'px' }">
        <div
          class="grid"
          :style="{
            gridTemplateRows: `repeat(${rows}, var(--cell))`,
            gridTemplateColumns: `repeat(${rowDepth}, minmax(16px, calc(var(--cell) * 0.6)))`,
          }"
        >
          <template v-for="r in rows" :key="`row-${r}`">
            <div
              v-for="i in rowDepth"
              :key="`row-${r}-c-${i}`"
              class="flex items-center justify-end pr-1.5 text-[11px] leading-none"
              :class="[
                (() => {
                  const clueArray = rowClues[r - 1];
                  if (!clueArray) return 'clue-text-default';
                  const clueIndex = i - 1 - (rowDepth - clueArray.length);
                  if (clueIndex >= 0 && clueIndex < clueArray.length) {
                    const isComplete = props.greyCompletedHints && props.isRowClueComplete?.(r - 1, clueIndex);
                    return isComplete ? 'clue-text-complete' : 'clue-text-default';
                  }
                  return 'clue-text-default';
                })(),
                { 'xhair-clue': xhairOn && r - 1 === cursorRow },
              ]"
            >
              <!-- show from right, hide 0 clues -->
              {{
                (() => {
                  const clueArray = rowClues[r - 1];
                  if (!clueArray) return '';
                  const clueIndex = i - 1 - (rowDepth - clueArray.length);
                  if (clueIndex >= 0 && clueIndex < clueArray.length) {
                    const clueValue = clueArray[clueIndex];
                    if (clueValue === 0) return ''; // Hide 0 clues
                    const isRevealed = props.isRowHintRevealed?.(r - 1) ?? true;
                    return isRevealed ? clueValue : '?';
                  }
                  return '';
                })()
              }}
            </div>
          </template>
        </div>
      </div>

      <!-- board (grid: rows x cols) -->
      <div class="overflow-hidden">
        <div class="relative p-2">
          <!-- SVG Grid overlay (pixel-perfect) -->
          <svg
            class="pointer-events-none absolute"
            :style="{
              left: `${padPx}px`,
              top: `${padPx}px`,
              width: `${boardW}px`,
              height: `${boardH}px`,
            }"
            :viewBox="`0 0 ${boardW} ${boardH}`"
            shape-rendering="crispEdges"
          >
            <!-- OUTER BORDER (half-pixel inset so all sides render the same) -->
            <line x1="0.5" y1="0.5" :x2="boardW - 0.5" y2="0.5" :stroke="`var(--color-grid-line-thin)`" stroke-width="1" />
            <line x1="0.5" y1="0.5" x2="0.5" :y2="boardH - 0.5" :stroke="`var(--color-grid-line-thin)`" stroke-width="1" />
            <line x1="0.5" :y1="boardH - 0.5" :x2="boardW - 0.5" :y2="boardH - 0.5" :stroke="`var(--color-grid-line-thin)`" stroke-width="1" />
            <line :x1="boardW - 0.5" y1="0.5" :x2="boardW - 0.5" :y2="boardH - 0.5" :stroke="`var(--color-grid-line-thin)`" stroke-width="1" />

            <!-- INTERNAL vertical lines at cell boundaries -->
            <template v-for="i in cols - 1" :key="`v-${i}`">
              <line
                :x1="i * cellSize"
                y1="0"
                :x2="i * cellSize"
                :y2="boardH"
                :stroke="isThick(i) ? `var(--color-grid-line-thick)` : `var(--color-grid-line-thin)`"
                :stroke-width="isThick(i) ? 2 : 1"
              />
            </template>

            <!-- INTERNAL horizontal lines at cell boundaries -->
            <template v-for="i in rows - 1" :key="`h-${i}`">
              <line
                x1="0"
                :y1="i * cellSize"
                :x2="boardW"
                :y2="i * cellSize"
                :stroke="isThick(i) ? `var(--color-grid-line-thick)` : `var(--color-grid-line-thin)`"
                :stroke-width="isThick(i) ? 2 : 1"
              />
            </template>
          </svg>

          <!-- Clickable cells -->
          <div
            ref="gridRef"
            class="grid relative"
            :style="{
              gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            }"
            @contextmenu.prevent
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
          >
            <button
              v-for="idx in rows * cols"
              :key="idx"
              class="flex items-center justify-center transition active:scale-[0.98]"
              :class="{
                'ring-2 ring-inset ring-amber-400 relative z-10':
                  cursorRow === Math.floor((idx - 1) / cols) && cursorCol === (idx - 1) % cols,
              }"
              :style="{
                backgroundColor: (() => {
                  const r = Math.floor((idx - 1) / cols);
                  const c = (idx - 1) % cols;
                  const playerRow = player[r];
                  if (!playerRow) {
                    return 'transparent';
                  }
                  const v = playerRow[c];
                  const wrongFill = isWrongFill(r, c);
                  const autoXing = shouldAutoX(r, c);

                  if (wrongFill) return `var(--color-grid-mistake-bg)`;
                  if (autoXing) return `var(--color-grid-cell-hover)`;
                  if (v === 'fill') return `var(--color-grid-cell-filled)`;
                  return 'transparent';
                })(),
              }"
              @pointerdown="(e) => onPointerDown(e as PointerEvent, Math.floor((idx - 1) / cols), (idx - 1) % cols)"
              @pointermove="(e) => onPointerMove(e as PointerEvent, Math.floor((idx - 1) / cols), (idx - 1) % cols)"
              @pointerup="(e) => onPointerUp(e as PointerEvent)"
              @touchstart="(e) => onPointerDown(e as TouchEvent, Math.floor((idx - 1) / cols), (idx - 1) % cols)"
            >
              <span
                v-if="player[Math.floor((idx - 1) / cols)]?.[(idx - 1) % cols] === 'x' || shouldAutoX(Math.floor((idx - 1) / cols), (idx - 1) % cols)"
                class="text-sm font-bold"
                :style="{
                  color: (() => {
                    const r = Math.floor((idx - 1) / cols);
                    const c = (idx - 1) % cols;
                    if (isWrongX(r, c)) return `var(--color-grid-x-mark-wrong)`;
                    if (shouldAutoX(r, c)) return `var(--color-grid-x-mark-auto)`;
                    return `var(--color-grid-x-mark)`;
                  })(),
                }"
              >
                ✕
              </span>
              <span
                v-else-if="player[Math.floor((idx - 1) / cols)]?.[(idx - 1) % cols] === 'maybe'"
                class="text-sm font-bold text-sky-300/80"
              >?</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="xhairOn && xhairV" class="xhair-strip" :style="xhairV" />
    <div v-if="xhairOn && xhairH" class="xhair-strip" :style="xhairH" />
  </div>
</template>

<style scoped>
.xhair-clue {
  font-weight: 600;
}
.xhair-strip {
  position: absolute;
  background: rgba(251, 191, 36, 0.13);
  pointer-events: none;
  z-index: 0;
}
</style>
