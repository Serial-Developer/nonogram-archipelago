import type { Client, Item } from 'archipelago.js';
import { clientStatuses, itemsHandlingFlags } from 'archipelago.js';
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

export function useArchipelago() {
  const nuxt = useNuxtApp();
  const client = nuxt.$apClient as Client;

  const host = useState('ap_host', () => 'archipelago.gg');
  const port = useState('ap_port', () => 38281);
  const slot = useState('ap_slot', () => 'NonopelagramPlayer1');
  const password = useState('ap_password', () => '');

  const status = useState<Status>('ap_status', () => 'disconnected');
  const lastMessage = useState<string>('ap_lastMessage', () => '');

  // Death Link state
  const deathLinkEnabled = useState('ap_deathLink', () => false);
  const lastDeathTime = useState('ap_lastDeathTime', () => 0);

  // Goal state
  const goalCompleted = useState('ap_goalCompleted', () => false);

  // Slot data from server
  const slotData = useState<Record<string, any>>('ap_slotData', () => ({}));

  // Chat/event log
  const messageLog = useState<Array<{ time: Date; text: string; type: 'info' | 'item' | 'chat' | 'error' }>>('ap_messageLog', () => []);

  // Get items composable
  const items = useArchipelagoItems();

  function addLogMessage(text: string, type: 'info' | 'item' | 'chat' | 'error' = 'info') {
    messageLog.value.push({ time: new Date(), text, type });
    // Keep log limited to last 100 messages
    if (messageLog.value.length > 100) {
      messageLog.value = messageLog.value.slice(-100);
    }
  }

  // Set up event handlers once
  function setupEventHandlers() {
    if (eventHandlersInitialized) return;
    eventHandlersInitialized = true;

    // Handle received items
    client.items.on('itemsReceived', (receivedItems: Item[], startingIndex: number) => {
      for (let i = 0; i < receivedItems.length; i++) {
        const currentIndex = startingIndex + i;

        // Skip items we've already processed
        if (currentIndex <= highestItemIndexProcessed) {
          continue;
        }

        // Update the highest index we've processed and persist it
        highestItemIndexProcessed = currentIndex;
        if (import.meta.client) {
          localStorage.setItem('nonogram_ap_highestItemIndex', currentIndex.toString());
        }

        const item = receivedItems[i];
        if (!item) continue; // Safety check

        // item.id is the item ID from the AP world
        const itemName = handleItemReceived(item.id);
        if (itemName) {
          // Format: NonopelagramPlayer2 sent Extra Cooldown Trap to Player2 (Complete 2 5x5 Puzzles)
          const sender = item.sender?.name || 'Unknown';
          const receiver = slot.value;
          let extra = '';
          if (item.locationId) {
            extra = ` (Location #${item.locationId})`;
          }
          addLogMessage(`${sender} sent ${itemName} to ${receiver}${extra}`.replace(/ ,/g, ''), 'item');
        }
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

    // Handle bounced packets (for Death Link)
    client.socket.on('bounced', (packet: any, data: any) => {
      if (data?.time && data?.cause && data?.source) {
        // This is a Death Link
        handleDeathLinkReceived(data.source, data.cause);
      }
    });
  }

  // Handle receiving a Death Link
  function handleDeathLinkReceived(source: string, cause: string) {
    if (!deathLinkEnabled.value) return;

    // Prevent death loops - ignore if we just died
    const now = Date.now();
    if (now - lastDeathTime.value < 3000) return;

    addLogMessage(`☠️ Death Link from ${source}: ${cause}`, 'error');
    items.loseLife();
  }

  // Send a Death Link to other players
  function sendDeathLink(cause: string = 'Lost all lives') {
    if (status.value !== 'connected' || !deathLinkEnabled.value) return;

    lastDeathTime.value = Date.now();

    try {
      client.bounce(
        { tags: ['DeathLink'] },
        {
          time: Date.now() / 1000,
          cause: cause,
          source: slot.value,
        },
      );
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

      // Set up event handlers before connecting
      setupEventHandlers();

      // Build the connection URL
      // archipelago.js v2 uses: client.login(url, name, game, options)
      const url = `wss://${host.value}:${port.value}`;

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

      // Apply slot data settings (only on first connection, not reconnect)
      // Check if we're reconnecting by seeing if archipelago mode was already enabled
      const isFirstConnection = !items.archipelagoMode.value;

      if (slotData.value) {
        if (typeof slotData.value.starting_lives === 'number') {
          items.baseLives.value = slotData.value.starting_lives;
        }
        if (typeof slotData.value.starting_coins === 'number') {
          items.startingCoins.value = slotData.value.starting_coins;
          // Only reset coins on first connection; preserve persisted coins on reconnect
          if (isFirstConnection) {
            items.coins.value = slotData.value.starting_coins;
          }
        }
        if (typeof slotData.value.starting_hints === 'number') {
          items.startingHintReveals.value = slotData.value.starting_hints;
        }
        if (typeof slotData.value.coins_per_bundle === 'number') {
          items.coinsPerBundle.value = slotData.value.coins_per_bundle;
        }
      }

      status.value = 'connected';
      lastMessage.value = 'Connected!';
      addLogMessage(`Connected to Archipelago server as ${slot.value}!`, 'info');

      // Update status to playing
      client.updateStatus(clientStatuses.playing);
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
      addLogMessage(`Checked ${locationIds.length} location(s).`, 'info');
    } catch (e: any) {
      const errorMsg = e?.message ?? String(e);
      lastMessage.value = errorMsg;
      addLogMessage(`Error checking locations: ${errorMsg}`, 'error');
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

  // Toggle Death Link
  function toggleDeathLink(enabled: boolean) {
    deathLinkEnabled.value = enabled;

    // Update tags if connected
    if (status.value === 'connected') {
      const tags = enabled ? ['DeathLink'] : [];
      client.updateTags(tags);
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
    status,
    lastMessage,
    messageLog,
    slotData,
    deathLinkEnabled,
    goalCompleted,
    connect,
    disconnect,
    checkLocation,
    checkLocations,
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
