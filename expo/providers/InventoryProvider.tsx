import { useCallback, useEffect, useMemo, useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { InventoryItem, InventoryCategory, InventoryMovement, InventoryMovementType } from '@/types';
import { useDatabase } from './DatabaseProvider';
import { generateId } from '@/lib/utils';
import { assertNotSubscriber } from './ProfileProvider';

export interface MovementContext {
  objectId?: string;
  objectName?: string;
  comment?: string;
}

export interface BulkReceiptItem {
  itemId: string;
  itemName: string;
  unit: string;
  quantity: number;
}

interface InventoryContextType {
  items: InventoryItem[];
  categories: InventoryCategory[];
  movements: InventoryMovement[];
  isLoading: boolean;
  addItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>, ctx?: MovementContext) => Promise<InventoryItem>;
  updateItem: (id: string, updates: Partial<InventoryItem>, ctx?: MovementContext) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  consumeItem: (id: string, quantity: number, ctx?: MovementContext) => Promise<boolean>;
  bulkReceipt: (entries: BulkReceiptItem[], comment?: string) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  getLowStockItems: () => InventoryItem[];
  getItem: (id: string) => InventoryItem | undefined;
  addCategory: (name: string) => Promise<InventoryCategory>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const [InventoryProvider, useInventory] = createContextHook<InventoryContextType>(() => {
  const { db, isReady } = useDatabase();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<InventoryCategory>(
      `SELECT id, name FROM inventory_categories ORDER BY name`
    );
    setCategories(result);
  }, [db]);

  const loadItems = useCallback(async () => {
    if (!db) return;
    const result = await db.getAllAsync<any>(
      `SELECT id, name, quantity, unit, min_quantity as minQuantity, category_id as categoryId, created_at as createdAt, updated_at as updatedAt 
       FROM inventory ORDER BY name`
    );
    const parsed: InventoryItem[] = result.map((row: any) => ({
      ...row,
      categoryId: row.categoryId || undefined,
    }));
    setItems(parsed);
  }, [db]);

  const loadMovements = useCallback(async () => {
    if (!db) return;
    try {
      const result = await db.getAllAsync<any>(
        `SELECT id, type, item_id as itemId, item_name as itemName, quantity, unit,
                object_id as objectId, object_name as objectName, comment, created_at as createdAt
         FROM inventory_movements ORDER BY created_at DESC`
      );
      const parsed: InventoryMovement[] = result.map((row: any) => ({
        id: row.id,
        type: (row.type === 'in' ? 'in' : 'out') as InventoryMovementType,
        itemId: row.itemId || undefined,
        itemName: row.itemName,
        quantity: row.quantity,
        unit: row.unit,
        objectId: row.objectId || undefined,
        objectName: row.objectName || undefined,
        comment: row.comment || undefined,
        createdAt: row.createdAt,
      }));
      setMovements(parsed);
    } catch (e: any) {
      console.log('[Inventory] loadMovements failed:', e?.message);
    }
  }, [db]);

  const refreshData = useCallback(async () => {
    if (!db) return;
    setIsLoading(true);
    await Promise.all([loadItems(), loadCategories(), loadMovements()]);
    setIsLoading(false);
  }, [db, loadItems, loadCategories, loadMovements]);

  useEffect(() => {
    if (isReady) {
      void refreshData();
    }
  }, [isReady, refreshData]);

  const insertMovement = useCallback(async (
    type: InventoryMovementType,
    item: { id?: string; name: string; unit: string },
    quantity: number,
    ctx?: MovementContext,
  ) => {
    if (!db) return;
    if (quantity <= 0) return;
    try {
      const id = generateId();
      await db.runAsync(
        `INSERT INTO inventory_movements (id, type, item_id, item_name, quantity, unit, object_id, object_name, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, type, item.id || null, item.name, quantity, item.unit, ctx?.objectId || null, ctx?.objectName || null, ctx?.comment || null, Date.now()]
      );
      await loadMovements();
    } catch (e: any) {
      console.log('[Inventory] insertMovement failed:', e?.message);
    }
  }, [db, loadMovements]);

  const addCategory = useCallback(async (name: string): Promise<InventoryCategory> => {
    if (assertNotSubscriber()) throw new Error('subscriber-readonly');
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    await db.runAsync('INSERT INTO inventory_categories (id, name) VALUES (?, ?)', [id, name]);
    await loadCategories();
    return { id, name };
  }, [db, loadCategories]);

  const updateCategory = useCallback(async (id: string, name: string) => {
    if (assertNotSubscriber()) return;
    if (!db) throw new Error('Database not ready');
    await db.runAsync('UPDATE inventory_categories SET name = ? WHERE id = ?', [name, id]);
    await loadCategories();
  }, [db, loadCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    if (assertNotSubscriber()) return;
    if (!db) throw new Error('Database not ready');
    await db.runAsync('UPDATE inventory SET category_id = NULL WHERE category_id = ?', [id]);
    await db.runAsync('DELETE FROM inventory_categories WHERE id = ?', [id]);
    await Promise.all([loadCategories(), loadItems()]);
  }, [db, loadCategories, loadItems]);

  const addItem = useCallback(async (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>, ctx?: MovementContext): Promise<InventoryItem> => {
    if (assertNotSubscriber()) throw new Error('subscriber-readonly');
    if (!db) throw new Error('Database not ready');
    const id = generateId();
    const now = Date.now();
    await db.runAsync(
      'INSERT INTO inventory (id, name, quantity, unit, min_quantity, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, item.name, item.quantity, item.unit, item.minQuantity, item.categoryId || null, now, now]
    );
    await loadItems();
    if (item.quantity > 0) {
      await insertMovement('in', { id, name: item.name, unit: item.unit }, item.quantity, { ...ctx, comment: ctx?.comment || 'Создание материала' });
    }
    return { id, ...item, createdAt: now, updatedAt: now };
  }, [db, loadItems, insertMovement]);

  const updateItem = useCallback(async (id: string, updates: Partial<InventoryItem>, ctx?: MovementContext) => {
    if (assertNotSubscriber()) return;
    if (!db) throw new Error('Database not ready');
    const before = items.find(i => i.id === id);
    const sets: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.quantity !== undefined) { sets.push('quantity = ?'); values.push(updates.quantity); }
    if (updates.unit !== undefined) { sets.push('unit = ?'); values.push(updates.unit); }
    if (updates.minQuantity !== undefined) { sets.push('min_quantity = ?'); values.push(updates.minQuantity); }
    if (updates.categoryId !== undefined) { sets.push('category_id = ?'); values.push(updates.categoryId || null); }
    sets.push('updated_at = ?'); values.push(Date.now());
    values.push(id);
    await db.runAsync(`UPDATE inventory SET ${sets.join(', ')} WHERE id = ?`, values);
    await loadItems();
    if (before && updates.quantity !== undefined && updates.quantity !== before.quantity) {
      const delta = updates.quantity - before.quantity;
      const name = updates.name ?? before.name;
      const unit = updates.unit ?? before.unit;
      await insertMovement(
        delta > 0 ? 'in' : 'out',
        { id, name, unit },
        Math.abs(delta),
        { ...ctx, comment: ctx?.comment || 'Корректировка остатков' },
      );
    }
  }, [db, loadItems, items, insertMovement]);

  const deleteItem = useCallback(async (id: string) => {
    if (assertNotSubscriber()) return;
    if (!db) throw new Error('Database not ready');
    await db.runAsync('DELETE FROM inventory WHERE id = ?', [id]);
    await loadItems();
  }, [db, loadItems]);

  const consumeItem = useCallback(async (id: string, quantity: number, ctx?: MovementContext): Promise<boolean> => {
    if (assertNotSubscriber()) return false;
    if (!db) throw new Error('Database not ready');
    const item = items.find(i => i.id === id);
    if (!item || item.quantity < quantity) return false;
    await db.runAsync(
      'UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?',
      [item.quantity - quantity, Date.now(), id]
    );
    await loadItems();
    await insertMovement('out', { id, name: item.name, unit: item.unit }, quantity, ctx);
    return true;
  }, [db, items, loadItems, insertMovement]);

  const bulkReceipt = useCallback(async (entries: BulkReceiptItem[], comment?: string) => {
    if (assertNotSubscriber()) return;
    if (!db) throw new Error('Database not ready');
    const now = Date.now();
    for (const e of entries) {
      if (!e.itemId || !Number.isFinite(e.quantity) || e.quantity <= 0) continue;
      const item = items.find(i => i.id === e.itemId);
      if (!item) continue;
      const newQty = item.quantity + e.quantity;
      await db.runAsync(
        'UPDATE inventory SET quantity = ?, updated_at = ? WHERE id = ?',
        [newQty, now, e.itemId]
      );
      await insertMovement('in', { id: e.itemId, name: item.name, unit: item.unit }, e.quantity, { comment: comment || 'Массовый приход' });
    }
    await loadItems();
  }, [db, items, loadItems, insertMovement]);

  const deleteMovement = useCallback(async (id: string) => {
    if (assertNotSubscriber()) return;
    if (!db) throw new Error('Database not ready');
    await db.runAsync('DELETE FROM inventory_movements WHERE id = ?', [id]);
    await loadMovements();
  }, [db, loadMovements]);

  const getLowStockItems = useCallback(() => items.filter(item => item.quantity <= item.minQuantity), [items]);
  const getItem = useCallback((id: string) => items.find(i => i.id === id), [items]);

  return useMemo(() => ({
    items, categories, movements, isLoading,
    addItem, updateItem, deleteItem, consumeItem, bulkReceipt, deleteMovement,
    getLowStockItems, getItem,
    addCategory, updateCategory, deleteCategory,
    refreshData,
  }), [items, categories, movements, isLoading, addItem, updateItem, deleteItem, consumeItem, bulkReceipt, deleteMovement, getLowStockItems, getItem, addCategory, updateCategory, deleteCategory, refreshData]);
});
