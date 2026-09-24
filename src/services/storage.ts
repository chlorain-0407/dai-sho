/**
 * 太平洋房屋｜預售與新成屋聯銷平台
 * LocalStorage 儲存庫與版本管理
 */

export const STORAGE_NAMESPACE = 'pacific_joint_sales_v1';
export const CURRENT_SCHEMA_VERSION = 1;

export interface StorageContainer<T> {
  schemaVersion: number;
  updatedAt: string;
  data: T;
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    const container: StorageContainer<T> = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      data,
    };
    localStorage.setItem(`${STORAGE_NAMESPACE}_${key}`, JSON.stringify(container));
  } catch (error) {
    console.error(`[LocalStorage] Failed to save key: ${key}`, error);
  }
}

export function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_NAMESPACE}_${key}`);
    if (!raw) return null;
    const container = JSON.parse(raw) as StorageContainer<T>;
    if (container.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      console.warn(`[LocalStorage] Schema version mismatch for ${key}. Expected ${CURRENT_SCHEMA_VERSION}, got ${container.schemaVersion}`);
      return null;
    }
    return container.data;
  } catch (error) {
    console.error(`[LocalStorage] Failed to load key: ${key}`, error);
    return null;
  }
}

export function clearAllStorage(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_NAMESPACE)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
