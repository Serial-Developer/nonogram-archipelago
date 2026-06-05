import { computed, ref, onMounted, watch } from 'vue';
import {
  type Cell,
  type Clue,
  type Grid,
  type Mark,
  clueNumbers,
  computeColClues,
  computeRowClues,
  isClueComplete,
  isSolved,
  makeGrid,
  randomSolution,
} from '~/utils/nonogram';
import { usePersistentRef } from './usePersistence';

export function useNonogram() {
  const rows = usePersistentRef('nonogram_rows', 5);
  const cols = usePersistentRef('nonogram_cols', 5);
  const fillRate = ref(0.45);

  // SSR-safe deterministic initial state
  const solution = usePersistentRef('nonogram_solution', makeGrid(5, 5, 0 as Cell));
  const player = usePersistentRef('nonogram_player', makeGrid(5, 5, 'empty'));

  // Full clue objects with position data (for completion checking)
  const rowClues = computed(() => computeRowClues(solution.value));
  const colClues = computed(() => computeColClues(solution.value));

  // Just the numbers for display
  const rowClueNumbers = computed(() => rowClues.value.map(clueNumbers));
  const colClueNumbers = computed(() => colClues.value.map(clueNumbers));

  const solved = computed(() => isSolved(player.value, solution.value));

  // Check if a specific row clue is complete
  function isRowClueComplete(rowIndex: number, clueIndex: number): boolean {
    const clue = rowClues.value[rowIndex]?.[clueIndex];
    const playerRow = player.value[rowIndex];
    if (!clue || !playerRow) return false;
    return isClueComplete(clue, playerRow);
  }

  // Check if a specific column clue is complete
  function isColClueComplete(colIndex: number, clueIndex: number): boolean {
    const clue = colClues.value[colIndex]?.[clueIndex];
    if (!clue) return false;
    // Build the column from player grid
    const playerCol: Mark[] = [];
    for (const row of player.value) {
      const cell = row[colIndex];
      if (cell !== undefined) playerCol.push(cell);
    }
    return isClueComplete(clue, playerCol);
  }

  function newRandom(r = rows.value, c = cols.value) {
    // Clamp to minimum 5x5
    const minSize = 5;
    const clampedR = Math.max(r, minSize);
    const clampedC = Math.max(c, minSize);
    rows.value = clampedR;
    cols.value = clampedC;
    solution.value = randomSolution(clampedR, clampedC, fillRate.value);
    player.value = makeGrid(clampedR, clampedC, 'empty');
  }

  function clearPlayer() {
    player.value = makeGrid(rows.value, cols.value, 'empty');
  }

  function autoSolve() {
    // Copy solution to player grid, converting 1 to 'fill' and 0 to 'empty'
    const newPlayer = solution.value.map((row) => row.map((cell) => (cell === 1 ? 'fill' : 'empty') as Mark));
    player.value = newPlayer;
  }

  function setCell(r: number, c: number, v: Mark) {
    player.value[r][c] = v;
  }

  function cycleCell(r: number, c: number, mode: 'fill' | 'x' | 'erase' | 'maybe') {
    // Create new array to trigger reactivity
    const newPlayer = [...player.value.map((row) => [...row])];
    const cur = newPlayer[r][c];

    if (mode === 'erase') {
      newPlayer[r][c] = 'empty';
    } else if (mode === 'fill') {
      newPlayer[r][c] = cur === 'fill' ? 'empty' : 'fill';
    } else if (mode === 'x') {
      newPlayer[r][c] = cur === 'x' ? 'empty' : 'x';
    } else if (mode === 'maybe') {
      newPlayer[r][c] = cur === 'maybe' ? 'empty' : 'maybe';
    }

    player.value = newPlayer;
  }

  // Generate only on client to avoid hydration mismatch
  onMounted(() => {
    newRandom(rows.value, cols.value);
  });

  return {
    rows,
    cols,
    fillRate,
    solution,
    player,
    rowClues,
    colClues,
    rowClueNumbers,
    colClueNumbers,
    solved,
    isRowClueComplete,
    isColClueComplete,
    newRandom,
    clearPlayer,
    autoSolve,
    setCell,
    cycleCell,
  };
}
