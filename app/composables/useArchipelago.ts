import type { Client, Item } from 'archipelago.js';
import { clientStatuses, itemsHandlingFlags } from 'archipelago.js';
import { onMounted, watch } from 'vue';
import { useArchipelagoItems, AP_LOCATIONS } from './useArchipelagoItems';

type Status = 'disconnected' | 'connecting' | 'connected' | 'error';

// Track if event handlers have been set up (to avoid duplicates)
let eventHandlersInitialized = false;
// Track the highest item index we've processed to avoid reprocessing on reconnect
// Load from localStorage to survive page refreshes
let highestItemIndexProcessed = (() => {
  if (import.meta.client) {
    const stored = localStorage.getItem('nonogram_ap_highestItemIndex');
    return stored ? parseInt(stored, 10) : -1;
  }
  return -1;
})();

// Step 2b: gate item application during (re)connect until the economy blob is restored, so
// item-fed balances (coins, lives, wallet, cell solves) are never double-counted. Items that
// arrive before the blob is loaded are buffered here and flushed once economyReady flips true.
let economyReady = false;
let bufferedItems: Array<{ item: Item | undefined; index: number }> = [];

export function useArchipelago() {
  const nuxt = useNuxtApp();
  const client = nuxt.$apClient as Client;

  const host = useState('ap_host', () => 'archipelago.gg');
  const port = useState('ap_port', () => 38281);
  const slot = useState('ap_slot', () => 'NonopelagramP1');
  const password = useState('ap_password', () => '');

  const status = useState<Status>('ap_status', () => 'disconnected');
  const lastMessage = useState<string>('ap_lastMessage', () => '');

  // Secure connection setting (true = wss://, false = ws://)
  const useSecureConnection = useState('ap_useSecure', () => true);

  // Death Link state
  const deathLinkEnabled = useState('ap_deathLink', () => false);
  const deathLinkLethal = useState('ap_deathLinkLethal', () => true);
  const lastDeathTime = useState('ap_lastDeathTime', () => 0);

  // Goal state
  const goalCompleted = useState('ap_goalCompleted', () => false);

  // Slot data from server
  const slotData = useState<Record<string, any>>('ap_slotData', () => ({}));

  // Chat/event log
  const messageLog = useState<Array<{ time: Date; text: string; type: 'info' | 'item' | 'chat' | 'error' }>>('ap_messageLog', () => []);

  // Get items composable
  const items = useArchipelagoItems();
  // Guard against the data-storage echo loop: each blob write triggers a SetReply that our own
  // notify subscription delivers back, which applyEconomy would re-apply and the watch would
  // re-write, forever. Remember the last economy state written/applied and skip identical writes.
  let lastEconomyJson = '';
  const economySnapshot = () =>
    JSON.stringify([
      items.flawlessStreak.value,
      items.flawlessTotal.value,
      items.livesBought.value,
      items.heartsBought.value,
      items.heartQuarters.value,
      items.coins.value,
      items.extraLives.value,
      items.walletLevel.value,
      items.randomCellSolves.value,
      items.currentLives.value,
    ]);

  // Write the full economy blob (counters + item-fed balances + replay high-water-mark) to the
  // server's data storage. Best-effort. Called on local changes (when connected) and right after
  // the connect-time buffer flush.
  function writeEconomyBlob() {
    try {
      const economyKey = `Nonopelagram:economy:${slot.value}`;
      lastEconomyJson = economySnapshot();
      client.storage
        .prepare(economyKey, {})
        .replace({
          flawlessStreak: items.flawlessStreak.value,
          flawlessTotal: items.flawlessTotal.value,
          livesBought: items.livesBought.value,
          heartsBought: items.heartsBought.value,
          heartQuarters: items.heartQuarters.value,
          coins: items.coins.value,
          extraLives: items.extraLives.value,
          walletLevel: items.walletLevel.value,
          randomCellSolves: items.randomCellSolves.value,
          currentLives: items.currentLives.value,
          itemIndex: highestItemIndexProcessed,
        })
        .commit(false)
        .catch(() => {});
    } catch {
      /* best-effort */
    }
  }

  // Persist the local economy state to the server's data storage on change (when connected) so it
  // survives reconnects and follows the player across devices. localStorage stays as the offline
  // fallback; on connect the server value wins (see connect()). Item-fed balances are included; the
  // stored itemIndex (replay high-water-mark) keeps each item counted exactly once across devices.
  watch(
    () => [
      items.flawlessStreak.value,
      items.flawlessTotal.value,
      items.livesBought.value,
      items.heartsBought.value,
      items.heartQuarters.value,
      items.coins.value,
      items.extraLives.value,
      items.walletLevel.value,
      items.randomCellSolves.value,
      items.currentLives.value,
    ] as const,
    () => {
      if (status.value !== 'connected') return;
      if (economySnapshot() === lastEconomyJson) return;
      writeEconomyBlob();
    },
  );

  // --- Per-slot last-played grid, persisted to server data storage for cross-device resume. ---
  // Stored under `Nonopelagram:grid:${slot}` as { rows, cols, solution, player, revealedRows, revealedCols }.
  function saveGridState(blob: unknown) {
    if (status.value !== 'connected') return;
    try {
      const gridKey = `Nonopelagram:grid:${slot.value}`;
      client.storage
        .prepare(gridKey, {})
        .replace(blob as Record<string, unknown>)
        .commit(false)
        .catch(() => {});
    } catch {
      /* best-effort */
    }
  }

  async function loadGridState(): Promise<unknown> {
    try {
      const gridKey = `Nonopelagram:grid:${slot.value}`;
      return await client.storage.fetch(gridKey, false);
    } catch {
      return null;
    }
  }

  // Persist connection settings across page reloads (F5). useState alone resets on a full reload,
  // so we mirror host/port/slot/secure into localStorage. The password is intentionally NOT
  // persisted (avoid storing a secret in plaintext localStorage).
  if (import.meta.client) {
    onMounted(() => {
      try {
        const saved = localStorage.getItem('nonogram_ap_connection');
        if (saved) {
          const c = JSON.parse(saved);
          if (typeof c.host === 'string') host.value = c.host;
          if (typeof c.port === 'number') port.value = c.port;
          if (typeof c.slot === 'string') slot.value = c.slot;
          if (typeof c.useSecure === 'boolean') useSecureConnection.value = c.useSecure;
        }
      } catch (e) {
        console.error('Failed to load AP connection settings:', e);
      }
    });

    watch([host, port, slot, useSecureConnection], () => {
      try {
        localStorage.setItem(
          'nonogram_ap_connection',
          JSON.stringify({ host: host.value, port: port.value, slot: slot.value, useSecure: useSecureConnection.value }),
        );
      } catch (e) {
        console.error('Failed to save AP connection settings:', e);
      }
    });
  }

  function addLogMessage(text: string, type: 'info' | 'item' | 'chat' | 'error' = 'info') {
    messageLog.value.push({ time: new Date(), text, type });
    // Keep log limited to last 100 messages
    if (messageLog.value.length > 100) {
      messageLog.value = messageLog.value.slice(-100);
    }
  }

  // Apply a single received item: advance the replay high-water-mark and mutate balances. Shared
  // by the live itemsReceived handler and the post-blob buffer flush in connect().
  function applyReceivedItem(item: Item | undefined, currentIndex: number) {
    if (currentIndex <= highestItemIndexProcessed) return;
    highestItemIndexProcessed = currentIndex;
    if (import.meta.client) {
      localStorage.setItem('nonogram_ap_highestItemIndex', currentIndex.toString());
    }
    if (!item) return;
    // The library's `message` handler already logs item sends in human-readable form
    // ("X found their Y"), so here we only mutate balances.
    handleItemReceived(item.id);
  }

  // Set up event handlers once
  function setupEventHandlers() {
    if (eventHandlersInitialized) return;
    eventHandlersInitialized = true;

    // Handle received items
    client.items.on('itemsReceived', (receivedItems: Item[], startingIndex: number) => {
      for (let i = 0; i < receivedItems.length; i++) {
        const currentIndex = startingIndex + i;
        // Until the economy blob is restored, buffer instead of applying (avoids double-counting).
        if (!economyReady) {
          bufferedItems.push({ item: receivedItems[i], index: currentIndex });
          continue;
        }
        applyReceivedItem(receivedItems[i], currentIndex);
      }
    });

    // Handle chat messages
    client.messages.on('message', (content: string) => {
      addLogMessage(content, 'chat');
    });

    // Handle disconnection
    client.socket.on('disconnected', () => {
      status.value = 'disconnected';
      lastMessage.value = 'Disconnected from server.';
      addLogMessage('Connection lost.', 'error');
    });

    // Handle received Death Links via the native DeathLinkManager.
    // Deaths sent by this client never fire this event (no self-echo loop).
    client.deathLink.on('deathReceived', (source: string, _time: number, cause?: string) => {
      handleDeathLinkReceived(source, cause ?? 'Unknown cause');
    });
  }

  // Handle receiving a Death Link (always from another player; self-sent deaths never reach here).
  function handleDeathLinkReceived(source: string, cause: string) {
    if (!deathLinkEnabled.value) return;

    // Stamp the death time BEFORE losing a life. If this received death drops us to 0,
    // the game-over watcher must NOT rebroadcast it (sendDeathLink guards on this timestamp).
    lastDeathTime.value = Date.now();

    addLogMessage(`☠️ Death Link from ${source}: ${cause}`, 'error');
    if (deathLinkLethal.value) {
      items.loseAllLives();
    } else {
      items.loseLife();
    }
    items.registerMistake(); // a received DeathLink voids a flawless clear
  }

  // Send a Death Link to other players via the native DeathLinkManager.
  function sendDeathLink(cause: string = 'Lost all lives') {
    if (status.value !== 'connected' || !deathLinkEnabled.value) return;

    // Don't rebroadcast a death that was itself caused by a received Death Link.
    if (Date.now() - lastDeathTime.value < 2000) return;
    lastDeathTime.value = Date.now();

    try {
      client.deathLink.sendDeathLink(slot.value, cause);
      addLogMessage(`☠️ Sent Death Link: ${cause}`, 'error');
    } catch (e: any) {
      console.error('Failed to send Death Link:', e);
    }
  }

  async function connect() {
    try {
      status.value = 'connecting';
      lastMessage.value = '';
      goalCompleted.value = false;

      // Enable Archipelago mode when connecting (preserve persisted state)
      items.enableArchipelagoModeForConnection();
      addLogMessage('Connecting to Archipelago...', 'info');

      // Gate item application until the economy blob is restored (prevents double-counting on
      // (re)connect): items received during login are buffered, then flushed after the blob load.
      economyReady = false;
      bufferedItems = [];

      // Set up event handlers before connecting
      setupEventHandlers();

      // Build the connection URL
      // archipelago.js v2 uses: client.login(url, name, game, options)
      const protocol = useSecureConnection.value ? 'wss' : 'ws';
      const url = `${protocol}://${host.value}:${port.value}`;

      // Build tags array
      const tags: string[] = [];
      if (deathLinkEnabled.value) {
        tags.push('DeathLink');
      }

      const receivedSlotData = await client.login(url, slot.value, 'Nonopelagram', {
        password: password.value || '',
        // Request all items (own, starting, others)
        items: itemsHandlingFlags.all,
        slotData: true,
        tags,
      });

      // Store slot data for use by items composable
      slotData.value = receivedSlotData as Record<string, any>;

      // --- Seed-based state isolation (#3) ---
      // The server is authoritative. Each seed (room) gets its own isolated local state.
      // On a new seed, wipe local AP state and let the server's checked locations + the
      // received-items replay rebuild it from scratch.
      const seed = client.room.seedName;
      const storedSeed = import.meta.client ? localStorage.getItem('nonogram_ap_seed') : null;
      const isNewSeed = seed !== '' && seed !== storedSeed;

      if (isNewSeed) {
        items.enableArchipelagoMode(); // full reset to starting values
        highestItemIndexProcessed = -1; // force the upcoming item replay to reprocess everything
        if (import.meta.client) {
          localStorage.setItem('nonogram_ap_highestItemIndex', '-1');
          localStorage.setItem('nonogram_ap_seed', seed);
        }
      }

      // Apply slot data settings (configuration coming from the player's YAML)
      if (slotData.value) {
        if (typeof slotData.value.starting_lives === 'number') {
          items.baseLives.value = slotData.value.starting_lives;
        }
        if (typeof slotData.value.starting_coins === 'number') {
          items.startingCoins.value = slotData.value.starting_coins;
          // Reset current coins to the starting amount only when entering a new seed.
          if (isNewSeed) {
            items.coins.value = slotData.value.starting_coins;
          }
        }
        if (typeof slotData.value.starting_hints === 'number') {
          items.startingHintReveals.value = slotData.value.starting_hints;
        }
        if (typeof slotData.value.coins_per_bundle === 'number') {
          items.coinsPerBundle.value = slotData.value.coins_per_bundle;
        }
        if (typeof slotData.value.starting_wallet_level === 'number') {
          items.startingWalletLevel.value = slotData.value.starting_wallet_level;
          if (isNewSeed) {
            items.walletLevel.value = slotData.value.starting_wallet_level;
          }
        }
        if (typeof slotData.value.wallets_in_pool === 'number') {
          items.walletsInPool.value = slotData.value.wallets_in_pool;
        }
        if (typeof slotData.value.hearts_in_pool === 'number') {
          items.heartsInPool.value = slotData.value.hearts_in_pool;
        }
        if (typeof slotData.value.require_tier_completion !== 'undefined') {
          items.requireTierCompletion.value = !!slotData.value.require_tier_completion;
        }
        if (typeof slotData.value.difficulty_cost === 'string') {
          items.difficultyCostMode.value = slotData.value.difficulty_cost;
        }
        if (typeof slotData.value.life_restore_on_clear === 'string') {
          items.lifeRestoreMode.value = slotData.value.life_restore_on_clear;
        }
        if (typeof slotData.value.life_restore_custom === 'number') {
          items.lifeRestoreCustom.value = slotData.value.life_restore_custom;
        }
        if (typeof slotData.value.shop_healing !== 'undefined') {
          items.shopHealing.value = !!slotData.value.shop_healing;
        }
        if (typeof slotData.value.healing_cost === 'string') {
          items.healingCostMode.value = slotData.value.healing_cost;
        }
        if (typeof slotData.value.healing_cost_custom === 'number') {
          items.healingCostCustom.value = slotData.value.healing_cost_custom;
        }
        if (typeof slotData.value.zelda_heart_mode !== 'undefined') {
          items.zeldaHeartMode.value = !!slotData.value.zelda_heart_mode;
        }
        if (typeof slotData.value.shop_hearts !== 'undefined') {
          items.shopHearts.value = !!slotData.value.shop_hearts;
        }
        if (typeof slotData.value.heart_cost === 'string') {
          items.heartCostMode.value = slotData.value.heart_cost;
        }
        if (typeof slotData.value.heart_cost_custom === 'number') {
          items.heartCostCustom.value = slotData.value.heart_cost_custom;
        }
        if (typeof slotData.value.flawless_checks !== 'undefined') {
          items.flawlessChecks.value = !!slotData.value.flawless_checks;
        }
        if (typeof slotData.value.debug_mode !== 'undefined') {
          items.debugMode.value = !!slotData.value.debug_mode;
        }
        if (isNewSeed) {
          items.livesBought.value = 0;
          items.heartQuarters.value = 0;
          items.heartsBought.value = 0;
        }
        // Clamp held coins to the wallet capacity (e.g. starting_coins above the cap).
        if (isNewSeed && !items.unlimitedCoins.value && items.coins.value > items.coinCap.value) {
          items.coins.value = items.coinCap.value;
        }
        // Per-size puzzle counts (goal weighting): overwrite the dynamic PUZZLE_COUNTS.
        if (typeof slotData.value.puzzles_5x5 === 'number') items.PUZZLE_COUNTS['5x5'] = slotData.value.puzzles_5x5;
        if (typeof slotData.value.puzzles_10x10 === 'number') items.PUZZLE_COUNTS['10x10'] = slotData.value.puzzles_10x10;
        if (typeof slotData.value.puzzles_15x15 === 'number') items.PUZZLE_COUNTS['15x15'] = slotData.value.puzzles_15x15;
        if (typeof slotData.value.puzzles_20x20 === 'number') items.PUZZLE_COUNTS['20x20'] = slotData.value.puzzles_20x20;
        // Start at the lowest size that actually has puzzles.
        if (isNewSeed) {
          items.currentDifficulty.value = items.firstActiveDifficulty();
        }
        // Unlimited lives is fixed by the YAML; the client toggle is locked in AP mode.
        if (typeof slotData.value.unlimited_lives !== 'undefined') {
          items.unlimitedLives.value = !!slotData.value.unlimited_lives;
        }
        // Death Link is driven entirely by slot data (#2); there is no manual UI toggle.
        if (typeof slotData.value.death_link !== 'undefined') {
          const dlMode = Number(slotData.value.death_link) || 0;
          deathLinkEnabled.value = dlMode !== 0;
          deathLinkLethal.value = dlMode !== 2;
          if (deathLinkEnabled.value) {
            client.deathLink.enableDeathLink();
          }
        }
      }

      // Reconcile local check state with the server's authoritative checked locations (#3).
      items.reconcileCheckedLocations(client.room.checkedLocations ?? []);

      // Restore the local economy state from the server's data storage (survives reconnects,
      // follows the player across devices). The server value wins over the local cache; a brand-new
      // room has no value yet. Best-effort: falls back to localStorage on failure. The stored
      // itemIndex (replay high-water-mark) is restored so the buffered-item flush below counts each
      // item exactly once.
      try {
        const economyKey = `Nonopelagram:economy:${slot.value}`;
        type EconomyBlob = {
          flawlessStreak?: number;
          flawlessTotal?: number;
          livesBought?: number;
          heartsBought?: number;
          heartQuarters?: number;
          coins?: number;
          extraLives?: number;
          walletLevel?: number;
          randomCellSolves?: number;
          currentLives?: number;
          itemIndex?: number;
        };
        const applyEconomy = (value: unknown, restoreMark: boolean) => {
          if (!value || typeof value !== 'object') return;
          const v = value as EconomyBlob;
          if (typeof v.flawlessStreak === 'number') items.flawlessStreak.value = v.flawlessStreak;
          if (typeof v.flawlessTotal === 'number') items.flawlessTotal.value = v.flawlessTotal;
          if (typeof v.livesBought === 'number') items.livesBought.value = v.livesBought;
          if (typeof v.heartsBought === 'number') items.heartsBought.value = v.heartsBought;
          if (typeof v.heartQuarters === 'number') items.heartQuarters.value = v.heartQuarters;
          if (typeof v.coins === 'number') items.coins.value = v.coins;
          if (typeof v.extraLives === 'number') items.extraLives.value = v.extraLives;
          if (typeof v.walletLevel === 'number') items.walletLevel.value = v.walletLevel;
          if (typeof v.randomCellSolves === 'number') items.randomCellSolves.value = v.randomCellSolves;
          if (typeof v.currentLives === 'number') items.currentLives.value = v.currentLives;
          // Only the initial connect restore touches the replay mark; a live update from another
          // device must not rewind/advance this device's processing position.
          if (restoreMark && typeof v.itemIndex === 'number') {
            highestItemIndexProcessed = v.itemIndex;
            if (import.meta.client) {
              localStorage.setItem('nonogram_ap_highestItemIndex', v.itemIndex.toString());
            }
          }
          // Remember what we just applied so the watcher it triggers does not echo it straight back.
          lastEconomyJson = economySnapshot();
        };
        const stored = await client.storage.notify([economyKey], (_k, value) => applyEconomy(value, false));
        applyEconomy(stored?.[economyKey], true);
      } catch {
        /* data storage is best-effort; localStorage remains the fallback */
      }

      // Economy restored: open the gate and flush any items buffered during login (each applied
      // only if its index is beyond the restored high-water-mark), then persist the reconciled blob.
      economyReady = true;
      const itemsToFlush = bufferedItems;
      bufferedItems = [];
      for (const buffered of itemsToFlush) {
        applyReceivedItem(buffered.item, buffered.index);
      }
      writeEconomyBlob();

      status.value = 'connected';
      lastMessage.value = 'Connected!';
      addLogMessage(`Connected to Archipelago server as ${slot.value}!`, 'info');

      // Update status to playing
      client.updateStatus(clientStatuses.playing);

      // Catch-up: re-send any puzzle-completion checks the server is missing (interior holes
      // left by a send lost during an earlier disconnect). Runs now that status is 'connected'
      // so checkLocations does not early-return; idempotent on the server side.
      const missingChecks = items.getMissingCompletionChecks();
      if (missingChecks.length > 0) {
        checkLocations(missingChecks);
        addLogMessage(`Re-sent ${missingChecks.length} missing completion check(s).`, 'info');
      }

      // Re-evaluate the goal on connect: a player who already meets it (reached the threshold
      // while briefly disconnected, or completed everything before the catch-up existed) gets the
      // goal status sent now instead of never.
      checkGoalCompletion();
    } catch (e: any) {
      status.value = 'error';
      const errorMsg = e?.message ?? String(e);
      lastMessage.value = errorMsg;
      addLogMessage(`Connection error: ${errorMsg}`, 'error');
      // Disable Archipelago mode on connection failure
      items.disableArchipelagoMode();
    }
  }

  function disconnect() {
    try {
      client.socket.disconnect();
      addLogMessage('Disconnected from server.', 'info');
    } finally {
      status.value = 'disconnected';
      lastMessage.value = 'Disconnected.';
      // Keep Archipelago mode active after disconnect to preserve state
      // User can manually switch to free play if desired
    }
  }

  function handleItemReceived(itemId: number): string | null {
    const result = items.receiveItem(itemId);
    if (result.itemName) {
      lastMessage.value = `Received: ${result.itemName}`;
    }
    // Send any checks triggered by receiving this item (e.g., coin milestones from coin bundles)
    if (result.checks.length > 0) {
      checkLocations(result.checks);
    }
    return result.itemName;
  }

  // Send a location check to the server
  function checkLocation(locationId: number) {
    if (status.value !== 'connected') return;
    try {
      client.check(locationId);
      addLogMessage(`Location ${locationId} checked.`, 'info');
    } catch (e: any) {
      const errorMsg = e?.message ?? String(e);
      lastMessage.value = errorMsg;
      addLogMessage(`Error checking location: ${errorMsg}`, 'error');
    }
  }

  // Check multiple locations at once
  function checkLocations(locationIds: number[]) {
    console.log('[DEBUG checkLocations] locationIds:', locationIds, 'status:', status.value);
    if (status.value !== 'connected') {
      console.log('[DEBUG checkLocations] Not connected, skipping');
      return;
    }
    try {
      client.check(...locationIds);
    } catch (e: any) {
      const errorMsg = e?.message ?? String(e);
      lastMessage.value = errorMsg;
      addLogMessage(`Error checking locations: ${errorMsg}`, 'error');
    }
  }

  // Scout the items contained at the given locations (no hint creation), so the banner can show
  // what was found and for whom. AP exposes item name/game/receiver and classification flags, but
  // NO icon in the protocol — the caller derives icons from game/flags.
  async function scoutChecks(locationIds: number[]) {
    if (status.value !== 'connected' || locationIds.length === 0) return [];
    try {
      const scouted = await client.scout(locationIds, 0); // 0 = do not create/broadcast hints
      return scouted.map((it) => ({
        locationId: it.locationId,
        itemId: it.id,
        itemName: it.name,
        itemGame: it.game,
        receiver: it.receiver?.name ?? 'Unknown',
        progression: it.progression,
        useful: it.useful,
        trap: it.trap,
      }));
    } catch (e: any) {
      console.error('Scout failed:', e?.message ?? e);
      return [];
    }
  }

  // Legacy function name for compatibility
  function checkPuzzleSolved() {
    // This should be called when a puzzle is completed
    // The actual location to check depends on how many puzzles have been completed
    addLogMessage('Puzzle completed! Checking for milestone locations...', 'info');
  }

  // Mark the goal as completed
  function completeGoal() {
    if (status.value !== 'connected' || goalCompleted.value) return;

    goalCompleted.value = true;
    client.updateStatus(clientStatuses.goal);
    addLogMessage('🏆 Goal completed! Congratulations!', 'info');
  }

  // Check if goal should be completed based on puzzles completed
  function checkGoalCompletion() {
    if (goalCompleted.value) return;

    const goalPuzzles = slotData.value?.goal_puzzles ?? 64;
    // Sum all puzzles completed across all difficulties
    const totalCompleted =
      items.puzzlesCompleted['5x5'] + items.puzzlesCompleted['10x10'] + items.puzzlesCompleted['15x15'] + items.puzzlesCompleted['20x20'];
    if (totalCompleted >= goalPuzzles) {
      completeGoal();
    }
  }

  // Toggle Death Link (kept for completeness; no UI currently calls this).
  function toggleDeathLink(enabled: boolean) {
    deathLinkEnabled.value = enabled;

    if (status.value === 'connected') {
      if (enabled) {
        client.deathLink.enableDeathLink();
      } else {
        client.deathLink.disableDeathLink();
      }
      addLogMessage(`Death Link ${enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  }

  // Debug function to simulate receiving an item (for testing)
  function debugReceiveItem(itemId: number) {
    const itemName = handleItemReceived(itemId);
    if (itemName) {
      addLogMessage(`[DEBUG] Received: ${itemName}`, 'item');
    }
  }

  // Send a chat message
  async function say(message: string) {
    if (status.value !== 'connected') return;
    try {
      await client.messages.say(message);
    } catch (e: any) {
      addLogMessage(`Error sending message: ${e?.message ?? String(e)}`, 'error');
    }
  }

  return {
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
    saveGridState,
    loadGridState,
    checkLocation,
    checkLocations,
    scoutChecks,
    checkPuzzleSolved,
    checkGoalCompletion,
    completeGoal,
    toggleDeathLink,
    sendDeathLink,
    debugReceiveItem,
    say,
    // Expose items composable
    items,
  };
}
