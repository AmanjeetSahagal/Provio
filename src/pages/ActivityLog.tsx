import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowLeft, ArrowRightLeft, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '../firebase';
import { TransactionRecord } from '../types';

export default function ActivityLog() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  useEffect(() => {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(txQuery, (snapshot) => {
      setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TransactionRecord)));
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-10">
      <div className="border-b-4 border-vt-ink pb-6">
        <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Activity Log</h1>
        <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Full transaction history</p>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-3 border-4 border-vt-ink bg-vt-cream px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest text-vt-ink shadow-[4px_4px_0px_0px_#861F41] hover:bg-vt-orange hover:-translate-y-1 transition-all"
      >
        <ArrowLeft size={18} />
        Back To Dashboard
      </Link>

      <div className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516]">
        <div className="p-6 border-b-4 border-vt-ink bg-vt-maroon">
          <h2 className="font-serif text-2xl font-bold text-vt-cream uppercase tracking-wide">All Recent Activity</h2>
        </div>
        <div className="divide-y-4 divide-vt-ink">
          {transactions.length === 0 ? (
            <div className="p-10 text-center font-mono text-gray-500 uppercase">No recent activity detected.</div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-vt-orange/10 transition-colors">
                <div className="flex items-center gap-6">
                  <div
                    className={`p-4 border-2 border-vt-ink ${
                      tx.type === 'transfer' ? 'bg-vt-orange text-vt-ink' : tx.type === 'add' ? 'bg-green-400 text-vt-ink' : tx.type === 'remove' ? 'bg-red-300 text-vt-ink' : 'bg-gray-300 text-vt-ink'
                    }`}
                  >
                    {tx.type === 'transfer' ? <ArrowRightLeft size={24} /> : <TrendingUp size={24} />}
                  </div>
                  <div>
                    <p className="font-sans text-xl font-bold text-vt-ink uppercase">
                      {tx.type === 'rollover' ? 'year-end rollover' : tx.type === 'remove' ? 'stock removed' : tx.type} <span className="font-mono text-vt-maroon">[{tx.quantity} units]</span>
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
                <div className="font-mono text-sm font-bold text-vt-ink border-2 border-vt-ink px-4 py-2 bg-vt-cream shadow-[4px_4px_0px_0px_#1A1516]">
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
