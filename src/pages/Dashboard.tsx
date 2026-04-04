import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, Package, ArrowRightLeft, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { TransactionRecord } from '../types';

export default function Dashboard() {
 const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, recentTransfers: 0 });
 const [recentTransactions, setRecentTransactions] = useState<TransactionRecord[]>([]);

 useEffect(() => {
 const itemsUnsub = onSnapshot(collection(db, 'items'), (snapshot) => {
 let total = 0;
 let low = 0;
 snapshot.forEach((doc) => {
 const data = doc.data();
 total += (data.pantry_quantity || 0) + (data.grocery_quantity || 0);
 if ((data.pantry_quantity || 0) + (data.grocery_quantity || 0) < 10) {
 low++;
 }
 });
 setStats(s => ({ ...s, totalItems: total, lowStock: low }));
 });

 const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(5));
 const txUnsub = onSnapshot(txQuery, (snapshot) => {
 const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionRecord));
 setRecentTransactions(txs);
 setStats(s => ({ ...s, recentTransfers: txs.filter(t => t.type === 'transfer').length }));
 });

 return () => {
 itemsUnsub();
 txUnsub();
 };
 }, []);

 return (
 <div className="space-y-10">
 <div className="border-b-4 border-vt-ink pb-6">
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Dashboard</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">System Overview</p>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
 {/* Brutalist Card 1 */}
 <div className="bg-vt-cream p-6 border-4 border-vt-ink shadow-[8px_8px_0px_0px_#861F41] flex flex-col gap-4 hover:-translate-y-1 transition-transform">
 <div className="flex justify-between items-start border-b-2 border-vt-ink pb-4">
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink ">Total Items</p>
 <Package className="text-vt-maroon " size={24} />
 </div>
 <div>
 <p className="font-mono text-5xl font-bold text-vt-ink ">{stats.totalItems}</p>
 </div>
 </div>
 
 {/* Brutalist Card 2 */}
 <div className="bg-vt-cream p-6 border-4 border-vt-ink shadow-[8px_8px_0px_0px_#E87722] flex flex-col gap-4 hover:-translate-y-1 transition-transform">
 <div className="flex justify-between items-start border-b-2 border-vt-ink pb-4">
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink ">Low Stock</p>
 <AlertTriangle className="text-vt-orange " size={24} />
 </div>
 <div>
 <p className="font-mono text-5xl font-bold text-vt-ink ">{stats.lowStock}</p>
 </div>
 </div>

 {/* Brutalist Card 3 */}
 <div className="bg-vt-cream p-6 border-4 border-vt-ink shadow-[8px_8px_0px_0px_#1A1516] flex flex-col gap-4 hover:-translate-y-1 transition-transform">
 <div className="flex justify-between items-start border-b-2 border-vt-ink pb-4">
 <p className="font-mono text-sm font-bold uppercase tracking-widest text-vt-ink ">Transfers</p>
 <ArrowRightLeft className="text-vt-ink " size={24} />
 </div>
 <div>
 <p className="font-mono text-5xl font-bold text-vt-ink ">{stats.recentTransfers}</p>
 </div>
 </div>
 </div>

 {/* Activity Brutalist Panel */}
 <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#861F41] ">
 <div className="p-6 border-b-4 border-vt-ink bg-vt-maroon ">
 <h2 className="font-serif text-2xl font-bold text-vt-cream uppercase tracking-wide">Recent Activity Log</h2>
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
 'bg-gray-300 text-vt-ink'
 }`}>
 {tx.type === 'transfer' ? <ArrowRightLeft size={24} /> : <TrendingUp size={24} />}
 </div>
 <div>
 <p className="font-sans text-xl font-bold text-vt-ink uppercase">
 {tx.type} <span className="font-mono text-vt-maroon ">[{tx.quantity} units]</span>
 </p>
 <p className="font-mono text-sm text-gray-600 mt-1 uppercase">
 {tx.type === 'transfer' 
 ? `Path: ${tx.from_program} -> ${tx.to_program}`
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
 </div>
 );
}
