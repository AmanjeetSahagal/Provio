import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Flag, History, Loader2, RotateCw, Boxes, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { CheckpointRecord, InventoryItem } from '../types';
import { createCheckpoint, createYearEndRollover } from '../services/checkpoints';

export default function Checkpoints() {
 const [checkpoints, setCheckpoints] = useState<CheckpointRecord[]>([]);
 const [isCreating, setIsCreating] = useState(false);
 const [isRollingOver, setIsRollingOver] = useState(false);
 const [items, setItems] = useState<InventoryItem[]>([]);
 const rolloverYear = String(new Date().getFullYear() + 1);

 useEffect(() => {
 const q = query(collection(db, 'checkpoints'), orderBy('created_at', 'desc'));
 const unsub = onSnapshot(q, (snapshot) => {
 setCheckpoints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckpointRecord)));
 });
 return unsub;
 }, []);

 useEffect(() => {
 const unsub = onSnapshot(collection(db, 'items'), (snapshot) => {
 setItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InventoryItem)));
 });
 return unsub;
 }, []);

 const handleCreateCheckpoint = async () => {
 if (!confirm("Are you sure you want to create a new baseline checkpoint? This will record the current state of all inventory.")) return;
 
 setIsCreating(true);
 try {
 await createCheckpoint();

 alert("Checkpoint created successfully!");
 } catch (error) {
 console.error("Error creating checkpoint:", error);
 alert("Failed to create checkpoint.");
 } finally {
 setIsCreating(false);
 }
 };

 const handleCreateRollover = async () => {
 if (!confirm(`Create the ${rolloverYear} year-end rollover baseline and log carry-forward transactions?`)) return;

 setIsRollingOver(true);
 try {
 await createYearEndRollover(rolloverYear);
 alert(`Rollover created for ${rolloverYear}.`);
 } catch (error) {
 console.error("Error creating rollover:", error);
 alert("Failed to create rollover.");
 } finally {
 setIsRollingOver(false);
 }
 };

 const pantryUnits = items.reduce((sum, item) => sum + Number(item.pantry_quantity || 0), 0);
 const groceryUnits = items.reduce((sum, item) => sum + Number(item.grocery_quantity || 0), 0);
 const totalUnits = pantryUnits + groceryUnits;
 const carryForwardItems = items.filter((item) => Number(item.pantry_quantity || 0) + Number(item.grocery_quantity || 0) > 0).length;
 const categoryTotals = Array.from(
 new Map(
 items.map((item) => [
 item.category || 'Uncategorized',
 0,
 ]),
 ),
 );

 items.forEach((item) => {
 const key = item.category || 'Uncategorized';
 const current = categoryTotals.find(([category]) => category === key);
 if (current) {
 current[1] += Number(item.pantry_quantity || 0) + Number(item.grocery_quantity || 0);
 }
 });

 const sortedCategoryTotals = categoryTotals
 .map(([category, total]) => ({ category, total }))
 .sort((a, b) => b.total - a.total)
 .slice(0, 4);

 const activeBaseline = checkpoints.find((checkpoint) => checkpoint.is_active_baseline) || checkpoints[0] || null;
 const activeBaselineMap = new Map(
 (activeBaseline?.baseline_items || []).map((item) => [item.item_id, item]),
 );
 const currentItemIds = new Set(items.map((item) => item.id));

 const changedItems = items.filter((item) => {
 const baselineItem = activeBaselineMap.get(item.id);
 if (!baselineItem) {
 return Number(item.pantry_quantity || 0) + Number(item.grocery_quantity || 0) > 0;
 }

 return (
 Number(item.pantry_quantity || 0) !== Number(baselineItem.pantry_qty || 0) ||
 Number(item.grocery_quantity || 0) !== Number(baselineItem.grocery_qty || 0)
 );
 }).length;

 const newItemsSinceBaseline = items.filter((item) => !activeBaselineMap.has(item.id)).length;
 const removedItemsSinceBaseline = (activeBaseline?.baseline_items || []).filter((item) => !currentItemIds.has(item.item_id)).length;

 return (
 <div className="space-y-10 max-w-6xl mx-auto">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 border-b-4 border-vt-ink pb-6">
 <div>
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Checkpoints</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Baselines, Audits, And Year-End Carry Forward</p>
 </div>
 <div className="flex flex-col sm:flex-row gap-4">
 <button 
 onClick={handleCreateCheckpoint}
 disabled={isCreating}
 className="bg-vt-maroon text-vt-cream border-4 border-vt-ink px-8 py-5 font-mono font-bold uppercase flex items-center gap-4 hover:bg-vt-maroon-dark hover:-translate-y-1 shadow-[8px_8px_0px_0px_#1A1516] transition-all disabled:opacity-50 disabled:hover:translate-y-0"
 >
 {isCreating ? <Loader2 className="animate-spin" size={28} /> : <Flag size={28} />}
 Save Checkpoint
 </button>
 <button 
 onClick={handleCreateRollover}
 disabled={isRollingOver}
 className="bg-vt-orange text-vt-ink border-4 border-vt-ink px-8 py-5 font-mono font-bold uppercase flex items-center gap-4 hover:bg-vt-orange-dark hover:-translate-y-1 shadow-[8px_8px_0px_0px_#1A1516] transition-all disabled:opacity-50 disabled:hover:translate-y-0"
 >
 {isRollingOver ? <Loader2 className="animate-spin" size={28} /> : <RotateCw size={28} />}
 Run {rolloverYear} Rollover
 </button>
 </div>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516] p-8 space-y-6">
 <div className="border-b-4 border-vt-ink pb-5">
 <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Active Baseline</h2>
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-600 mt-3">Current comparison starting point</p>
 </div>
 {activeBaseline ? (
 <div className="space-y-6">
 <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
 <div>
 <p className="font-serif text-3xl font-bold text-vt-ink uppercase">{activeBaseline.label || 'Baseline snapshot'}</p>
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-600 mt-3">
 Active since {format(new Date(activeBaseline.created_at), 'MMMM d, yyyy HH:mm')}
 </p>
 {activeBaseline.notes ? <p className="font-sans text-base text-gray-700 mt-4 max-w-3xl">{activeBaseline.notes}</p> : null}
 </div>
 <span className="px-6 py-3 bg-green-400 text-vt-ink border-4 border-vt-ink font-mono font-bold text-lg uppercase tracking-widest shadow-[4px_4px_0px_0px_#1A1516]">
 Active Baseline
 </span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Changed Items</p>
 <p className="font-serif text-4xl font-bold text-vt-ink mt-3">{changedItems}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">New Items</p>
 <p className="font-serif text-4xl font-bold text-vt-ink mt-3">{newItemsSinceBaseline}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Missing From Current Inventory</p>
 <p className="font-serif text-4xl font-bold text-vt-ink mt-3">{removedItemsSinceBaseline}</p>
 </div>
 </div>
 </div>
 ) : (
 <div className="border-4 border-dashed border-vt-ink bg-white p-8 text-center font-mono text-sm uppercase tracking-widest text-gray-500">
 No active baseline yet. Save a checkpoint to start formal comparisons.
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-8">
 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#861F41] p-8 space-y-6">
 <div className="border-b-4 border-vt-ink pb-5">
 <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Rollover Preview</h2>
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-600 mt-3">What moves into {rolloverYear}</p>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Items In System</p>
 <p className="font-serif text-4xl font-bold text-vt-ink mt-3">{items.length}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Items Carried</p>
 <p className="font-serif text-4xl font-bold text-vt-ink mt-3">{carryForwardItems}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Total Units</p>
 <p className="font-serif text-4xl font-bold text-vt-ink mt-3">{totalUnits}</p>
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="border-4 border-vt-ink bg-white p-5 flex items-center gap-4">
 <Boxes size={26} className="text-vt-maroon shrink-0" />
 <div>
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Pantry Units</p>
 <p className="font-sans text-2xl font-bold text-vt-ink">{pantryUnits}</p>
 </div>
 </div>
 <div className="border-4 border-vt-ink bg-white p-5 flex items-center gap-4">
 <Archive size={26} className="text-vt-orange shrink-0" />
 <div>
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Grocery Units</p>
 <p className="font-sans text-2xl font-bold text-vt-ink">{groceryUnits}</p>
 </div>
 </div>
 </div>
 <div className="space-y-3">
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink">Top Categories Carrying Forward</p>
 {sortedCategoryTotals.length === 0 ? (
 <div className="border-4 border-dashed border-vt-ink bg-white p-6 text-center font-mono text-sm uppercase tracking-widest text-gray-500">
 No inventory is loaded yet.
 </div>
 ) : (
 sortedCategoryTotals.map(({ category, total }) => (
 <div key={category} className="border-4 border-vt-ink bg-white px-5 py-4 flex items-center justify-between">
 <span className="font-sans text-lg font-bold text-vt-ink">{category}</span>
 <span className="font-mono text-xl font-bold text-vt-maroon">{total}</span>
 </div>
 ))
 )}
 </div>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#E87722] p-8 space-y-5">
 <div className="border-b-4 border-vt-ink pb-5">
 <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">What Rollover Does</h2>
 </div>
 <div className="space-y-4 font-sans text-gray-700">
 <p>Creates a new baseline checkpoint for the next operating year.</p>
 <p>Preserves every current pantry and grocery quantity as the carry-forward starting point.</p>
 <p>Logs rollover transactions so the carry-forward is visible in the activity history.</p>
 <p>Does not zero out inventory. It records the current state as the new starting baseline.</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-5">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Rollover Output</p>
 <p className="font-sans text-base font-bold text-vt-ink mt-3">Summary totals, category breakdown, baseline snapshot, and per-item rollover log entries.</p>
 </div>
 </div>
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
 {cp.label || format(new Date(cp.created_at), 'MMMM d, yyyy')}
 </h3>
 <p className="font-mono text-lg text-gray-600 font-bold mt-2 uppercase tracking-widest">
 {format(new Date(cp.created_at), 'MMMM d, yyyy HH:mm:ss')} // <span className="text-vt-maroon ">{cp.baseline_items?.length || 0} RECORDS</span>
 </p>
 {cp.notes ? <p className="font-sans text-base text-gray-700 mt-3 max-w-3xl">{cp.notes}</p> : null}
 </div>
 <span className={`px-6 py-3 text-vt-ink border-4 border-vt-ink font-mono font-bold text-lg uppercase tracking-widest shadow-[4px_4px_0px_0px_#1A1516] ${
 cp.is_active_baseline ? 'bg-green-400' : cp.type === 'rollover' ? 'bg-vt-orange' : 'bg-vt-cream'
 }`}>
 {cp.is_active_baseline ? 'Active Baseline' : cp.type === 'rollover' ? 'Year-End Rollover' : 'Baseline Verified'}
 </span>
 </div>

 {cp.summary ? (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
 <div className="border-4 border-vt-ink bg-white p-4">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Total Items</p>
 <p className="font-serif text-3xl font-bold text-vt-ink mt-2">{cp.summary.total_items}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-4">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Carried Forward</p>
 <p className="font-serif text-3xl font-bold text-vt-ink mt-2">{cp.summary.items_carried_forward}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-4">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Total Units</p>
 <p className="font-serif text-3xl font-bold text-vt-ink mt-2">{cp.summary.total_units}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-4">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Pantry</p>
 <p className="font-serif text-3xl font-bold text-vt-ink mt-2">{cp.summary.pantry_units}</p>
 </div>
 <div className="border-4 border-vt-ink bg-white p-4">
 <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Grocery</p>
 <p className="font-serif text-3xl font-bold text-vt-ink mt-2">{cp.summary.grocery_units}</p>
 </div>
 </div>
 ) : null}
 
 <div className="bg-vt-cream border-4 border-vt-ink p-2 max-h-96 overflow-y-auto shadow-inner">
 <table className="w-full text-left">
 <thead className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink bg-vt-cream sticky top-0 border-b-4 border-vt-ink ">
 <tr>
 <th className="p-5 border-r-4 border-vt-ink ">Designation</th>
 <th className="p-5 border-r-4 border-vt-ink ">Category</th>
 <th className="p-5 border-r-4 border-vt-ink ">Pantry Vol</th>
 <th className="p-5">Grocery Vol</th>
 </tr>
 </thead>
 <tbody className="divide-y-2 divide-vt-ink/20 font-mono">
 {cp.baseline_items?.map((item, idx: number) => (
 <tr key={idx} className="hover:bg-vt-orange/10 transition-colors">
 <td className="p-5 font-bold text-vt-ink text-lg border-r-2 border-vt-ink/20 ">{item.name}</td>
 <td className="p-5 text-gray-700 text-lg border-r-2 border-vt-ink/20 ">{item.category || 'Uncategorized'}</td>
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
