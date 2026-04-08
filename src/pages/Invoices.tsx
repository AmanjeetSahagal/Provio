import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { FileText, ScanText, Upload, ReceiptText, CheckCircle2, Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { InventoryItem, InvoiceLineItem, InvoiceRecord } from '../types';

const UNIT_KEYWORDS = [
  'boxes',
  'box',
  'bags',
  'bag',
  'cans',
  'can',
  'bottles',
  'bottle',
  'packs',
  'pack',
  'cases',
  'case',
  'lbs',
  'lb',
  'oz',
  'items',
  'item',
  'units',
  'unit',
  'cartons',
  'carton',
  'jars',
  'jar',
];

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: 'Grains', keywords: ['rice', 'pasta', 'oats', 'cereal', 'flour'] },
  { category: 'Canned Goods', keywords: ['beans', 'soup', 'tomato', 'corn', 'can'] },
  { category: 'Snacks', keywords: ['bar', 'granola', 'cracker', 'chips', 'cookies'] },
  { category: 'Produce', keywords: ['apple', 'banana', 'potato', 'onion', 'carrot'] },
  { category: 'Protein', keywords: ['tuna', 'chicken', 'peanut', 'egg', 'tofu'] },
  { category: 'Dairy', keywords: ['milk', 'cheese', 'yogurt', 'butter'] },
  { category: 'Beverages', keywords: ['juice', 'tea', 'coffee', 'water'] },
];

function inferCategory(name: string) {
  const lower = name.toLowerCase();
  const match = CATEGORY_KEYWORDS.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)));
  return match?.category || 'Uncategorized';
}

function parseInvoiceText(rawText: string, defaultProgram: 'pantry' | 'grocery', vendor: string): InvoiceLineItem[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const quantityMatch = line.match(/(\d+(?:\.\d+)?)/);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;

      const unitMatch = UNIT_KEYWORDS.find((unit) => new RegExp(`\\b${unit}\\b`, 'i').test(line));
      const unit = unitMatch || 'items';

      const program =
        /\bgrocery\b/i.test(line) ? 'grocery' : /\bpantry\b/i.test(line) ? 'pantry' : defaultProgram;

      const scrubbed = line
        .replace(/\$?\d+(?:\.\d+)?/g, ' ')
        .replace(new RegExp(`\\b(${UNIT_KEYWORDS.join('|')})\\b`, 'gi'), ' ')
        .replace(/\b(pantry|grocery)\b/gi, ' ')
        .replace(/[,|-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const name = scrubbed.length ? scrubbed.replace(/\b(invoice|total|subtotal|vendor)\b/gi, '').trim() : 'Unlabeled item';

      return {
        name,
        quantity,
        unit,
        category: inferCategory(name),
        program,
        vendor: vendor || undefined,
        source_line: line,
      };
    })
    .filter((item) => item.name);
}

export default function Invoices() {
  const [vendor, setVendor] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [defaultProgram, setDefaultProgram] = useState<'pantry' | 'grocery'>('pantry');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsedItems, setParsedItems] = useState<InvoiceLineItem[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const invoiceQuery = query(collection(db, 'invoices'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(invoiceQuery, (snapshot) => {
      setRecentInvoices(snapshot.docs.map((invoice) => ({ id: invoice.id, ...invoice.data() } as InvoiceRecord)));
    });
    return unsub;
  }, []);

  const handleParse = () => {
    const items = parseInvoiceText(rawText, defaultProgram, vendor.trim());
    setParsedItems(items);
    setStatusMessage(items.length ? `Parsed ${items.length} invoice lines.` : 'No invoice lines detected. Use one item per line.');
  };

  const handleSaveInvoice = async () => {
    if (!vendor.trim() || !invoiceDate || parsedItems.length === 0) {
      setStatusMessage('Add vendor, invoice date, and at least one parsed line before saving.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('');

    try {
      const itemsSnapshot = await getDocs(collection(db, 'items'));
      const existingItems = itemsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as InventoryItem));

      for (const lineItem of parsedItems) {
        const match = existingItems.find(
          (item) =>
            item.name.toLowerCase() === lineItem.name.toLowerCase() &&
            item.unit.toLowerCase() === lineItem.unit.toLowerCase(),
        );

        if (match) {
          const itemRef = doc(db, 'items', match.id);
          const pantry_quantity =
            lineItem.program === 'pantry' ? Number(match.pantry_quantity || 0) + lineItem.quantity : Number(match.pantry_quantity || 0);
          const grocery_quantity =
            lineItem.program === 'grocery' ? Number(match.grocery_quantity || 0) + lineItem.quantity : Number(match.grocery_quantity || 0);

          await updateDoc(itemRef, {
            category: lineItem.category || match.category,
            vendor: lineItem.vendor || match.vendor,
            pantry_quantity,
            grocery_quantity,
            updated_at: new Date().toISOString(),
          });

          await addDoc(collection(db, 'transactions'), {
            item_id: match.id,
            type: 'invoice',
            quantity: lineItem.quantity,
            to_program: lineItem.program,
            vendor: vendor.trim(),
            timestamp: new Date().toISOString(),
            notes: `Invoice import: ${lineItem.name}`,
          });
          continue;
        }

        const docRef = await addDoc(collection(db, 'items'), {
          name: lineItem.name,
          category: lineItem.category,
          unit: lineItem.unit,
          vendor: lineItem.vendor || vendor.trim(),
          pantry_quantity: lineItem.program === 'pantry' ? lineItem.quantity : 0,
          grocery_quantity: lineItem.program === 'grocery' ? lineItem.quantity : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        await addDoc(collection(db, 'transactions'), {
          item_id: docRef.id,
          type: 'invoice',
          quantity: lineItem.quantity,
          to_program: lineItem.program,
          vendor: vendor.trim(),
          timestamp: new Date().toISOString(),
          notes: `Invoice import: ${lineItem.name}`,
        });
      }

      await addDoc(collection(db, 'invoices'), {
        vendor: vendor.trim(),
        date: invoiceDate,
        items: parsedItems,
        raw_text: rawText,
        file_name: fileName || undefined,
        created_at: new Date().toISOString(),
      });

      setVendor('');
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setDefaultProgram('pantry');
      setRawText('');
      setFileName('');
      setParsedItems([]);
      setStatusMessage('Invoice saved and inventory updated.');
    } catch (error) {
      console.error('Error saving invoice:', error);
      setStatusMessage('Failed to save invoice workflow.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="border-b-4 border-vt-ink pb-6">
        <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Invoice Intake</h1>
        <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">No-paid-AI import workflow</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-10 items-start">
        <section className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#861F41] space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Vendor</label>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Costco, Kroger, Local Food Bank..." className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
            </div>
            <div>
              <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
            <div>
              <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Upload Invoice File</label>
              <label className="w-full flex items-center gap-4 border-4 border-vt-ink p-4 cursor-pointer bg-vt-orange/10 hover:bg-vt-orange/20 transition-colors">
                <Upload size={24} className="text-vt-maroon" />
                <span className="font-sans text-vt-ink text-lg">{fileName || 'Choose image or PDF for reference only'}</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
                />
              </label>
            </div>
            <div>
              <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Default Program</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setDefaultProgram('pantry')} className={`px-4 py-4 border-4 border-vt-ink font-mono font-bold uppercase ${defaultProgram === 'pantry' ? 'bg-vt-maroon text-vt-cream' : 'bg-vt-cream text-vt-ink'}`}>
                  Pantry
                </button>
                <button type="button" onClick={() => setDefaultProgram('grocery')} className={`px-4 py-4 border-4 border-vt-ink font-mono font-bold uppercase ${defaultProgram === 'grocery' ? 'bg-vt-orange text-vt-ink' : 'bg-vt-cream text-vt-ink'}`}>
                  Grocery
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink">Invoice Text / OCR Paste</label>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">One line per item works best</span>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              placeholder={'12 boxes cereal pantry\n24 cans black beans\n10 bags rice grocery\n6 jars peanut butter'}
              className="w-full bg-vt-cream border-4 border-vt-ink p-5 font-sans text-lg text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all resize-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end border-t-4 border-vt-ink pt-6">
            <button type="button" onClick={handleParse} className="px-8 py-4 border-4 border-vt-ink bg-vt-ink text-vt-cream font-mono font-bold uppercase flex items-center justify-center gap-3 hover:bg-vt-maroon transition-colors">
              <ScanText size={20} />
              Parse Invoice
            </button>
            <button type="button" disabled={isSaving} onClick={handleSaveInvoice} className="px-8 py-4 border-4 border-vt-ink bg-vt-orange text-vt-ink font-mono font-bold uppercase flex items-center justify-center gap-3 hover:bg-vt-orange-dark transition-colors disabled:opacity-60">
              {isSaving ? <Loader2 size={20} className="animate-spin" /> : <ReceiptText size={20} />}
              Save Invoice
            </button>
          </div>

          {statusMessage ? (
            <div className={`border-4 border-vt-ink px-4 py-3 shadow-[4px_4px_0px_0px_#1A1516] ${statusMessage.includes('Failed') || statusMessage.includes('No ') || statusMessage.includes('Add vendor') ? 'bg-red-200 text-vt-ink' : 'bg-green-300 text-vt-ink'}`}>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5" />
                <p className="font-sans text-sm font-medium">{statusMessage}</p>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="space-y-8">
          <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#1A1516]">
            <div className="border-b-4 border-vt-ink pb-4 mb-6">
              <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Parsed Preview</h2>
            </div>
            {parsedItems.length === 0 ? (
              <div className="border-4 border-dashed border-vt-ink p-8 text-center bg-vt-orange/10">
                <FileText size={44} className="mx-auto mb-4 text-vt-maroon" />
                <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-500">No parsed items yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                {parsedItems.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="border-4 border-vt-ink p-4 bg-vt-cream shadow-[4px_4px_0px_0px_#E87722]">
                    <p className="font-sans text-xl font-bold text-vt-ink">{item.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-widest">
                      <span className="px-2 py-1 border-2 border-vt-ink bg-vt-orange">{item.quantity} {item.unit}</span>
                      <span className="px-2 py-1 border-2 border-vt-ink bg-vt-cream">{item.category}</span>
                      <span className="px-2 py-1 border-2 border-vt-ink bg-vt-ink text-vt-cream">{item.program}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#861F41]">
            <div className="border-b-4 border-vt-ink pb-4 mb-6">
              <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Recent Invoices</h2>
            </div>
            <div className="space-y-4">
              {recentInvoices.length === 0 ? (
                <p className="font-mono text-sm font-bold uppercase tracking-widest text-gray-500">No invoice imports yet.</p>
              ) : (
                recentInvoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="border-4 border-vt-ink p-4 bg-vt-cream shadow-[4px_4px_0px_0px_#1A1516]">
                    <p className="font-serif text-2xl font-bold text-vt-ink">{invoice.vendor}</p>
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">{invoice.date} // {invoice.items?.length || 0} items</p>
                    {invoice.file_name ? <p className="font-mono text-xs mt-2 text-vt-maroon uppercase">{invoice.file_name}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
