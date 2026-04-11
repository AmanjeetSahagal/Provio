import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { format } from 'date-fns';
import { AlertRecord, InventoryItem, TransactionRecord } from '../types';

export default function Dashboard() {
 const [categoryTotals, setCategoryTotals] = useState<Array<{ category: string; total: number }>>([]);
 const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);
 const [alerts, setAlerts] = useState<AlertRecord[]>([]);

 useEffect(() => {
 const itemsUnsub = onSnapshot(collection(db, 'items'), (snapshot) => {
 const totalsByCategory = new Map<string, number>();
 snapshot.docs.forEach((doc) => {
 const data = doc.data() as InventoryItem;
 const total = Number(data.pantry_quantity || 0) + Number(data.grocery_quantity || 0);
 const category = data.category || 'Uncategorized';
 totalsByCategory.set(category, (totalsByCategory.get(category) || 0) + total);
 });
 setCategoryTotals(
 Array.from(totalsByCategory.entries())
 .map(([category, total]) => ({ category, total }))
 .sort((a, b) => b.total - a.total),
 );
 });

 const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(3));
 const txUnsub = onSnapshot(txQuery, (snapshot) => {
 const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionRecord));
 setRecentTransactions(txs);
 });

 const alertsQuery = query(collection(db, 'alerts'), where('resolved', '==', false), orderBy('created_at', 'desc'));
 const alertsUnsub = onSnapshot(alertsQuery, (snapshot) => {
 setAlerts(snapshot.docs.map((alert) => ({ id: alert.id, ...alert.data() } as AlertRecord)));
 });

 return () => {
 itemsUnsub();
 txUnsub();
 alertsUnsub();
 };
 }, []);

 return (
 <div className="space-y-10">
 <div className="border-b-4 border-vt-ink pb-6">
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Dashboard</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Today&apos;s overview</p>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516] ">
 <div className="p-6 border-b-4 border-vt-ink bg-vt-maroon flex flex-col md:flex-row md:items-center md:justify-between gap-4">
 <h2 className="font-serif text-2xl font-bold text-vt-cream uppercase tracking-wide">Recent Activity Log</h2>
 <Link
 to="/activity"
 className="inline-flex items-center justify-center border-4 border-vt-cream bg-vt-cream px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-vt-maroon hover:bg-vt-orange hover:text-vt-ink transition-colors"
 >
 View Full Log
 </Link>
 </div>
 <div className="divide-y-4 divide-vt-ink ">
 {recentTransactions.length === 0 ? (
 <div className="p-10 text-center font-mono text-gray-500 uppercase">No recent activity detected.</div>
 ) : (
 recentTransactions.map((tx) => (
 <div key={tx.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-vt-orange/10 transition-colors">
 <div className="flex items-center gap-6">
 <div className={`p-4 border-2 border-vt-ink ${
 tx.type === 'transfer' ? 'bg-vt-orange text-vt-ink' :
 tx.type === 'add' ? 'bg-green-400 text-vt-ink' :
 tx.type === 'remove' ? 'bg-red-300 text-vt-ink' :
 'bg-gray-300 text-vt-ink'
 }`}>
 {tx.type === 'transfer' ? <ArrowRightLeft size={24} /> : <TrendingUp size={24} />}
 </div>
 <div>
 <p className="font-sans text-xl font-bold text-vt-ink uppercase">
 {tx.type === 'rollover' ? 'year-end rollover' : tx.type === 'remove' ? 'stock removed' : tx.type} <span className="font-mono text-vt-maroon ">[{tx.quantity} units]</span>
 </p>
 <p className="font-mono text-sm text-gray-600 mt-1 uppercase">
 {tx.vendor ? `Vendor: ${tx.vendor} // ` : ''}
 {tx.type === 'transfer'
 ? `Path: ${tx.from_program} -> ${tx.to_program}`
 : tx.type === 'remove'
 ? tx.notes || 'Inventory reduced'
 : tx.type === 'rollover'
 ? tx.notes || 'Carry-forward baseline recorded'
 : `Dest: ${tx.to_program || 'inventory'}`}
 </p>
 </div>
 </div>
 <div className="font-mono text-sm font-bold text-vt-ink border-2 border-vt-ink px-4 py-2 bg-vt-cream shadow-[4px_4px_0px_0px_#1A1516] ">
 {tx.timestamp ? format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm') : ''}
 </div>
 </div>
 ))
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
 <div className="bg-vt-cream border-4 border-vt-ink shadow-[8px_8px_0px_0px_#861F41] h-full p-6 space-y-5">
 <div className="border-b-2 border-vt-ink pb-4">
 <h2 className="font-serif text-2xl font-bold text-vt-ink uppercase tracking-wide">Stock By Category</h2>
 <p className="font-sans text-sm text-gray-600 mt-2">Use this to explain where most pantry volume is currently sitting.</p>
 </div>
 <div className="space-y-4">
 {categoryTotals.length === 0 ? (
 <div className="border-2 border-vt-ink bg-white px-4 py-5 text-center font-mono text-sm font-bold uppercase tracking-widest text-gray-500">
 No inventory yet.
 </div>
 ) : (
 categoryTotals.slice(0, 6).map(({ category, total }) => (
 <div key={category} className="flex items-center justify-between gap-4 border-2 border-vt-ink bg-white px-4 py-4">
 <span className="font-sans font-bold text-vt-ink">{category}</span>
 <span className="font-mono text-xl font-bold text-vt-maroon">{total}</span>
 </div>
 ))
 )}
 </div>
 </div>
 <div className="bg-vt-cream border-4 border-vt-ink shadow-[8px_8px_0px_0px_#E87722] h-full p-6 space-y-5">
 <div className="border-b-2 border-vt-ink pb-4">
 <h2 className="font-serif text-2xl font-bold text-vt-ink uppercase tracking-wide">Restock Notices</h2>
 <p className="font-sans text-sm text-gray-600 mt-2">These notices clear automatically after stock is replenished.</p>
 </div>
 <div className="space-y-4">
 {alerts.length === 0 ? (
 <div className="border-2 border-vt-ink bg-white px-4 py-5 text-center font-mono text-sm font-bold uppercase tracking-widest text-gray-500">
 No items need attention right now.
 </div>
 ) : (
 alerts.slice(0, 6).map((alert) => (
 <div key={alert.id} className="border-2 border-vt-ink bg-white px-4 py-4">
 <div className="flex items-start gap-4">
 <AlertTriangle className="text-vt-orange shrink-0 mt-1" size={22} />
 <div>
 <p className="font-sans text-base font-bold text-vt-ink">{alert.message}</p>
 <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mt-2">{format(new Date(alert.created_at), 'yyyy-MM-dd HH:mm')}</p>
 <p className="font-sans text-sm text-gray-600 mt-2">This notice clears automatically after the item is restocked.</p>
 </div>
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
