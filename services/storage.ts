
import { Prize, SpendingRecord } from '../types';

const DB_NAME = 'CraneStockDB';
const STORE_NAME = 'prizes';
const SPENDING_STORE = 'spending';
const DB_VERSION = 2;

export class StorageService {
  private static openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(SPENDING_STORE)) {
          db.createObjectStore(SPENDING_STORE);
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  static async savePrizes(prizes: Prize[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // 既存のデータをクリア
        store.clear();
        
        // 各景品を個別のレコードとして保存
        // 大量にある場合はチャンク分けすることも検討できるが、IndexedDBのトランザクション内なら一括で問題ない
        prizes.forEach(prize => {
          store.put(prize, prize.id);
        });

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async savePrize(prize: Prize): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(prize, prize.id);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async deletePrize(prizeId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(prizeId);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async saveSpendingRecord(record: SpendingRecord): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(SPENDING_STORE, 'readwrite');
        const store = transaction.objectStore(SPENDING_STORE);
        store.put(record, record.id);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async saveSpendingRecords(records: SpendingRecord[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(SPENDING_STORE, 'readwrite');
        const store = transaction.objectStore(SPENDING_STORE);
        store.clear();
        records.forEach(record => {
          store.put(record, record.id);
        });
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async loadSpendingRecords(): Promise<SpendingRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(SPENDING_STORE, 'readonly');
        const store = transaction.objectStore(SPENDING_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
          db.close();
          resolve(request.result || []);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async deleteSpendingRecord(recordId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(SPENDING_STORE, 'readwrite');
        const store = transaction.objectStore(SPENDING_STORE);
        store.delete(recordId);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async loadPrizes(): Promise<Prize[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        // まず、レガシーな 'current_inventory' キーがあるか確認
        const legacyRequest = store.get('current_inventory');
        
        legacyRequest.onsuccess = () => {
          if (legacyRequest.result && Array.isArray(legacyRequest.result)) {
            // レガシーデータが見つかった場合
            db.close();
            resolve(legacyRequest.result);
          } else {
            // 個別レコードをすべて取得
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
              db.close();
              resolve(getAllRequest.result || []);
            };
            getAllRequest.onerror = () => {
              db.close();
              reject(getAllRequest.error);
            };
          }
        };
        
        legacyRequest.onerror = () => {
          db.close();
          reject(legacyRequest.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  static async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME, SPENDING_STORE], 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
        transaction.objectStore(SPENDING_STORE).clear();
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    });
  }

  // localStorageからの移行用
  static getLocalStorageData(): Prize[] | null {
    try {
      const data = localStorage.getItem('crane-game-prizes');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static clearLocalStorage(): void {
    localStorage.removeItem('crane-game-prizes');
  }
}
