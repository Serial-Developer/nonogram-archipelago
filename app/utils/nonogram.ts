export type Cell = 0 | 1;
export type Mark = 'empty' | 'fill' | 'x' | 'maybe';

export type Grid<T> = T[][];

/**
 * A clue represents a contiguous segment of filled cells in a row/column.
 * - `length`: the number of filled cells (this is what's displayed to the user)
 * - `start`: the starting index of this segment in the solution
 * - `end`: the ending index (exclusive) of this segment in the solution
 */
export interface Clue {
  length: number;
  start: number;
  end: number;
}

export function makeGrid<T>(rows: number, cols: number, value: T): Grid<T> {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

export function randomSolution(rows: number, cols: number, fillRate = 0.45): Grid<Cell> {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() < fillRate ? 1 : 0) as Cell));
}

/**
 * Compute clues for a single line (row or column) from the solution.
 * Each clue includes the length and the exact position (start/end) in the solution.
 */
export function lineClues(line: Cell[]): Clue[] {
  const clues: Clue[] = [];
  let runStart = -1;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) {
      if (runStart === -1) {
        runStart = i;
      }
    } else {
      if (runStart !== -1) {
        clues.push({
          length: i - runStart,
          start: runStart,
          end: i,
        });
        runStart = -1;
      }
    }
  }

  // Handle segment that extends to the end
  if (runStart !== -1) {
    clues.push({
      length: line.length - runStart,
      start: runStart,
      end: line.length,
    });
  }

  // Empty line gets a single "0" clue
  if (clues.length === 0) {
    clues.push({ length: 0, start: -1, end: -1 });
  }

  return clues;
}

/**
 * Extract just the clue numbers for display purposes.
 */
export function clueNumbers(clues: Clue[]): number[] {
  return clues.map((c) => c.length);
}

export function computeRowClues(solution: Grid<Cell>): Clue[][] {
  return solution.map(lineClues);
}

export function computeColClues(solution: Grid<Cell>): Clue[][] {
  const rows = solution.length;
  const cols = solution[0]?.length ?? 0;
  const out: Clue[][] = [];
  for (let c = 0; c < cols; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < rows; r++) col.push(solution[r][c]);
    out.push(lineClues(col));
  }
  return out;
}

/**
 * Check if a specific clue segment is completely filled by the player.
 * This checks that all cells in the clue's range are filled.
 */
export function isClueComplete(clue: Clue, playerLine: Mark[]): boolean {
  // Empty clue (0) is complete when no cells are filled
  if (clue.length === 0) {
    return playerLine.every((cell) => cell !== 'fill');
  }

  // Check that all cells in the clue's range are filled
  for (let i = clue.start; i < clue.end; i++) {
    if (playerLine[i] !== 'fill') {
      return false;
    }
  }

  return true;
}

export function isSolved(player: Grid<Mark>, solution: Grid<Cell>): boolean {
  for (let r = 0; r < solution.length; r++) {
    for (let c = 0; c < solution[0].length; c++) {
      const want = solution[r][c] === 1;
      const got = player[r][c] === 'fill';
      if (want !== got) return false;
    }
  }
  return true;
}
