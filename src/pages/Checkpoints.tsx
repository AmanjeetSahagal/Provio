import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Flag, History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { CheckpointRecord } from '../types';

export default function Checkpoints() {
 const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
 const [isCreating, setIsCreating] = useState(false);

 useEffect(() => {
 const q = query(collection(db, 'checkpoints'), orderBy('created_at', 'desc'));
 const unsub = onSnapshot(q, (snapshot) => {
 setCheckpoints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckpointRecord)));
 });
 return unsub;
 }, []);

 const handleCreateCheckpoint = async () => {
 if (!confirm("Are you sure you want to create a new baseline checkpoint? This will record the current state of all inventory.")) return;
 
 setIsCreating(true);
 try {
 const itemsSnapshot = await getDocs(collection(db, 'items'));
 const baselineItems = itemsSnapshot.docs.map(doc => {
 const data = doc.data();
 return {
 item_id: doc.id,
 name: data.name,
 pantry_qty: data.pantry_quantity || 0,
 grocery_qty: data.grocery_quantity || 0
 };
 });

 await addDoc(collection(db, 'checkpoints'), {
 created_at: new Date().toISOString(),
 baseline_items: baselineItems
 });

 alert("Checkpoint created successfully!");
 } catch (error) {
 console.error("Error creating checkpoint:", error);
 alert("Failed to create checkpoint.");
 } finally {
 setIsCreating(false);
 }
 };

 return (
 <div className="space-y-10 max-w-6xl mx-auto">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b-4 border-vt-ink pb-6">
 <div>
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Checkpoints</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Baseline Snapshots & Audits</p>
 </div>
 <button 
 onClick={handleCreateCheckpoint}
 disabled={isCreating}
 className="bg-vt-maroon text-vt-cream border-4 border-vt-ink px-8 py-5 font-mono font-bold uppercase flex items-center gap-4 hover:bg-vt-maroon-dark hover:-translate-y-1 shadow-[8px_8px_0px_0px_#1A1516] transition-all disabled:opacity-50 disabled:hover:translate-y-0"
 >
 {isCreating ? <Loader2 className="animate-spin" size={28} /> : <Flag size={28} />}
 Initialize Checkpoint
 </button>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#861F41] overflow-hidden">
 <div className="p-8 border-b-4 border-vt-ink bg-vt-orange flex items-center gap-4">
 <div className="p-3 bg-vt-ink text-vt-cream border-2 border-vt-ink">
 <History size={28} />
 </div>
 <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">System History</h2>
 </div>
 <div className="divide-y-4 divide-vt-ink ">
 {checkpoints.length === 0 ? (
 <div className="p-16 text-center font-mono text-gray-500 text-xl uppercase tracking-widest">No checkpoints initialized.</div>
 ) : (
 checkpoints.map((cp) => (
 <div key={cp.id} className="p-10 hover:bg-vt-orange/10 transition-colors">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
 <div>
 <h3 className="font-serif font-bold text-vt-ink text-4xl">
 {format(new Date(cp.created_at), 'MMMM d, yyyy')}
 </h3>
 <p className="font-mono text-lg text-gray-600 font-bold mt-2 uppercase tracking-widest">
 {format(new Date(cp.created_at), 'HH:mm:ss')} // <span className="text-vt-maroon ">{cp.baseline_items?.length || 0} RECORDS</span>
 </p>
 </div>
 <span className="px-6 py-3 bg-green-400 text-vt-ink border-4 border-vt-ink font-mono font-bold text-lg uppercase tracking-widest shadow-[4px_4px_0px_0px_#1A1516] ">
 Baseline Verified
 </span>
 </div>
 
 <div className="bg-vt-cream border-4 border-vt-ink p-2 max-h-96 overflow-y-auto shadow-inner">
 <table className="w-full text-left">
 <thead className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink bg-vt-cream sticky top-0 border-b-4 border-vt-ink ">
 <tr>
 <th className="p-5 border-r-4 border-vt-ink ">Designation</th>
 <th className="p-5 border-r-4 border-vt-ink ">Pantry Vol</th>
 <th className="p-5">Grocery Vol</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-vt-ink/20 font-mono">
 {cp.baseline_items?.map((item, idx: number) => (
 <tr key={idx} className="hover:bg-vt-orange/10 transition-colors">
 <td className="p-5 font-bold text-vt-ink text-lg border-r-2 border-vt-ink/20 ">{item.name}</td>
 <td className="p-5 text-gray-700 text-xl border-r-2 border-vt-ink/20 ">{item.pantry_qty}</td>
 <td className="p-5 text-gray-700 text-xl">{item.grocery_qty}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 );
}
