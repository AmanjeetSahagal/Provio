import { addDoc, collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckpointRecord, CheckpointSummary, InventoryItem } from '../types';

type SnapshotResult = {
  baselineItems: CheckpointRecord['baseline_items'];
  summary: CheckpointSummary;
};

function buildSnapshot(items: InventoryItem[], rolloverYear?: string): SnapshotResult {
  const categoryTotals = new Map<string, number>();

  const baselineItems = items.map((item) => {
    const pantryQty = Number(item.pantry_quantity || 0);
    const groceryQty = Number(item.grocery_quantity || 0);
    const total = pantryQty + groceryQty;
    const category = item.category || 'Uncategorized';

    categoryTotals.set(category, (categoryTotals.get(category) || 0) + total);

    return {
      item_id: item.id,
      name: item.name,
      category,
      pantry_qty: pantryQty,
      grocery_qty: groceryQty,
    };
  });

  const pantryUnits = baselineItems.reduce((sum, item) => sum + item.pantry_qty, 0);
  const groceryUnits = baselineItems.reduce((sum, item) => sum + item.grocery_qty, 0);
  const totalUnits = pantryUnits + groceryUnits;
  const itemsCarriedForward = baselineItems.filter((item) => item.pantry_qty + item.grocery_qty > 0).length;

  return {
    baselineItems,
    summary: {
      total_items: baselineItems.length,
      items_carried_forward: itemsCarriedForward,
      total_units: totalUnits,
      pantry_units: pantryUnits,
      grocery_units: groceryUnits,
      category_totals: Array.from(categoryTotals.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      rollover_year: rolloverYear,
    },
  };
}

export async function getCurrentInventorySnapshot(rolloverYear?: string): Promise<SnapshotResult> {
  const itemsSnapshot = await getDocs(collection(db, 'items'));
  const items = itemsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as InventoryItem));
  return buildSnapshot(items, rolloverYear);
}

export async function createCheckpoint() {
  const { baselineItems, summary } = await getCurrentInventorySnapshot();

  await addDoc(collection(db, 'checkpoints'), {
    created_at: new Date().toISOString(),
    type: 'checkpoint',
    label: 'Manual checkpoint',
    notes: 'Manual baseline saved from the current inventory state.',
    baseline_items: baselineItems,
    summary,
  });
}

export async function createYearEndRollover(rolloverYear: string) {
  const timestamp = new Date().toISOString();
  const itemsSnapshot = await getDocs(collection(db, 'items'));
  const items = itemsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as InventoryItem));
  const { baselineItems, summary } = buildSnapshot(items, rolloverYear);

  const batch = writeBatch(db);
  const checkpointRef = doc(collection(db, 'checkpoints'));

  batch.set(checkpointRef, {
    created_at: timestamp,
    type: 'rollover',
    label: `${rolloverYear} year-end rollover`,
    notes: `Carry-forward baseline created for ${rolloverYear}.`,
    baseline_items: baselineItems,
    summary,
  });

  items.forEach((item) => {
    const pantryQty = Number(item.pantry_quantity || 0);
    const groceryQty = Number(item.grocery_quantity || 0);
    const total = pantryQty + groceryQty;

    if (total <= 0) {
      return;
    }

    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, {
      item_id: item.id,
      type: 'rollover',
      quantity: total,
      timestamp,
      to_program: 'year_end_rollover',
      notes: `Carry-forward into ${rolloverYear}. Pantry: ${pantryQty}. Grocery: ${groceryQty}.`,
    });
  });

  await batch.commit();
}
