import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { FileText, ReceiptText, Search } from 'lucide-react';
import { db } from '../firebase';
import { InvoiceRecord } from '../types';

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  useEffect(() => {
    const invoiceQuery = query(collection(db, 'invoices'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(invoiceQuery, (snapshot) => {
      const nextInvoices = snapshot.docs.map((invoice) => ({ id: invoice.id, ...invoice.data() } as InvoiceRecord));
      setInvoices(nextInvoices);
      setSelectedInvoiceId((current) => current || nextInvoices[0]?.id || '');
    });
    return unsub;
  }, []);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const isApproved = !invoice.status || invoice.status === 'saved';
        if (!isApproved) {
          return false;
        }
        const needle = search.toLowerCase();
        return (
          invoice.vendor?.toLowerCase().includes(needle) ||
          invoice.date?.toLowerCase().includes(needle) ||
          invoice.file_name?.toLowerCase().includes(needle)
        );
      }),
    [invoices, search],
  );

  const selectedInvoice =
    filteredInvoices.find((invoice) => invoice.id === selectedInvoiceId) || filteredInvoices[0] || null;

  return (
    <div className="space-y-10">
      <div className="border-b-4 border-vt-ink pb-6">
        <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Invoices</h1>
        <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Past uploads and approved invoice records</p>
      </div>

      <div className="bg-vt-cream border-4 border-vt-ink p-4 shadow-[8px_8px_0px_0px_#E87722] flex items-center gap-4">
        <Search className="text-vt-ink ml-2" size={28} />
        <input
          type="text"
          placeholder="SEARCH BY VENDOR, DATE, OR FILE..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-vt-ink font-mono text-xl placeholder-gray-400 uppercase"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-10 items-start">
        <aside className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#1A1516] overflow-hidden">
          <div className="p-6 border-b-4 border-vt-ink bg-vt-maroon text-vt-cream">
            <h2 className="font-serif text-3xl font-bold uppercase">Invoice History</h2>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y-4 divide-vt-ink">
            {filteredInvoices.length === 0 ? (
              <div className="p-10 text-center font-mono text-gray-500 uppercase tracking-widest">No invoices found.</div>
            ) : (
              filteredInvoices.map((invoice) => (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                  className={`w-full text-left p-6 transition-colors ${
                    selectedInvoice?.id === invoice.id ? 'bg-vt-orange/20' : 'bg-vt-cream hover:bg-vt-orange/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-sans text-xl font-bold text-vt-ink">{invoice.vendor || 'Unknown vendor'}</p>
                      <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">
                        {invoice.date} // {invoice.transaction_count || invoice.items?.length || 0} linked lines
                      </p>
                      {invoice.file_name ? (
                        <p className="font-mono text-xs uppercase tracking-widest text-vt-maroon mt-2">{invoice.file_name}</p>
                      ) : null}
                    </div>
                    <span className="border-2 border-vt-ink px-3 py-1 bg-white font-mono text-xs font-bold uppercase tracking-widest text-vt-ink">
                      {invoice.status || 'saved'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="bg-vt-cream border-4 border-vt-ink shadow-[12px_12px_0px_0px_#861F41] p-8">
          {!selectedInvoice ? (
            <div className="min-h-[420px] flex flex-col items-center justify-center text-center border-4 border-dashed border-vt-ink p-8 bg-vt-orange/10">
              <ReceiptText size={56} className="text-vt-maroon mb-5" />
              <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase mb-3">Choose An Invoice</h2>
              <p className="font-sans text-gray-600 max-w-sm">
                Select an invoice from the history list to inspect the approved line items and audit links.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="border-b-4 border-vt-ink pb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div>
                  <h2 className="font-serif text-4xl font-bold text-vt-ink uppercase">{selectedInvoice.vendor || 'Unknown vendor'}</h2>
                  <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-500 mt-3">
                    {selectedInvoice.date} // {selectedInvoice.created_at.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border-4 border-vt-ink bg-white px-4 py-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Status</p>
                    <p className="font-sans font-bold text-vt-ink mt-2">{selectedInvoice.status || 'saved'}</p>
                  </div>
                  <div className="border-4 border-vt-ink bg-white px-4 py-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">File</p>
                    <p className="font-sans font-bold text-vt-ink mt-2">{selectedInvoice.file_name || 'No file'}</p>
                  </div>
                  <div className="border-4 border-vt-ink bg-white px-4 py-3">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Linked Entries</p>
                    <p className="font-sans font-bold text-vt-ink mt-2">{selectedInvoice.transaction_count || selectedInvoice.items?.length || 0}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedInvoice.items?.length ? (
                  selectedInvoice.items.map((item, idx) => (
                    <div key={`${selectedInvoice.id}-${idx}`} className="border-4 border-vt-ink bg-white p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                          <p className="font-sans text-xl font-bold text-vt-ink">{item.name}</p>
                          <div className="flex flex-wrap gap-3 mt-3">
                            <span className="border-2 border-vt-ink px-3 py-1 bg-vt-orange font-mono text-xs font-bold uppercase tracking-widest text-vt-ink">
                              {item.quantity} {item.unit}
                            </span>
                            <span className="border-2 border-vt-ink px-3 py-1 bg-white font-mono text-xs font-bold uppercase tracking-widest text-vt-ink">
                              {item.program}
                            </span>
                            <span className="border-2 border-vt-ink px-3 py-1 bg-white font-mono text-xs font-bold uppercase tracking-widest text-vt-ink">
                              {item.category}
                            </span>
                            {item.source_line ? (
                              <span className="border-2 border-vt-ink px-3 py-1 bg-white font-mono text-xs font-bold uppercase tracking-widest text-vt-ink">
                                Source captured
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
                            Item Link: {item.linked_item_id || 'not linked'}
                          </p>
                          <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
                            Tx Link: {item.transaction_id || 'not linked'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="border-4 border-dashed border-vt-ink bg-white p-8 text-center">
                    <FileText size={40} className="mx-auto mb-4 text-vt-maroon" />
                    <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-500">No approved line items stored for this invoice.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
