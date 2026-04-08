import { addDoc, collection, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';

type SyncLowStockAlertInput = {
  itemId: string;
  itemName: string;
  pantryQuantity: number;
  groceryQuantity: number;
  threshold?: number;
};

const DEFAULT_THRESHOLD = 10;

export async function syncLowStockAlert({
  itemId,
  itemName,
  pantryQuantity,
  groceryQuantity,
  threshold,
}: SyncLowStockAlertInput) {
  const lowStockThreshold = Number(threshold ?? DEFAULT_THRESHOLD);
  const total = Number(pantryQuantity || 0) + Number(groceryQuantity || 0);
  const alertsQuery = query(
    collection(db, 'alerts'),
    where('item_id', '==', itemId),
    where('type', '==', 'low_stock'),
    where('resolved', '==', false),
  );
  const existingAlerts = await getDocs(alertsQuery);

  if (total < lowStockThreshold) {
    if (existingAlerts.empty) {
      await addDoc(collection(db, 'alerts'), {
        item_id: itemId,
        type: 'low_stock',
        message: `${itemName} is low on stock (${total} remaining, threshold ${lowStockThreshold}).`,
        created_at: new Date().toISOString(),
        resolved: false,
      });
    }
    return;
  }

  await Promise.all(existingAlerts.docs.map((alert) => updateDoc(alert.ref, { resolved: true })));
}
