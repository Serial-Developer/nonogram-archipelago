/**
 * Archipelago Items & Unlocks Management
 *
 * This composable manages all items that can be received from Archipelago.
 * Each item has an ID that corresponds to the Archipelago data package.
 *
 * === ARCHIPELAGO ITEM STANDARD ===
 * Items are identified by numeric IDs defined in your AP world's data package.
 * When the AP server sends an item, it includes the item ID which we map to unlocks.
 *
 * To add new items:
 * 1. Define the item ID constant below (must match your AP world)
 * 2. Add the unlock state to the `unlocks` reactive object
 * 3. Add the item to the `ITEM_REGISTRY` for documentation/UI
 * 4. Handle the item in `receiveItem()` function
 */

import { computed, reactive, ref, watch, onMounted } from 'vue';
import { usePersistentRef } from './usePersistence';

// ============================================
// ITEM IDS - Must match your Archipelago world
// ============================================
export const AP_ITEMS = {
  // Hint Visibility (8001xxx range)
  UNLOCK_HINTS: 8001001,

  // Lives (8002xxx range)
  EXTRA_LIFE: 8002001,

  // Coins (8003xxx range)
  COINS_BUNDLE: 8003001, // Grants coins

  // Consumables (8004xxx range)
  SOLVE_RANDOM_CELL: 8004001, // Solves a random unsolved cell

  // Wallet (8005xxx range) - progressive coin capacity
  WALLET_UPGRADE: 8005001,

  // Heart Container (8006xxx range) - max-heart expansion via pooled shop checks
  HEART_CONTAINER: 8006001,
} as const;

// ============================================
// LOCATION IDS - Checks sent TO Archipelago
// ============================================
export const AP_LOCATIONS = {
  // Coin milestones
  OBTAIN_50_COINS: 9000001,
  OBTAIN_100_COINS: 9000002,

  // 5x5 milestones
  FIRST_LINE_5X5: 9000003,

  // Difficulty unlocks
  UNLOCK_10X10: 9000004,
  FIRST_LINE_10X10: 9000005,
  UNLOCK_15X15: 9000006,
  FIRST_LINE_15X15: 9000007,
  UNLOCK_20X20: 9000008,
  FIRST_LINE_20X20: 9000009,

  // Puzzle completion base IDs (add puzzle count to get location ID)
  PUZZLE_5X5_BASE: 9001000, // 9001001-9001026
  PUZZLE_10X10_BASE: 9002000, // 9002001-9002015
  PUZZLE_15X15_BASE: 9003000, // 9003001-9003010
  PUZZLE_20X20_BASE: 9004000, // 9004001-9004005

  // Flawless checks (no-mistake clears)
  FLAWLESS_5X5: 9005001,
  FLAWLESS_10X10: 9005002,
  FLAWLESS_15X15: 9005003,
  FLAWLESS_20X20: 9005004,
  FLAWLESS_STREAK_5: 9005005,
  FLAWLESS_TOTAL_10: 9005006,

  // Shop wallet check locations (active when wallets are in the pool)
  SHOP_WALLET_1: 9006001,
  SHOP_WALLET_2: 9006002,
  SHOP_WALLET_3: 9006003,
  SHOP_WALLET_4: 9006004,

  // Shop heart-container check locations (active when hearts are in the pool)
  SHOP_HEART_1: 9007001,
  SHOP_HEART_2: 9007002,
  SHOP_HEART_3: 9007003,
  SHOP_HEART_4: 9007004,
  SHOP_HEART_5: 9007005,
  SHOP_HEART_6: 9007006,
  SHOP_HEART_7: 9007007,
  SHOP_HEART_8: 9007008,
  SHOP_HEART_9: 9007009,
  SHOP_HEART_10: 9007010,
} as const;

// Puzzle completion counts per difficulty
export const PUZZLE_COUNTS: Record<'5x5' | '10x10' | '15x15' | '20x20', number> = reactive({
  '5x5': 26,
  '10x10': 15,
  '15x15': 10,
  '20x20': 5,
});

// Wallet (progressive coin capacity). Index = wallet level (level 0 always owned).
export const WALLET_CAPS = [49, 99, 999, 4999, 9999] as const;
// Shop price to obtain each wallet level (index = level; index 0 unused).
export const WALLET_PRICES = [0, 30, 90, 900, 3333] as const;

// Helper to get location ID for puzzle completions by difficulty
export function getPuzzleLocationId(difficulty: '5x5' | '10x10' | '15x15' | '20x20', count: number): number {
  const baseIds = {
    '5x5': AP_LOCATIONS.PUZZLE_5X5_BASE,
    '10x10': AP_LOCATIONS.PUZZLE_10X10_BASE,
    '15x15': AP_LOCATIONS.PUZZLE_15X15_BASE,
    '20x20': AP_LOCATIONS.PUZZLE_20X20_BASE,
  };
  return baseIds[difficulty] + count;
}

// Location registry for UI display
export interface LocationDefinition {
  id: number;
  name: string;
  description: string;
  threshold?: number; // For puzzle checks
  difficulty?: string; // For puzzle checks
}

// Generate location registry dynamically
export const LOCATION_REGISTRY: LocationDefinition[] = [
  // Coin milestones
  { id: AP_LOCATIONS.OBTAIN_50_COINS, name: 'Obtain 50 Coins', description: 'Accumulate 50 total coins' },
  { id: AP_LOCATIONS.OBTAIN_100_COINS, name: 'Obtain 100 Coins', description: 'Accumulate 100 total coins' },

  // 5x5 checks
  { id: AP_LOCATIONS.FIRST_LINE_5X5, name: 'First Line (5x5)', description: 'Complete your first row or column in a 5x5 puzzle' },
  ...Array.from({ length: PUZZLE_COUNTS['5x5'] }, (_, i) => ({
    id: getPuzzleLocationId('5x5', i + 1),
    name: `Complete ${i + 1} 5x5 Puzzle${i > 0 ? 's' : ''}`,
    description: `Complete ${i + 1} 5x5 puzzle${i > 0 ? 's' : ''}`,
    threshold: i + 1,
    difficulty: '5x5',
  })),

  // 10x10 checks
  { id: AP_LOCATIONS.UNLOCK_10X10, name: 'Unlock 10x10', description: 'Increase difficulty to 10x10' },
  { id: AP_LOCATIONS.FIRST_LINE_10X10, name: 'First Line (10x10)', description: 'Complete your first row or column in a 10x10 puzzle' },
  ...Array.from({ length: PUZZLE_COUNTS['10x10'] }, (_, i) => ({
    id: getPuzzleLocationId('10x10', i + 1),
    name: `Complete ${i + 1} 10x10 Puzzle${i > 0 ? 's' : ''}`,
    description: `Complete ${i + 1} 10x10 puzzle${i > 0 ? 's' : ''}`,
    threshold: i + 1,
    difficulty: '10x10',
  })),

  // 15x15 checks
  { id: AP_LOCATIONS.UNLOCK_15X15, name: 'Unlock 15x15', description: 'Increase difficulty to 15x15' },
  { id: AP_LOCATIONS.FIRST_LINE_15X15, name: 'First Line (15x15)', description: 'Complete your first row or column in a 15x15 puzzle' },
  ...Array.from({ length: PUZZLE_COUNTS['15x15'] }, (_, i) => ({
    id: getPuzzleLocationId('15x15', i + 1),
    name: `Complete ${i + 1} 15x15 Puzzle${i > 0 ? 's' : ''}`,
    description: `Complete ${i + 1} 15x15 puzzle${i > 0 ? 's' : ''}`,
    threshold: i + 1,
    difficulty: '15x15',
  })),

  // 20x20 checks
  { id: AP_LOCATIONS.UNLOCK_20X20, name: 'Unlock 20x20', description: 'Increase difficulty to 20x20' },
  { id: AP_LOCATIONS.FIRST_LINE_20X20, name: 'First Line (20x20)', description: 'Complete your first row or column in a 20x20 puzzle' },
  ...Array.from({ length: PUZZLE_COUNTS['20x20'] }, (_, i) => ({
    id: getPuzzleLocationId('20x20', i + 1),
    name: `Complete ${i + 1} 20x20 Puzzle${i > 0 ? 's' : ''}`,
    description: `Complete ${i + 1} 20x20 puzzle${i > 0 ? 's' : ''}`,
    threshold: i + 1,
    difficulty: '20x20',
  })),

  // Flawless checks (no-mistake clears)
  { id: AP_LOCATIONS.FLAWLESS_5X5, name: 'Flawless 5x5', description: 'Clear a 5x5 puzzle without any mistakes' },
  { id: AP_LOCATIONS.FLAWLESS_10X10, name: 'Flawless 10x10', description: 'Clear a 10x10 puzzle without any mistakes' },
  { id: AP_LOCATIONS.FLAWLESS_15X15, name: 'Flawless 15x15', description: 'Clear a 15x15 puzzle without any mistakes' },
  { id: AP_LOCATIONS.FLAWLESS_20X20, name: 'Flawless 20x20', description: 'Clear a 20x20 puzzle without any mistakes' },
  { id: AP_LOCATIONS.FLAWLESS_STREAK_5, name: 'Flawless Streak (5)', description: 'Clear 5 puzzles in a row without any mistakes' },
  { id: AP_LOCATIONS.FLAWLESS_TOTAL_10, name: 'Flawless Total (10)', description: 'Clear 10 puzzles without any mistakes' },
];

// ============================================
// ITEM REGISTRY - For UI and documentation
// ============================================
export interface ItemDefinition {
  id: number;
  name: string;
  description: string;
  category: 'settings' | 'hints' | 'consumable' | 'progression';
}

export const ITEM_REGISTRY: ItemDefinition[] = [
  {
    id: AP_ITEMS.UNLOCK_HINTS,
    name: 'Hint Reveal',
    description: 'Reveals 1 additional random row or column hint per puzzle',
    category: 'consumable',
  },
  {
    id: AP_ITEMS.EXTRA_LIFE,
    name: 'Extra Life',
    description: 'Permanently increases your maximum lives by 1',
    category: 'consumable',
  },
  {
    id: AP_ITEMS.COINS_BUNDLE,
    name: 'Coin Bundle',
    description: 'Grants 10 coins to spend in the shop',
    category: 'consumable',
  },
  {
    id: AP_ITEMS.SOLVE_RANDOM_CELL,
    name: 'Random Cell Solve',
    description: 'Automatically solves one random unsolved cell',
    category: 'consumable',
  },
  {
    id: AP_ITEMS.WALLET_UPGRADE,
    name: 'Wallet Upgrade',
    description: 'Progressively increases your maximum coin capacity',
    category: 'progression',
  },
  {
    id: AP_ITEMS.HEART_CONTAINER,
    name: 'Heart Container',
    description: 'Expands your maximum hearts (a quarter in Zelda mode, a whole heart otherwise)',
    category: 'progression',
  },
];

// ============================================
// COMPOSABLE
// ============================================
export function useArchipelagoItems() {
  const { t } = useI18n();
  // Unlock states - these determine what features are available
  // In "locked" mode (Archipelago run), these start as false
  // In "free play" mode, these are all true
  // Remove unlocks object, as abilities are always available

  // Whether we're in Archipelago mode (locked) or free play (unlocked)
  const archipelagoMode = usePersistentRef('ap_archipelagoMode', false);

  // Hint reveal system - tracks how many row/col hints to reveal per puzzle
  const startingHintReveals = usePersistentRef('ap_startingHintReveals', 1); // Starting hints revealed setting (configurable)
  const hintReveals = usePersistentRef('ap_hintReveals', 0); // Number of hints revealed (permanent, stackable)
  const revealedRows = usePersistentRef<Set<number>>('ap_revealedRows', new Set()); // Which row hints are revealed for current puzzle
  const revealedCols = usePersistentRef<Set<number>>('ap_revealedCols', new Set()); // Which col hints are revealed for current puzzle
  const allHintsRevealed = computed(() => !archipelagoMode.value); // In free play, all hints shown
  const currentPuzzleRows = usePersistentRef('ap_currentPuzzleRows', 0); // Track current puzzle dimensions for re-selecting hints
  const currentPuzzleCols = usePersistentRef('ap_currentPuzzleCols', 0);
  const totalHintReveals = computed(() => startingHintReveals.value + hintReveals.value); // Total hints to reveal

  // Lives system
  const baseLives = usePersistentRef('ap_baseLives', 3); // Default starting lives per puzzle (configurable)
  const extraLives = usePersistentRef('ap_extraLives', 0); // Permanent extra lives from AP rewards
  const currentLives = usePersistentRef('ap_currentLives', 3); // Current lives for the puzzle
  const maxLives = computed(() => baseLives.value + extraLives.value);
  const unlimitedLives = usePersistentRef('ap_unlimitedLives', false); // Setting for unlimited lives (independent of AP mode)
  // Life restoration on clear + shop healing (feature 4a)
  const lifeRestoreMode = usePersistentRef('ap_lifeRestoreMode', 'full'); // none|one|full|custom
  const lifeRestoreCustom = usePersistentRef('ap_lifeRestoreCustom', 3);
  const shopHealing = usePersistentRef('ap_shopHealing', false);
  const healingCostMode = usePersistentRef('ap_healingCostMode', 'normal'); // free|low|normal|high|progressive|custom
  const healingCostCustom = usePersistentRef('ap_healingCostCustom', 30);
  const livesBought = usePersistentRef('ap_livesBought', 0); // count for progressive healing cost (per seed)
  // Heart containers / quarter-hearts (feature 4b)
  const zeldaHeartMode = usePersistentRef('ap_zeldaHeartMode', false);
  const shopHearts = usePersistentRef('ap_shopHearts', false);
  const heartCostMode = usePersistentRef('ap_heartCostMode', 'normal');
  const heartCostCustom = usePersistentRef('ap_heartCostCustom', 100);
  const heartQuarters = usePersistentRef('ap_heartQuarters', 0); // 0-3 quarters toward next heart
  const heartsBought = usePersistentRef('ap_heartsBought', 0); // for progressive heart cost

  // ----- Flawless checks (feature 5) -----
  const flawlessChecks = usePersistentRef('ap_flawlessChecks', false); // feature enabled (from slot_data)
  const flawlessStreak = usePersistentRef('ap_flawlessStreak', 0); // consecutive flawless clears
  const flawlessTotal = usePersistentRef('ap_flawlessTotal', 0); // total flawless clears
  const mistakesThisPuzzle = usePersistentRef('ap_mistakesThisPuzzle', 0); // gameplay mistakes this puzzle (auto-X never counts)
  const debugMode = usePersistentRef('ap_debugMode', false); // debug tab/simulator visible (from slot_data debug_mode)

  // Coins system
  const startingCoins = usePersistentRef('ap_startingCoins', 5); // Starting coins (configurable)
  const coins = usePersistentRef('ap_coins', 0); // Current coins
  const coinsPerBundle = usePersistentRef('ap_coinsPerBundle', 5); // Coins received from AP bundle (configurable)
  const unlimitedCoins = usePersistentRef('ap_unlimitedCoins', false); // Setting for unlimited coins (independent of AP mode)

  // Wallet system (progressive coin capacity). Level 0 is always owned.
  const startingWalletLevel = usePersistentRef('ap_startingWalletLevel', 0); // Wallet level granted at seed start (YAML)
  const walletLevel = usePersistentRef('ap_walletLevel', 0); // Current wallet level (0-4)
  const walletsInPool = usePersistentRef('ap_walletsInPool', 0); // Wallet levels coming from the multiworld pool
  const heartsInPool = usePersistentRef('ap_heartsInPool', 0); // Heart Container checks coming from the multiworld pool
  const coinCap = computed(() => WALLET_CAPS[Math.min(Math.max(walletLevel.value, 0), 4)]);

  // Random cell solve tokens
  const randomCellSolves = usePersistentRef('ap_randomCellSolves', 0); // Number of random cell solves available

  // Temporary hint reveals (only for current puzzle, purchased from shop)
  const tempHintReveals = usePersistentRef('ap_tempHintReveals', 0); // Temporary hints for current puzzle
  const TEMP_HINT_COST = usePersistentRef('ap_tempHintCost', 15); // Cost to buy a temporary hint reveal

  // Difficulty system
  const currentDifficulty = usePersistentRef('ap_currentDifficulty', 5); // Starting grid size (5x5)
  const difficultyCostMode = usePersistentRef('ap_difficultyCostMode', 'low'); // free|low|normal|high|progressive
  const requireTierCompletion = usePersistentRef('ap_requireTierCompletion', true); // finish current tier before advancing

  // Skip-aware next active grid size above a difficulty (null at the top).
  function nextActiveSizeFrom(d: number): number | null {
    const order = [5, 10, 15, 20];
    const i = order.indexOf(d);
    if (i < 0) return null;
    const k = (s: number) => `${s}x${s}` as '5x5' | '10x10' | '15x15' | '20x20';
    return order.slice(i + 1).find((s) => PUZZLE_COUNTS[k(s)] > 0) ?? null;
  }
  // Coin cost to reach a given grid size, per the difficulty_cost mode.
  function difficultyCostFor(target: number): number {
    switch (difficultyCostMode.value) {
      case 'free': return 0;
      case 'normal': return 250;
      case 'high': return 500;
      case 'progressive': return ({ 10: 99, 15: 999, 20: 1999 } as Record<number, number>)[target] ?? 0;
      default: return 30; // low
    }
  }
  const nextDifficultyCost = computed(() => {
    const t = nextActiveSizeFrom(currentDifficulty.value);
    return t === null ? 0 : difficultyCostFor(t);
  });

  // Lowest / highest grid size that actually has puzzles (drives start tier + max tier).
  // Plain functions reading the mutable PUZZLE_COUNTS (set once from slot_data on connect).
  function firstActiveDifficulty(): number {
    for (const d of [5, 10, 15, 20]) {
      if (PUZZLE_COUNTS[`${d}x${d}` as '5x5' | '10x10' | '15x15' | '20x20'] > 0) return d;
    }
    return 5;
  }
  function maxActiveDifficulty(): number {
    for (const d of [20, 15, 10, 5]) {
      if (PUZZLE_COUNTS[`${d}x${d}` as '5x5' | '10x10' | '15x15' | '20x20'] > 0) return d;
    }
    return 20;
  }

  // Check/Location tracking
  const completedChecks = usePersistentRef<Set<number>>('ap_completedChecks', new Set()); // Location IDs that have been sent

  // Use reactive for the puzzle tracking objects
  const puzzlesCompleted = reactive({
    '5x5': 0,
    '10x10': 0,
    '15x15': 0,
    '20x20': 0,
  }); // Puzzles completed per difficulty
  const firstLineCompleted = reactive({
    '5x5': false,
    '10x10': false,
    '15x15': false,
    '20x20': false,
  }); // First line completed per difficulty

  const totalCoinsEarned = usePersistentRef('ap_totalCoinsEarned', 0); // Total coins ever earned (for milestone tracking)
  const coinMilestones = reactive({
    50: false,
    100: false,
  }); // Coin milestones reached

  // Track received items for the UI
  const receivedItems = usePersistentRef<number[]>('ap_receivedItems', []);

  // Load persisted reactive object data on mount
  onMounted(() => {
    // Load puzzlesCompleted
    const savedPuzzlesCompleted = localStorage.getItem('nonogram_ap_puzzlesCompleted');
    if (savedPuzzlesCompleted) {
      try {
        const data = JSON.parse(savedPuzzlesCompleted);
        Object.assign(puzzlesCompleted, data);
      } catch (e) {
        console.error('Failed to load puzzlesCompleted from storage:', e);
      }
    }

    // Load firstLineCompleted
    const savedFirstLineCompleted = localStorage.getItem('nonogram_ap_firstLineCompleted');
    if (savedFirstLineCompleted) {
      try {
        const data = JSON.parse(savedFirstLineCompleted);
        Object.assign(firstLineCompleted, data);
      } catch (e) {
        console.error('Failed to load firstLineCompleted from storage:', e);
      }
    }

    // Load coinMilestones
    const savedCoinMilestones = localStorage.getItem('nonogram_ap_coinMilestones');
    if (savedCoinMilestones) {
      try {
        const data = JSON.parse(savedCoinMilestones);
        Object.assign(coinMilestones, data);
      } catch (e) {
        console.error('Failed to load coinMilestones from storage:', e);
      }
    }
  });

  // Watch reactive objects and persist changes
  watch(
    () => puzzlesCompleted,
    (newVal) => {
      try {
        localStorage.setItem('nonogram_ap_puzzlesCompleted', JSON.stringify(newVal));
      } catch (e) {
        console.error('Failed to save puzzlesCompleted to storage:', e);
      }
    },
    { deep: true },
  );

  watch(
    () => firstLineCompleted,
    (newVal) => {
      try {
        localStorage.setItem('nonogram_ap_firstLineCompleted', JSON.stringify(newVal));
      } catch (e) {
        console.error('Failed to save firstLineCompleted to storage:', e);
      }
    },
    { deep: true },
  );

  watch(
    () => coinMilestones,
    (newVal) => {
      try {
        localStorage.setItem('nonogram_ap_coinMilestones', JSON.stringify(newVal));
      } catch (e) {
        console.error('Failed to save coinMilestones to storage:', e);
      }
    },
    { deep: true },
  );

  // Ensure completedChecks is a Set (convert if it's a plain object from old localStorage format)
  function ensureCompletedChecksIsSet() {
    if (!(completedChecks.value instanceof Set)) {
      const data = Array.isArray(completedChecks.value) ? completedChecks.value : [];
      completedChecks.value = new Set(data) as any;
    }
  }

  // Get item definition by ID
  function getItemDefinition(itemId: number): ItemDefinition | undefined {
    return ITEM_REGISTRY.find((item) => item.id === itemId);
  }

  // Check if an item has been received
  function hasItem(itemId: number): boolean {
    return receivedItems.value.includes(itemId);
  }

  // Helper to add to completedChecks and trigger persistence
  function addCompletedCheck(locationId: number) {
    ensureCompletedChecksIsSet();
    completedChecks.value.add(locationId);
    // Manually trigger persistence for Set
    if ((completedChecks as any).triggerPersist) {
      (completedChecks as any).triggerPersist();
    }
  }

  // Receive an item from Archipelago
  // Returns item name and any location checks that should be sent as a result
  function receiveItem(itemId: number): { itemName: string | null; checks: number[] } {
    // Don't process duplicates (except for stackable items)
    const isStackable =
      itemId === AP_ITEMS.EXTRA_LIFE || itemId === AP_ITEMS.UNLOCK_HINTS || itemId === AP_ITEMS.COINS_BUNDLE || itemId === AP_ITEMS.SOLVE_RANDOM_CELL || itemId === AP_ITEMS.WALLET_UPGRADE || itemId === AP_ITEMS.HEART_CONTAINER;
    if (!isStackable && receivedItems.value.includes(itemId)) {
      return { itemName: null, checks: [] };
    }

    receivedItems.value.push(itemId);
    const itemDef = getItemDefinition(itemId);
    let newChecks: number[] = [];

    // Apply the unlock (no ability unlocks anymore)
    switch (itemId) {
      case AP_ITEMS.UNLOCK_HINTS:
        hintReveals.value += 1;
        addRandomHintReveal(); // Immediately reveal a new hint on current puzzle
        break;
      case AP_ITEMS.EXTRA_LIFE:
        // Zelda mode: the AP item grants a quarter heart (4 pieces = +1 max). Classic mode: a whole heart.
        // Forming a new heart fully heals and respects the 10-heart cap.
        if (zeldaHeartMode.value) gainHeartQuarter();
        else gainMaxHeart();
        break;
      case AP_ITEMS.COINS_BUNDLE:
        // Use addCoins to track total earned and trigger milestones
        newChecks = addCoins(coinsPerBundle.value);
        break;
      case AP_ITEMS.SOLVE_RANDOM_CELL:
        randomCellSolves.value += 1;
        break;
      case AP_ITEMS.WALLET_UPGRADE:
        walletLevel.value = Math.min(walletLevel.value + 1, 4);
        break;
      case AP_ITEMS.HEART_CONTAINER:
        // Same effect as Extra Life: a quarter in Zelda mode, a whole heart otherwise (cap 10).
        if (zeldaHeartMode.value) gainHeartQuarter();
        else gainMaxHeart();
        break;
      default:
        console.warn(`Unknown item received: ${itemId}`);
        return { itemName: null, checks: [] };
    }

    return { itemName: itemDef?.name ?? `Item #${itemId}`, checks: newChecks };
  }

  // Enable Archipelago mode (lock everything, reset to initial state)
  // This is called when manually enabling AP mode from settings
  function enableArchipelagoMode() {
    archipelagoMode.value = true;
    receivedItems.value = [];
    extraLives.value = 0;
    livesBought.value = 0;
    heartQuarters.value = 0;
    heartsBought.value = 0;
    flawlessStreak.value = 0;
    flawlessTotal.value = 0;
    mistakesThisPuzzle.value = 0;
    currentLives.value = baseLives.value;
    coins.value = startingCoins.value;
    walletLevel.value = startingWalletLevel.value;
    if (!unlimitedCoins.value && coins.value > coinCap.value) {
      coins.value = coinCap.value;
    }
    hintReveals.value = 0; // Reset bonus hints, startingHintReveals will be used as base
    revealedRows.value = new Set();
    revealedCols.value = new Set();
    randomCellSolves.value = 0;
    tempHintReveals.value = 0;
    currentDifficulty.value = 5; // Reset to easy (5x5)
    completedChecks.value = new Set();
    puzzlesCompleted['5x5'] = 0;
    puzzlesCompleted['10x10'] = 0;
    puzzlesCompleted['15x15'] = 0;
    puzzlesCompleted['20x20'] = 0;
    firstLineCompleted['5x5'] = false;
    firstLineCompleted['10x10'] = false;
    firstLineCompleted['15x15'] = false;
    firstLineCompleted['20x20'] = false;
    totalCoinsEarned.value = 0;
    coinMilestones[50] = false;
    coinMilestones[100] = false;
  }

  // Enable Archipelago mode without resetting persistent data (for reconnecting)
  function enableArchipelagoModeForConnection() {
    archipelagoMode.value = true;
    // Don't reset any values - keep all persisted state
  }

  // Disable Archipelago mode (unlock everything for free play)
  function disableArchipelagoMode() {
    archipelagoMode.value = false;
    // All abilities are always available; nothing to unlock
    // Reset resources (unlimited settings handle display)
    currentLives.value = baseLives.value;
    coins.value = startingCoins.value;
  }

  // Lives for a new puzzle. After clearing a puzzle, apply life_restore_on_clear; otherwise
  // (first puzzle, difficulty change, retry after Game Over) refill fully to avoid soft-locks.
  function resetLivesForNewPuzzle(afterClear = false) {
    if (!afterClear) {
      currentLives.value = maxLives.value;
      return;
    }
    switch (lifeRestoreMode.value) {
      case 'none':
        break; // carry remaining lives over
      case 'one':
        currentLives.value = Math.min(maxLives.value, currentLives.value + 1);
        break;
      case 'custom':
        currentLives.value = Math.min(maxLives.value, currentLives.value + lifeRestoreCustom.value);
        break;
      case 'full':
      default:
        currentLives.value = maxLives.value;
        break;
    }
  }

  // Lose a life (returns true if still alive, false if game over)
  function loseLife(): boolean {
    if (unlimitedLives.value) return true; // Unlimited lives enabled
    if (currentLives.value > 0) {
      currentLives.value -= 1;
    }
    return currentLives.value > 0;
  }

  // Remove all lives at once (used by a lethal Death Link).
  function loseAllLives(): void {
    currentLives.value = 0;
  }

  // Coin cost of the next shop heal, per healing_cost mode.
  function healingCostValue(): number {
    switch (healingCostMode.value) {
      case 'free': return 0;
      case 'low': return 10;
      case 'high': return 100;
      case 'progressive': return Math.min(9999, 10 * (livesBought.value + 1));
      case 'custom': return healingCostCustom.value;
      case 'normal':
      default: return 30;
    }
  }
  const nextHealingCost = computed(() => healingCostValue());
  const canHeal = computed(
    () =>
      shopHealing.value &&
      !unlimitedLives.value &&
      currentLives.value > 0 &&
      currentLives.value < maxLives.value &&
      coins.value >= nextHealingCost.value,
  );
  // Buy one heal: +1 current life up to max, spend coins, bump the progressive counter.
  function buyHealing(): { success: boolean; reason?: string } {
    if (!shopHealing.value) return { success: false, reason: 'Healing is not available.' };
    if (unlimitedLives.value) return { success: false, reason: 'Unlimited lives is on.' };
    if (currentLives.value <= 0) return { success: false, reason: 'Puzzle already lost - heal on the next puzzle.' };
    if (currentLives.value >= maxLives.value) return { success: false, reason: 'Lives already full.' };
    if (!spendCoins(nextHealingCost.value)) return { success: false, reason: 'Not enough coins.' };
    currentLives.value = Math.min(maxLives.value, currentLives.value + 1);
    livesBought.value += 1;
    return { success: true };
  }

  // ----- Heart containers (max-life expansion; feature 4b) -----
  const MAX_HEARTS = 10;
  // Gain one whole max heart (+1 max, full heal), respecting the cap.
  function gainMaxHeart(): boolean {
    if (maxLives.value >= MAX_HEARTS) return false;
    extraLives.value += 1;
    currentLives.value = maxLives.value; // forming a new heart fully heals
    return true;
  }
  // Gain one quarter toward the next heart; converts to a whole heart at 4 (Zelda style).
  function gainHeartQuarter(): boolean {
    if (maxLives.value >= MAX_HEARTS) return false;
    heartQuarters.value += 1;
    if (heartQuarters.value >= 4) {
      heartQuarters.value -= 4;
      return gainMaxHeart();
    }
    return true;
  }
  function heartCostValue(): number {
    switch (heartCostMode.value) {
      case 'free': return 0;
      case 'low': return 30;
      case 'high': return 300;
      case 'progressive': return Math.min(9999, 50 * (heartsBought.value + 1));
      case 'custom': return heartCostCustom.value;
      case 'normal':
      default: return 100;
    }
  }
  const nextHeartCost = computed(() => heartCostValue());
  const canBuyHeart = computed(
    () =>
      shopHearts.value &&
      !unlimitedLives.value &&
      maxLives.value < MAX_HEARTS &&
      coins.value >= nextHeartCost.value,
  );
  // Buy one heart (whole) or one quarter (Zelda mode) toward max hearts.
  function buyHeart(): { success: boolean; reason?: string } {
    if (!shopHearts.value) return { success: false, reason: 'Heart purchase is not available.' };
    if (unlimitedLives.value) return { success: false, reason: 'Unlimited lives is on.' };
    if (maxLives.value >= MAX_HEARTS) return { success: false, reason: 'Already at the maximum (10 hearts).' };
    if (!spendCoins(nextHeartCost.value)) return { success: false, reason: 'Not enough coins.' };
    if (zeldaHeartMode.value) gainHeartQuarter();
    else gainMaxHeart();
    heartsBought.value += 1;
    return { success: true };
  }

  // Next heart-shop action: pooled Heart Container slots are multiworld checks (claim them; the
  // max-heart increase arrives as a Heart Container item); beyond the pool they are coin purchases.
  const nextHeartAction = computed(() => {
    if (!archipelagoMode.value || !shopHearts.value || unlimitedLives.value) return null;
    if (maxLives.value >= MAX_HEARTS) return null;
    const n = Math.min(heartsInPool.value, 10);
    for (let k = 1; k <= n; k++) {
      const checkId = AP_LOCATIONS.SHOP_HEART_1 + (k - 1);
      if (!completedChecks.value.has(checkId)) {
        return { index: k, kind: 'check' as const, price: nextHeartCost.value, checkId };
      }
    }
    return { index: 0, kind: 'purchase' as const, price: nextHeartCost.value };
  });

  // Claim a pooled Heart Container shop slot (a multiworld check). Pays and sends the check; the
  // max-heart increase itself arrives as the Heart Container item.
  function claimHeartShopCheck(index: number): { success: boolean; checkId?: number; reason?: string } {
    if (!shopHearts.value || unlimitedLives.value) return { success: false, reason: 'Heart purchase is not available.' };
    if (index < 1 || index > Math.min(heartsInPool.value, 10)) return { success: false, reason: 'Not a pooled heart slot.' };
    ensureCompletedChecksIsSet();
    const checkId = AP_LOCATIONS.SHOP_HEART_1 + (index - 1);
    if (completedChecks.value.has(checkId)) return { success: false, reason: 'Already claimed.' };
    if (!spendCoins(nextHeartCost.value)) return { success: false, reason: 'Not enough coins.' };
    addCompletedCheck(checkId);
    return { success: true, checkId };
  }

  // Add coins (for completing rows/columns)
  function addCoins(amount: number): number[] {
    coins.value += amount;
    totalCoinsEarned.value += amount;
    // Clamp held coins to the wallet capacity; total earned stays uncapped so coin
    // milestones still fire even at a low cap.
    if (!unlimitedCoins.value && coins.value > coinCap.value) {
      coins.value = coinCap.value;
    }

    console.log('[DEBUG addCoins] amount:', amount, 'totalCoinsEarned:', totalCoinsEarned.value, 'archipelagoMode:', archipelagoMode.value);

    ensureCompletedChecksIsSet();

    // Check for coin milestones
    const newChecks: number[] = [];
    if (!coinMilestones[50] && totalCoinsEarned.value >= 50) {
      console.log('[DEBUG addCoins] Hit 50 coin milestone!');
      coinMilestones[50] = true;
      if (archipelagoMode.value && !completedChecks.value.has(AP_LOCATIONS.OBTAIN_50_COINS)) {
        console.log('[DEBUG addCoins] Adding 50 coin check:', AP_LOCATIONS.OBTAIN_50_COINS);
        addCompletedCheck(AP_LOCATIONS.OBTAIN_50_COINS);
        newChecks.push(AP_LOCATIONS.OBTAIN_50_COINS);
      }
    }
    if (!coinMilestones[100] && totalCoinsEarned.value >= 100) {
      console.log('[DEBUG addCoins] Hit 100 coin milestone!');
      coinMilestones[100] = true;
      if (archipelagoMode.value && !completedChecks.value.has(AP_LOCATIONS.OBTAIN_100_COINS)) {
        console.log('[DEBUG addCoins] Adding 100 coin check:', AP_LOCATIONS.OBTAIN_100_COINS);
        addCompletedCheck(AP_LOCATIONS.OBTAIN_100_COINS);
        newChecks.push(AP_LOCATIONS.OBTAIN_100_COINS);
      }
    }
    console.log('[DEBUG addCoins] returning newChecks:', newChecks);
    return newChecks;
  }

  // Spend coins (returns true if successful, false if not enough)
  function spendCoins(amount: number): boolean {
    if (unlimitedCoins.value || coins.value >= amount) {
      if (!unlimitedCoins.value) {
        coins.value -= amount;
      }
      return true;
    }
    return false;
  }

  // Reset all unlocks (for new game)
  function resetUnlocks() {
    if (archipelagoMode.value) {
      enableArchipelagoMode();
    }
  }

  // Select which hints to reveal for a new puzzle
  function selectRevealedHints(totalRows: number, totalCols: number) {
    // Store dimensions for re-selection when receiving new hints
    currentPuzzleRows.value = totalRows;
    currentPuzzleCols.value = totalCols;

    revealedRows.value = new Set();
    revealedCols.value = new Set();

    if (!archipelagoMode.value) return; // In free play, all hints shown via allHintsRevealed

    const totalHints = totalRows + totalCols;
    const hintsToReveal = Math.min(totalHintReveals.value, totalHints);

    // Create array of all possible hint indices (0 to totalRows-1 for rows, totalRows to totalRows+totalCols-1 for cols)
    const allIndices: Array<{ type: 'row' | 'col'; index: number }> = [];
    for (let i = 0; i < totalRows; i++) {
      allIndices.push({ type: 'row', index: i });
    }
    for (let i = 0; i < totalCols; i++) {
      allIndices.push({ type: 'col', index: i });
    }

    // Shuffle using Fisher-Yates
    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = allIndices[i]!;
      allIndices[i] = allIndices[j]!;
      allIndices[j] = temp;
    }

    for (let i = 0; i < hintsToReveal; i++) {
      const hint = allIndices[i];
      if (hint) {
        if (hint.type === 'row') {
          revealedRows.value.add(hint.index);
        } else {
          revealedCols.value.add(hint.index);
        }
      }
    }
  }

  // Add a single new random hint reveal (called when receiving hint item mid-puzzle)
  function addRandomHintReveal() {
    if (!archipelagoMode.value) return; // Free play shows all anyway

    const totalRows = currentPuzzleRows.value;
    const totalCols = currentPuzzleCols.value;
    if (totalRows === 0 || totalCols === 0) return; // No puzzle loaded yet

    // Find all unrevealed hints
    const unrevealedHints: Array<{ type: 'row' | 'col'; index: number }> = [];
    for (let i = 0; i < totalRows; i++) {
      if (!revealedRows.value.has(i)) {
        unrevealedHints.push({ type: 'row', index: i });
      }
    }
    for (let i = 0; i < totalCols; i++) {
      if (!revealedCols.value.has(i)) {
        unrevealedHints.push({ type: 'col', index: i });
      }
    }

    if (unrevealedHints.length === 0) return; // All hints already revealed

    // Pick a random unrevealed hint
    const randomIndex = Math.floor(Math.random() * unrevealedHints.length);
    const hint = unrevealedHints[randomIndex];
    if (hint) {
      if (hint.type === 'row') {
        revealedRows.value.add(hint.index);
      } else {
        revealedCols.value.add(hint.index);
      }
    }
  }

  // Check if a specific row hint is revealed
  function isRowHintRevealed(rowIndex: number): boolean {
    if (!archipelagoMode.value) return true; // Free play shows all
    return revealedRows.value.has(rowIndex);
  }

  // Check if a specific col hint is revealed
  function isColHintRevealed(colIndex: number): boolean {
    if (!archipelagoMode.value) return true; // Free play shows all
    return revealedCols.value.has(colIndex);
  }

  // Use a random cell solve token (returns true if had tokens)
  function useRandomCellSolve(): boolean {
    if (randomCellSolves.value > 0) {
      randomCellSolves.value -= 1;
      return true;
    }
    return false;
  }

  // Buy a random cell solve from the shop
  const RANDOM_CELL_SOLVE_COST = usePersistentRef('ap_randomCellSolveCost', 15);
  function buyRandomCellSolve(): boolean {
    if (spendCoins(RANDOM_CELL_SOLVE_COST.value)) {
      return true;
    }
    return false;
  }

  // Buy a temporary hint reveal (only for current puzzle)
  function buyTempHintReveal(): boolean {
    if (spendCoins(TEMP_HINT_COST.value)) {
      tempHintReveals.value += 1;
      addRandomHintReveal(); // Immediately reveal a new hint
      return true;
    }
    return false;
  }

  // Reset temporary hints for new puzzle
  function resetTempHintsForNewPuzzle() {
    tempHintReveals.value = 0;
  }

  // === Wallet (progressive coin capacity) ===
  // One wallet step is shown at a time. Pooled levels (1..walletsInPool) are multiworld
  // check slots (paying sends the check; the cap arrives as the Wallet Upgrade item).
  // Non-pooled levels are direct coin purchases.
  const nextWalletAction = computed(() => {
    if (!archipelagoMode.value) return null;
    const n = walletsInPool.value;
    for (let k = 1; k <= n && k <= 4; k++) {
      const checkId = AP_LOCATIONS.SHOP_WALLET_1 + (k - 1);
      if (!completedChecks.value.has(checkId)) {
        return { level: k, kind: 'check' as const, price: WALLET_PRICES[k], checkId };
      }
    }
    const next = walletLevel.value + 1;
    if (next > n && next <= 4) {
      return { level: next, kind: 'purchase' as const, price: WALLET_PRICES[next] };
    }
    return null;
  });

  // Buy the next non-pooled wallet level directly with coins.
  function buyWalletUpgrade(): { success: boolean; reason?: string } {
    const next = walletLevel.value + 1;
    if (next > 4) return { success: false, reason: 'Wallet already at maximum.' };
    if (next <= walletsInPool.value) {
      return { success: false, reason: 'This wallet level comes from the multiworld pool.' };
    }
    if (!spendCoins(WALLET_PRICES[next])) return { success: false, reason: 'Not enough coins.' };
    walletLevel.value = next;
    return { success: true };
  }

  // Claim a pooled wallet level's shop slot (a multiworld check). Pays the price and
  // sends the check; the capacity increase itself arrives as the Wallet Upgrade item.
  function claimWalletShopCheck(level: number): { success: boolean; checkId?: number; reason?: string } {
    if (level < 1 || level > walletsInPool.value || level > 4) {
      return { success: false, reason: 'Not a pooled wallet level.' };
    }
    ensureCompletedChecksIsSet();
    const checkId = AP_LOCATIONS.SHOP_WALLET_1 + (level - 1);
    if (completedChecks.value.has(checkId)) return { success: false, reason: 'Already claimed.' };
    if (!spendCoins(WALLET_PRICES[level])) return { success: false, reason: 'Not enough coins.' };
    addCompletedCheck(checkId);
    return { success: true, checkId };
  }

  // Buy difficulty increase. Skips sizes with no puzzles (0 in slot_data), jumping
  // straight to the next size that is actually played.
  function buyDifficultyIncrease(): { success: boolean; checks: number[]; reason?: string } {
    ensureCompletedChecksIsSet();
    const sizes = [5, 10, 15, 20];
    const keyOf = (d: number) => `${d}x${d}` as '5x5' | '10x10' | '15x15' | '20x20';
    const idx = sizes.indexOf(currentDifficulty.value);
    if (idx < 0) {
      return { success: false, checks: [], reason: 'Unknown difficulty.' };
    }
    const nextSize = sizes.slice(idx + 1).find((d) => PUZZLE_COUNTS[keyOf(d)] > 0);
    if (nextSize === undefined) {
      return { success: false, checks: [], reason: 'Already at max difficulty.' };
    }
    const diffStr = keyOf(currentDifficulty.value);
    if (requireTierCompletion.value && puzzlesCompleted[diffStr] < PUZZLE_COUNTS[diffStr]) {
      return { success: false, checks: [], reason: `Complete all ${diffStr} puzzles first.` };
    }
    if (spendCoins(difficultyCostFor(nextSize))) {
      currentDifficulty.value = nextSize;
      const newChecks: number[] = [];
      if (archipelagoMode.value) {
        const unlockId = ({
          10: AP_LOCATIONS.UNLOCK_10X10,
          15: AP_LOCATIONS.UNLOCK_15X15,
          20: AP_LOCATIONS.UNLOCK_20X20,
        } as Record<number, number>)[nextSize];
        if (unlockId !== undefined && !completedChecks.value.has(unlockId)) {
          addCompletedCheck(unlockId);
          newChecks.push(unlockId);
        }
      }
      return { success: true, checks: newChecks };
    }
    return { success: false, checks: [], reason: 'Not enough coins.' };
  }

  // Allow decreasing difficulty (shop). Skips sizes with no puzzles.
  function buyDifficultyDecrease(): { success: boolean; reason?: string } {
    const sizes = [5, 10, 15, 20];
    const keyOf = (d: number) => `${d}x${d}` as '5x5' | '10x10' | '15x15' | '20x20';
    const idx = sizes.indexOf(currentDifficulty.value);
    if (idx < 0) return { success: false, reason: 'Unknown difficulty.' };
    const prevSize = sizes.slice(0, idx).reverse().find((d) => PUZZLE_COUNTS[keyOf(d)] > 0);
    if (prevSize === undefined) {
      return { success: false, reason: 'Already at minimum difficulty.' };
    }
    currentDifficulty.value = prevSize;
    return { success: true };
  }

  // Mark first line as completed for a specific difficulty and return the location ID if it's a new check
  function markFirstLineCompleted(difficulty: '5x5' | '10x10' | '15x15' | '20x20'): number | null {
    if (!archipelagoMode.value) return null;
    if (firstLineCompleted[difficulty]) return null;

    ensureCompletedChecksIsSet();

    firstLineCompleted[difficulty] = true;

    const locationIds = {
      '5x5': AP_LOCATIONS.FIRST_LINE_5X5,
      '10x10': AP_LOCATIONS.FIRST_LINE_10X10,
      '15x15': AP_LOCATIONS.FIRST_LINE_15X15,
      '20x20': AP_LOCATIONS.FIRST_LINE_20X20,
    };

    const locationId = locationIds[difficulty];
    if (!completedChecks.value.has(locationId)) {
      addCompletedCheck(locationId);
      return locationId;
    }
    return null;
  }

  // Mark puzzle as completed and return any new location IDs that should be sent
  function markPuzzleCompleted(difficulty: '5x5' | '10x10' | '15x15' | '20x20'): number[] {
    if (!archipelagoMode.value) return [];

    ensureCompletedChecksIsSet();

    puzzlesCompleted[difficulty] += 1;
    const newChecks: number[] = [];

    // Send the current count's check AND backfill any lower threshold whose check was never
    // confirmed (e.g. a send lost during a brief disconnect). AP checks are idempotent, so
    // re-sending an already-checked location is a harmless no-op.
    const upTo = Math.min(puzzlesCompleted[difficulty], PUZZLE_COUNTS[difficulty]);
    for (let n = 1; n <= upTo; n++) {
      const locationId = getPuzzleLocationId(difficulty, n);
      if (!completedChecks.value.has(locationId)) {
        addCompletedCheck(locationId);
        newChecks.push(locationId);
      }
    }

    return newChecks;
  }

  // Re-send every puzzle-completion check implied by the current counts that the server is
  // missing. Completion checks form a contiguous range (base+1..base+count); reconcile rebuilds
  // the count as the highest checked id, so an interior hole (a lost mid-range send) stays hidden
  // and is never re-sent by normal play. This catch-up (run on connect) fills those holes.
  function getMissingCompletionChecks(): number[] {
    if (!archipelagoMode.value) return [];
    ensureCompletedChecksIsSet();
    const out: number[] = [];
    const bases: Array<{ diff: '5x5' | '10x10' | '15x15' | '20x20'; base: number }> = [
      { diff: '5x5', base: AP_LOCATIONS.PUZZLE_5X5_BASE },
      { diff: '10x10', base: AP_LOCATIONS.PUZZLE_10X10_BASE },
      { diff: '15x15', base: AP_LOCATIONS.PUZZLE_15X15_BASE },
      { diff: '20x20', base: AP_LOCATIONS.PUZZLE_20X20_BASE },
    ];
    for (const { diff, base } of bases) {
      const upTo = Math.min(puzzlesCompleted[diff], PUZZLE_COUNTS[diff]);
      for (let n = 1; n <= upTo; n++) {
        const id = base + n;
        if (!completedChecks.value.has(id)) out.push(id);
      }
    }
    return out;
  }

  // Register something that voids a flawless clear: a wrong cell (gameplay) or a received DeathLink.
  // Auto-X never calls this. Counted even with unlimited lives (flawless = a clean clear).
  function registerMistake() {
    mistakesThisPuzzle.value += 1;
  }

  // Reset the per-puzzle mistake counter (called at the start of every puzzle).
  function resetMistakesForNewPuzzle() {
    mistakesThisPuzzle.value = 0;
  }

  // A failed puzzle (game over) breaks the flawless streak.
  function noteFlawlessRunBroken() {
    flawlessStreak.value = 0;
  }

  // Call when a puzzle is CLEARED. If flawless (no mistakes), advance streak/total and return any
  // newly-earned flawless checks; otherwise reset the streak. Returns [] when off or not in AP mode.
  function markFlawlessProgress(difficulty: '5x5' | '10x10' | '15x15' | '20x20'): number[] {
    if (!archipelagoMode.value || !flawlessChecks.value) return [];
    ensureCompletedChecksIsSet();
    if (mistakesThisPuzzle.value > 0) {
      flawlessStreak.value = 0;
      return [];
    }
    flawlessStreak.value += 1;
    flawlessTotal.value += 1;
    const newChecks: number[] = [];
    const perSize: Record<'5x5' | '10x10' | '15x15' | '20x20', number> = {
      '5x5': AP_LOCATIONS.FLAWLESS_5X5,
      '10x10': AP_LOCATIONS.FLAWLESS_10X10,
      '15x15': AP_LOCATIONS.FLAWLESS_15X15,
      '20x20': AP_LOCATIONS.FLAWLESS_20X20,
    };
    const push = (id: number) => {
      if (!completedChecks.value.has(id)) {
        addCompletedCheck(id);
        newChecks.push(id);
      }
    };
    push(perSize[difficulty]);
    if (flawlessStreak.value >= 5) push(AP_LOCATIONS.FLAWLESS_STREAK_5);
    if (flawlessTotal.value >= 10) push(AP_LOCATIONS.FLAWLESS_TOTAL_10);
    return newChecks;
  }

  // Reconcile local check/progress state with the server's authoritative list of checked
  // locations (called on connect, #3). The server is the source of truth: completedChecks and
  // every derived counter (puzzlesCompleted / firstLineCompleted / coinMilestones) are rebuilt
  // from the server's checkedLocations rather than trusting the local browser session.
  function reconcileCheckedLocations(checkedIds: number[]) {
    ensureCompletedChecksIsSet();

    // completedChecks = exactly what the server reports as checked.
    completedChecks.value = new Set(checkedIds);
    if ((completedChecks as any).triggerPersist) {
      (completedChecks as any).triggerPersist();
    }

    // Rebuild derived structures from scratch.
    puzzlesCompleted['5x5'] = 0;
    puzzlesCompleted['10x10'] = 0;
    puzzlesCompleted['15x15'] = 0;
    puzzlesCompleted['20x20'] = 0;
    firstLineCompleted['5x5'] = false;
    firstLineCompleted['10x10'] = false;
    firstLineCompleted['15x15'] = false;
    firstLineCompleted['20x20'] = false;
    coinMilestones[50] = false;
    coinMilestones[100] = false;

    const puzzleBases: Array<{ diff: '5x5' | '10x10' | '15x15' | '20x20'; base: number }> = [
      { diff: '5x5', base: AP_LOCATIONS.PUZZLE_5X5_BASE },
      { diff: '10x10', base: AP_LOCATIONS.PUZZLE_10X10_BASE },
      { diff: '15x15', base: AP_LOCATIONS.PUZZLE_15X15_BASE },
      { diff: '20x20', base: AP_LOCATIONS.PUZZLE_20X20_BASE },
    ];

    for (const id of checkedIds) {
      if (id === AP_LOCATIONS.OBTAIN_50_COINS) coinMilestones[50] = true;
      else if (id === AP_LOCATIONS.OBTAIN_100_COINS) coinMilestones[100] = true;
      else if (id === AP_LOCATIONS.FIRST_LINE_5X5) firstLineCompleted['5x5'] = true;
      else if (id === AP_LOCATIONS.FIRST_LINE_10X10) firstLineCompleted['10x10'] = true;
      else if (id === AP_LOCATIONS.FIRST_LINE_15X15) firstLineCompleted['15x15'] = true;
      else if (id === AP_LOCATIONS.FIRST_LINE_20X20) firstLineCompleted['20x20'] = true;
      else {
        // Puzzle completion checks are sequential (base+1 .. base+count); the count
        // completed for a difficulty is the highest n that appears in the checked set.
        for (const { diff, base } of puzzleBases) {
          const n = id - base;
          if (n >= 1 && n <= PUZZLE_COUNTS[diff]) {
            if (n > puzzlesCompleted[diff]) puzzlesCompleted[diff] = n;
            break;
          }
        }
      }
    }

    // Rebuild current difficulty from the UNLOCK checks (server-authoritative
    // progression); fall back to the lowest played size when nothing is unlocked yet.
    let unlockedDifficulty = firstActiveDifficulty();
    if (checkedIds.includes(AP_LOCATIONS.UNLOCK_10X10)) unlockedDifficulty = 10;
    if (checkedIds.includes(AP_LOCATIONS.UNLOCK_15X15)) unlockedDifficulty = 15;
    if (checkedIds.includes(AP_LOCATIONS.UNLOCK_20X20)) unlockedDifficulty = 20;
    currentDifficulty.value = unlockedDifficulty;
  }

  // Get location definition by ID
  function getLocationDefinition(locationId: number): LocationDefinition | undefined {
    return LOCATION_REGISTRY.find((loc) => loc.id === locationId);
  }

  // Check if a location has been completed
  function isLocationCompleted(locationId: number): boolean {
    ensureCompletedChecksIsSet();
    return completedChecks.value.has(locationId);
  }

  // Get list of locked items (for UI display)
  const lockedItems = computed(() => {
    return ITEM_REGISTRY.filter((item) => !receivedItems.value.includes(item.id));
  });

  // Get list of unlocked items (for UI display)
  const unlockedItems = computed(() => {
    return ITEM_REGISTRY.filter((item) => receivedItems.value.includes(item.id));
  });

  // Grouped checks for the Checks tab: one collapsible section per played grid size, a wallet
  // section (pooled levels are real location checks), and a misc section. Each section reports
  // how many of its checks are completed vs total.
  const checkSections = computed(() => {
    ensureCompletedChecksIsSet();
    const isDone = (id: number) => completedChecks.value.has(id);
    type CItem = { id: number; name: string; completed: boolean };
    type CSection = { key: string; label: string; items: CItem[]; done: number; total: number };
    const mk = (id: number, name: string): CItem => ({ id, name, completed: isDone(id) });
    const finish = (key: string, label: string, items: CItem[]): CSection => ({
      key, label, items, done: items.filter((x) => x.completed).length, total: items.length,
    });
    const sizeDefs = [
      { key: "5x5", label: t('checks.sectionGrid', { size: '5x5' }), unlock: 0, first: AP_LOCATIONS.FIRST_LINE_5X5, base: AP_LOCATIONS.PUZZLE_5X5_BASE, flawless: AP_LOCATIONS.FLAWLESS_5X5 },
      { key: "10x10", label: t('checks.sectionGrid', { size: '10x10' }), unlock: AP_LOCATIONS.UNLOCK_10X10, first: AP_LOCATIONS.FIRST_LINE_10X10, base: AP_LOCATIONS.PUZZLE_10X10_BASE, flawless: AP_LOCATIONS.FLAWLESS_10X10 },
      { key: "15x15", label: t('checks.sectionGrid', { size: '15x15' }), unlock: AP_LOCATIONS.UNLOCK_15X15, first: AP_LOCATIONS.FIRST_LINE_15X15, base: AP_LOCATIONS.PUZZLE_15X15_BASE, flawless: AP_LOCATIONS.FLAWLESS_15X15 },
      { key: "20x20", label: t('checks.sectionGrid', { size: '20x20' }), unlock: AP_LOCATIONS.UNLOCK_20X20, first: AP_LOCATIONS.FIRST_LINE_20X20, base: AP_LOCATIONS.PUZZLE_20X20_BASE, flawless: AP_LOCATIONS.FLAWLESS_20X20 },
    ];
    const sections: CSection[] = [];
    for (const sd of sizeDefs) {
      const count = PUZZLE_COUNTS[sd.key as "5x5" | "10x10" | "15x15" | "20x20"];
      if (count <= 0) continue;
      const its: CItem[] = [];
      if (sd.unlock) its.push(mk(sd.unlock, t('checks.unlock', { size: sd.key })));
      its.push(mk(sd.first, t('checks.firstLine', { size: sd.key })));
      for (let i = 1; i <= count; i++) its.push(mk(sd.base + i, t('checks.completePuzzles', { i, size: sd.key, s: i > 1 ? 's' : '' })));
      if (flawlessChecks.value) its.push(mk(sd.flawless, t('checks.flawlessSize', { size: sd.key })));
      sections.push(finish(sd.key, sd.label, its));
    }
    const wallets: CItem[] = [];
    for (let k = 1; k <= Math.min(walletsInPool.value, 4); k++) {
      wallets.push(mk(AP_LOCATIONS.SHOP_WALLET_1 + (k - 1), t('checks.walletUpgradeN', { k })));
    }
    if (wallets.length) sections.push(finish("wallets", t('checks.sectionWallets'), wallets));
    const hearts: CItem[] = [];
    if (shopHearts.value && !unlimitedLives.value) {
      for (let k = 1; k <= Math.min(heartsInPool.value, 10); k++) {
        hearts.push(mk(AP_LOCATIONS.SHOP_HEART_1 + (k - 1), t('checks.heartContainerN', { k })));
      }
    }
    if (hearts.length) sections.push(finish("hearts", t('checks.sectionHearts'), hearts));
    const misc: CItem[] = [
      mk(AP_LOCATIONS.OBTAIN_50_COINS, t('checks.obtainCoins', { n: 50 })),
      mk(AP_LOCATIONS.OBTAIN_100_COINS, t('checks.obtainCoins', { n: 100 })),
    ];
    const totalPuzzles = PUZZLE_COUNTS["5x5"] + PUZZLE_COUNTS["10x10"] + PUZZLE_COUNTS["15x15"] + PUZZLE_COUNTS["20x20"];
    if (flawlessChecks.value && totalPuzzles >= 5) misc.push(mk(AP_LOCATIONS.FLAWLESS_STREAK_5, t('checks.flawlessStreak', { n: 5 })));
    if (flawlessChecks.value && totalPuzzles >= 10) misc.push(mk(AP_LOCATIONS.FLAWLESS_TOTAL_10, t('checks.flawlessTotal', { n: 10 })));
    sections.push(finish("misc", t('checks.sectionMisc'), misc));
    return sections;
  });
  const goalTarget = computed(
    () => PUZZLE_COUNTS["5x5"] + PUZZLE_COUNTS["10x10"] + PUZZLE_COUNTS["15x15"] + PUZZLE_COUNTS["20x20"],
  );
  const goalProgress = computed(
    () => puzzlesCompleted["5x5"] + puzzlesCompleted["10x10"] + puzzlesCompleted["15x15"] + puzzlesCompleted["20x20"],
  );
  const goalBreakdown = computed(() =>
    (["5x5", "10x10", "15x15", "20x20"] as const)
      .filter((sz) => PUZZLE_COUNTS[sz] > 0)
      .map((sz) => ({ size: sz, done: puzzlesCompleted[sz], total: PUZZLE_COUNTS[sz] })),
  );

  // Start in free play mode by default (only if not already in archipelago mode)
  if (!archipelagoMode.value) {
    disableArchipelagoMode();
  }

  return {
    // State
    archipelagoMode,
    receivedItems,

    // Lives
    currentLives,
    maxLives,
    extraLives,
    baseLives,
    unlimitedLives,
    lifeRestoreMode,
    lifeRestoreCustom,
    shopHealing,
    healingCostMode,
    healingCostCustom,
    livesBought,
    nextHealingCost,
    canHeal,
    buyHealing,
    zeldaHeartMode,
    shopHearts,
    heartCostMode,
    heartCostCustom,
    heartQuarters,
    heartsBought,
    nextHeartCost,
    canBuyHeart,
    buyHeart,

    // Coins
    coins,
    startingCoins,
    coinsPerBundle,
    unlimitedCoins,
    totalCoinsEarned,
    coinMilestones,

    // Wallet
    walletLevel,
    startingWalletLevel,
    walletsInPool,
    heartsInPool,
    coinCap,
    WALLET_CAPS,
    WALLET_PRICES,
    nextWalletAction,
    nextHeartAction,

    // Hints
    startingHintReveals,
    hintReveals,
    totalHintReveals,
    revealedRows,
    revealedCols,
    allHintsRevealed,
    tempHintReveals,
    TEMP_HINT_COST,

    // Random Cell Solves
    randomCellSolves,
    RANDOM_CELL_SOLVE_COST,

    // Difficulty
    currentDifficulty,
    difficultyCostMode,
    requireTierCompletion,
    nextDifficultyCost,
    firstActiveDifficulty,
    maxActiveDifficulty,

    // Checks/Locations
    completedChecks,
    puzzlesCompleted,
    firstLineCompleted,
    LOCATION_REGISTRY,
    PUZZLE_COUNTS,

    // Item registry
    ITEM_REGISTRY,
    AP_ITEMS,
    AP_LOCATIONS,

    // Methods
    receiveItem,
    hasItem,
    getItemDefinition,
    getLocationDefinition,
    isLocationCompleted,
    checkSections,
    goalTarget,
    goalProgress,
    goalBreakdown,
    reconcileCheckedLocations,
    enableArchipelagoMode,
    enableArchipelagoModeForConnection,
    disableArchipelagoMode,
    resetUnlocks,
    resetLivesForNewPuzzle,
    resetTempHintsForNewPuzzle,
    loseLife,
    loseAllLives,
    registerMistake,
    resetMistakesForNewPuzzle,
    noteFlawlessRunBroken,
    markFlawlessProgress,
    flawlessChecks,
    flawlessStreak,
    flawlessTotal,
    mistakesThisPuzzle,
    debugMode,
    addCoins,
    spendCoins,
    selectRevealedHints,
    isRowHintRevealed,
    isColHintRevealed,
    useRandomCellSolve,
    buyRandomCellSolve,
    buyTempHintReveal,
    buyWalletUpgrade,
    claimWalletShopCheck,
    claimHeartShopCheck,
    buyDifficultyIncrease,
    buyDifficultyDecrease,
    markFirstLineCompleted,
    markPuzzleCompleted,
    getMissingCompletionChecks,
    getPuzzleLocationId,

    // Computed
    lockedItems,
    unlockedItems,
  };
}
