import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { syncLowStockAlert } from './alerts';
import { InventoryItem } from '../types';

const SAMPLE_ITEMS = [
  { name: 'White Rice', category: 'Grains', unit: 'bags', vendor: 'Costco', weight_value: 5, weight_unit: 'lbs', unit_price: 6.99, price_basis: 'per_unit', pantry_quantity: 24, grocery_quantity: 12, low_stock_threshold: 10 },
  { name: 'Black Beans', category: 'Canned Goods', unit: 'cans', vendor: 'Kroger', weight_value: 15, weight_unit: 'oz', unit_price: 1.29, price_basis: 'per_unit', pantry_quantity: 48, grocery_quantity: 18, low_stock_threshold: 15 },
  { name: 'Granola Bars', category: 'Snacks', unit: 'boxes', vendor: 'Sam Club', weight_value: 12, weight_unit: 'oz', unit_price: 4.49, price_basis: 'per_unit', pantry_quantity: 16, grocery_quantity: 10, low_stock_threshold: 8 },
  { name: 'Pasta', category: 'Grains', unit: 'boxes', vendor: 'Costco', weight_value: 16, weight_unit: 'oz', unit_price: 1.79, price_basis: 'per_unit', pantry_quantity: 20, grocery_quantity: 8, low_stock_threshold: 10 },
  { name: 'Peanut Butter', category: 'Protein', unit: 'jars', vendor: 'Food Bank', weight_value: 28, weight_unit: 'oz', unit_price: 3.99, price_basis: 'per_unit', pantry_quantity: 14, grocery_quantity: 6, low_stock_threshold: 6 },
  { name: 'Apple Juice', category: 'Beverages', unit: 'bottles', vendor: 'Community Partner', weight_value: 64, weight_unit: 'oz', unit_price: 2.49, price_basis: 'per_unit', pantry_quantity: 12, grocery_quantity: 12, low_stock_threshold: 6 },
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
