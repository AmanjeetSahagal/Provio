import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ArrowRightLeft, Search } from 'lucide-react';
import { InventoryItem } from '../types';

export default function Transfers() {
 const [items, setItems] = useState<InventoryItem[]>([]);
 const [search, setSearch] = useState('');
 const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
 const [transferAmount, setTransferAmount] = useState(0);
 const [direction, setDirection] = useState<'pantry_to_grocery' | 'grocery_to_pantry'>('pantry_to_grocery');

 useEffect(() => {
 const unsub = onSnapshot(collection(db, 'items'), (snapshot) => {
 setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
 });
 return unsub;
 }, []);

 const handleTransfer = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedItem || transferAmount <= 0) return;

 const isP2G = direction === 'pantry_to_grocery';
 
 // Validate stock
 if (isP2G && selectedItem.pantry_quantity < transferAmount) {
 alert("Not enough stock in Pantry");
 return;
 }
 if (!isP2G && selectedItem.grocery_quantity < transferAmount) {
 alert("Not enough stock in Grocery");
 return;
 }

 try {
 const itemRef = doc(db, 'items', selectedItem.id);
 await updateDoc(itemRef, {
 pantry_quantity: isP2G 
 ? selectedItem.pantry_quantity - transferAmount 
 : selectedItem.pantry_quantity + transferAmount,
 grocery_quantity: isP2G 
 ? selectedItem.grocery_quantity + transferAmount 
 : selectedItem.grocery_quantity - transferAmount,
 updated_at: new Date().toISOString()
 });

 await addDoc(collection(db, 'transactions'), {
 item_id: selectedItem.id,
 type: 'transfer',
 quantity: transferAmount,
 from_program: isP2G ? 'pantry' : 'grocery',
 to_program: isP2G ? 'grocery' : 'pantry',
 timestamp: new Date().toISOString(),
 });

 setSelectedItem(null);
 setTransferAmount(0);
 alert("Transfer successful!");
 } catch (error) {
 console.error("Transfer failed:", error);
 alert("Transfer failed.");
 }
 };

 const filteredItems = items.filter(item => 
 item.name?.toLowerCase().includes(search.toLowerCase())
 );

 return (
 <div className="space-y-10">
 <div className="border-b-4 border-vt-ink pb-6">
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Program Transfers</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Cross-Program Logistics</p>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
 {/* Item Selection */}
 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516] flex flex-col h-[700px]">
 <div className="p-6 border-b-4 border-vt-ink bg-vt-orange">
 <div className="flex items-center gap-4 bg-vt-cream p-4 border-4 border-vt-ink shadow-[4px_4px_0px_0px_#1A1516] ">
 <Search className="text-vt-ink " size={28} />
 <input 
 type="text"
 placeholder="SEARCH INVENTORY..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="flex-1 bg-transparent outline-none text-vt-ink font-mono text-lg uppercase placeholder-gray-400 "
 />
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-vt-cream ">
 {filteredItems.map(item => (
 <button
 key={item.id}
 onClick={() => setSelectedItem(item)}
 className={`w-full text-left p-6 border-4 transition-all ${
 selectedItem?.id === item.id 
 ? 'bg-vt-maroon text-vt-cream border-vt-ink shadow-[6px_6px_0px_0px_#1A1516] translate-x-1' 
 : 'bg-vt-cream text-vt-ink border-vt-ink hover:shadow-[6px_6px_0px_0px_#E87722] hover:-translate-y-1'
 }`}
 >
 <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
 <div>
 <p className="font-sans font-bold text-2xl">{item.name}</p>
 <p className="font-mono text-sm font-bold uppercase tracking-widest mt-2 opacity-80">{item.category}</p>
 </div>
 <div className={`font-mono text-sm font-bold border-2 p-3 ${selectedItem?.id === item.id ? 'border-vt-cream bg-vt-maroon-dark' : 'border-vt-ink bg-vt-cream '}`}>
 <p className="mb-2">PANTRY: <span className="text-xl ml-2">{item.pantry_quantity}</span></p>
 <p>GROCERY: <span className="text-xl ml-2">{item.grocery_quantity}</span></p>
 </div>
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* Transfer Form */}
 <div className="bg-vt-cream border-4 border-vt-ink p-8 lg:p-10 shadow-[12px_12px_0px_0px_#861F41] h-fit">
 <h2 className="font-serif text-3xl font-bold text-vt-ink mb-10 flex items-center gap-4 uppercase border-b-4 border-vt-ink pb-6">
 <ArrowRightLeft className="text-vt-orange" size={36} />
 Execute Transfer
 </h2>

 {!selectedItem ? (
 <div className="text-center py-20 border-4 border-dashed border-vt-ink bg-vt-cream ">
 <ArrowRightLeft size={64} className="mx-auto mb-6 text-gray-300 " />
 <p className="font-mono text-xl font-bold uppercase tracking-widest text-gray-500 ">Awaiting Selection</p>
 </div>
 ) : (
 <form onSubmit={handleTransfer} className="space-y-10">
 <div className="p-8 bg-vt-cream border-4 border-vt-ink shadow-[6px_6px_0px_0px_#1A1516] ">
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">Target Asset</p>
 <p className="font-serif text-4xl font-bold text-vt-ink ">{selectedItem.name}</p>
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-4">Vector</label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
 <button
 type="button"
 onClick={() => setDirection('pantry_to_grocery')}
 className={`p-6 border-4 font-mono font-bold uppercase tracking-wider transition-all ${
 direction === 'pantry_to_grocery'
 ? 'bg-vt-maroon text-vt-cream border-vt-ink shadow-[6px_6px_0px_0px_#1A1516] '
 : 'bg-vt-cream text-vt-ink border-vt-ink hover:bg-vt-orange/10'
 }`}
 >
 Pantry → Grocery
 </button>
 <button
 type="button"
 onClick={() => setDirection('grocery_to_pantry')}
 className={`p-6 border-4 font-mono font-bold uppercase tracking-wider transition-all ${
 direction === 'grocery_to_pantry'
 ? 'bg-vt-orange text-vt-ink border-vt-ink shadow-[6px_6px_0px_0px_#1A1516] '
 : 'bg-vt-cream text-vt-ink border-vt-ink hover:bg-vt-orange/10'
 }`}
 >
 Grocery → Pantry
 </button>
 </div>
 </div>

 <div>
 <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-4">Volume</label>
 <input 
 type="number" 
 min="1"
 required
 value={transferAmount || ''}
 onChange={e => setTransferAmount(Number(e.target.value))}
 className="w-full bg-vt-cream border-4 border-vt-ink p-6 font-mono text-4xl font-bold text-vt-ink focus:ring-4 focus:ring-vt-orange outline-none transition-all"
 />
 <div className="mt-4 flex items-center gap-4 font-mono text-sm font-bold uppercase tracking-widest text-vt-ink bg-vt-orange/20 p-4 border-2 border-vt-orange">
 <span>Available Source Volume:</span>
 <span className="text-2xl">
 {direction === 'pantry_to_grocery' ? selectedItem.pantry_quantity : selectedItem.grocery_quantity}
 </span>
 </div>
 </div>

 <button 
 type="submit"
 className="w-full bg-vt-ink text-vt-cream border-4 border-vt-ink p-6 font-mono font-bold text-xl uppercase tracking-widest hover:bg-vt-maroon hover:text-vt-cream transition-all shadow-[8px_8px_0px_0px_#861F41] hover:-translate-y-1 flex justify-center items-center gap-4"
 >
 <ArrowRightLeft size={28} />
 Authorize Transfer
 </button>
 </form>
 )}
 </div>
 </div>
 </div>
 );
}
