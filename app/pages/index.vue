<script setup lang="ts">
  import NonogramBoard from '~/components/NonogramBoard.vue';
  import ThemePicker from '~/components/ThemePicker.vue';
  import LanguageSwitcher from '~/components/LanguageSwitcher.vue';
  import { useNonogram } from '~/composables/useNonogram';
  import { useArchipelago } from '~/composables/useArchipelago';
  import { AP_ITEMS } from '~/composables/useArchipelagoItems';
  import { clearAllPersistence } from '~/composables/usePersistence';

  const { t } = useI18n();

  const {
    rows,
    cols,
    fillRate,
    solution,
    player,
    rowClueNumbers,
    colClueNumbers,
    solved,
    isRowClueComplete,
    isColClueComplete,
    newRandom,
    clearPlayer,
    autoSolve,
    cycleCell,
  } = useNonogram();

  const {
    host,
    port,
    slot,
    password,
    useSecureConnection,
    status,
    lastMessage,
    messageLog,
    slotData,
    deathLinkEnabled,
    goalCompleted,
    connect,
    disconnect,
    completeGoal,
    checkLocation,
    checkLocations,
    scoutChecks,
    checkPuzzleSolved,
    checkGoalCompletion,
    toggleDeathLink,
    sendDeathLink,
    debugReceiveItem,
    items,
    loadGridState,
    saveGridState,
    say,
  } = useArchipelago();

  // Compute the latest item message (sent or received)
  const latestItemMessage = computed(() => {
    const messages = messageLog?.value ?? [];
    return messages.length > 0 ? (messages[messages.length - 1]?.text.replaceAll(',', ' ') ?? '') : '';
  });

  // Loading state - start as true on server, will be set false on client after hydration
  const isLoading = ref(true);
  const isClientReady = ref(false);

  // Track if we're on mobile for tab visibility logic
  const isMobile = ref(false);

  // --- Resizable panels (desktop only) ---
  // resizeReady gates stored px sizes until after mount; defaults match SSR so no hydration mismatch.
  const resizeReady = ref(false);
  const optionsRegionEl = ref<HTMLElement | null>(null);
  const optionsPanelWidth = usePersistentRef('layout_optionsWidth', 600); // px: width of the right options region
  const shopWidth = usePersistentRef('layout_shopWidth', 300); // px: width of the shop within the top area
  const logHeight = usePersistentRef('layout_logHeight', 200); // px: height of the bottom log strip

  // bounds (px) to keep every panel usable
  const MIN_OPTIONS = 360;
  const MIN_GAME = 480;
  const MIN_SHOP = 200;
  const MIN_TAB = 200;
  const MIN_LOG = 90;
  const MIN_TOP = 160;

  const clampOptionsWidth = (w: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    return Math.min(Math.max(w, MIN_OPTIONS), Math.max(MIN_OPTIONS, vw - MIN_GAME));
  };
  const clampShopWidth = (w: number) =>
    Math.min(Math.max(w, MIN_SHOP), Math.max(MIN_SHOP, optionsPanelWidth.value - MIN_TAB));
  const clampLogHeight = (h: number) => {
    const regionH = optionsRegionEl.value?.clientHeight ?? (typeof window !== 'undefined' ? window.innerHeight - 200 : 600);
    return Math.min(Math.max(h, MIN_LOG), Math.max(MIN_LOG, regionH - MIN_TOP));
  };

  // keep the shop within bounds if the options width shrinks
  watch(optionsPanelWidth, () => {
    shopWidth.value = clampShopWidth(shopWidth.value);
  });

  const optionsStyle = computed(() => (isMobile.value ? undefined : { width: (resizeReady.value ? optionsPanelWidth.value : 600) + 'px' }));
  const shopStyle = computed(() => (isMobile.value ? undefined : { width: (resizeReady.value ? shopWidth.value : 300) + 'px' }));
  const logStyle = computed(() => (isMobile.value ? undefined : { height: (resizeReady.value ? logHeight.value : 200) + 'px' }));

  function startResize(axis: 'options' | 'shop' | 'log', ev: PointerEvent) {
    ev.preventDefault();
    const startX = ev.clientX;
    const startY = ev.clientY;
    const startOptions = optionsPanelWidth.value;
    const startShop = shopWidth.value;
    const startLog = logHeight.value;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = axis === 'log' ? 'row-resize' : 'col-resize';
    const onMove = (e: PointerEvent) => {
      if (axis === 'options') optionsPanelWidth.value = clampOptionsWidth(startOptions - (e.clientX - startX));
      else if (axis === 'shop') shopWidth.value = clampShopWidth(startShop + (e.clientX - startX));
      else logHeight.value = clampLogHeight(startLog - (e.clientY - startY));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  onMounted(() => {
    // Check mobile on mount and resize
    const checkMobile = () => {
      isMobile.value = window.innerWidth < 1024; // lg breakpoint
    };
    checkMobile();
    resizeReady.value = true;
    window.addEventListener('resize', checkMobile);
    window.addEventListener('resize', measureControls);

    // Wait for next tick after mount to ensure hydration is complete
    nextTick(() => {
      // Generate a fresh puzzle to ensure clean state
      newRandom(rows.value, cols.value);
      // Baseline the checks already unlocked for the first puzzle of the session
      snapshotChecksBaseline();
      measureControls();
      // Small delay to ensure styles are fully applied
      setTimeout(() => {
        isClientReady.value = true;
        isLoading.value = false;
      }, 100);
    });

    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener('resize', checkMobile);
    });
  });

  // User preference settings (these are what the user WANTS, actual behavior depends on unlocks)
  const showMistakes = ref(true);
  const checkPulse = ref(false);
  const autoX = ref(true);
  const greyCompletedHints = ref(true);
  const highlightLines = ref(true); // Highlight cursor row/column + clues (D-pad)
  const showDebugGrid = ref(false);
  // Debug: simulate Archipelago slot_data options without generating a seed
  const simAutoX = ref(true);
  const simGreyHints = ref(true);
  const simUnlimitedLives = ref(false);
  const simShowMistakes = ref(true);
  const simWalletLevel = ref(0);
  const simWalletsInPool = ref(0);
  const simPuzzles5x5 = ref(3);
  const simPuzzles10x10 = ref(3);
  const simPuzzles15x15 = ref(3);
  const simPuzzles20x20 = ref(3);
  const simRequireTierCompletion = ref(true);
  const simDifficultyCost = ref('low');
  const simLifeRestoreMode = ref('full');
  const simLifeRestoreCustom = ref(3);
  const simShopHealing = ref(false);
  const simHealingCost = ref('normal');
  const simHealingCostCustom = ref(30);
  const simZeldaHeartMode = ref(false);
  const simShopHearts = ref(false);
  const simHeartCost = ref('normal');
  const simHeartCostCustom = ref(100);
  const simFlawlessChecks = ref(true);
  const simDebugMode = ref(false);
  const dragPainting = ref(true);
  // Mobile cell mode toggle: 'fill' or 'x'
  const mobileCellMode = ref<'fill' | 'x' | 'maybe'>('fill');

  // Mobile D-pad cursor (selected cell) + touch-controls height (reserved below the board).
  const cursorR = ref(0);
  const cursorC = ref(0);
  const controlsEl = ref<HTMLElement | null>(null);
  const controlsH = ref(0);
  const controlsReserve = computed(() => (isMobile.value ? controlsH.value + 8 : 0));
  function moveCursor(dr: number, dc: number) {
    // Wrap around: stepping past an edge re-enters from the opposite side.
    const R = Math.max(1, rows.value);
    const C = Math.max(1, cols.value);
    cursorR.value = (((cursorR.value + dr) % R) + R) % R;
    cursorC.value = (((cursorC.value + dc) % C) + C) % C;
  }
  function applyCursor() {
    handleCellChange(cursorR.value, cursorC.value, mobileCellMode.value);
  }
  function measureControls() {
    controlsH.value = controlsEl.value?.offsetHeight ?? 0;
  }
  watch([rows, cols], () => {
    cursorR.value = Math.min(cursorR.value, Math.max(0, rows.value - 1));
    cursorC.value = Math.min(cursorC.value, Math.max(0, cols.value - 1));
  });
  const coinsPerLine = ref(0); // Coins earned per completed row/column

  // Computed values that combine user preferences with unlock state
  const effectiveShowMistakes = computed(() => showMistakes.value); // Always available, just a preference
  const canPlaceX = computed(() => true); // Always available
  const effectiveAutoX = computed(() => autoX.value); // Always available
  const effectiveGreyHints = computed(() => greyCompletedHints.value); // Always available
  // On mobile, disable drag painting to prevent grid movement issues
  // Allow drag painting on mobile
  const effectiveDragPainting = computed(() => dragPainting.value); // Always allow drag painting
  const gameOver = computed(() => !items.unlimitedLives.value && items.currentLives.value <= 0);

  // Apply AP-locked UI preferences from slot data when connected to Archipelago.
  // auto_x / grey_completed_hints are fixed by the YAML; show_mistakes is forced on
  // while playing with lives (finite), and only follows the YAML when lives are unlimited.
  watch(
    slotData,
    (sd) => {
      if (!sd || typeof sd.auto_x === 'undefined') return; // not an AP slot_data payload
      autoX.value = !!sd.auto_x;
      if (typeof sd.grey_completed_hints !== 'undefined') greyCompletedHints.value = !!sd.grey_completed_hints;
      const unlimited = !!sd.unlimited_lives;
      showMistakes.value = unlimited ? !!sd.show_mistakes : true;
    },
    { deep: true, immediate: true },
  );

  // Debug: inject fake AP slot_data so the locked options can be tested without generating a seed.
  function debugSimulateApOptions() {
    items.enableArchipelagoModeForConnection(); // AP mode on, no state reset
    items.unlimitedLives.value = simUnlimitedLives.value;
    items.startingWalletLevel.value = simWalletLevel.value;
    items.walletLevel.value = simWalletLevel.value;
    items.walletsInPool.value = simWalletsInPool.value;
    items.requireTierCompletion.value = simRequireTierCompletion.value;
    items.difficultyCostMode.value = simDifficultyCost.value;
    items.lifeRestoreMode.value = simLifeRestoreMode.value;
    items.lifeRestoreCustom.value = simLifeRestoreCustom.value;
    items.shopHealing.value = simShopHealing.value;
    items.healingCostMode.value = simHealingCost.value;
    items.healingCostCustom.value = simHealingCostCustom.value;
    items.livesBought.value = 0;
    items.zeldaHeartMode.value = simZeldaHeartMode.value;
    items.shopHearts.value = simShopHearts.value;
    items.heartCostMode.value = simHeartCost.value;
    items.heartCostCustom.value = simHeartCostCustom.value;
    items.heartQuarters.value = 0;
    items.heartsBought.value = 0;
    items.flawlessChecks.value = simFlawlessChecks.value;
    items.debugMode.value = simDebugMode.value;
    items.flawlessStreak.value = 0;
    items.flawlessTotal.value = 0;
    items.mistakesThisPuzzle.value = 0;
    items.PUZZLE_COUNTS['5x5'] = simPuzzles5x5.value;
    items.PUZZLE_COUNTS['10x10'] = simPuzzles10x10.value;
    items.PUZZLE_COUNTS['15x15'] = simPuzzles15x15.value;
    items.PUZZLE_COUNTS['20x20'] = simPuzzles20x20.value;
    items.currentDifficulty.value = items.firstActiveDifficulty();
    // Fresh progress so the difficulty gate can be tested cleanly from the sim.
    items.puzzlesCompleted['5x5'] = 0;
    items.puzzlesCompleted['10x10'] = 0;
    items.puzzlesCompleted['15x15'] = 0;
    items.puzzlesCompleted['20x20'] = 0;
    randomize();
    if (!items.unlimitedCoins.value && items.coins.value > items.coinCap.value) {
      items.coins.value = items.coinCap.value;
    }
    slotData.value = {
      ...slotData.value,
      auto_x: simAutoX.value,
      grey_completed_hints: simGreyHints.value,
      unlimited_lives: simUnlimitedLives.value,
      // mirror fill_slot_data: with finite lives, show_mistakes is forced on
      show_mistakes: simUnlimitedLives.value ? simShowMistakes.value : true,
      starting_wallet_level: simWalletLevel.value,
      wallets_in_pool: simWalletsInPool.value,
      require_tier_completion: simRequireTierCompletion.value,
      difficulty_cost: simDifficultyCost.value,
      life_restore_on_clear: simLifeRestoreMode.value,
      life_restore_custom: simLifeRestoreCustom.value,
      shop_healing: simShopHealing.value,
      healing_cost: simHealingCost.value,
      healing_cost_custom: simHealingCostCustom.value,
      zelda_heart_mode: simZeldaHeartMode.value,
      shop_hearts: simShopHearts.value,
      heart_cost: simHeartCost.value,
      heart_cost_custom: simHeartCostCustom.value,
      flawless_checks: simFlawlessChecks.value,
      debug_mode: simDebugMode.value,
      puzzles_5x5: simPuzzles5x5.value,
      puzzles_10x10: simPuzzles10x10.value,
      puzzles_15x15: simPuzzles15x15.value,
      puzzles_20x20: simPuzzles20x20.value,
      goal_puzzles: simPuzzles5x5.value + simPuzzles10x10.value + simPuzzles15x15.value + simPuzzles20x20.value,
    };
  }
  function debugExitApSim() {
    items.disableArchipelagoMode();
    slotData.value = {};
  }

  // Shop: difficulty gating
  // Current AP difficulty as a tier key ('5x5' | '10x10' | '15x15' | '20x20').
  const apDifficultyKey = computed<'5x5' | '10x10' | '15x15' | '20x20'>(() => {
    const d = items.currentDifficulty.value;
    if (d >= 20) return '20x20';
    if (d >= 15) return '15x15';
    if (d >= 10) return '10x10';
    return '5x5';
  });
  // True once every puzzle of the current tier has been completed (mirrors buyDifficultyIncrease rule).
  const currentTierComplete = computed(
    () => items.puzzlesCompleted[apDifficultyKey.value] >= items.PUZZLE_COUNTS[apDifficultyKey.value],
  );
  // True at the highest tier, where there is nothing left to unlock.
  const isMaxDifficulty = computed(() => items.currentDifficulty.value >= items.maxActiveDifficulty());

  // Next / previous grid size that actually has puzzles (skip-aware difficulty navigation).
  const sizeKey = (d: number) => `${d}x${d}` as '5x5' | '10x10' | '15x15' | '20x20';
  const nextActiveSize = computed<number | null>(() => {
    const sizes = [5, 10, 15, 20];
    const i = sizes.indexOf(items.currentDifficulty.value);
    if (i < 0) return null;
    return sizes.slice(i + 1).find((d) => items.PUZZLE_COUNTS[sizeKey(d)] > 0) ?? null;
  });
  const prevActiveSize = computed<number | null>(() => {
    const sizes = [5, 10, 15, 20];
    const i = sizes.indexOf(items.currentDifficulty.value);
    if (i < 0) return null;
    return sizes.slice(0, i).reverse().find((d) => items.PUZZLE_COUNTS[sizeKey(d)] > 0) ?? null;
  });

  // Whether the next difficulty can be bought now (tier rule + affordability).
  const canBuyDifficulty = computed(
    () =>
      (!items.requireTierCompletion.value || currentTierComplete.value) &&
      items.coins.value >= items.nextDifficultyCost.value,
  );

  // The unlock location for the difficulty above the current one (null at the max tier).
  const nextUnlockLocId = computed<number | null>(() => {
    switch (apDifficultyKey.value) {
      case '5x5':
        return items.AP_LOCATIONS.UNLOCK_10X10;
      case '10x10':
        return items.AP_LOCATIONS.UNLOCK_15X15;
      case '15x15':
        return items.AP_LOCATIONS.UNLOCK_20X20;
      default:
        return null;
    }
  });
  // Show a "go unlock the next difficulty in the shop" hint when the current tier is fully done
  // and the next difficulty hasn't been unlocked yet. Covers both finishing the tier and replaying
  // an already-finished one, and stays quiet once the next difficulty is unlocked.
  const showTierUnlockHint = computed(
    () =>
      items.archipelagoMode.value &&
      currentTierComplete.value &&
      !isMaxDifficulty.value &&
      nextUnlockLocId.value !== null &&
      !items.isLocationCompleted(nextUnlockLocId.value),
  );

  // Filter out consumables from unlocked/locked items display
  const unlockedNonConsumables = computed(() => items.unlockedItems.value.filter((item) => item.category !== 'consumable'));
  const lockedNonConsumables = computed(() => items.lockedItems.value.filter((item) => item.category !== 'consumable'));

  // Track completed rows/columns to award coins only once
  const completedRows = ref<Set<number>>(new Set());
  const completedCols = ref<Set<number>>(new Set());
  const hasCompletedFirstLineThisPuzzle = ref(false); // Track if we've sent first line check for current puzzle

  // --- "Puzzle Solved" banner: show the checks unlocked while solving this puzzle ---
  // Snapshot the server-confirmed checks when a puzzle begins, then diff against them on solve.
  const checksAtPuzzleStart = ref<Set<number>>(new Set());
  function snapshotChecksBaseline() {
    const cc: unknown = items.completedChecks.value;
    checksAtPuzzleStart.value = new Set(cc instanceof Set ? cc : Array.isArray(cc) ? cc : []);
  }

  const AP_LOC = items.AP_LOCATIONS;
  function checkIconFor(id: number): string {
    if (
      id === AP_LOC.FLAWLESS_5X5 ||
      id === AP_LOC.FLAWLESS_10X10 ||
      id === AP_LOC.FLAWLESS_15X15 ||
      id === AP_LOC.FLAWLESS_20X20 ||
      id === AP_LOC.FLAWLESS_STREAK_5 ||
      id === AP_LOC.FLAWLESS_TOTAL_10
    )
      return '\u2B50';
    if (id === AP_LOC.OBTAIN_50_COINS || id === AP_LOC.OBTAIN_100_COINS) return '🪙';
    if (id === AP_LOC.FIRST_LINE_5X5 || id === AP_LOC.FIRST_LINE_10X10 || id === AP_LOC.FIRST_LINE_15X15 || id === AP_LOC.FIRST_LINE_20X20)
      return '📏';
    if (id === AP_LOC.UNLOCK_10X10 || id === AP_LOC.UNLOCK_15X15 || id === AP_LOC.UNLOCK_20X20) return '🔓';
    return '🧩'; // puzzle-completion milestone
  }

  // Location checks newly unlocked since the current puzzle began (insertion order preserved).
  const solvedUnlockedChecks = computed(() => {
    const cc: unknown = items.completedChecks.value;
    const all = cc instanceof Set ? [...cc] : Array.isArray(cc) ? cc : [];
    const start = checksAtPuzzleStart.value;
    return all
      .filter((id) => !start.has(id))
      .map((id) => ({ id, name: items.getLocationDefinition(id)?.name ?? `Location #${id}`, icon: checkIconFor(id) }));
  });

  // Items actually found at the checks unlocked this puzzle (populated by scouting on solve).
  type ScoutedItem = {
    locationId: number;
    itemId: number;
    itemName: string;
    itemGame: string;
    receiver: string;
    progression: boolean;
    useful: boolean;
    trap: boolean;
  };
  const solvedItems = ref<ScoutedItem[]>([]);

  // --- Shop check scouting: show which AP item lives in each pooled wallet/heart shop slot ---
  const scoutedShop = ref<Record<number, ScoutedItem>>({});
  async function refreshShopScout() {
    const ids: number[] = [];
    const w = items.nextWalletAction.value;
    if (w && w.kind === 'check' && w.checkId != null && !(w.checkId in scoutedShop.value)) ids.push(w.checkId);
    const h = items.nextHeartAction.value;
    if (h && h.kind === 'check' && h.checkId != null && !(h.checkId in scoutedShop.value)) ids.push(h.checkId);
    if (ids.length === 0) return;
    const scouted = await scoutChecks(ids);
    if (scouted.length === 0) return;
    const map: Record<number, ScoutedItem> = { ...scoutedShop.value };
    for (const it of scouted) map[it.locationId] = it;
    scoutedShop.value = map;
  }
  watch(
    () => [items.nextWalletAction.value?.checkId, items.nextHeartAction.value?.checkId],
    () => {
      void refreshShopScout();
    },
    { immediate: true },
  );
  const walletScout = computed(() => {
    const w = items.nextWalletAction.value;
    return w && w.kind === 'check' && w.checkId != null ? scoutedShop.value[w.checkId] ?? null : null;
  });
  const heartScout = computed(() => {
    const h = items.nextHeartAction.value;
    return h && h.kind === 'check' && h.checkId != null ? scoutedShop.value[h.checkId] ?? null : null;
  });

  // --- Shop purchase/claim notice (transient toast) ---
  const shopNotice = ref<{ icon: string; title: string; detail: string } | null>(null);
  let shopNoticeTimer: any = null;
  function showShopNotice(icon: string, title: string, detail: string) {
    shopNotice.value = { icon, title, detail };
    if (shopNoticeTimer) clearTimeout(shopNoticeTimer);
    shopNoticeTimer = setTimeout(() => {
      shopNotice.value = null;
    }, 4000);
  }
  function shopReceiverLabel(it: ScoutedItem): string {
    return it.receiver === slot.value ? t('common.you') : it.receiver;
  }

  const AP_IT = items.AP_ITEMS;
  function itemIconFor(it: ScoutedItem): string {
    if (it.itemGame === 'Nonopelagram') {
      switch (it.itemId) {
        case AP_IT.UNLOCK_HINTS:
          return '👁️';
        case AP_IT.EXTRA_LIFE:
          return '❤️';
        case AP_IT.COINS_BUNDLE:
          return '🪙';
        case AP_IT.SOLVE_RANDOM_CELL:
          return '✨';
        default:
          return '🧩';
      }
    }
    // Item belonging to another game: AP carries no per-item art, so use the generic island icon.
    return '🏝️';
  }
  function itemClassBadge(it: ScoutedItem): string {
    if (it.progression) return '⭐';
    if (it.trap) return '💀';
    if (it.useful) return '🔧';
    return '';
  }

  // Helper to get difficulty string from current puzzle size
  function getCurrentDifficulty(): '5x5' | '10x10' | '15x15' | '20x20' {
    if (rows.value >= 20) return '20x20';
    if (rows.value >= 15) return '15x15';
    if (rows.value >= 10) return '10x10';
    return '5x5';
  }

  // Check for newly completed rows/columns and award coins
  function checkLineCompletions() {
    if (!solution.value) return;

    // Check rows
    for (let r = 0; r < rows.value; r++) {
      if (completedRows.value.has(r)) continue;

      // A row with no filled cells (clue all-0) is auto-X'd and "complete" from the start; we
      // still process it to award the auto-X cell coins, but skip the line bonus / first-line.
      const rowHasFills = solution.value[r]?.some((cell) => cell === 1);

      let rowComplete = true;
      for (let c = 0; c < cols.value; c++) {
        const shouldBeFilled = solution.value[r]?.[c] === 1;
        const playerFilled = player.value[r]?.[c] === 'fill';
        if (shouldBeFilled !== playerFilled) {
          rowComplete = false;
          break;
        }
      }

      if (rowComplete) {
        completedRows.value.add(r);

        // Line completion bonus only for rows that actually have filled cells.
        let rowCoinChecks = rowHasFills ? items.addCoins(coinsPerLine.value) : [];

        // If auto-X is enabled, award coins for auto-X'd cells in this row
        if (effectiveAutoX.value) {
          let autoXCount = 0;
          for (let c = 0; c < cols.value; c++) {
            const shouldBeFilled = solution.value[r]?.[c] === 1;
            const currentState = player.value[r]?.[c];
            // Count empty cells that shouldn't be filled (will be auto-X'd),
            // unless their column is already complete (already auto-X'd & awarded).
            if (!shouldBeFilled && currentState === 'empty' && !completedCols.value.has(c)) {
              autoXCount++;
            }
          }
          if (autoXCount > 0) {
            const autoXCoinChecks = items.addCoins(autoXCount);
            rowCoinChecks = [...rowCoinChecks, ...autoXCoinChecks];
          }
        }

        if (rowCoinChecks.length > 0) {
          checkLocations(rowCoinChecks);
        }

        // Check for first line completion (skip trivial all-0 rows).
        if (rowHasFills && !hasCompletedFirstLineThisPuzzle.value) {
          hasCompletedFirstLineThisPuzzle.value = true;
          const difficulty = getCurrentDifficulty();
          const locationId = items.markFirstLineCompleted(difficulty);
          if (locationId !== null) {
            checkLocation(locationId);
          }
        }
      }
    }

    // Check columns
    for (let c = 0; c < cols.value; c++) {
      if (completedCols.value.has(c)) continue;

      // A column with no filled cells is auto-X'd / "complete" from the start; process it for the
      // auto-X cell coins but skip the line bonus / first-line.
      let colHasFills = false;
      for (let r = 0; r < rows.value; r++) {
        if (solution.value[r]?.[c] === 1) {
          colHasFills = true;
          break;
        }
      }

      let colComplete = true;
      for (let r = 0; r < rows.value; r++) {
        const shouldBeFilled = solution.value[r]?.[c] === 1;
        const playerFilled = player.value[r]?.[c] === 'fill';
        if (shouldBeFilled !== playerFilled) {
          colComplete = false;
          break;
        }
      }

      if (colComplete) {
        completedCols.value.add(c);

        // Line completion bonus only for columns that actually have filled cells.
        let colCoinChecks = colHasFills ? items.addCoins(coinsPerLine.value) : [];

        // If auto-X is enabled, award coins for auto-X'd cells in this column
        if (effectiveAutoX.value) {
          let autoXCount = 0;
          for (let r = 0; r < rows.value; r++) {
            const shouldBeFilled = solution.value[r]?.[c] === 1;
            const currentState = player.value[r]?.[c];
            // Count empty cells that shouldn't be filled (will be auto-X'd),
            // unless their row is already complete (already auto-X'd & awarded).
            if (!shouldBeFilled && currentState === 'empty' && !completedRows.value.has(r)) {
              autoXCount++;
            }
          }
          if (autoXCount > 0) {
            const autoXCoinChecks = items.addCoins(autoXCount);
            colCoinChecks = [...colCoinChecks, ...autoXCoinChecks];
          }
        }

        if (colCoinChecks.length > 0) {
          checkLocations(colCoinChecks);
        }

        // Check for first line completion (skip trivial all-0 columns).
        if (colHasFills && !hasCompletedFirstLineThisPuzzle.value) {
          hasCompletedFirstLineThisPuzzle.value = true;
          const difficulty = getCurrentDifficulty();
          const locationId = items.markFirstLineCompleted(difficulty);
          if (locationId !== null) {
            checkLocation(locationId);
          }
        }
      }
    }
  }

  // Handle cell changes - award coins for correct moves
  function handleCellChange(r: number, c: number, mode: 'fill' | 'x' | 'erase' | 'maybe') {
    // Block interaction if puzzle is solved or game is over
    if (solved.value || gameOver.value) {
      return;
    }

    // Block X placement if not unlocked
    if (mode === 'x' && !canPlaceX.value) {
      return; // Silently ignore X placement attempts
    }

    if (!solution.value) return;

    const currentState = player.value[r]?.[c];
    const shouldBeFilled = solution.value[r]?.[c] === 1;

    // Block changing correct cells (can't erase or toggle off correct answers)
    const isCorrectFill = currentState === 'fill' && shouldBeFilled;
    const isCorrectX = currentState === 'x' && !shouldBeFilled;
    // Auto-X'd cells (empty, shouldn't be filled, in a completed row/col) are already
    // resolved and were already awarded coins — treat them as locked to prevent double rewards.
    const isAutoXed =
      currentState === 'empty' &&
      !shouldBeFilled &&
      effectiveAutoX.value &&
      (completedRows.value.has(r) || completedCols.value.has(c));
    if (isCorrectFill || isCorrectX || isAutoXed) {
      return; // Can't modify already-resolved cells
    }

    // "?" is a pure planning annotation: toggle it, never award coins, never deal damage.
    if (mode === 'maybe') {
      cycleCell(r, c, 'maybe');
      player.value = player.value.slice();
      return;
    }

    // Apply the change
    cycleCell(r, c, mode);
    // Force reactivity update (simple fix for mobile mistake display)
    player.value = player.value.slice();

    // Check result after change
    const newState = player.value[r]?.[c];

    // Award coins for correct placements
    if (mode === 'fill' && newState === 'fill') {
      if (shouldBeFilled) {
        const coinChecks = items.addCoins(1); // Correct fill
        if (coinChecks.length > 0) {
          checkLocations(coinChecks);
        }
      } else {
        items.registerMistake();
        items.loseLife(); // Mistake
        player.value = player.value.slice(); // Force update after mistake
      }
    } else if (mode === 'x' && newState === 'x') {
      if (!shouldBeFilled) {
        const coinChecks = items.addCoins(1); // Correct X
        if (coinChecks.length > 0) {
          checkLocations(coinChecks);
        }
      } else {
        items.registerMistake();
        items.loseLife(); // Mistake
        player.value = player.value.slice(); // Force update after mistake
      }
    }

    // Check for newly completed lines
    checkLineCompletions();
  }

  // Solve a random unsolved cell
  function solveRandomCell() {
    if (!solution.value) return false;

    // Helper function to check if a row is complete
    const isRowComplete = (r: number): boolean => {
      for (let c = 0; c < cols.value; c++) {
        const shouldBeFilled = solution.value[r]?.[c] === 1;
        const playerFilled = player.value[r]?.[c] === 'fill';
        if (shouldBeFilled !== playerFilled) return false;
      }
      return true;
    };

    // Helper function to check if a column is complete
    const isColComplete = (c: number): boolean => {
      for (let r = 0; r < rows.value; r++) {
        const shouldBeFilled = solution.value[r]?.[c] === 1;
        const playerFilled = player.value[r]?.[c] === 'fill';
        if (shouldBeFilled !== playerFilled) return false;
      }
      return true;
    };

    // Find all unsolved cells
    const unsolvedCells: Array<{ r: number; c: number }> = [];
    for (let r = 0; r < rows.value; r++) {
      for (let c = 0; c < cols.value; c++) {
        const currentState = player.value[r]?.[c];
        const shouldBeFilled = solution.value[r]?.[c] === 1;

        // Cell is correctly solved if:
        // - It's filled and should be filled, OR
        // - It's x'd and should be x'd, OR
        // - It's empty, shouldn't be filled, and would be auto-X'd (row or col complete)
        const isCorrectlySolved =
          (currentState === 'fill' && shouldBeFilled) ||
          (currentState === 'x' && !shouldBeFilled) ||
          (currentState === 'empty' && !shouldBeFilled && effectiveAutoX.value && (isRowComplete(r) || isColComplete(c)));

        // Only add cells that are NOT correctly solved
        if (!isCorrectlySolved) {
          unsolvedCells.push({ r, c });
        }
      }
    }

    if (unsolvedCells.length === 0) return false;

    // Pick random cell
    const randomIndex = Math.floor(Math.random() * unsolvedCells.length);
    const cell = unsolvedCells[randomIndex];
    if (!cell) return false;

    const shouldBeFilled = solution.value[cell.r]?.[cell.c] === 1;
    const currentState = player.value[cell.r]?.[cell.c];

    // Double-check this cell is actually unsolved (defensive programming)
    const isAlreadyCorrect = (currentState === 'fill' && shouldBeFilled) || (currentState === 'x' && !shouldBeFilled);
    if (isAlreadyCorrect) {
      // This shouldn't happen, but if it does, try again
      console.warn('Selected an already-solved cell, retrying...');
      return solveRandomCell();
    }

    // Set the correct value
    // First, ensure the cell is empty
    if (currentState !== 'empty') {
      cycleCell(cell.r, cell.c, 'erase');
    }

    // Now set the correct value (cell is guaranteed to be empty)
    if (shouldBeFilled) {
      cycleCell(cell.r, cell.c, 'fill'); // Will toggle empty -> fill
    } else {
      cycleCell(cell.r, cell.c, 'x'); // Will toggle empty -> x
    }

    // Power-ups don't pay out the per-cell coin (a token was spent to use the power-up);
    // line-completion coins below still apply.
    checkLineCompletions();
    return true;
  }

  // Use a random cell solve token
  function useRandomCellSolve() {
    if (items.useRandomCellSolve()) {
      solveRandomCell();
    }
  }

  // Buy and use a random cell solve from shop
  function buyAndUseRandomCellSolve() {
    if (items.buyRandomCellSolve()) {
      solveRandomCell();
    }
  }

  // Buy a temporary hint reveal
  function buyTempHint() {
    items.buyTempHintReveal();
  }

  // Buy difficulty increase
  function buyDifficultyIncrease() {
    const result = items.buyDifficultyIncrease();
    if (result.success) {
      if (result.checks.length > 0) {
        checkLocations(result.checks);
      }
      randomize();
    } else if (result.reason) {
      alert(result.reason);
    }
  }

  function buyDifficultyDecrease() {
    const result = items.buyDifficultyDecrease();
    if (result.success) {
      randomize();
    } else if (result.reason) {
      alert(result.reason);
    }
  }

  // Wallet: buy the next non-pooled level, or claim a pooled level's shop check.
  function buyWalletUpgrade() {
    const lvl = items.nextWalletAction.value?.level;
    const result = items.buyWalletUpgrade();
    if (!result.success && result.reason) alert(result.reason);
    else if (result.success) showShopNotice('', 'Achat !', 'Wallet niveau ' + (lvl ?? ''));
  }
  // Shop: buy one heal (+1 life up to max).
  function buyHealing() {
    const result = items.buyHealing();
    if (!result.success && result.reason) alert(result.reason);
    else if (result.success) showShopNotice('♥', 'Soin !', '+1 vie');
  }
  // Shop: buy a heart container (whole, or a quarter in Zelda mode).
  function buyHeart() {
    const result = items.buyHeart();
    if (!result.success && result.reason) alert(result.reason);
    else if (result.success) showShopNotice('♥', 'Achat !', 'Conteneur de cœur');
  }
  function claimWalletShopCheck(level: number) {
    const result = items.claimWalletShopCheck(level);
    if (result.success && result.checkId != null) {
      checkLocations([result.checkId]);
      const it = scoutedShop.value[result.checkId];
      if (it) showShopNotice(itemIconFor(it), 'Check débloqué !', it.itemName + ' → ' + shopReceiverLabel(it));
      else showShopNotice('', 'Check débloqué !', 'Wallet niveau ' + level);
    } else if (result.reason) {
      alert(result.reason);
    }
  }
  function claimHeartShopCheck(index: number) {
    const result = items.claimHeartShopCheck(index);
    if (result.success && result.checkId != null) {
      checkLocations([result.checkId]);
      const it = scoutedShop.value[result.checkId];
      if (it) showShopNotice(itemIconFor(it), 'Check débloqué !', it.itemName + ' → ' + shopReceiverLabel(it));
      else showShopNotice('♥', 'Check débloqué !', 'Heart Container ' + index);
    } else if (result.reason) {
      alert(result.reason);
    }
  }

  function checkAll() {
    // Ability is always available
    // if (!items.unlocks.checkMistakes) return;
    checkPulse.value = true;
    window.setTimeout(() => (checkPulse.value = false), 2000);
  }

  // Track puzzle completion - only fire once when solved transitions from false to true
  watch(solved, async (isSolved, wasSolved) => {
    if (isSolved && !wasSolved) {
      // Mark puzzle completed and get any new location checks
      const difficulty = getCurrentDifficulty();
      const newLocationChecks = items.markPuzzleCompleted(difficulty);
      // Send all new checks to AP
      if (newLocationChecks.length > 0) {
        checkLocations(newLocationChecks);
      }
      // Flawless tracking: a clear with zero mistakes counts toward the flawless checks.
      const flawlessChecksToSend = items.markFlawlessProgress(difficulty);
      if (flawlessChecksToSend.length > 0) {
        checkLocations(flawlessChecksToSend);
      }
      checkPuzzleSolved(); // Legacy logging
      // Check if we've reached the goal
      checkGoalCompletion();
      // Scout the checks unlocked during this puzzle to show the items found (and for whom)
      const unlockedIds = solvedUnlockedChecks.value.map((c) => c.id);
      solvedItems.value = unlockedIds.length > 0 ? await scoutChecks(unlockedIds) : [];
    }
  });

  // Watch for game over (lost all lives) to send Death Link
  watch(
    () => items.currentLives.value,
    (newLives, oldLives) => {
      if (newLives === 0 && oldLives > 0) {
        // A failed puzzle breaks the flawless streak.
        items.noteFlawlessRunBroken();
        if (deathLinkEnabled.value) {
          sendDeathLink('Lost all lives on a puzzle');
        }
      }
    },
  );

  function clampInt(v: any, min: number, max: number) {
    const n = Number.parseInt(String(v ?? ''), 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function clearAllProgress() {
    const confirmed = confirm(
      'Are you sure you want to delete ALL game data? This will reset:\n' +
        '- Current puzzle progress\n' +
        '- All items and coins\n' +
        '- Puzzle completion history\n' +
        '- Archipelago connection state\n\n' +
        'This action cannot be undone.',
    );

    if (confirmed) {
      // Clear persistence
      clearAllPersistence();

      // Reset all game state
      // Clear player grid
      clearPlayer();

      // Reset items system
      items.enableArchipelagoMode();
      items.disableArchipelagoMode();

      // Generate fresh puzzle
      newRandom(5, 5);

      alert('All game data has been cleared. Starting fresh!');
    }
  }

  /** Right panel tabs - on mobile, 'puzzle' is also a tab */
  type MobileTab = 'puzzle' | 'archipelago' | 'settings' | 'goals' | 'chat' | 'shop' | 'debug';
  type RightTab = 'archipelago' | 'settings' | 'goals' | 'chat' | 'shop' | 'debug';
  const activeTab = ref<RightTab>('archipelago');
  const activeMobileTab = ref<MobileTab>('puzzle');

  // Mobile navigation drawer (replaces the cramped horizontal tab bar).
  const mobileMenuOpen = ref(false);
  const mobileMenuItems = computed(() => {
    const list: { key: MobileTab; label: string }[] = [
      { key: 'puzzle', label: t('tabs.puzzle') },
      { key: 'archipelago', label: t('tabs.archipelago') },
      { key: 'shop', label: t('tabs.shop') },
    ];
    if (items.archipelagoMode.value) list.push({ key: 'goals', label: t('tabs.checks') });
    list.push({ key: 'chat', label: t('tabs.log') });
    list.push({ key: 'settings', label: t('tabs.settings') });
    return list;
  });
  const mobileTabLabel = computed(
    () => mobileMenuItems.value.find((m) => m.key === activeMobileTab.value)?.label ?? t('tabs.puzzle'),
  );
  function selectMobileTab(key: MobileTab) {
    activeMobileTab.value = key;
    mobileMenuOpen.value = false;
  }
  const activeLogTab = ref<'log' | 'debug'>('log');
  // Debug tab: visible when the host enabled debug_mode, or while offline (so the slot_data
  // simulator stays reachable before/without a connection).
  const debugTabVisible = computed(() => items.debugMode.value || status.value !== 'connected');
  watch(debugTabVisible, (visible) => {
    if (!visible && activeLogTab.value === 'debug') activeLogTab.value = 'log';
  });

  // Ref for chat log container to enable auto-scroll
  const chatLogContainer = ref<HTMLElement | null>(null);

  // Game Log chat input -> say() (plain messages + AP `!` server commands like !hint, !help).
  const chatInput = ref('');
  function submitChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    void say(msg);
    chatInput.value = '';
  }

  // Computed to check if a specific tab should be shown
  const isTabVisible = (tab: RightTab) => {
    if (isMobile.value) {
      return activeMobileTab.value === tab;
    }
    return activeTab.value === tab;
  };

  // Desktop layout: Shop is an always-open middle column and Chat is an always-visible bottom strip;
  // on mobile they are tab pages. The right column (tabs + chat) shows on desktop, or on mobile when
  // a right-column tab or chat is active.
  const showShopArea = computed(() => !isMobile.value || activeMobileTab.value === 'shop');
  const showChatArea = computed(() => !isMobile.value || activeMobileTab.value === 'chat');
  const showTabsArea = computed(
    () => !isMobile.value || (['archipelago', 'settings', 'goals'] as MobileTab[]).includes(activeMobileTab.value),
  );
  const showRightColumn = computed(
    () => !isMobile.value || (['archipelago', 'settings', 'goals', 'debug', 'chat'] as MobileTab[]).includes(activeMobileTab.value),
  );

  // Function to navigate to chat (mobile switches to the chat tab; desktop chat is always visible)
  const navigateToChat = () => {
    if (isMobile.value) {
      activeMobileTab.value = 'chat';
    }
    nextTick(() => {
      if (chatLogContainer.value) {
        chatLogContainer.value.scrollTop = chatLogContainer.value.scrollHeight;
      }
    });
  };

  // Auto-scroll chat to the bottom when it becomes visible
  watch([activeTab, activeMobileTab, isMobile], () => {
    if (showChatArea.value) {
      nextTick(() => {
        if (chatLogContainer.value) {
          chatLogContainer.value.scrollTop = chatLogContainer.value.scrollHeight;
        }
      });
    }
  });

  /** Keep rows & cols equal */
  const lockSize = ref(true);

  // Computed values for the inputs to ensure proper reactivity
  const rowsInput = computed({
    get: () => rows.value,
    set: (val: number) => {
      const clamped = clampInt(val, 5, 50);
      rows.value = clamped;
      if (lockSize.value) cols.value = clamped;
      // Regenerate puzzle with new dimensions
      newRandom(rows.value, cols.value);
    },
  });

  const colsInput = computed({
    get: () => cols.value,
    set: (val: number) => {
      const clamped = clampInt(val, 5, 50);
      cols.value = clamped;
      if (lockSize.value) rows.value = clamped;
      // Regenerate puzzle with new dimensions
      newRandom(rows.value, cols.value);
    },
  });

  function setRows(next: number) {
    rowsInput.value = next;
  }
  function setCols(next: number) {
    colsInput.value = next;
  }

  /** If user toggles lock ON, immediately equalize */
  watch(lockSize, (on) => {
    if (on) cols.value = rows.value;
  });

  /** Bottom status indicator */
  const statusMeta = computed(() => {
    switch (status.value) {
      case 'connected':
        return { label: t('status.connected'), dot: 'bg-lime-400', text: 'text-lime-300' };
      case 'connecting':
        return { label: t('status.connecting'), dot: 'bg-amber-400', text: 'text-amber-300' };
      case 'error':
        return { label: t('status.error'), dot: 'bg-red-400', text: 'text-red-300' };
      default:
        return { label: t('status.disconnected'), dot: 'bg-neutral-500', text: 'text-neutral-300' };
    }
  });

  function randomize(afterClear = false, resetLives = true) {
    // In archipelago mode, use the current difficulty setting
    const size = items.archipelagoMode.value ? items.currentDifficulty.value : rows.value;
    // When locked, ensure square randomize
    if (lockSize.value) newRandom(size, size);
    else newRandom(items.archipelagoMode.value ? size : rows.value, items.archipelagoMode.value ? size : cols.value);
    // Update rows/cols refs to match
    if (items.archipelagoMode.value) {
      rows.value = size;
      cols.value = size;
    }
    // Lives for the new puzzle (restore-on-clear only when following a solved puzzle).
    // On a connect-time regen (resetLives=false) the economy blob governs health instead.
    if (resetLives) items.resetLivesForNewPuzzle(afterClear);
    // Reset temporary hints
    items.resetTempHintsForNewPuzzle();
    // Reset the per-puzzle mistake counter (flawless tracking)
    items.resetMistakesForNewPuzzle();
    // Reset completed line tracking
    completedRows.value = new Set();
    completedCols.value = new Set();
    hasCompletedFirstLineThisPuzzle.value = false;
    // Auto-X'd empty lines (clue all-0) are "complete" from the start: award their cell coins now
    // so the player doesn't have to manually re-cross them. Run before the baseline so these
    // automatic checks aren't flagged as "earned this puzzle" in the solved banner.
    checkLineCompletions();
    // Baseline the checks already unlocked, so the solved banner only shows checks earned in this puzzle
    snapshotChecksBaseline();
    solvedItems.value = [];
    // Select which hints to reveal for this puzzle
    items.selectRevealedHints(rows.value, cols.value);
  }

  // --- Last-played grid persistence (server-side, per slot; pairs with useArchipelago.saveGridState). ---
  function buildGridBlob() {
    return {
      rows: rows.value,
      cols: cols.value,
      solution: solution.value,
      player: player.value,
      revealedRows: [...items.revealedRows.value],
      revealedCols: [...items.revealedCols.value],
    };
  }

  // Recompute per-puzzle line-completion trackers from the current grid WITHOUT awarding coins
  // (used after restoring a saved grid; coins were already earned and come back via the economy blob).
  function recomputeCompletedLines() {
    const cr = new Set<number>();
    const cc = new Set<number>();
    let anyNonTrivial = false;
    for (let r = 0; r < rows.value; r++) {
      let complete = true;
      let hasFills = false;
      for (let c = 0; c < cols.value; c++) {
        const should = solution.value[r]?.[c] === 1;
        if (should) hasFills = true;
        if (should !== (player.value[r]?.[c] === 'fill')) { complete = false; break; }
      }
      if (complete) { cr.add(r); if (hasFills) anyNonTrivial = true; }
    }
    for (let c = 0; c < cols.value; c++) {
      let complete = true;
      let hasFills = false;
      for (let r = 0; r < rows.value; r++) {
        const should = solution.value[r]?.[c] === 1;
        if (should) hasFills = true;
        if (should !== (player.value[r]?.[c] === 'fill')) { complete = false; break; }
      }
      if (complete) { cc.add(c); if (hasFills) anyNonTrivial = true; }
    }
    completedRows.value = cr;
    completedCols.value = cc;
    hasCompletedFirstLineThisPuzzle.value = anyNonTrivial;
  }

  // On connect: restore the saved grid if present and size-compatible, else a fresh puzzle.
  async function setupGridOnConnect() {
    try {
      const size = items.currentDifficulty.value;
      const blob = (await loadGridState()) as null | {
        rows?: number; cols?: number;
        solution?: typeof solution.value;
        player?: typeof player.value;
        revealedRows?: number[]; revealedCols?: number[];
      };
      if (
        blob && blob.rows === size &&
        Array.isArray(blob.solution) && blob.solution.length === size &&
        Array.isArray(blob.player) && blob.player.length === size
      ) {
        rows.value = size;
        cols.value = blob.cols ?? size;
        solution.value = blob.solution;
        player.value = blob.player;
        items.revealedRows.value = new Set(blob.revealedRows ?? []);
        items.revealedCols.value = new Set(blob.revealedCols ?? []);
        recomputeCompletedLines();
        items.resetTempHintsForNewPuzzle();
        solvedItems.value = [];
        snapshotChecksBaseline();
        return;
      }
    } catch {
      /* fall through to a fresh puzzle */
    }
    randomize(false, false);
  }

  // Persist the current grid to the server (debounced) whenever it changes while connected.
  let gridSaveTimer: ReturnType<typeof setTimeout> | null = null;
  watch([player, solution], () => {
    if (status.value !== 'connected') return;
    if (gridSaveTimer) clearTimeout(gridSaveTimer);
    gridSaveTimer = setTimeout(() => { saveGridState(buildGridBlob()); }, 800);
  });

  // When Archipelago mode is enabled, generate a new puzzle so user doesn't see the hints
  watch(
    () => items.archipelagoMode.value,
    (isArchipelagoMode) => {
      // Manual enable while offline -> fresh puzzle. On connect, setupGridOnConnect() owns grid setup.
      if (isArchipelagoMode && status.value === 'disconnected') {
        randomize(false, false);
      }
    },
  );

  // After connecting (and the server reconciliation in connect()), re-baseline so the solved
  // banner doesn't list checks that were already completed on the server.
  watch(status, (s) => {
    if (s !== 'connected') return;
    void refreshShopScout();
    // Restore the last-played grid for this slot from the server (cross-device); falls back to a
    // fresh puzzle when there is no saved grid or its size no longer matches currentDifficulty.
    if (items.archipelagoMode.value) {
      void setupGridOnConnect();
    } else {
      snapshotChecksBaseline();
    }
  });

  // Debug functions
  function debugHints() {
    if (!solution.value) return;
    console.log('=== HINT DEBUG ===');
    console.log('Solution grid:');
    solution.value.forEach((row, i) => {
      console.log(`Row ${i + 1}:`, row.join(' '));
    });

    console.log('\nCalculated row hints:');
    rowClueNumbers.value.forEach((clues, i) => {
      console.log(`Row ${i + 1}:`, clues);
    });

    console.log('\nCalculated column hints:');
    colClueNumbers.value.forEach((clues, i) => {
      console.log(`Col ${i + 1}:`, clues);
    });
    console.log('==================');
  }

  function copyDebugInfo() {
    if (!solution.value) {
      console.log('No solution available');
      return;
    }

    let output = '=== DEBUG INFO ===\n\n';
    output += 'Solution rows (0=empty, 1=fill) → rowClues prop:\n';
    solution.value.forEach((row, r) => {
      output += `R${r + 1}: [${row.join(',')}] → [${rowClueNumbers.value[r]?.join(', ') || '?'}]\n`;
    });

    output += '\nColumn hints (colClues prop):\n';
    colClueNumbers.value.forEach((clues, c) => {
      output += `C${c + 1}: [${clues.join(', ')}]\n`;
    });

    console.log('Debug output:', output);

    try {
      navigator.clipboard
        .writeText(output)
        .then(() => {
          console.log('Copied to clipboard!');
          alert('Debug info copied to clipboard!');
        })
        .catch((err) => {
          console.error('Clipboard write failed:', err);
          alert('Failed to copy. Check console for debug info.');
        });
    } catch (err) {
      console.error('Clipboard error:', err);
      alert('Failed to copy. Check console for debug info.');
    }
  }
</script>

<template>
  <!-- Shop purchase/claim notice (transient toast) -->
  <div
    v-if="shopNotice"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-neutral-900/95 px-4 py-2 shadow-xl"
  >
    <span v-if="shopNotice.icon" class="text-lg">{{ shopNotice.icon }}</span>
    <div class="text-left">
      <div class="text-xs font-semibold text-emerald-300">{{ shopNotice.title }}</div>
      <div class="text-[11px] text-neutral-300">{{ shopNotice.detail }}</div>
    </div>
  </div>
  <!-- Loading Screen with inline styles for SSR -->
  <div
    v-if="isLoading"
    style="
      position: fixed;
      inset: 0;
      z-index: 9999;
      background-color: #0a0a0a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    "
  >
    <div style="text-align: center">
      <h1 style="font-size: 1.5rem; font-weight: bold; color: #f5f5f5; margin-bottom: 0.5rem">Nonopelagram</h1>
      <p style="font-size: 0.875rem; color: #a3a3a3">{{ $t('board.loading') }}</p>
    </div>
  </div>

  <div v-show="!isLoading" class="h-screen bg-neutral-950 text-neutral-100 flex flex-col overflow-hidden">
    <!-- Mobile top bar with burger menu (mobile only) -->
    <div class="lg:hidden flex items-center gap-2 border-b border-neutral-700/50 bg-neutral-900/95 shrink-0 px-3 py-2">
      <button
        type="button"
        class="p-1.5 -ml-1 rounded hover:bg-neutral-800 text-neutral-200 transition-colors"
        :aria-label="$t('aria.openMenu')"
        @click="mobileMenuOpen = true"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span class="text-sm font-semibold text-neutral-100">{{ mobileTabLabel }}</span>
    </div>

    <!-- Mobile navigation drawer -->
    <div v-if="mobileMenuOpen" class="lg:hidden fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/60" @click="mobileMenuOpen = false"></div>
      <nav class="absolute left-0 top-0 h-full w-64 max-w-[80%] bg-neutral-900 border-r border-neutral-700/50 shadow-xl flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-700/50 shrink-0">
          <span class="text-sm font-semibold text-neutral-100">{{ $t('nav.menu') }}</span>
          <button type="button" class="p-1 text-neutral-400 hover:text-white" :aria-label="$t('aria.closeMenu')" @click="mobileMenuOpen = false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto py-1">
          <button
            v-for="t in mobileMenuItems"
            :key="t.key"
            type="button"
            class="w-full flex items-center px-4 py-3 text-left text-sm transition-colors"
            :class="activeMobileTab === t.key ? 'bg-neutral-800 text-white font-medium border-l-2 border-lime-400' : 'text-neutral-300 hover:bg-neutral-800/60 border-l-2 border-transparent'"
            @click="selectMobileTab(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
      </nav>
    </div>

    <div class="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
      <!-- Main content area (grid) - hidden on mobile when not on puzzle tab -->
      <div
        class="flex-1 px-1.5 sm:px-6 py-1 sm:py-0 min-h-0 overflow-hidden lg:overflow-y-auto"
        :class="{ 'hidden lg:block': activeMobileTab !== 'puzzle' }"
      >
        <!-- LEFT: board -->
        <div class="glass-card p-2 sm:p-3 animate-fade-in overflow-visible">
          <!-- Status bar: Lives, Coins-->
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1 pb-1 border-b border-neutral-700/50">
            <div class="flex flex-wrap items-center gap-3 sm:gap-6">
              <div class="hidden sm:flex items-center gap-2">
                <span class="text-sm text-neutral-400">Nonopelagram</span>
              </div>
              <!-- Lives Display -->
              <div class="flex items-center gap-1 sm:gap-2">
                <span class="text-xs sm:text-sm text-neutral-400">{{ $t('status.lives') }}</span>
                <div class="flex items-center gap-0.5">
                  <span
                    v-for="i in items.maxLives.value"
                    :key="i"
                    class="text-base sm:text-lg"
                    :class="i <= items.currentLives.value ? 'text-red-400' : 'text-neutral-600'"
                  >
                    ♥
                  </span>
                  <span v-if="items.unlimitedLives.value" class="text-xs text-neutral-500 ml-1">(∞)</span>
                  <span
                    v-if="items.archipelagoMode.value && items.zeldaHeartMode.value && !items.unlimitedLives.value && items.maxLives.value < 10"
                    class="text-xs text-rose-300/80 ml-1"
                    :title="$t('board.quartersToHeart')"
                  >{{ items.heartQuarters.value }}/4&#9829;</span>
                </div>
              </div>
              <!-- Coins Display -->
              <div class="flex items-center gap-1 sm:gap-2">
                <span class="text-xs sm:text-sm text-neutral-400">{{ $t('status.coins') }}</span>
                <span class="text-base sm:text-lg font-bold text-amber-400">🪙 {{ items.coins.value }}<span v-if="items.archipelagoMode.value && !items.unlimitedCoins.value" class="text-[11px] font-normal text-amber-400/60"> / {{ items.coinCap.value }}</span></span>
                <span v-if="items.unlimitedCoins.value" class="text-xs text-neutral-500">(∞)</span>
              </div>
              <!-- Power-ups: click an icon to use it directly -->
              <div class="hidden lg:flex items-center gap-1 sm:gap-2">
                <span class="text-xs sm:text-sm text-neutral-400">{{ $t('status.powerups') }}</span>
                <button
                  class="flex items-center gap-1 px-2 py-1 rounded text-base sm:text-lg transition-colors"
                  :class="
                    items.randomCellSolves.value > 0
                      ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30'
                      : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                  "
                  :disabled="items.randomCellSolves.value <= 0"
                  @click="useRandomCellSolve()"
                  :title="$t('controls.solveRandomTitle')"
                  :aria-label="$t('aria.useRandomSolve')"
                >
                  <span>🎯</span>
                  <span class="text-sm font-bold">{{ items.randomCellSolves.value }}</span>
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="solved"
            class="mb-4 sm:mb-6 p-3 sm:p-4 rounded-sm border border-accent-500/40 bg-accent-500/10 text-accent-200 celebration-glow animate-slide-up"
          >
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex items-start gap-3">
                <span class="text-xl sm:text-2xl">🎉</span>
                <div>
                  <div class="font-semibold text-sm sm:text-base">{{ $t('modal.solvedTitle') }}</div>
                  <div v-if="items.archipelagoMode.value && items.flawlessChecks.value" class="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-amber-300">
                    <span>&#11088;</span>
                    <span>S&#233;rie sans faute : {{ items.flawlessStreak.value }} <span class="text-accent-300/70">(total : {{ items.flawlessTotal.value }})</span></span>
                  </div>
                  <!-- Archipelago: show what solving this puzzle unlocked -->
                  <div v-if="solvedItems.length > 0 || solvedUnlockedChecks.length > 0 || goalCompleted" class="mt-1 space-y-0.5">
                    <div class="text-[11px] uppercase tracking-wider text-accent-300/70">
                      {{ solvedItems.length > 0 ? 'Items envoyés' : 'Checks débloqués' }}
                    </div>
                    <!-- Items found (scouted): icon + name + classification badge + recipient -->
                    <template v-if="solvedItems.length > 0">
                      <div
                        v-for="it in solvedItems"
                        :key="it.locationId"
                        class="flex items-center gap-1.5 text-xs sm:text-sm text-accent-200"
                      >
                        <span>{{ itemIconFor(it) }}</span>
                        <span>{{ it.itemName }}</span>
                        <span v-if="itemClassBadge(it)">{{ itemClassBadge(it) }}</span>
                        <span class="text-accent-300/70">→ {{ it.receiver === slot ? $t('common.you') : it.receiver }}</span>
                      </div>
                    </template>
                    <!-- Fallback when scouting is unavailable: show the location names -->
                    <template v-else>
                      <div
                        v-for="c in solvedUnlockedChecks"
                        :key="c.id"
                        class="flex items-center gap-1.5 text-xs sm:text-sm text-accent-200"
                      >
                        <span>{{ c.icon }}</span>
                        <span>{{ c.name }}</span>
                      </div>
                    </template>
                    <div v-if="goalCompleted" class="flex items-center gap-1.5 text-xs sm:text-sm text-amber-300">
                      <span>🏆</span>
                      <span>{{ $t('modal.goalReached') }}</span>
                    </div>
                  </div>
                  <!-- Free play / no new check: keep the generic congratulations -->
                  <div v-else class="text-xs sm:text-sm text-accent-300/80">{{ $t('modal.solvedBody') }}</div>
                  <!-- Tier completed: nudge the player to unlock the next difficulty in the shop -->
                  <div
                    v-if="showTierUnlockHint"
                    class="mt-2 flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1 text-xs sm:text-sm text-amber-300"
                  >
                    <span>🛒</span>
                    <span>Tu as terminé toutes les grilles {{ apDifficultyKey }} ! Débloque la difficulté supérieure dans la boutique.</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn-primary text-sm w-full sm:w-auto" @click="randomize(true)">{{ $t('controls.nextPuzzle') }}</button>
            </div>
          </div>

          <!-- Game Over Message -->
          <div
            v-if="gameOver && !solved"
            class="mb-4 sm:mb-6 p-3 sm:p-4 rounded-sm border border-red-500/40 bg-red-500/10 text-red-200 animate-slide-up"
          >
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <span class="text-xl sm:text-2xl">💔</span>
                <div>
                  <div class="font-semibold text-sm sm:text-base">{{ $t('modal.gameOverTitle') }}</div>
                  <div v-if="items.archipelagoMode.value && items.flawlessChecks.value" class="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-amber-300">
                    <span>&#11088;</span>
                    <span>{{ $t('flawless.streakReset') }} <span class="text-red-300/70">({{ $t('flawless.total', { n: items.flawlessTotal.value }) }})</span></span>
                  </div>
                  <div class="text-xs sm:text-sm text-red-300/80">{{ $t('modal.gameOverBody') }}</div>
                </div>
              </div>
              <button type="button" class="btn-primary text-sm w-full sm:w-auto" @click="randomize()">{{ $t('controls.newPuzzle') }}</button>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-2 sm:gap-6 items-center justify-start sm:items-start sm:justify-start">
            <!-- Grid - with custom scrollbars on mobile -->
            <div class="shrink-0 lg:pr-0">
              <ScrollableGrid max-width="calc(100vw - 16px)" max-height="calc(100dvh - 56px)">
                <NonogramBoard
                  v-if="isClientReady"
                  :rows="rows"
                  :cols="cols"
                  :row-clues="rowClueNumbers"
                  :col-clues="colClueNumbers"
                  :player="player"
                  :solution="solution"
                  :show-mistakes="effectiveShowMistakes || checkPulse"
                  :auto-x="effectiveAutoX"
                  :grey-completed-hints="effectiveGreyHints"
                  :is-row-clue-complete="isRowClueComplete"
                  :is-col-clue-complete="isColClueComplete"
                  :show-debug-grid="showDebugGrid"
                  :drag-painting="effectiveDragPainting"
                  :is-row-hint-revealed="items.isRowHintRevealed"
                  :is-col-hint-revealed="items.isColHintRevealed"
                  :mobile-cell-mode="mobileCellMode"
                  :cursor-row="isMobile ? cursorR : -1"
                  :cursor-col="isMobile ? cursorC : -1"
                  :highlight-lines="highlightLines"
                  :reserved-bottom="controlsReserve"
                  :disabled="gameOver && !solved"
                  @cell="handleCellChange"
                />
                <div v-else class="flex items-center justify-center" style="width: 300px; height: 300px">
                  <p class="text-neutral-400">{{ $t('board.loading') }}</p>
                </div>
              </ScrollableGrid>
            </div>

            <!-- Solution Grid (debug) -->
            <div v-if="showDebugGrid && solution" class="shrink-0">
              <div class="bg-neutral-800/40 rounded-sm p-4 border border-neutral-700/50 select-text">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Solution (Debug)</h3>
                  <div class="flex gap-2">
                    <button @click="copyDebugInfo" class="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded">
                      Copy Debug
                    </button>
                    <button @click="debugHints" class="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded">{{ $t('settings.logHints') }}</button>
                  </div>
                </div>

                <!-- Visual grid -->
                <div class="flex mb-4">
                  <!-- Row numbers -->
                  <div class="flex flex-col mr-1">
                    <!-- Spacer for column header row -->
                    <div class="h-3 mb-1"></div>
                    <div v-for="r in rows" :key="`row-num-${r}`" class="h-3 text-[8px] text-neutral-500 flex items-center justify-end pr-1">
                      {{ r }}
                    </div>
                  </div>
                  <!-- Grid -->
                  <div>
                    <!-- Column numbers -->
                    <div class="flex mb-1">
                      <div v-for="c in cols" :key="`col-num-${c}`" class="w-3 text-[8px] text-neutral-500 text-center">
                        {{ c }}
                      </div>
                    </div>
                    <div
                      class="grid gap-0 border border-neutral-600"
                      :style="{
                        gridTemplateColumns: `repeat(${cols}, 12px)`,
                        gridTemplateRows: `repeat(${rows}, 12px)`,
                      }"
                    >
                      <div v-for="(row, r) in solution" :key="`debug-row-${r}`" class="contents">
                        <div
                          v-for="(cell, c) in row"
                          :key="`debug-${r}-${c}`"
                          class="border-r border-b border-neutral-700"
                          :class="cell === 1 ? 'bg-neutral-400' : 'bg-transparent'"
                          :style="{
                            borderRightWidth: c === cols - 1 ? '0' : '1px',
                            borderBottomWidth: r === rows - 1 ? '0' : '1px',
                          }"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Show each row's raw solution data + computed hints side by side -->
                <div class="text-[10px] text-neutral-400 font-mono space-y-1">
                  <div class="text-neutral-500 mb-2">Row data: [solution cells] → [computed hints]</div>
                  <div v-for="(row, r) in solution" :key="`debug-row-data-${r}`" class="flex items-center gap-2">
                    <span class="text-neutral-500 w-8">R{{ r + 1 }}:</span>
                    <span class="text-neutral-300">[{{ row.join(',') }}]</span>
                    <span class="text-neutral-500">→</span>
                    <span class="text-amber-400">[{{ rowClueNumbers[r]?.join(', ') || '?' }}]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Mobile touch controls: directional pad + mode + power-up (below the grid) -->
          <div ref="controlsEl" class="lg:hidden mt-2 flex flex-col items-center gap-3 select-none">
            <div class="flex items-center justify-center gap-6">
            <!-- Directional pad: arrows move the cursor (wraps around edges) -->
            <div class="grid grid-cols-3 grid-rows-3 gap-1" style="width: 150px; height: 150px">
              <span></span>
              <button type="button" class="flex items-center justify-center rounded bg-neutral-800 text-neutral-200 text-lg active:bg-neutral-700" @click="moveCursor(-1, 0)" :aria-label="$t('aria.moveUp')">&#9650;</button>
              <span></span>
              <button type="button" class="flex items-center justify-center rounded bg-neutral-800 text-neutral-200 text-lg active:bg-neutral-700" @click="moveCursor(0, -1)" :aria-label="$t('aria.moveLeft')">&#9664;</button>
              <span></span>
              <button type="button" class="flex items-center justify-center rounded bg-neutral-800 text-neutral-200 text-lg active:bg-neutral-700" @click="moveCursor(0, 1)" :aria-label="$t('aria.moveRight')">&#9654;</button>
              <span></span>
              <button type="button" class="flex items-center justify-center rounded bg-neutral-800 text-neutral-200 text-lg active:bg-neutral-700" @click="moveCursor(1, 0)" :aria-label="$t('aria.moveDown')">&#9660;</button>
              <span></span>
            </div>
              <button
                type="button"
                class="flex items-center justify-center rounded-full text-white text-3xl font-bold transition active:scale-95"
                style="width: 96px; height: 96px"
                :class="mobileCellMode === 'fill' ? 'bg-lime-600 active:bg-lime-500' : mobileCellMode === 'x' ? 'bg-red-600 active:bg-red-500' : 'bg-sky-700 active:bg-sky-600'"
                @click="applyCursor()"
                :aria-label="mobileCellMode === 'fill' ? $t('aria.fillSelected') : $t('aria.crossSelected')"
              >
                <span v-if="mobileCellMode === 'fill'">&#9632;</span><span v-else-if="mobileCellMode === 'x'">&#10005;</span><span v-else>?</span>
              </button>
            </div>
            <div class="flex items-end justify-center gap-5">
              <div class="flex flex-col gap-1">
                <span class="text-xs text-neutral-400">{{ $t('controls.mode') }}</span>
                <div class="flex items-center">
                  <button type="button" class="px-3 py-2 rounded-l border border-neutral-700 text-lg" :class="mobileCellMode === 'fill' ? 'bg-lime-600 text-white' : 'bg-neutral-800 text-neutral-300'" @click="mobileCellMode = 'fill'" :aria-label="$t('aria.fillMode')">&#9632;</button>
                  <button type="button" class="px-3 py-2 border border-l-0 border-neutral-700 text-lg" :class="mobileCellMode === 'maybe' ? 'bg-sky-700 text-white' : 'bg-neutral-800 text-neutral-300'" @click="mobileCellMode = 'maybe'" :aria-label="$t('aria.maybeMode')">?</button>
                  <button type="button" class="px-3 py-2 rounded-r border border-l-0 border-neutral-700 text-lg" :class="mobileCellMode === 'x' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-300'" @click="mobileCellMode = 'x'" :aria-label="$t('aria.xMode')">&#10005;</button>
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-xs text-neutral-400">{{ $t('controls.powerup') }}</span>
                <button type="button" class="flex items-center justify-center gap-1.5 px-3 py-2 rounded text-base transition-colors" :class="items.randomCellSolves.value > 0 ? 'bg-cyan-500/20 text-cyan-300 active:bg-cyan-500/30' : 'bg-neutral-700/30 text-neutral-500'" :disabled="items.randomCellSolves.value <= 0" @click="useRandomCellSolve()" :aria-label="$t('aria.useRandomSolve')">
                  <span>&#128302;</span>
                  <span class="text-sm font-bold">{{ items.randomCellSolves.value }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resize handle: game / options panel width (desktop only) -->
      <div
        class="hidden lg:block shrink-0 w-1.5 cursor-col-resize bg-neutral-700/40 hover:bg-cyan-500/60 transition-colors touch-none"
        @pointerdown="startResize('options', $event)"
        :title="$t('resize.gameOptions')"
      ></div>

      <!-- RIGHT: sidebar attached to right side (hidden on mobile when puzzle tab active) -->
      <!-- layout: top row [Shop column | open tab] (~75%) + Chat full width below (~25%) -->
      <div
        ref="optionsRegionEl"
        class="w-full lg:w-[600px] shrink-0 bg-neutral-900/95 backdrop-blur-lg border-t lg:border-t-0 lg:border-l border-neutral-700 flex flex-col min-h-0 flex-1 lg:flex-initial"
        :class="{ 'hidden lg:flex': activeMobileTab === 'puzzle' }"
        :style="optionsStyle"
      >
        <!-- TOP AREA: Shop column + open tab side by side; height fills above the log strip -->
        <div v-show="showShopArea || showTabsArea" class="flex flex-col lg:flex-row min-h-0 flex-1 overflow-hidden">
          <!-- MIDDLE COLUMN: Shop (always open on desktop; a tab page on mobile) -->
          <div
            v-show="showShopArea"
            class="w-full lg:w-[300px] shrink-0 lg:border-r border-neutral-700/50 bg-neutral-900/95 overflow-y-auto p-4"
            :style="shopStyle"
          >
          <div class="space-y-6">
            <div class="flex items-center gap-3">
              <div>
                <h2 class="font-semibold text-neutral-100">{{ $t('tabs.shop') }}</h2>
                <p class="text-xs text-neutral-400">{{ $t('shop.subtitle') }}</p>
              </div>
            </div>

            <!-- Shop -->
            <section class="space-y-3">
              <div class="bg-neutral-800/30 rounded-sm p-4 space-y-3">
                <!-- Random Cell Solve -->
                <button
                  class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                  :class="
                    items.coins.value >= items.RANDOM_CELL_SOLVE_COST.value
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                  "
                  :disabled="items.coins.value < items.RANDOM_CELL_SOLVE_COST.value"
                  @click="buyAndUseRandomCellSolve()"
                >
                  <span>🎯 {{ $t('shop.buyRandomCell') }}</span>
                  <span class="text-xs">🪙 {{ items.RANDOM_CELL_SOLVE_COST.value }}</span>
                </button>

                <!-- Temporary Hint Reveal (only in AP mode) -->
                <button
                  v-if="items.archipelagoMode.value"
                  class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                  :class="
                    items.coins.value >= items.TEMP_HINT_COST.value
                      ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                      : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                  "
                  :disabled="items.coins.value < items.TEMP_HINT_COST.value"
                  @click="buyTempHint()"
                >
                  <div class="text-left">
                    <span>👁️ {{ $t('shop.tempHint') }}</span>
                    <div class="text-[10px] opacity-70">{{ $t('controls.revealHint') }}</div>
                  </div>
                  <span class="text-xs">🪙 {{ items.TEMP_HINT_COST.value }}</span>
                </button>

                <!-- Wallet (progressive coin capacity), only in AP mode -->
                <template v-if="items.archipelagoMode.value && items.nextWalletAction.value">
                  <button
                    v-if="items.nextWalletAction.value.kind === 'check'"
                    class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                    :class="
                      items.coins.value >= items.nextWalletAction.value.price
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                    "
                    :disabled="items.coins.value < items.nextWalletAction.value.price"
                    @click="claimWalletShopCheck(items.nextWalletAction.value.level)"
                  >
                    <div class="text-left">
                      <span>{{ $t('shop.walletLevelCheck', { level: items.nextWalletAction.value.level }) }}</span>
                      <div class="text-[10px] opacity-70">{{ $t('shop.sendsCheckCap', { cap: items.WALLET_CAPS[items.nextWalletAction.value.level] }) }}</div>
                      <div v-if="walletScout" class="text-[10px] text-accent-200/90 flex items-center gap-1">
                        <span>{{ itemIconFor(walletScout) }}</span>
                        <span class="truncate">{{ walletScout.itemName }}</span>
                        <span v-if="itemClassBadge(walletScout)">{{ itemClassBadge(walletScout) }}</span>
                        <span class="opacity-70">&rarr; {{ walletScout.receiver === slot ? $t('common.you') : walletScout.receiver }}</span>
                      </div>
                    </div>
                    <span class="text-xs">🪙 {{ items.nextWalletAction.value.price }}</span>
                  </button>
                  <button
                    v-else
                    class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                    :class="
                      items.coins.value >= items.nextWalletAction.value.price
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                    "
                    :disabled="items.coins.value < items.nextWalletAction.value.price"
                    @click="buyWalletUpgrade()"
                  >
                    <div class="text-left">
                      <span>{{ $t('shop.walletUpgrade', { level: items.nextWalletAction.value.level }) }}</span>
                      <div class="text-[10px] opacity-70">{{ $t('shop.maxCoins', { from: items.coinCap.value, to: items.WALLET_CAPS[items.nextWalletAction.value.level] }) }}</div>
                    </div>
                    <span class="text-xs">🪙 {{ items.nextWalletAction.value.price }}</span>
                  </button>
                </template>

                <!-- Buy Healing (AP mode, shop healing on, finite lives) -->
                <button
                  v-if="items.archipelagoMode.value && items.shopHealing.value && !items.unlimitedLives.value"
                  class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                  :class="
                    items.canHeal.value
                      ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                      : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                  "
                  :disabled="!items.canHeal.value"
                  @click="buyHealing()"
                >
                  <div class="text-left">
                    <span>{{ $t('controls.heal') }}</span>
                    <div class="text-[10px] opacity-70">{{ items.currentLives.value }}/{{ items.maxLives.value }} {{ $t('shop.livesWord') }}</div>
                  </div>
                  <span class="text-xs">&#129689; {{ items.nextHealingCost.value }}</span>
                </button>

                <!-- Heart container (AP mode, shop hearts on, finite lives): pooled slots are checks -->
                <template v-if="items.archipelagoMode.value && items.shopHearts.value && !items.unlimitedLives.value && items.nextHeartAction.value">
                  <button
                    v-if="items.nextHeartAction.value.kind === 'check'"
                    class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                    :class="
                      items.coins.value >= items.nextHeartAction.value.price
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                    "
                    :disabled="items.coins.value < items.nextHeartAction.value.price"
                    @click="claimHeartShopCheck(items.nextHeartAction.value.index)"
                  >
                    <div class="text-left">
                      <span>{{ $t('shop.heartContainerCheck', { index: items.nextHeartAction.value.index }) }}</span>
                      <div class="text-[10px] opacity-70">{{ $t('shop.sendsCheckHearts', { max: items.maxLives.value }) }}</div>
                      <div v-if="heartScout" class="text-[10px] text-accent-200/90 flex items-center gap-1">
                        <span>{{ itemIconFor(heartScout) }}</span>
                        <span class="truncate">{{ heartScout.itemName }}</span>
                        <span v-if="itemClassBadge(heartScout)">{{ itemClassBadge(heartScout) }}</span>
                        <span class="opacity-70">&rarr; {{ heartScout.receiver === slot ? $t('common.you') : heartScout.receiver }}</span>
                      </div>
                    </div>
                    <span class="text-xs">&#129689; {{ items.nextHeartAction.value.price }}</span>
                  </button>
                  <button
                    v-else
                    class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                    :class="
                      items.canBuyHeart.value
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                    "
                    :disabled="!items.canBuyHeart.value"
                    @click="buyHeart()"
                  >
                    <div class="text-left">
                      <span>{{ items.zeldaHeartMode.value ? $t('shop.buyQuarterHeart') : $t('shop.buyHeart') }}</span>
                      <div class="text-[10px] opacity-70">
                        <template v-if="items.zeldaHeartMode.value">{{ items.heartQuarters.value }}/4 &#9829; - {{ items.maxLives.value }}/10 max</template>
                        <template v-else>{{ items.maxLives.value }}/10 {{ $t('shop.maxHearts') }}</template>
                      </div>
                    </div>
                    <span class="text-xs">&#129689; {{ items.nextHeartAction.value.price }}</span>
                  </button>
                </template>

                <!-- Increase Difficulty (only in AP mode, hidden at max tier) -->
                <button
                  v-if="items.archipelagoMode.value && (nextActiveSize !== null)"
                  class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between"
                  :class="
                    canBuyDifficulty
                      ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                      : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed'
                  "
                  :disabled="!canBuyDifficulty"
                  @click="buyDifficultyIncrease()"
                >
                  <div class="text-left">
                    <span>📈 {{ $t('shop.increaseDifficulty') }}</span>
                    <div class="text-[10px] opacity-70">
                      {{ items.currentDifficulty.value }}x{{ items.currentDifficulty.value }} →
                      {{ nextActiveSize }}x{{ nextActiveSize }}
                    </div>
                  </div>
                  <span class="text-xs">🪙 {{ items.nextDifficultyCost.value }}</span>
                </button>
                <!-- Locked hint: finish every puzzle of the current tier first -->
                <p
                  v-if="items.archipelagoMode.value && (nextActiveSize !== null) && items.requireTierCompletion.value && !currentTierComplete"
                  class="text-[11px] text-amber-400/80 -mt-1 px-1"
                >
                  Termine toutes les grilles {{ apDifficultyKey }} pour débloquer la difficulté suivante
                  ({{ items.puzzlesCompleted[apDifficultyKey] }}/{{ items.PUZZLE_COUNTS[apDifficultyKey] }})
                </p>
                <!-- Decrease Difficulty (only shown once difficulty has been increased above the base 5x5) -->
                <button
                  v-if="items.archipelagoMode.value && (prevActiveSize !== null)"
                  class="w-full px-4 py-3 rounded text-sm font-medium transition-colors flex items-center justify-between bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                  @click="buyDifficultyDecrease()"
                >
                  <div class="text-left">
                    <span>📉 {{ $t('shop.decreaseDifficulty') }}</span>
                    <div class="text-[10px] opacity-70">
                      {{ items.currentDifficulty.value }}x{{ items.currentDifficulty.value }} →
                      {{ prevActiveSize }}x{{ prevActiveSize }}
                    </div>
                  </div>
                </button>
              </div>
            </section>
          </div>
        </div>

          <!-- Resize handle: shop / open-tab width (desktop only) -->
          <div
            class="hidden lg:block shrink-0 w-1.5 cursor-col-resize bg-neutral-700/40 hover:bg-cyan-500/60 transition-colors touch-none"
            @pointerdown="startResize('shop', $event)"
            :title="$t('resize.shopTab')"
          ></div>

          <!-- TAB COLUMN: tab bar + open tab content (fills the rest of the options width) -->
          <div v-show="showTabsArea" class="w-full lg:w-auto lg:flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            <!-- tab bar (desktop only - mobile uses top tab bar) -->
            <div class="hidden lg:flex border-b border-neutral-700/50 shrink-0">
              <button class="tab-button whitespace-nowrap" :class="{ active: activeTab === 'archipelago' }" @click="activeTab = 'archipelago'">
                Archipelago
              </button>
              <button class="tab-button whitespace-nowrap" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">{{ $t('tabs.settings') }}</button>
              <button
                v-if="items.archipelagoMode.value"
                class="tab-button whitespace-nowrap"
                :class="{ active: activeTab === 'goals' }"
                @click="activeTab = 'goals'"
              >{{ $t('tabs.checks') }}</button>
            </div>

          <!-- tab content - on mobile, show based on activeMobileTab; on desktop, show based on activeTab -->
          <div class="p-4 flex-1 overflow-y-auto min-h-0">
            <!-- SETTINGS -->
            <div v-if="isTabVisible('settings')" class="space-y-6">
              <div class="flex items-center gap-3 mb-6">
                <div>
                  <h2 class="font-semibold text-neutral-100">{{ $t('settings.title') }}</h2>
                  <p class="text-xs text-neutral-400">{{ $t('settings.subtitle') }}</p>
                </div>
              </div>

              <!-- Appearance & Language -->
              <section class="space-y-3">
                <h3 class="section-heading">{{ $t('settings.appearance') }}</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 flex flex-col gap-3 items-start">
                  <LanguageSwitcher />
                  <ThemePicker />
                </div>
              </section>

              <!-- Archipelago Mode Indicator -->
              <div v-if="items.archipelagoMode.value" class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-sm">
                <div class="flex items-center gap-2 text-amber-300 text-sm">
                  <span>🔒</span>
                  <span>{{ $t('settings.apLockedNote') }}</span>
                </div>
              </div>

              <!-- Mode Toggle -->
              <div class="bg-neutral-800/30 rounded-sm p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium text-neutral-200">{{ $t('settings.apMode') }}</div>
                    <div class="text-xs text-neutral-400">{{ $t('settings.apModeDesc') }}</div>
                  </div>
                  <button
                    class="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
                    :class="
                      items.archipelagoMode.value
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-neutral-600/30 text-neutral-300 hover:bg-neutral-600/50'
                    "
                    :disabled="status === 'connected'"
                    :title="status === 'connected' ? $t('settings.apModeLockedTitle') : ''"
                    @click="items.archipelagoMode.value ? items.disableArchipelagoMode() : items.enableArchipelagoMode()"
                  >
                    {{ items.archipelagoMode.value ? $t('common.disable') : $t('common.enable') }}
                  </button>
                </div>
              </div>

              <!-- Starting Resources -->
              <section class="space-y-3">
                <h3 class="section-heading">{{ $t('settings.resources') }}</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 space-y-4" :class="{ 'opacity-60': items.archipelagoMode.value }">
                  <!-- Lock notice for Archipelago mode -->
                  <div v-if="items.archipelagoMode.value" class="text-xs text-amber-300/70 mb-2">
                    🔒 Resource settings are locked in Archipelago mode
                  </div>
                  <!-- Unlimited toggles -->
                  <label class="flex items-center gap-3 group" :class="items.archipelagoMode.value ? 'cursor-not-allowed' : 'cursor-pointer'">
                    <input type="checkbox" v-model="items.unlimitedLives.value" class="checkbox-field" :disabled="items.archipelagoMode.value" />
                    <span class="text-sm text-neutral-200 group-hover:text-white transition-colors">{{ $t('settings.unlimitedLives') }}</span>
                  </label>
                  <label class="flex items-center gap-3 group" :class="items.archipelagoMode.value ? 'cursor-not-allowed' : 'cursor-pointer'">
                    <input type="checkbox" v-model="items.unlimitedCoins.value" class="checkbox-field" :disabled="items.archipelagoMode.value" />
                    <span class="text-sm text-neutral-200 group-hover:text-white transition-colors">{{ $t('settings.unlimitedCoins') }}</span>
                  </label>

                  <div class="border-t border-neutral-700/50 pt-4">
                    <div class="flex items-center justify-between">
                      <label for="starting-lives" class="text-sm text-neutral-300">{{ $t('settings.startingLives') }}</label>
                      <input
                        id="starting-lives"
                        type="number"
                        min="1"
                        max="10"
                        class="input-field w-20 text-center text-sm"
                        v-model.number="items.baseLives.value"
                        :disabled="items.archipelagoMode.value"
                      />
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <label for="starting-coins" class="text-sm text-neutral-300">{{ $t('settings.startingCoins') }}</label>
                    <input
                      id="starting-coins"
                      type="number"
                      min="0"
                      max="100"
                      class="input-field w-20 text-center text-sm"
                      v-model.number="items.startingCoins.value"
                      :disabled="items.archipelagoMode.value"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <label for="starting-hints" class="text-sm text-neutral-300">{{ $t('settings.startingHints') }}</label>
                    <input
                      id="starting-hints"
                      type="number"
                      min="0"
                      max="20"
                      class="input-field w-20 text-center text-sm"
                      v-model.number="items.startingHintReveals.value"
                      :disabled="items.archipelagoMode.value"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <label for="coins-per-line" class="text-sm text-neutral-300">{{ $t('settings.coinsPerLine') }}</label>
                    <input
                      id="coins-per-line"
                      type="number"
                      min="0"
                      max="10"
                      class="input-field w-20 text-center text-sm"
                      v-model.number="coinsPerLine"
                      :disabled="items.archipelagoMode.value"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <label for="coins-per-bundle" class="text-sm text-neutral-300">{{ $t('settings.coinsPerBundle') }}</label>
                    <input
                      id="coins-per-bundle"
                      type="number"
                      min="1"
                      max="50"
                      class="input-field w-20 text-center text-sm"
                      v-model.number="items.coinsPerBundle.value"
                      :disabled="items.archipelagoMode.value"
                    />
                  </div>
                  <div v-if="items.extraLives.value > 0" class="text-xs text-lime-400">
                    +{{ items.extraLives.value }} extra lives from Archipelago
                  </div>
                </div>
              </section>

              <!-- Shop Prices -->
              <section class="space-y-3">
                <h3 class="section-heading">{{ $t('settings.shopPrices') }}</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 space-y-4" :class="{ 'opacity-60': items.archipelagoMode.value }">
                  <!-- Lock notice for Archipelago mode -->
                  <div v-if="items.archipelagoMode.value" class="text-xs text-amber-300/70 mb-2">🔒 Shop prices are locked in Archipelago mode</div>
                  <div class="flex items-center justify-between">
                    <label for="random-cell-solve-cost" class="text-sm text-neutral-300">{{ $t('settings.randomCellCost') }}</label>
                    <input
                      id="random-cell-solve-cost"
                      type="number"
                      min="1"
                      max="50"
                      class="input-field w-20 text-center text-sm"
                      v-model.number="items.RANDOM_CELL_SOLVE_COST.value"
                      :disabled="items.archipelagoMode.value"
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <label for="temp-hint-cost" class="text-sm text-neutral-300">{{ $t('settings.tempHintCost') }}</label>
                    <input
                      id="temp-hint-cost"
                      type="number"
                      min="1"
                      max="50"
                      class="input-field w-20 text-center text-sm"
                      v-model.number="items.TEMP_HINT_COST.value"
                      :disabled="items.archipelagoMode.value"
                    />
                  </div>
                </div>
              </section>

              <div class="space-y-6">
                <!-- Game Display -->
                <section class="space-y-4">
                  <h3 class="section-heading">{{ $t('settings.behaviour') }}</h3>
                  <div class="space-y-4 bg-neutral-800/30 rounded-sm p-4">
                    <label class="flex items-center gap-3 cursor-pointer group" :class="{ 'opacity-60 cursor-not-allowed': items.archipelagoMode.value && !items.unlimitedLives.value }">
                      <input type="checkbox" v-model="showMistakes" class="checkbox-field" :disabled="items.archipelagoMode.value && !items.unlimitedLives.value" />
                      <span class="text-sm text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2">{{ $t('settings.showMistakes') }}<span v-if="items.archipelagoMode.value && !items.unlimitedLives.value" class="text-2xs text-amber-300/70">🔒 Archipelago</span>
                      </span>
                    </label>

                    <label class="flex items-center gap-3 cursor-pointer group" :class="{ 'opacity-60 cursor-not-allowed': items.archipelagoMode.value }">
                      <input type="checkbox" v-model="autoX" class="checkbox-field" :disabled="items.archipelagoMode.value" />
                      <span class="text-sm text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2">{{ $t('settings.autoX') }}<span v-if="items.archipelagoMode.value" class="text-2xs text-amber-300/70">🔒 Archipelago</span>
                      </span>
                    </label>

                    <label class="flex items-center gap-3 cursor-pointer group" :class="{ 'opacity-60 cursor-not-allowed': items.archipelagoMode.value }">
                      <input type="checkbox" v-model="greyCompletedHints" class="checkbox-field" :disabled="items.archipelagoMode.value" />
                      <span class="text-sm text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2">{{ $t('settings.greyHints') }}<span v-if="items.archipelagoMode.value" class="text-2xs text-amber-300/70">🔒 Archipelago</span>
                      </span>
                    </label>

                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" v-model="dragPainting" class="checkbox-field" />
                      <span class="text-sm text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2">{{ $t('controls.clickDrag') }}</span>
                    </label>

                    <label class="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" v-model="highlightLines" class="checkbox-field" />
                      <span class="text-sm text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2">{{ $t('settings.highlightLines') }}</span>
                    </label>
                  </div>
                </section>
                <!-- Puzzle Dimensions -->
                <section class="space-y-4">
                  <h3 class="section-heading">{{ $t('settings.puzzleDimensions') }}</h3>
                  <div class="space-y-4 bg-neutral-800/30 rounded-sm p-4" :class="{ 'opacity-60': items.archipelagoMode.value }">
                    <div v-if="items.archipelagoMode.value" class="text-xs text-amber-300/70 mb-2">
                      ⚠️ Dimensions are controlled by Archipelago difficulty
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div class="space-y-2">
                        <label for="rows" class="block text-xs font-medium text-neutral-300">{{ $t('settings.rows') }}</label>
                        <input
                          id="rows"
                          type="number"
                          min="5"
                          max="50"
                          class="input-field"
                          v-model.number="rowsInput"
                          :disabled="items.archipelagoMode.value"
                        />
                      </div>
                      <div class="space-y-2">
                        <label for="cols" class="block text-xs font-medium text-neutral-300">{{ $t('settings.columns') }}</label>
                        <input
                          id="cols"
                          type="number"
                          min="5"
                          max="50"
                          class="input-field"
                          v-model.number="colsInput"
                          :disabled="lockSize || items.archipelagoMode.value"
                        />
                      </div>
                    </div>

                    <label class="flex items-center gap-3 group" :class="items.archipelagoMode.value ? 'cursor-not-allowed' : 'cursor-pointer'">
                      <input type="checkbox" v-model="lockSize" :disabled="items.archipelagoMode.value" class="checkbox-field" />
                      <span class="text-sm text-neutral-200 group-hover:text-white transition-colors">{{ $t('settings.lockAspect') }}</span>
                    </label>
                  </div>
                </section>
                <!-- Puzzle Generation -->
                <section class="space-y-4">
                  <h3 class="section-heading">{{ $t('settings.puzzleGeneration') }}</h3>
                  <div class="space-y-4 bg-neutral-800/30 rounded-sm p-4" :class="{ 'opacity-60': items.archipelagoMode.value }">
                    <div v-if="items.archipelagoMode.value" class="text-xs text-amber-300/70 mb-2">⚠️ Fill density is controlled by Archipelago</div>
                    <div class="space-y-3">
                      <div class="flex items-center justify-between">
                        <label for="fill-rate" class="text-xs font-medium text-neutral-300">{{ $t('settings.fillDensity') }}</label>
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-1 bg-neutral-600/30 text-neutral-300 rounded-md text-xs font-medium">
                            {{ Math.round(fillRate * 100) }}%
                          </span>
                        </div>
                      </div>
                      <input
                        id="fill-rate"
                        type="range"
                        min="0.2"
                        max="0.7"
                        step="0.01"
                        v-model.number="fillRate"
                        :disabled="items.archipelagoMode.value"
                        class="slider w-full"
                      />
                      <div class="flex justify-between text-2xs text-neutral-500">
                        <span>{{ $t('settings.sparse') }}</span>
                        <span>{{ $t('settings.dense') }}</span>
                      </div>
                    </div>

                    <button type="button" class="btn-primary w-full" @click="randomize()">{{ $t('controls.generate') }}</button>
                  </div>
                </section>
                <!-- Game Actions -->
                <section class="space-y-4">
                  <h3 class="section-heading">{{ $t('settings.gameActions') }}</h3>
                  <div
                    class="bg-neutral-800/30 rounded-sm p-4 space-y-3"
                    :class="{ 'opacity-60 pointer-events-none': items.archipelagoMode.value }"
                  >
                    <div v-if="items.archipelagoMode.value" class="text-xs text-amber-300/70">{{ $t('settings.gameActionsLocked') }}</div>
                    <button type="button" class="btn-destructive w-full" @click="clearPlayer()">{{ $t('settings.clearCurrent') }}</button>
                    <button
                      type="button"
                      class="btn-destructive w-full opacity-75 hover:opacity-100"
                      @click="clearAllProgress()"
                      :title="$t('settings.clearAllTitle')"
                    >
                      🗑️ Clear All Game Data
                    </button>
                  </div>
                </section>
              </div>
            </div>

            <!-- ARCHIPELAGO -->
            <div v-else-if="isTabVisible('archipelago')" class="space-y-6">
              <div class="flex items-center gap-3">
                <div>
                  <h2 class="font-semibold text-neutral-100">{{ $t('ap.connectionTitle') }}</h2>
                  <p class="text-xs text-neutral-400">{{ $t('ap.connectSubtitle') }}</p>
                </div>
              </div>

              <div class="bg-neutral-800/30 rounded-sm p-4 space-y-4">
                <p class="text-xs text-neutral-400">{{ $t('ap.enterDetails') }}</p>

                <div class="space-y-3">
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-neutral-300">{{ $t('ap.host') }}</label>
                    <input v-model="host" class="input-field" :placeholder="$t('ap.phHost')" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-neutral-300">{{ $t('ap.port') }}</label>
                    <input v-model.number="port" class="input-field" :placeholder="$t('ap.phPort')" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-neutral-300">{{ $t('ap.playerName') }}</label>
                    <input v-model="slot" class="input-field" :placeholder="$t('ap.phPlayer')" />
                  </div>
                  <div class="space-y-1">
                    <label class="text-xs font-medium text-neutral-300">{{ $t('ap.password') }}</label>
                    <input v-model="password" type="password" class="input-field" :placeholder="$t('ap.phPassword')" />
                  </div>
                  <div class="flex items-center gap-3 pt-2">
                    <input type="checkbox" v-model="useSecureConnection" class="checkbox-field" id="secure-connection" />
                    <label for="secure-connection" class="text-xs text-neutral-300 cursor-pointer">{{ $t('ap.useSecure') }}<span class="text-neutral-500 text-2xs ml-1">(uncheck for local servers)</span>
                    </label>
                  </div>
                </div>

                <div class="flex gap-3 pt-2">
                  <button class="btn-primary flex-1" @click="connect()" :disabled="status === 'connected' || status === 'connecting'">
                    {{ status === 'connecting' ? $t('ap.connecting') : $t('ap.connect') }}
                  </button>
                  <button class="btn-secondary" @click="disconnect()" :disabled="status !== 'connected'">{{ $t('ap.disconnect') }}</button>
                </div>

                <div v-if="lastMessage" class="mt-4 p-3 bg-neutral-900/50 rounded-lg border border-neutral-600">
                  <div class="text-xs text-neutral-300">
                    {{ lastMessage }}
                  </div>
                </div>
              </div>
            </div>

            <!-- GOALS (location checks) -->
            <div v-else-if="isTabVisible('goals')" class="space-y-3">
              <div>
                <h2 class="font-semibold text-neutral-100">{{ $t('tabs.checks') }}</h2>
                <p class="text-xs text-neutral-400">{{ $t('goals.locationChecks') }}</p>
              </div>

              <!-- Goal panel (collapsible: total in the summary, per-size detail inside) -->
              <details class="rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <summary class="cursor-pointer list-none">
                  <div class="text-[11px] uppercase tracking-wider text-amber-300/70">{{ $t('common.goal') }}</div>
                  <div class="mt-0.5 flex items-center gap-2 text-sm text-amber-200">
                    <span>&#127919;</span>
                    <span>{{ $t('board.complete') }}<span class="font-semibold">{{ items.goalTarget.value }}</span> {{ $t('goals.gridsWord') }}</span>
                    <span class="ml-auto text-xs" :class="goalCompleted ? 'text-lime-400' : 'text-amber-300/80'">{{ goalCompleted ? '&#10003; ' + $t('goals.reached') : items.goalProgress.value + ' / ' + items.goalTarget.value }}</span>
                  </div>
                </summary>
                <div class="mt-2 space-y-1 border-t border-amber-500/20 pt-2">
                  <div
                    v-for="b in items.goalBreakdown.value"
                    :key="b.size"
                    class="flex items-center gap-2 text-xs text-amber-200/90"
                  >
                    <span class="font-mono">{{ b.size }}</span>
                    <span class="ml-auto">{{ b.done }} / {{ b.total }}</span>
                  </div>
                </div>
              </details>

              <!-- Collapsible sections: one per played grid size, plus wallets + misc -->
              <details
                v-for="sec in items.checkSections.value"
                :key="sec.key"
                class="rounded-sm border border-neutral-700/50 bg-neutral-900/30"
              >
                <summary class="flex cursor-pointer items-center justify-between px-2 py-1.5 text-xs font-semibold text-neutral-200">
                  <span>{{ sec.label }}</span>
                  <span :class="sec.done === sec.total ? 'text-lime-400' : 'text-neutral-400'">{{ $t('goals.completedCount', { done: sec.done, total: sec.total }) }}</span>
                </summary>
                <div class="space-y-1 px-2 pb-2">
                  <div
                    v-for="c in sec.items"
                    :key="c.id"
                    class="flex items-center gap-1.5 text-xs"
                    :class="c.completed ? 'text-lime-400' : 'text-white/70'"
                  >
                    <span>{{ c.completed ? '&#10003;' : '&#9633;' }}</span>
                    <span>{{ c.name }}</span>
                  </div>
                </div>
              </details>
            </div>

          </div>
          </div>
        </div>
        <!-- Resize handle: top panels / log height (desktop only) -->
        <div
          class="hidden lg:block shrink-0 h-1.5 cursor-row-resize bg-neutral-700/40 hover:bg-cyan-500/60 transition-colors touch-none"
          @pointerdown="startResize('log', $event)"
          :title="$t('resize.logHeight')"
        ></div>
        <!-- Bottom log panel (Game Log | Debug); height resizable on desktop -->
        <div
          v-show="showChatArea"
          class="border-t border-neutral-700/50 flex flex-col min-h-0 flex-1 lg:flex-none overflow-hidden"
          :style="logStyle"
        >
            <!-- mini tab bar: Game Log | Debug -->
            <div class="flex border-b border-neutral-700/50 shrink-0">
              <button class="tab-button whitespace-nowrap" :class="{ active: activeLogTab === 'log' }" @click="activeLogTab = 'log'">{{ $t('tabs.log') }}</button>
              <button v-if="debugTabVisible" class="tab-button whitespace-nowrap" :class="{ active: activeLogTab === 'debug' }" @click="activeLogTab = 'debug'">{{ $t('tabs.debug') }}</button>
            </div>
            <div v-show="activeLogTab === 'log'" ref="chatLogContainer" class="flex-1 min-h-0 px-4 pb-3 overflow-auto custom-scrollbar">
              <div v-if="messageLog.length === 0" class="flex items-center justify-center h-full text-xs text-neutral-500">
                <div class="text-center space-y-1">
                  <div>{{ $t('log.noMessages') }}</div>
                  <div class="text-2xs">{{ $t('log.eventsHere') }}</div>
                </div>
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="(msg, idx) in messageLog"
                  :key="idx"
                  class="text-xs py-1 border-b border-neutral-700/30 last:border-0"
                  :class="{
                    'text-lime-300': msg.type === 'item',
                    'text-red-300': msg.type === 'error',
                    'text-blue-300': msg.type === 'chat',
                    'text-neutral-400': msg.type === 'info',
                  }"
                >
                  <span class="text-neutral-600 mr-2">{{ msg.time.toLocaleTimeString() }}</span>
                  {{ msg.text.replaceAll(',', ' ') }}
                </div>
              </div>
            </div>
            <!-- Chat input: plain messages + AP server commands (e.g. !hint, !help). -->
            <div v-show="activeLogTab === 'log'" class="shrink-0 border-t border-neutral-700/50 p-2 flex gap-2">
              <input
                v-model="chatInput"
                @keyup.enter="submitChat()"
                :disabled="status !== 'connected'"
                class="input-field flex-1 min-w-0"
                :placeholder="status === 'connected' ? $t('ap.chatPlaceholder') : $t('ap.chatPlaceholderOff')"
              />
              <button
                type="button"
                class="btn-secondary shrink-0"
                :disabled="status !== 'connected' || !chatInput.trim()"
                @click="submitChat()"
              >{{ $t('log.send') }}</button>
            </div>
            <div v-show="activeLogTab === 'debug' && debugTabVisible" class="space-y-6 p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              <div class="flex items-center gap-3">
                <div>
                  <h2 class="font-semibold text-neutral-100">Debug Tools</h2>
                  <p class="text-xs text-neutral-400">Development and testing options</p>
                </div>
              </div>

              <!-- Debug Display -->
              <section class="space-y-3">
                <h3 class="section-heading">{{ $t('settings.displayOptions') }}</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 space-y-4">
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="showDebugGrid" class="checkbox-field" />
                    <span class="text-sm text-neutral-200 group-hover:text-white transition-colors">{{ $t('settings.showSolution') }}</span>
                  </label>
                </div>
              </section>

              <!-- Debug Actions -->
              <section class="space-y-3">
                <h3 class="section-heading">Actions</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 space-y-3">
                  <button type="button" class="btn-secondary w-full" @click="autoSolve()">{{ $t('controls.autoSolve') }}</button>
                  <button type="button" class="btn-secondary w-full" :disabled="goalCompleted" @click="completeGoal()">{{ goalCompleted ? 'Goal completed' : 'Mark goal as completed' }}</button>
                </div>
              </section>

              <!-- Simulate AP options (slot_data) -->
              <section class="space-y-3">
                <h3 class="section-heading">Simulate AP options (slot_data)</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 space-y-3">
                  <p class="text-xs text-neutral-400">Inject fake slot_data to test option locking without generating a seed.</p>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simAutoX" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">auto_x</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simGreyHints" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">grey_completed_hints</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simUnlimitedLives" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">unlimited_lives</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group" :class="{ 'opacity-50': !simUnlimitedLives }">
                    <input type="checkbox" v-model="simShowMistakes" class="checkbox-field" :disabled="!simUnlimitedLives" />
                    <span class="text-sm text-neutral-200">show_mistakes <span class="text-2xs text-neutral-500">(forcé ON si vies finies)</span></span>
                  </label>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-neutral-200">starting_wallet_level</span>
                    <input type="number" min="0" max="4" v-model.number="simWalletLevel" class="w-16 ml-auto bg-neutral-700 text-neutral-100 rounded px-2 py-1 text-sm" />
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-neutral-200">wallets_in_pool</span>
                    <input type="number" min="0" max="4" v-model.number="simWalletsInPool" class="w-16 ml-auto bg-neutral-700 text-neutral-100 rounded px-2 py-1 text-sm" />
                  </div>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simRequireTierCompletion" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">require_tier_completion</span>
                  </label>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-neutral-200">difficulty_cost</span>
                    <select v-model="simDifficultyCost" class="ml-auto bg-neutral-700 text-neutral-100 rounded px-2 py-1 text-sm">
                      <option value="free">free</option>
                      <option value="low">low</option>
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                      <option value="progressive">progressive</option>
                    </select>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-neutral-200">life_restore_on_clear</span>
                    <select v-model="simLifeRestoreMode" class="ml-auto bg-neutral-700 text-neutral-100 rounded px-2 py-1 text-sm">
                      <option value="none">none</option>
                      <option value="one">one</option>
                      <option value="full">full</option>
                      <option value="custom">custom</option>
                    </select>
                    <input type="number" min="0" max="20" v-model.number="simLifeRestoreCustom" class="w-14 bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                  </div>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simShopHealing" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">shop_healing</span>
                  </label>
                  <div class="flex items-center gap-3" :class="{ 'opacity-50': !simShopHealing }">
                    <span class="text-sm text-neutral-200">healing_cost</span>
                    <select v-model="simHealingCost" :disabled="!simShopHealing" class="ml-auto bg-neutral-700 text-neutral-100 rounded px-2 py-1 text-sm">
                      <option value="free">free</option>
                      <option value="low">low</option>
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                      <option value="progressive">progressive</option>
                      <option value="custom">custom</option>
                    </select>
                    <input type="number" min="0" max="9999" v-model.number="simHealingCostCustom" :disabled="!simShopHealing" class="w-16 bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                  </div>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simZeldaHeartMode" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">zelda_heart_mode</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simShopHearts" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">shop_hearts</span>
                  </label>
                  <div class="flex items-center gap-3" :class="{ 'opacity-50': !simShopHearts }">
                    <span class="text-sm text-neutral-200">heart_cost</span>
                    <select v-model="simHeartCost" :disabled="!simShopHearts" class="ml-auto bg-neutral-700 text-neutral-100 rounded px-2 py-1 text-sm">
                      <option value="free">free</option>
                      <option value="low">low</option>
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                      <option value="progressive">progressive</option>
                      <option value="custom">custom</option>
                    </select>
                    <input type="number" min="0" max="9999" v-model.number="simHeartCostCustom" :disabled="!simShopHearts" class="w-16 bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                  </div>
                  <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" v-model="simFlawlessChecks" class="checkbox-field" />
                    <span class="text-sm text-neutral-200">flawless_checks</span>
                  </label>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-neutral-200">puzzles_5x5 / 10x10 / 15x15 / 20x20</span>
                    <input type="number" min="0" max="100" v-model.number="simPuzzles5x5" class="w-14 ml-auto bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                    <input type="number" min="0" max="100" v-model.number="simPuzzles10x10" class="w-14 bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                    <input type="number" min="0" max="100" v-model.number="simPuzzles15x15" class="w-14 bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                    <input type="number" min="0" max="100" v-model.number="simPuzzles20x20" class="w-14 bg-neutral-700 text-neutral-100 rounded px-1 py-1 text-sm" />
                  </div>
                  <div class="flex gap-2">
                    <button type="button" class="btn-secondary flex-1" @click="debugSimulateApOptions()">Apply as slot_data</button>
                    <button type="button" class="btn-secondary flex-1" @click="debugExitApSim()">Exit AP sim</button>
                  </div>
                </div>
              </section>

              <!-- Simulate Items -->
              <section class="space-y-3">
                <h3 class="section-heading">Simulate Items</h3>
                <div class="bg-neutral-800/30 rounded-sm p-4 space-y-2">
                  <p class="text-xs text-neutral-400 mb-3">Click to simulate receiving an item from Archipelago:</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="item in items.ITEM_REGISTRY"
                      :key="item.id"
                      class="px-2 py-1 text-xs rounded transition-colors"
                      :class="
                        items.hasItem(item.id) &&
                        ![
                          items.AP_ITEMS.EXTRA_LIFE,
                          items.AP_ITEMS.COINS_BUNDLE,
                          items.AP_ITEMS.UNLOCK_HINTS,
                          items.AP_ITEMS.SOLVE_RANDOM_CELL,
                        ].includes(item.id as any)
                          ? 'bg-lime-500/20 text-lime-300 cursor-default'
                          : 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                      "
                      :disabled="
                        items.hasItem(item.id) &&
                        ![
                          items.AP_ITEMS.EXTRA_LIFE,
                          items.AP_ITEMS.COINS_BUNDLE,
                          items.AP_ITEMS.UNLOCK_HINTS,
                          items.AP_ITEMS.SOLVE_RANDOM_CELL,
                        ].includes(item.id as any)
                      "
                      @click="debugReceiveItem(item.id)"
                    >
                      {{ item.name }}
                      <span v-if="item.id === items.AP_ITEMS.EXTRA_LIFE" class="text-lime-400"></span>
                      <span v-if="item.id === items.AP_ITEMS.COINS_BUNDLE" class="text-amber-400"></span>
                      <span v-if="item.id === items.AP_ITEMS.UNLOCK_HINTS" class="text-purple-400"></span>
                      <span v-if="item.id === items.AP_ITEMS.SOLVE_RANDOM_CELL" class="text-cyan-400"></span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
      </div>
    </div>

    <!-- Bottom status bar -->
    <footer class="shrink-0 border-t border-neutral-700/50 bg-neutral-950/90 backdrop-blur-lg">
      <div class="px-6 py-3">
        <div class="flex items-center gap-4">
          <!-- Left side: Status indicator and controls info -->
          <div class="flex items-center gap-4 w-1/2">
            <div class="status-indicator shrink-0">
              <span class="status-dot" :class="statusMeta.dot"></span>
              <span class="text-neutral-400 font-medium">{{ $t('tabs.archipelago') }}</span>
              <span :class="statusMeta.text" class="font-semibold">{{ statusMeta.label }}</span>
            </div>
            <div class="text-xs text-white/70 hidden lg:block">
              Left click: fill &nbsp;&nbsp;•&nbsp;&nbsp; Right click: X &nbsp;&nbsp;•&nbsp;&nbsp; Shift+click or click again: erase
            </div>
            <div>
              <button
                type="button"
                data-sleek
                class="px-3 py-1.5 rounded text-xs transition-colors bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/30"
              >{{ $t('misc.giveFeedback') }}</button>
            </div>
          </div>

          <!-- Right side: Latest item message (sent or received) and version (always takes half) -->
          <div class="w-1/2 text-xs text-neutral-400 truncate text-right">
            <button
              v-if="latestItemMessage"
              :key="latestItemMessage"
              @click="navigateToChat"
              class="inline-block animate-message-flash hover:text-lime-400 transition-colors cursor-pointer"
            >
              <span class="opacity-60">{{ $t('log.latest') }}</span> {{ latestItemMessage }}
            </button>
            <span v-else class="opacity-50">{{ $t('log.noItemMessages') }}</span>
            <!-- version -->
            <span class="ml-4 opacity-50">v0.6.6</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
