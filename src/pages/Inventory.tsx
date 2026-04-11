import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, Package, PencilLine, Boxes, CheckCircle2 } from 'lucide-react';
import { InventoryInput, InventoryItem } from '../types';
import { syncLowStockAlert } from '../services/alerts';
import { seedSampleInventory } from '../services/demoData';

const categoryOptions = [
 'Grains',
 'Canned Goods',
 'Produce',
 'Snacks',
 'Protein',
 'Dairy',
 'Beverages',
 'Frozen',
 'Bakery',
 'Other',
];

const unitOptions = ['items', 'boxes', 'bags', 'cans', 'bottles', 'packs', 'lbs'];
const weightUnitOptions = ['lbs', 'oz', 'kg', 'g'];
const priceBasisOptions = [
 'per_unit',
 'per_weight',
] as const;

const thresholdOptions = [5, 10, 15, 20];

const emptyItem: InventoryInput = {
 name: '',
 category: 'Grains',
 unit: 'items',
 vendor: '',
 weight_value: undefined,
 weight_unit: 'lbs',
 unit_price: undefined,
 price_basis: 'per_unit',
 low_stock_threshold: 10,
 pantry_quantity: 0,
 grocery_quantity: 0,
};

const emptyRestock = {
 addPantry: 0,
 addGrocery: 0,
 removePantry: 0,
 removeGrocery: 0,
 removeReason: 'Distributed',
 notes: '',
};

const removalReasonOptions = ['Distributed', 'Damaged', 'Expired', 'Count Correction', 'Other'];

export default function Inventory() {
 const [items, setItems] = useState<InventoryItem[]>([]);
 const [search, setSearch] = useState('');
 const [isAdding, setIsAdding] = useState(false);
 const [newItem, setNewItem] = useState<InventoryInput>(emptyItem);
 const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
 const [editItem, setEditItem] = useState<InventoryInput>(emptyItem);
 const [restock, setRestock] = useState(emptyRestock);
 const [isSaving, setIsSaving] = useState(false);
 const [isSeeding, setIsSeeding] = useState(false);
 const [statusMessage, setStatusMessage] = useState('');

 useEffect(() => {
 const unsub = onSnapshot(collection(db, 'items'), (snapshot) => {
 const nextItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
 setItems(nextItems);
 setSelectedItem((current) => {
 if (!current) return null;
 return nextItems.find((item) => item.id === current.id) || null;
 });
 });
 return unsub;
 }, []);

 useEffect(() => {
 if (!selectedItem) return;
 setEditItem({
 name: selectedItem.name,
 category: selectedItem.category,
 unit: selectedItem.unit,
 vendor: selectedItem.vendor || '',
 weight_value: selectedItem.weight_value,
 weight_unit: selectedItem.weight_unit || 'lbs',
 unit_price: selectedItem.unit_price,
 price_basis: selectedItem.price_basis || 'per_unit',
 low_stock_threshold: Number(selectedItem.low_stock_threshold ?? 10),
 pantry_quantity: Number(selectedItem.pantry_quantity || 0),
 grocery_quantity: Number(selectedItem.grocery_quantity || 0),
 });
 setRestock(emptyRestock);
 setStatusMessage('');
 }, [selectedItem]);

 const handleAddItem = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const docRef = await addDoc(collection(db, 'items'), {
     ...newItem,
     low_stock_threshold: Number(newItem.low_stock_threshold ?? 10),
     weight_value: newItem.weight_value ? Number(newItem.weight_value) : undefined,
     unit_price: newItem.unit_price ? Number(newItem.unit_price) : undefined,
     pantry_quantity: Number(newItem.pantry_quantity),
     grocery_quantity: Number(newItem.grocery_quantity),
     created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 });

 await syncLowStockAlert({
 itemId: docRef.id,
 itemName: newItem.name,
 pantryQuantity: Number(newItem.pantry_quantity),
 groceryQuantity: Number(newItem.grocery_quantity),
 threshold: Number(newItem.low_stock_threshold ?? 10),
 });
 
 await addDoc(collection(db, 'transactions'), {
 item_id: docRef.id,
 type: 'add',
 quantity: Number(newItem.pantry_quantity) + Number(newItem.grocery_quantity),
 vendor: newItem.vendor?.trim() || undefined,
 timestamp: new Date().toISOString(),
 notes: 'Initial stock addition'
 });

 setIsAdding(false);
 setNewItem(emptyItem);
 } catch (error) {
 console.error("Error adding item:", error);
 alert("Failed to add item");
 }
 };

 const handleSaveItem = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedItem) return;

 setIsSaving(true);
 setStatusMessage('');

 const pantryIncrease = Number(restock.addPantry || 0);
 const groceryIncrease = Number(restock.addGrocery || 0);
 const pantryDecrease = Number(restock.removePantry || 0);
 const groceryDecrease = Number(restock.removeGrocery || 0);
 const nextPantryQty = Number(editItem.pantry_quantity || 0) + pantryIncrease - pantryDecrease;
 const nextGroceryQty = Number(editItem.grocery_quantity || 0) + groceryIncrease - groceryDecrease;

 if (nextPantryQty < 0 || nextGroceryQty < 0) {
 setIsSaving(false);
 setStatusMessage('This change would make inventory go below zero.');
 return;
 }

 if ((pantryDecrease > 0 || groceryDecrease > 0) && !restock.removeReason.trim()) {
 setIsSaving(false);
 setStatusMessage('Choose a reason for removing stock.');
 return;
 }

 try {
 const itemRef = doc(db, 'items', selectedItem.id);
 await updateDoc(itemRef, {
 name: editItem.name,
 category: editItem.category,
 unit: editItem.unit,
     vendor: editItem.vendor?.trim() || '',
     weight_value: editItem.weight_value ? Number(editItem.weight_value) : undefined,
     weight_unit: editItem.weight_value ? editItem.weight_unit || 'lbs' : '',
     unit_price: editItem.unit_price ? Number(editItem.unit_price) : undefined,
     price_basis: editItem.unit_price ? editItem.price_basis || 'per_unit' : '',
     low_stock_threshold: Number(editItem.low_stock_threshold ?? 10),
     pantry_quantity: nextPantryQty,
     grocery_quantity: nextGroceryQty,
 updated_at: new Date().toISOString(),
 });

 await syncLowStockAlert({
 itemId: selectedItem.id,
 itemName: editItem.name,
 pantryQuantity: nextPantryQty,
 groceryQuantity: nextGroceryQty,
 threshold: Number(editItem.low_stock_threshold ?? 10),
 });

 if (pantryIncrease !== 0 || groceryIncrease !== 0) {
 const totalAdded = pantryIncrease + groceryIncrease;
 await addDoc(collection(db, 'transactions'), {
 item_id: selectedItem.id,
 type: 'add',
 quantity: totalAdded,
 to_program: 'inventory',
 vendor: editItem.vendor?.trim() || selectedItem.vendor || undefined,
 timestamp: new Date().toISOString(),
 notes: restock.notes || `Added stock: pantry ${pantryIncrease}, grocery ${groceryIncrease}`,
 });
 }

 if (pantryDecrease !== 0 || groceryDecrease !== 0) {
 const totalRemoved = pantryDecrease + groceryDecrease;
 await addDoc(collection(db, 'transactions'), {
 item_id: selectedItem.id,
 type: 'remove',
 quantity: totalRemoved,
 from_program: 'inventory',
 vendor: editItem.vendor?.trim() || selectedItem.vendor || undefined,
 timestamp: new Date().toISOString(),
 notes: `${restock.removeReason}${restock.notes ? ` // ${restock.notes}` : ''} // Removed stock: pantry ${pantryDecrease}, grocery ${groceryDecrease}`,
 });
 }

 setRestock(emptyRestock);
 setStatusMessage('Inventory record updated.');
 } catch (error) {
 console.error('Error updating item:', error);
 setStatusMessage('Failed to update inventory record.');
 } finally {
 setIsSaving(false);
 }
 };

 const filteredItems = items.filter(item => 
 item.name?.toLowerCase().includes(search.toLowerCase()) ||
 item.category?.toLowerCase().includes(search.toLowerCase()) ||
 item.vendor?.toLowerCase().includes(search.toLowerCase())
 );

 const vendorOptions = Array.from(new Set(items.map((item) => item.vendor?.trim()).filter(Boolean) as string[])).sort();

 const handleSeedSamples = async () => {
 setIsSeeding(true);
 setStatusMessage('');
 try {
 await seedSampleInventory();
 setStatusMessage('Sample inventory loaded.');
 } catch (error) {
 console.error('Error loading sample inventory:', error);
 setStatusMessage('Failed to load sample inventory.');
 } finally {
 setIsSeeding(false);
 }
 };

 return (
 <>
 <div className="space-y-10">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b-4 border-vt-ink pb-6">
 <div>
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Inventory</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Current stock</p>
 </div>
 <div className="flex flex-wrap gap-3">
 <button
 onClick={handleSeedSamples}
 disabled={isSeeding}
 className="bg-vt-orange text-vt-ink border-4 border-vt-ink px-6 py-3 font-mono font-bold uppercase flex items-center gap-3 hover:bg-vt-orange-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all disabled:opacity-60 disabled:hover:translate-y-0"
 >
 <Boxes size={24} />
 {isSeeding ? 'Loading...' : 'Load Sample Data'}
 </button>
 <button 
 onClick={() => setIsAdding(true)}
 className="bg-vt-maroon text-vt-cream border-4 border-vt-ink px-6 py-3 font-mono font-bold uppercase flex items-center gap-3 hover:bg-vt-maroon-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all"
 >
 <Plus size={24} />
 New Record
 </button>
 </div>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink p-4 shadow-[8px_8px_0px_0px_#E87722] flex items-center gap-4">
 <Search className="text-vt-ink ml-2" size={28} />
 <input 
 type="text"
 placeholder="QUERY DATABASE..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="flex-1 bg-transparent border-none outline-none text-vt-ink font-mono text-xl placeholder-gray-400 uppercase"
 />
 </div>

 <div className="border-4 border-vt-ink bg-vt-cream p-6 shadow-[8px_8px_0px_0px_#861F41]">
 <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-gray-500">Quick Guide</p>
 <p className="font-sans text-lg text-vt-ink mt-3">
 Use <span className="font-bold">New Record</span> for brand-new items. Use the table to look up an existing item and restock it without re-entering everything.
 </p>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516] overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead className="bg-vt-maroon text-vt-cream border-b-4 border-vt-ink ">
 <tr>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Designation</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Class</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Pricing</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Pantry</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Grocery</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm">Total</th>
 </tr>
 </thead>
 <tbody className="divide-y-4 divide-vt-ink ">
 {filteredItems.map(item => (
 <tr
 key={item.id}
 onClick={() => setSelectedItem(item)}
 className={`cursor-pointer transition-colors ${
 selectedItem?.id === item.id ? 'bg-vt-orange/20' : 'hover:bg-vt-orange/10'
 }`}
 >
 <td className="p-6 border-r-4 border-vt-ink ">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-vt-cream border-2 border-vt-ink ">
 <Package size={24} className="text-vt-ink " />
 </div>
 <div>
 <p className="font-sans font-bold text-vt-ink text-xl">{item.name}</p>
 <p className="font-mono text-sm text-gray-600 mt-1 uppercase">{item.unit}</p>
 {item.vendor ? <p className="font-sans text-sm text-gray-600 mt-1">Vendor: {item.vendor}</p> : null}
 {item.weight_value || item.unit_price ? (
 <p className="font-sans text-sm text-gray-600 mt-1">
 {item.weight_value ? `${item.weight_value} ${item.weight_unit || 'lbs'}` : 'No weight'}{item.unit_price ? ` // $${item.unit_price.toFixed(2)} ${item.price_basis === 'per_weight' ? `/ ${item.weight_unit || 'lb'}` : `/ ${item.unit}`}` : ''}
 </p>
 ) : null}
 </div>
 </div>
 </td>
 <td className="p-6 border-r-4 border-vt-ink font-sans text-lg font-semibold text-gray-700 uppercase">{item.category}</td>
 <td className="p-6 border-r-4 border-vt-ink">
 <div className="font-sans text-sm text-vt-ink">
 {item.unit_price ? (
 <p className="font-bold">${item.unit_price.toFixed(2)} {item.price_basis === 'per_weight' ? `/${item.weight_unit || 'lb'}` : `/ ${item.unit}`}</p>
 ) : (
 <p className="text-gray-500">No pricing</p>
 )}
 {item.weight_value ? (
 <p className="text-gray-600 mt-1">{item.weight_value} {item.weight_unit || 'lbs'} each</p>
 ) : null}
 </div>
 </td>
 <td className="p-6 border-r-4 border-vt-ink font-mono font-bold text-vt-ink text-2xl">{item.pantry_quantity || 0}</td>
 <td className="p-6 border-r-4 border-vt-ink font-mono font-bold text-vt-ink text-2xl">{item.grocery_quantity || 0}</td>
 <td className="p-6 font-mono font-extrabold text-vt-maroon text-3xl">{(item.pantry_quantity || 0) + (item.grocery_quantity || 0)}</td>
 </tr>
 ))}
 {filteredItems.length === 0 && (
 <tr>
 <td colSpan={6} className="p-16 text-center font-mono text-gray-500 text-xl uppercase tracking-widest">No records found.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 </div>
 {isAdding && (
 <div className="fixed inset-y-0 right-0 left-0 lg:left-72 z-50 flex items-center justify-center p-4 md:p-8">
 <button
 type="button"
 aria-label="Close new item modal"
 onClick={() => setIsAdding(false)}
 className="absolute inset-0 bg-vt-ink/55 backdrop-blur-[2px]"
 />
 <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-vt-cream border-4 border-vt-ink shadow-[16px_16px_0px_0px_#1A1516]">
 <div className="sticky top-0 bg-vt-maroon text-vt-cream border-b-4 border-vt-ink px-6 py-5 flex items-center justify-between gap-4">
 <div>
 <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] opacity-80">New Record</p>
 <h2 className="font-serif text-3xl font-bold uppercase">Add Inventory Item</h2>
 </div>
 <button
 type="button"
 onClick={() => setIsAdding(false)}
 className="border-4 border-vt-cream px-4 py-2 font-mono font-bold uppercase hover:bg-vt-cream hover:text-vt-maroon transition-colors"
 >
 Close
 </button>
 </div>

 <form onSubmit={handleAddItem} className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
 <div className="md:col-span-2 border-4 border-vt-ink bg-vt-orange/10 p-5">
 <p className="font-sans text-base text-vt-ink">
 Fill in the item details once, choose where the starting stock belongs, then save the record. Use the restock panel later if more of the same item arrives.
 </p>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Item Name</label>
 <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Category</label>
 <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Unit</label>
 <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Vendor</label>
 <input list="inventory-vendors" type="text" value={newItem.vendor || ''} onChange={e => setNewItem({...newItem, vendor: e.target.value})} placeholder="Costco, Kroger, Food Bank..." className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Item Weight</label>
 <input type="number" min="0" step="0.01" value={newItem.weight_value ?? ''} onChange={e => setNewItem({...newItem, weight_value: e.target.value ? Number(e.target.value) : undefined})} placeholder="Optional" className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Weight Unit</label>
 <select value={newItem.weight_unit || 'lbs'} onChange={e => setNewItem({...newItem, weight_unit: e.target.value as InventoryInput['weight_unit']})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {weightUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Price</label>
 <input type="number" min="0" step="0.01" value={newItem.unit_price ?? ''} onChange={e => setNewItem({...newItem, unit_price: e.target.value ? Number(e.target.value) : undefined})} placeholder="Optional" className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Price Type</label>
 <select value={newItem.price_basis || 'per_unit'} onChange={e => setNewItem({...newItem, price_basis: e.target.value as InventoryInput['price_basis']})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {priceBasisOptions.map((option) => <option key={option} value={option}>{option === 'per_weight' ? 'Per Weight' : 'Per Unit'}</option>)}
 </select>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Alert When Total Stock Falls Below</label>
 <select value={newItem.low_stock_threshold ?? 10} onChange={e => setNewItem({...newItem, low_stock_threshold: Number(e.target.value)})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {thresholdOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 <p className="font-sans text-sm text-gray-600 mt-2">The dashboard will automatically flag this item when it drops below the alert level.</p>
 </div>
 <div className="border-4 border-vt-ink bg-vt-orange/10 p-5">
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-4">Starting Stock</p>
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Starting Pantry Stock</label>
 <input type="number" min="0" value={newItem.pantry_quantity} onChange={e => setNewItem({...newItem, pantry_quantity: Number(e.target.value)})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Starting Grocery Stock</label>
 <input type="number" min="0" value={newItem.grocery_quantity} onChange={e => setNewItem({...newItem, grocery_quantity: Number(e.target.value)})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 </div>
 </div>
 <div className="md:col-span-2 flex justify-end gap-6 mt-2 border-t-4 border-vt-ink pt-8">
 <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 font-mono font-bold uppercase text-vt-ink border-4 border-vt-ink hover:bg-vt-ink hover:text-vt-cream transition-colors">Abort</button>
 <button type="submit" className="bg-vt-orange text-vt-ink border-4 border-vt-ink px-10 py-4 font-mono font-bold uppercase hover:bg-vt-orange-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all">Commit Record</button>
 </div>
 </form>
 </div>
 </div>
 )}
 {selectedItem && (
 <div className="fixed inset-y-0 right-0 left-0 lg:left-72 z-50 flex items-center justify-center p-4 md:p-8">
 <button
 type="button"
 aria-label="Close edit item modal"
 onClick={() => setSelectedItem(null)}
 className="absolute inset-0 bg-vt-ink/55 backdrop-blur-[2px]"
 />
 <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-vt-cream border-4 border-vt-ink shadow-[16px_16px_0px_0px_#1A1516]">
 <div className="sticky top-0 bg-vt-ink text-vt-cream border-b-4 border-vt-ink px-6 py-5 flex items-center justify-between gap-4">
 <div>
 <div className="inline-flex items-center gap-3 bg-vt-ink text-vt-cream border-4 border-vt-cream px-4 py-2 shadow-[4px_4px_0px_0px_#E87722] mb-5">
 <PencilLine size={20} />
 <span className="font-mono font-bold uppercase tracking-widest text-sm">Edit + Stock Update</span>
 </div>
 <h2 className="font-serif text-3xl font-bold uppercase">{selectedItem.name}</h2>
 <p className="font-mono text-sm uppercase tracking-widest mt-2 opacity-80">Update details and stock levels</p>
 </div>
 <button
 type="button"
 onClick={() => setSelectedItem(null)}
 className="border-4 border-vt-cream px-4 py-2 font-mono font-bold uppercase hover:bg-vt-cream hover:text-vt-ink transition-colors"
 >
 Close
 </button>
 </div>

 <form onSubmit={handleSaveItem} className="p-8 md:p-10 space-y-8">
 <div className="border-4 border-vt-ink bg-vt-orange/10 p-4">
 <p className="font-sans text-sm text-vt-ink">
 Change item details here, then use the stock sections below to add or remove units. If stock is removed, choose why.
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Item Name</label>
 <input required type="text" value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Category</label>
 <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Unit</label>
 <select value={editItem.unit} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {unitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Vendor</label>
 <input list="inventory-vendors" type="text" value={editItem.vendor || ''} onChange={e => setEditItem({ ...editItem, vendor: e.target.value })} placeholder="Costco, Kroger, Food Bank..." className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Item Weight</label>
 <input type="number" min="0" step="0.01" value={editItem.weight_value ?? ''} onChange={e => setEditItem({ ...editItem, weight_value: e.target.value ? Number(e.target.value) : undefined })} placeholder="Optional" className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Weight Unit</label>
 <select value={editItem.weight_unit || 'lbs'} onChange={e => setEditItem({ ...editItem, weight_unit: e.target.value as InventoryInput['weight_unit'] })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {weightUnitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Price</label>
 <input type="number" min="0" step="0.01" value={editItem.unit_price ?? ''} onChange={e => setEditItem({ ...editItem, unit_price: e.target.value ? Number(e.target.value) : undefined })} placeholder="Optional" className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Price Type</label>
 <select value={editItem.price_basis || 'per_unit'} onChange={e => setEditItem({ ...editItem, price_basis: e.target.value as InventoryInput['price_basis'] })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {priceBasisOptions.map((option) => <option key={option} value={option}>{option === 'per_weight' ? 'Per Weight' : 'Per Unit'}</option>)}
 </select>
 </div>

 <div className="md:col-span-2">
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Alert When Total Stock Falls Below</label>
 <select value={editItem.low_stock_threshold ?? 10} onChange={e => setEditItem({ ...editItem, low_stock_threshold: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {thresholdOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 <p className="font-sans text-sm text-gray-600 mt-2">The dashboard notice clears automatically after stock is replenished.</p>
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Current Pantry Stock</label>
 <input type="number" min="0" value={editItem.pantry_quantity} onChange={e => setEditItem({ ...editItem, pantry_quantity: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Current Grocery Stock</label>
 <input type="number" min="0" value={editItem.grocery_quantity} onChange={e => setEditItem({ ...editItem, grocery_quantity: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 </div>

 <div className="border-4 border-vt-ink p-6 bg-green-100/60 space-y-5">
 <div>
 <h3 className="font-serif text-2xl font-bold text-vt-ink uppercase">Add Stock</h3>
 <p className="font-sans text-gray-600 mt-1">Use this when more of this item arrives and should be added to inventory.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Add To Pantry</label>
 <input type="number" min="0" value={restock.addPantry} onChange={e => setRestock({ ...restock, addPantry: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Add To Grocery</label>
 <input type="number" min="0" value={restock.addGrocery} onChange={e => setRestock({ ...restock, addGrocery: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 </div>
 </div>

 <div className="border-4 border-vt-ink p-6 bg-red-100/70 space-y-5">
 <div>
 <h3 className="font-serif text-2xl font-bold text-vt-ink uppercase">Remove Stock</h3>
 <p className="font-sans text-gray-600 mt-1">Use this when food was distributed, damaged, expired, or counted down during a correction.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Remove From Pantry</label>
 <input type="number" min="0" value={restock.removePantry} onChange={e => setRestock({ ...restock, removePantry: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Remove From Grocery</label>
 <input type="number" min="0" value={restock.removeGrocery} onChange={e => setRestock({ ...restock, removeGrocery: Number(e.target.value) })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Why Is Stock Going Down?</label>
 <select value={restock.removeReason} onChange={e => setRestock({ ...restock, removeReason: e.target.value })} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all">
 {removalReasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
 </select>
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Notes</label>
 <textarea value={restock.notes} onChange={e => setRestock({ ...restock, notes: e.target.value })} rows={3} placeholder="Optional extra detail: weekly pantry distribution, damaged case, shelf recount..." className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-base text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all resize-none" />
 </div>
 </div>

 <div className="border-4 border-vt-ink p-5 bg-vt-ink text-vt-cream">
 <p className="font-mono text-xs font-bold uppercase tracking-widest mb-3">New Totals After Save</p>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <p className="font-mono text-sm uppercase text-vt-orange">Pantry</p>
 <p className="font-mono text-3xl font-bold">{Number(editItem.pantry_quantity || 0) + Number(restock.addPantry || 0) - Number(restock.removePantry || 0)}</p>
 </div>
 <div>
 <p className="font-mono text-sm uppercase text-vt-orange">Grocery</p>
 <p className="font-mono text-3xl font-bold">{Number(editItem.grocery_quantity || 0) + Number(restock.addGrocery || 0) - Number(restock.removeGrocery || 0)}</p>
 </div>
 </div>
 </div>

 {statusMessage ? (
 <div className={`border-4 border-vt-ink px-4 py-3 shadow-[4px_4px_0px_0px_#1A1516] ${statusMessage.includes('Failed') || statusMessage.includes('below zero') ? 'bg-red-200 text-vt-ink' : 'bg-green-300 text-vt-ink'}`}>
 <div className="flex items-start gap-3">
 <CheckCircle2 size={18} className="mt-0.5" />
 <p className="font-sans text-sm font-medium">{statusMessage}</p>
 </div>
 </div>
 ) : null}

 <div className="flex justify-end gap-4 border-t-4 border-vt-ink pt-6">
 <button type="button" onClick={() => setSelectedItem(null)} className="px-6 py-4 font-mono font-bold uppercase text-vt-ink border-4 border-vt-ink hover:bg-vt-ink hover:text-vt-cream transition-colors">Close</button>
 <button disabled={isSaving} type="submit" className="bg-vt-orange text-vt-ink border-4 border-vt-ink px-8 py-4 font-mono font-bold uppercase hover:bg-vt-orange-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all disabled:opacity-60 disabled:hover:translate-y-0">
 {isSaving ? 'Saving...' : 'Save Changes'}
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 <datalist id="inventory-vendors">
 {vendorOptions.map((vendor) => <option key={vendor} value={vendor} />)}
 </datalist>
 </>
 );
}
