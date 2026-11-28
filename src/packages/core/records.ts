import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Json, ModuleStore, ProductEntry } from '@noyau/extension-contract';

export function openRecords(directory: string, legacyRecord: ProductEntry['legacyRecord']) {
  const db = new DatabaseSync(join(directory, 'noyau.sqlite'));
  try {
    db.exec(`
      PRAGMA locking_mode = EXCLUSIVE;
      BEGIN EXCLUSIVE;
      CREATE TABLE IF NOT EXISTS product_data (
        id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS module_records (
        module TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (module, key)
      );
      COMMIT;
    `);
    const oldRead = db.prepare('SELECT value FROM product_data WHERE id = 1');
    const oldWrite = db.prepare('INSERT OR REPLACE INTO product_data (id, value) VALUES (1, ?)');
    const oldDelete = db.prepare('DELETE FROM product_data WHERE id = 1');
    const read = db.prepare('SELECT value FROM module_records WHERE module = ? AND key = ?');
    const write = db.prepare('INSERT OR REPLACE INTO module_records (module, key, value) VALUES (?, ?, ?)');
    const remove = db.prepare('DELETE FROM module_records WHERE module = ? AND key = ?');
    const list = db.prepare('SELECT key, value FROM module_records WHERE module = ? ORDER BY key');
    if (legacyRecord && read.get(legacyRecord.module, legacyRecord.key)) {
      throw new Error('旧资料映射与已有模块记录冲突：' + legacyRecord.module + '/' + legacyRecord.key);
    }

    function readLegacy(): Json | undefined {
      const row = oldRead.get();
      return row && JSON.parse(row.value as string);
    }
    function writeLegacy(value: Json) {
      oldWrite.run(JSON.stringify(value));
    }

    async function transaction<Result>(module: string, run: (store: ModuleStore) => Promise<Result>) {
      const oldKey = legacyRecord?.module === module ? legacyRecord.key : undefined;
      let active = true;
      function checkActive() {
        if (!active) throw new Error('模块操作已经结束');
      }
      const store: ModuleStore = {
        get(key) {
          checkActive();
          if (oldKey !== undefined && key === oldKey) return readLegacy();
          const row = read.get(module, key);
          return row && JSON.parse(row.value as string);
        },
        set(key, value) {
          checkActive();
          if (oldKey !== undefined && key === oldKey) writeLegacy(value);
          else write.run(module, key, JSON.stringify(value));
        },
        delete(key) {
          checkActive();
          if (oldKey !== undefined && key === oldKey) oldDelete.run();
          else remove.run(module, key);
        },
        entries() {
          checkActive();
          const rows: [string, Json][] = list.all(module).map(row => [row.key as string, JSON.parse(row.value as string)]);
          if (oldKey !== undefined) {
            const value = readLegacy();
            if (value !== undefined) rows.push([oldKey, value]);
          }
          return rows;
        },
      };
      db.exec('BEGIN');
      try {
        const result = await run(store);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        active = false;
      }
    }
    return { transaction, readLegacy, writeLegacy, close: () => db.close() };
  } catch (error) {
    db.close();
    throw error;
  }
}
