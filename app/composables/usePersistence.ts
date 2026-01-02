/**
 * Persistence utility for saving/loading game state to localStorage
 * Handles both Nonogram and Archipelago item states
 */

import { ref, watch, type Ref } from 'vue';

const STORAGE_PREFIX = 'nonogram_';

interface PersistenceOptions {
  key: string;
  defaultValue?: any;
}

/**
 * Create a persisted ref that syncs with localStorage
 * @param key - Storage key (will be prefixed with STORAGE_PREFIX)
 * @param defaultValue - Default value if not in storage
 */
export function usePersistentRef<T>(key: string, defaultValue: T) {
  const storageKey = STORAGE_PREFIX + key;

  // Check if the type is a Set
  const isSet = defaultValue instanceof Set;

  // Serialize value, handling special types like Set
  const serializeValue = (val: any): any => {
    if (val instanceof Set) {
      return { _type: 'Set', data: Array.from(val) };
    }
    return val;
  };

  // Deserialize value, handling special types like Set
  const deserializeValue = (val: any): any => {
    // Handle new Set format
    if (val && typeof val === 'object' && val._type === 'Set' && Array.isArray(val.data)) {
      return new Set(val.data);
    }
    // Handle old Set format (plain object or array from old code)
    if (isSet) {
      if (Array.isArray(val)) {
        return new Set(val);
      }
      // If it's a plain object and we expect a Set, try to extract data
      if (val && typeof val === 'object' && val.data && Array.isArray(val.data)) {
        return new Set(val.data);
      }
    }
    return val;
  };

  // Load from localStorage on client only
  const loadFromStorage = (): T => {
    if (import.meta.server) return defaultValue;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        return deserializeValue(parsed) as T;
      }
    } catch (e) {
      console.error(`Failed to load ${storageKey} from localStorage:`, e);
    }
    return defaultValue;
  };

  const value = ref<T>(loadFromStorage());

  // Watch for changes and persist
  // For Sets, don't use deep watch as it breaks Set type
  watch(
    value,
    (newVal) => {
      if (import.meta.server) return;
      try {
        const serialized = serializeValue(newVal);
        localStorage.setItem(storageKey, JSON.stringify(serialized));
      } catch (e) {
        console.error(`Failed to save ${storageKey} to localStorage:`, e);
      }
    },
    { deep: !isSet }, // Don't use deep watch for Sets
  );

  // For Sets, we need to provide a function to manually trigger persistence
  // This is called after Set operations
  const triggerPersist = () => {
    if (import.meta.server) return;
    try {
      const serialized = serializeValue(value.value);
      localStorage.setItem(storageKey, JSON.stringify(serialized));
    } catch (e) {
      console.error(`Failed to save ${storageKey} to localStorage:`, e);
    }
  };

  // Attach the trigger function to the ref for Set types
  if (isSet) {
    (value as any).triggerPersist = triggerPersist;
  }

  return value;
}

/**
 * Persist reactive object properties to localStorage
 * @param key - Storage key (will be prefixed with STORAGE_PREFIX)
 * @param obj - Reactive object to persist
 * @param properties - Array of property names to persist
 */
export function persistReactiveObject<T extends Record<string, any>>(key: string, obj: T, properties: (keyof T)[]) {
  const storageKey = STORAGE_PREFIX + key;

  // Load from storage on mount
  const loadFromStorage = () => {
    if (import.meta.server) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const data = JSON.parse(stored) as Partial<T>;
        for (const prop of properties) {
          if (prop in data && data[prop] !== undefined) {
            obj[prop] = data[prop];
          }
        }
      }
    } catch (e) {
      console.error(`Failed to load ${storageKey} from localStorage:`, e);
    }
  };

  // Watch each property and persist
  for (const prop of properties) {
    watch(
      () => obj[prop],
      (newVal) => {
        if (import.meta.server) return;
        try {
          const current = localStorage.getItem(storageKey);
          const data = current ? JSON.parse(current) : {};
          data[prop] = newVal;
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
          console.error(`Failed to save ${storageKey} to localStorage:`, e);
        }
      },
      { deep: true },
    );
  }

  return { loadFromStorage };
}

/**
 * Clear all persisted game data from localStorage
 */
export function clearAllPersistence() {
  if (import.meta.server) return;

  const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX));
  for (const key of keys) {
    localStorage.removeItem(key);
  }
}

/**
 * Clear specific persistence key
 */
export function clearPersistenceKey(key: string) {
  if (import.meta.server) return;
  const storageKey = STORAGE_PREFIX + key;
  localStorage.removeItem(storageKey);
}
