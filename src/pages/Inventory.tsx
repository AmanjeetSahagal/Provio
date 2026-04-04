import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, Package } from 'lucide-react';
import { InventoryInput, InventoryItem } from '../types';

export default function Inventory() {
 const [items, setItems] = useState<InventoryItem[]>([]);
 const [search, setSearch] = useState('');
 const [isAdding, setIsAdding] = useState(false);
 const [newItem, setNewItem] = useState<InventoryInput>({
 name: '',
 category: '',
 unit: 'items',
 pantry_quantity: 0,
 grocery_quantity: 0,
 });

 useEffect(() => {
 const unsub = onSnapshot(collection(db, 'items'), (snapshot) => {
 setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
 });
 return unsub;
 }, []);

 const handleAddItem = async (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const docRef = await addDoc(collection(db, 'items'), {
 ...newItem,
 pantry_quantity: Number(newItem.pantry_quantity),
 grocery_quantity: Number(newItem.grocery_quantity),
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 });
 
 await addDoc(collection(db, 'transactions'), {
 item_id: docRef.id,
 type: 'add',
 quantity: Number(newItem.pantry_quantity) + Number(newItem.grocery_quantity),
 timestamp: new Date().toISOString(),
 notes: 'Initial stock addition'
 });

 setIsAdding(false);
 setNewItem({ name: '', category: '', unit: 'items', pantry_quantity: 0, grocery_quantity: 0 });
 } catch (error) {
 console.error("Error adding item:", error);
 alert("Failed to add item");
 }
 };

 const filteredItems = items.filter(item => 
 item.name?.toLowerCase().includes(search.toLowerCase()) ||
 item.category?.toLowerCase().includes(search.toLowerCase())
 );

 return (
 <div className="space-y-10">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 border-b-4 border-vt-ink pb-6">
 <div>
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Inventory</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Database Records</p>
 </div>
 <button 
 onClick={() => setIsAdding(true)}
 className="bg-vt-maroon text-vt-cream border-4 border-vt-ink px-6 py-3 font-mono font-bold uppercase flex items-center gap-3 hover:bg-vt-maroon-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all"
 >
 <Plus size={24} />
 New Record
 </button>
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

 {isAdding && (
 <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#861F41] mb-10">
 <div className="border-b-4 border-vt-ink pb-4 mb-8">
 <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Initialize New Item</h2>
 </div>
 <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-2 gap-8">
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Item Designation</label>
 <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Classification</label>
 <input required type="text" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Unit Type</label>
 <input required type="text" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Pantry Qty</label>
 <input type="number" min="0" value={newItem.pantry_quantity} onChange={e => setNewItem({...newItem, pantry_quantity: Number(e.target.value)})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Grocery Qty</label>
 <input type="number" min="0" value={newItem.grocery_quantity} onChange={e => setNewItem({...newItem, grocery_quantity: Number(e.target.value)})} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-mono text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
 </div>
 </div>
 <div className="md:col-span-2 flex justify-end gap-6 mt-6 border-t-4 border-vt-ink pt-8">
 <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-4 font-mono font-bold uppercase text-vt-ink border-4 border-vt-ink hover:bg-vt-ink hover:text-vt-cream transition-colors">Abort</button>
 <button type="submit" className="bg-vt-orange text-vt-ink border-4 border-vt-ink px-10 py-4 font-mono font-bold uppercase hover:bg-vt-orange-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all">Commit Record</button>
 </div>
 </form>
 </div>
 )}

 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516] overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead className="bg-vt-maroon text-vt-cream border-b-4 border-vt-ink ">
 <tr>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Designation</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Class</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Pantry</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm border-r-4 border-vt-ink ">Grocery</th>
 <th className="p-6 font-mono font-bold uppercase tracking-widest text-sm">Total</th>
 </tr>
 </thead>
 <tbody className="divide-y-4 divide-vt-ink ">
 {filteredItems.map(item => (
 <tr key={item.id} className="hover:bg-vt-orange/10 transition-colors">
 <td className="p-6 border-r-4 border-vt-ink ">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-vt-cream border-2 border-vt-ink ">
 <Package size={24} className="text-vt-ink " />
 </div>
 <div>
 <p className="font-sans font-bold text-vt-ink text-xl">{item.name}</p>
 <p className="font-mono text-sm text-gray-600 mt-1 uppercase">{item.unit}</p>
 </div>
 </div>
 </td>
 <td className="p-6 border-r-4 border-vt-ink font-sans text-lg font-semibold text-gray-700 uppercase">{item.category}</td>
 <td className="p-6 border-r-4 border-vt-ink font-mono font-bold text-vt-ink text-2xl">{item.pantry_quantity || 0}</td>
 <td className="p-6 border-r-4 border-vt-ink font-mono font-bold text-vt-ink text-2xl">{item.grocery_quantity || 0}</td>
 <td className="p-6 font-mono font-extrabold text-vt-maroon text-3xl">{(item.pantry_quantity || 0) + (item.grocery_quantity || 0)}</td>
 </tr>
 ))}
 {filteredItems.length === 0 && (
 <tr>
 <td colSpan={5} className="p-16 text-center font-mono text-gray-500 text-xl uppercase tracking-widest">No records found.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 );
}
