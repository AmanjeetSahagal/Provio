import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { syncLowStockAlert } from './alerts';
import { InventoryItem } from '../types';

const SAMPLE_ITEMS = [
  { name: 'White Rice', category: 'Grains', unit: 'bags', vendor: 'Costco', pantry_quantity: 24, grocery_quantity: 12, low_stock_threshold: 10 },
  { name: 'Black Beans', category: 'Canned Goods', unit: 'cans', vendor: 'Kroger', pantry_quantity: 48, grocery_quantity: 18, low_stock_threshold: 15 },
  { name: 'Granola Bars', category: 'Snacks', unit: 'boxes', vendor: 'Sam Club', pantry_quantity: 16, grocery_quantity: 10, low_stock_threshold: 8 },
  { name: 'Pasta', category: 'Grains', unit: 'boxes', vendor: 'Costco', pantry_quantity: 20, grocery_quantity: 8, low_stock_threshold: 10 },
  { name: 'Peanut Butter', category: 'Protein', unit: 'jars', vendor: 'Food Bank', pantry_quantity: 14, grocery_quantity: 6, low_stock_threshold: 6 },
  { name: 'Apple Juice', category: 'Beverages', unit: 'bottles', vendor: 'Community Partner', pantry_quantity: 12, grocery_quantity: 12, low_stock_threshold: 6 },
];

export async function seedSampleInventory() {
  const itemsSnapshot = await getDocs(collection(db, 'items'));
  const existingItems = itemsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as InventoryItem));

  for (const sample of SAMPLE_ITEMS) {
    const exists = existingItems.some(
      (item) => item.name.toLowerCase() === sample.name.toLowerCase() && item.unit.toLowerCase() === sample.unit.toLowerCase(),
    );

    if (exists) {
      continue;
    }

    const docRef = await addDoc(collection(db, 'items'), {
      ...sample,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await syncLowStockAlert({
      itemId: docRef.id,
      itemName: sample.name,
      pantryQuantity: sample.pantry_quantity,
      groceryQuantity: sample.grocery_quantity,
      threshold: sample.low_stock_threshold,
    });

    await addDoc(collection(db, 'transactions'), {
      item_id: docRef.id,
      type: 'add',
      quantity: sample.pantry_quantity + sample.grocery_quantity,
      vendor: sample.vendor,
      timestamp: new Date().toISOString(),
      notes: 'Loaded sample inventory',
    });
  }
}
