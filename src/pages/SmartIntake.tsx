import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { Camera, Mic, Send, CheckCircle2, Loader2, FileText, Upload, Sparkles, ReceiptText } from 'lucide-react';
import { db } from '../firebase';
import { parseInventoryText, parseInvoiceInput } from '../services/gemini';
import { InventoryItem, InvoiceLineItem, InvoiceRecord, ParsedInventoryItem } from '../types';
import { syncLowStockAlert } from '../services/alerts';

type IntakeMode = 'text' | 'voice' | 'invoice';

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type UploadFile = {
  name: string;
  mimeType: string;
  data: string;
  previewUrl: string;
};

const today = new Date().toISOString().slice(0, 10);

function fileToBase64(file: File): Promise<UploadFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        data: base64,
        previewUrl: result,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function SmartIntake() {
  const [mode, setMode] = useState<IntakeMode>('invoice');
  const [input, setInput] = useState('');
  const [textVendor, setTextVendor] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceVendor, setVoiceVendor] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [invoiceVendor, setInvoiceVendor] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [invoiceDefaultProgram, setInvoiceDefaultProgram] = useState<'pantry' | 'grocery'>('pantry');
  const [invoiceText, setInvoiceText] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<UploadFile | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<'idle' | 'loaded' | 'parsing' | 'parsed'>('idle');
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);

  const speechRecognitionCtor =
    typeof window !== 'undefined'
      ? ((window as Window & {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }).SpeechRecognition ||
          (window as Window & {
            SpeechRecognition?: SpeechRecognitionConstructor;
            webkitSpeechRecognition?: SpeechRecognitionConstructor;
          }).webkitSpeechRecognition ||
          null)
      : null;

  const resetFeedback = () => {
    setIsSaved(false);
    setStatusMessage('');
  };

  useEffect(() => {
    const invoiceQuery = query(collection(db, 'invoices'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(invoiceQuery, (snapshot) => {
      const invoices = snapshot.docs.map((invoice) => ({ id: invoice.id, ...invoice.data() } as InvoiceRecord));
      setRecentInvoices(invoices);
      setSelectedInvoiceId((current) => current || invoices[0]?.id || '');
    });
    return unsub;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetFeedback();

    try {
      const prepared = await fileToBase64(file);
      setInvoiceFile(prepared);
      setInvoiceStatus('loaded');
      if (!invoiceText.trim()) {
        setStatusMessage(`Loaded ${file.name}. You can parse directly or add notes in the invoice text box.`);
      }
    } catch (error) {
      console.error('Error loading file:', error);
      setStatusMessage('Failed to read invoice file.');
    }
  };

  const handleStartListening = () => {
    if (!speechRecognitionCtor) {
      setStatusMessage('Voice input is not supported in this browser.');
      return;
    }

    resetFeedback();

    const recognition = new speechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      setVoiceTranscript(transcript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setStatusMessage(event.error === 'not-allowed' ? 'Microphone access was blocked.' : 'Voice capture failed.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
    setStatusMessage('Listening for voice intake...');
  };

  const handleStopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (voiceTranscript.trim()) {
      setStatusMessage('Voice note captured. Review or parse it when ready.');
    }
  };

  const handleProcess = async () => {
    resetFeedback();
    setIsProcessing(true);

    try {
      if (mode === 'text' || mode === 'voice') {
        const sourceText = mode === 'voice' ? voiceTranscript : input;

        if (!sourceText.trim()) {
          setStatusMessage(mode === 'voice' ? 'Record a voice note before parsing.' : 'Enter intake text before parsing.');
          return;
        }

        const items = await parseInventoryText(sourceText);
        setParsedItems(items);
        setStatusMessage(items.length ? `Parsed ${items.length} inventory items.` : `No items detected from the provided ${mode === 'voice' ? 'voice note' : 'text'}.`);
        return;
      }

      if (!invoiceText.trim() && !invoiceFile) {
        setStatusMessage('Upload an invoice file or paste invoice text before parsing.');
        return;
      }

      setInvoiceStatus('parsing');
      const items = await parseInvoiceInput({
        vendor: invoiceVendor,
        date: invoiceDate,
        defaultProgram: invoiceDefaultProgram,
        rawText: invoiceText,
        file: invoiceFile || undefined,
      });

      setParsedItems(items);
      setInvoiceStatus('parsed');
      setStatusMessage(items.length ? `Parsed ${items.length} invoice line items.` : 'No invoice items detected.');
    } catch (error) {
      console.error('Error processing intake:', error);
      if (mode === 'invoice' && invoiceFile) {
        setInvoiceStatus('loaded');
      }
      const detail = error instanceof Error ? error.message : 'Unknown error.';
      setStatusMessage(
        mode === 'invoice'
          ? `Failed to parse invoice input. ${detail}`
          : `Failed to process ${mode === 'voice' ? 'voice' : 'text'} intake. ${detail}`,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (parsedItems.length === 0) return;

    setIsProcessing(true);
    resetFeedback();

    try {
      if (mode === 'invoice') {
        const itemsSnapshot = await getDocs(collection(db, 'items'));
        const existingItems = itemsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as InventoryItem));
        const invoiceDocRef = await addDoc(collection(db, 'invoices'), {
          vendor: invoiceVendor,
          date: invoiceDate,
          items: [],
          raw_text: invoiceText,
          file_name: invoiceFile?.name,
          status: 'parsed',
          transaction_count: 0,
          created_at: new Date().toISOString(),
        });
        const savedItems: InvoiceLineItem[] = [];

        for (const item of parsedItems as InvoiceLineItem[]) {
          const match = existingItems.find(
            (existing) =>
              existing.name.toLowerCase() === item.name.toLowerCase() &&
              existing.unit.toLowerCase() === item.unit.toLowerCase(),
          );

          if (match) {
            const itemRef = doc(db, 'items', match.id);
            await updateDoc(itemRef, {
              category: item.category || match.category,
              vendor: invoiceVendor || match.vendor,
              low_stock_threshold: Number(match.low_stock_threshold ?? 10),
              pantry_quantity:
                item.program === 'pantry' ? Number(match.pantry_quantity || 0) + Number(item.quantity) : Number(match.pantry_quantity || 0),
              grocery_quantity:
                item.program === 'grocery' ? Number(match.grocery_quantity || 0) + Number(item.quantity) : Number(match.grocery_quantity || 0),
              updated_at: new Date().toISOString(),
            });
            await syncLowStockAlert({
              itemId: match.id,
              itemName: match.name,
              pantryQuantity:
                item.program === 'pantry' ? Number(match.pantry_quantity || 0) + Number(item.quantity) : Number(match.pantry_quantity || 0),
              groceryQuantity:
                item.program === 'grocery' ? Number(match.grocery_quantity || 0) + Number(item.quantity) : Number(match.grocery_quantity || 0),
              threshold: match.low_stock_threshold,
            });

            const transactionRef = await addDoc(collection(db, 'transactions'), {
              invoice_id: invoiceDocRef.id,
              item_id: match.id,
              type: 'invoice',
              quantity: Number(item.quantity),
              to_program: item.program,
              vendor: invoiceVendor || undefined,
              timestamp: new Date().toISOString(),
              notes: `Invoice intake${invoiceFile ? ` // ${invoiceFile.name}` : ''}`,
            });
            savedItems.push({
              ...item,
              linked_item_id: match.id,
              transaction_id: transactionRef.id,
            });
            continue;
          }

          const docRef = await addDoc(collection(db, 'items'), {
            name: item.name,
            category: item.category || 'Uncategorized',
            unit: item.unit || 'items',
            vendor: invoiceVendor || undefined,
            low_stock_threshold: 10,
            pantry_quantity: item.program === 'pantry' ? Number(item.quantity) : 0,
            grocery_quantity: item.program === 'grocery' ? Number(item.quantity) : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await syncLowStockAlert({
            itemId: docRef.id,
            itemName: item.name,
            pantryQuantity: item.program === 'pantry' ? Number(item.quantity) : 0,
            groceryQuantity: item.program === 'grocery' ? Number(item.quantity) : 0,
            threshold: 10,
          });

          const transactionRef = await addDoc(collection(db, 'transactions'), {
            invoice_id: invoiceDocRef.id,
            item_id: docRef.id,
            type: 'invoice',
            quantity: Number(item.quantity),
            to_program: item.program,
            vendor: invoiceVendor || undefined,
            timestamp: new Date().toISOString(),
            notes: `Invoice intake${invoiceFile ? ` // ${invoiceFile.name}` : ''}`,
          });
          savedItems.push({
            ...item,
            linked_item_id: docRef.id,
            transaction_id: transactionRef.id,
          });
        }

        await updateDoc(doc(db, 'invoices', invoiceDocRef.id), {
          items: savedItems,
          status: 'saved',
          transaction_count: savedItems.length,
        });

        setInvoiceText('');
        setInvoiceVendor('');
        setInvoiceDate(today);
        setInvoiceDefaultProgram('pantry');
        setInvoiceFile(null);
        setInvoiceStatus('idle');
        setSelectedInvoiceId(invoiceDocRef.id);
      } else {
        const sourceVendor = mode === 'voice' ? voiceVendor.trim() : textVendor.trim();
        const sourceNotes = mode === 'voice' ? 'Added via Voice Intake' : 'Added via Smart Intake';

        for (const item of parsedItems) {
          const isPantry = item.program === 'pantry';

          const docRef = await addDoc(collection(db, 'items'), {
            name: item.name,
            category: item.category || 'Uncategorized',
            unit: item.unit || 'items',
            vendor: sourceVendor || undefined,
            low_stock_threshold: 10,
            pantry_quantity: isPantry ? Number(item.quantity) : 0,
            grocery_quantity: !isPantry ? Number(item.quantity) : 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          await syncLowStockAlert({
            itemId: docRef.id,
            itemName: item.name,
            pantryQuantity: isPantry ? Number(item.quantity) : 0,
            groceryQuantity: !isPantry ? Number(item.quantity) : 0,
            threshold: 10,
          });

          await addDoc(collection(db, 'transactions'), {
            item_id: docRef.id,
            type: 'add',
            quantity: Number(item.quantity),
            to_program: item.program || 'pantry',
            vendor: sourceVendor || undefined,
            timestamp: new Date().toISOString(),
            notes: sourceNotes,
          });
        }

        if (mode === 'voice') {
          setVoiceTranscript('');
          setVoiceVendor('');
        } else {
          setInput('');
          setTextVendor('');
        }
      }

      setIsSaved(true);
      setParsedItems([]);
      setStatusMessage(
        mode === 'invoice'
          ? 'Invoice processed and inventory updated.'
          : mode === 'voice'
            ? 'Voice intake committed to database.'
            : 'Records committed to database.',
      );
    } catch (error) {
      console.error('Error saving intake items:', error);
      setStatusMessage(mode === 'invoice' ? 'Failed to save invoice intake.' : `Failed to save ${mode === 'voice' ? 'voice' : 'text'} intake records.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedInvoice = recentInvoices.find((invoice) => invoice.id === selectedInvoiceId) || recentInvoices[0] || null;

  const updateParsedItem = (
    index: number,
    field: keyof ParsedInventoryItem,
    value: string | number,
  ) => {
    setParsedItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === 'quantity'
                  ? Number(value)
                  : field === 'program'
                    ? value === 'grocery'
                      ? 'grocery'
                      : 'pantry'
                    : value,
            }
          : item,
      ),
    );
  };

  const switchMode = (nextMode: IntakeMode) => {
    setMode(nextMode);
    setParsedItems([]);
    resetFeedback();
    if (nextMode === 'invoice') {
      setInvoiceStatus(invoiceFile ? 'loaded' : 'idle');
    }
    if (nextMode !== 'voice') {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div className="border-b-4 border-vt-ink pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Smart Intake</h1>
          <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">Unified intake hub</p>
        </div>
      </div>

      <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#861F41] space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <button
            type="button"
            onClick={() => switchMode('invoice')}
            className={`py-5 border-4 border-vt-ink flex items-center justify-center gap-4 font-mono font-bold text-lg uppercase tracking-wider transition-all shadow-[6px_6px_0px_0px_#1A1516] ${
              mode === 'invoice' ? 'bg-vt-maroon text-vt-cream -translate-y-1' : 'bg-vt-cream text-vt-ink hover:bg-vt-maroon hover:text-vt-cream'
            }`}
          >
            <Camera size={28} /> Scan Invoice
          </button>
          <button
            type="button"
            onClick={() => switchMode('voice')}
            className={`py-5 border-4 border-vt-ink flex items-center justify-center gap-4 font-mono font-bold text-lg uppercase tracking-wider transition-all shadow-[6px_6px_0px_0px_#1A1516] ${
              mode === 'voice' ? 'bg-vt-ink text-vt-cream -translate-y-1' : 'bg-vt-cream text-vt-ink hover:bg-vt-ink hover:text-vt-cream'
            }`}
          >
            <Mic size={28} /> Voice Intake
          </button>
          <button
            type="button"
            onClick={() => switchMode('text')}
            className={`py-5 border-4 border-vt-ink flex items-center justify-center gap-4 font-mono font-bold text-lg uppercase tracking-wider transition-all shadow-[6px_6px_0px_0px_#1A1516] ${
              mode === 'text' ? 'bg-vt-orange text-vt-ink -translate-y-1' : 'bg-vt-cream text-vt-ink hover:bg-vt-orange/15'
            }`}
          >
            <Sparkles size={28} /> Text Intake
          </button>
        </div>

        {mode === 'text' ? (
          <div className="space-y-6">
            <div>
              <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Vendor</label>
              <input
                value={textVendor}
                onChange={(e) => setTextVendor(e.target.value)}
                placeholder="Optional vendor or donation source"
                className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all"
              />
            </div>
            <div className="relative">
            <div className="absolute top-0 left-0 bg-vt-ink text-vt-cream font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border-b-4 border-r-4 border-vt-ink z-10">
              RAW INPUT BUFFER
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., 'We received 50 cans of soup for the pantry and 20 boxes of cereal for grocery.'"
              className="w-full h-64 p-8 pt-16 bg-vt-cream border-4 border-vt-ink focus:ring-4 focus:ring-vt-orange outline-none resize-none font-sans text-2xl text-vt-ink placeholder-gray-400 shadow-inner"
            />
            <button
              onClick={handleProcess}
              disabled={isProcessing || !input.trim()}
              className="absolute bottom-6 right-6 bg-vt-ink text-vt-cream border-4 border-vt-ink p-4 hover:bg-vt-orange disabled:opacity-50 transition-all shadow-[6px_6px_0px_0px_#861F41] hover:-translate-y-1"
            >
              {isProcessing && !parsedItems.length ? <Loader2 className="animate-spin" size={32} /> : <Send size={32} />}
            </button>
          </div>
          </div>
        ) : mode === 'voice' ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
            <div className="space-y-6">
              <div>
                <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Vendor</label>
                <input
                  value={voiceVendor}
                  onChange={(e) => setVoiceVendor(e.target.value)}
                  placeholder="Optional vendor or donation source"
                  className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all"
                />
              </div>

              <div className="border-4 border-vt-ink bg-vt-cream p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Voice Capture</h2>
                    <p className="font-sans text-gray-600 mt-2">Speak naturally, then parse the transcript into inventory records.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleStartListening}
                      disabled={isListening || !speechRecognitionCtor}
                      className="px-6 py-4 border-4 border-vt-ink bg-vt-maroon text-vt-cream font-mono font-bold uppercase hover:bg-vt-maroon-dark transition-colors disabled:opacity-50"
                    >
                      Start Listening
                    </button>
                    <button
                      type="button"
                      onClick={handleStopListening}
                      disabled={!isListening}
                      className="px-6 py-4 border-4 border-vt-ink bg-vt-orange text-vt-ink font-mono font-bold uppercase hover:bg-vt-orange-dark transition-colors disabled:opacity-50"
                    >
                      Stop
                    </button>
                  </div>
                </div>

                <div className={`border-4 border-vt-ink px-4 py-3 font-mono text-sm font-bold uppercase tracking-widest ${isListening ? 'bg-green-300 text-vt-ink' : 'bg-white text-gray-600'}`}>
                  {speechRecognitionCtor ? (isListening ? 'Microphone active' : 'Ready to record') : 'Voice input not available in this browser'}
                </div>

                <div className="relative">
                  <div className="absolute top-0 left-0 bg-vt-ink text-vt-cream font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border-b-4 border-r-4 border-vt-ink z-10">
                    VOICE TRANSCRIPT
                  </div>
                  <textarea
                    value={voiceTranscript}
                    onChange={(e) => setVoiceTranscript(e.target.value)}
                    placeholder="Your spoken note will appear here. You can edit it before parsing."
                    className="w-full h-64 p-8 pt-16 bg-vt-cream border-4 border-vt-ink focus:ring-4 focus:ring-vt-orange outline-none resize-none font-sans text-2xl text-vt-ink placeholder-gray-400 shadow-inner"
                  />
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing || !voiceTranscript.trim()}
                    className="absolute bottom-6 right-6 bg-vt-ink text-vt-cream border-4 border-vt-ink p-4 hover:bg-vt-orange disabled:opacity-50 transition-all shadow-[6px_6px_0px_0px_#861F41] hover:-translate-y-1"
                  >
                    {isProcessing && !parsedItems.length ? <Loader2 className="animate-spin" size={32} /> : <Send size={32} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-4 border-vt-ink bg-vt-orange/10 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Mic className="text-vt-maroon" size={28} />
                <h2 className="font-serif text-2xl font-bold text-vt-ink uppercase">Voice Tips</h2>
              </div>
              <p className="font-sans text-gray-700">
                Speak in short inventory phrases like quantities, item names, and whether stock is for pantry or grocery.
              </p>
              <ul className="font-mono text-sm text-vt-ink space-y-3 uppercase tracking-wide">
                <li>Pause between line items</li>
                <li>Say pantry or grocery clearly</li>
                <li>Edit the transcript before parsing if needed</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)] gap-8 items-start">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Vendor</label>
                  <input
                    value={invoiceVendor}
                    onChange={(e) => setInvoiceVendor(e.target.value)}
                    placeholder="Costco, Kroger, Community Partner..."
                    className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-vt-cream border-4 border-vt-ink p-4 font-sans text-xl text-vt-ink focus:outline-none focus:ring-4 focus:ring-vt-orange transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
                <div>
                  <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Invoice File</label>
                  <label className="w-full flex items-center gap-4 border-4 border-vt-ink p-4 cursor-pointer bg-vt-orange/10 hover:bg-vt-orange/20 transition-colors">
                    <Upload size={24} className="text-vt-maroon" />
                    <span className="font-sans text-vt-ink text-lg">{invoiceFile?.name || 'Upload image or PDF invoice'}</span>
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                <div>
                  <label className="block font-mono text-sm font-bold uppercase tracking-widest text-vt-ink mb-3">Default Program</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setInvoiceDefaultProgram('pantry')} className={`px-4 py-4 border-4 border-vt-ink font-mono font-bold uppercase ${invoiceDefaultProgram === 'pantry' ? 'bg-vt-maroon text-vt-cream' : 'bg-vt-cream text-vt-ink'}`}>
                      Pantry
                    </button>
                    <button type="button" onClick={() => setInvoiceDefaultProgram('grocery')} className={`px-4 py-4 border-4 border-vt-ink font-mono font-bold uppercase ${invoiceDefaultProgram === 'grocery' ? 'bg-vt-orange text-vt-ink' : 'bg-vt-cream text-vt-ink'}`}>
                      Grocery
                    </button>
                  </div>
                </div>
              </div>

              {invoiceFile ? (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-6 items-start">
                  <div className={`border-4 border-vt-ink p-4 ${invoiceStatus === 'parsed' ? 'bg-green-200' : invoiceStatus === 'parsing' ? 'bg-vt-orange/20' : 'bg-vt-cream'}`}>
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Invoice Status</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs font-bold uppercase tracking-widest">
                      <div className="border-2 border-vt-ink px-3 py-2 bg-vt-ink text-vt-cream">1. File Loaded</div>
                      <div className={`border-2 border-vt-ink px-3 py-2 ${invoiceStatus === 'parsing' ? 'bg-vt-orange text-vt-ink' : invoiceStatus === 'parsed' ? 'bg-vt-ink text-vt-cream' : 'bg-vt-cream text-vt-ink'}`}>2. Parsing</div>
                      <div className={`border-2 border-vt-ink px-3 py-2 ${invoiceStatus === 'parsed' ? 'bg-green-400 text-vt-ink' : 'bg-vt-cream text-vt-ink'}`}>3. Review Output</div>
                    </div>
                  </div>
                  <div className="border-4 border-vt-ink bg-vt-orange/10 p-4">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Loaded File</p>
                    {invoiceFile.mimeType.startsWith('image/') ? (
                      <img src={invoiceFile.previewUrl} alt={invoiceFile.name} className="w-full h-40 object-cover border-4 border-vt-ink bg-vt-cream" />
                    ) : (
                      <div className="border-4 border-vt-ink bg-vt-cream p-5 min-h-40 flex flex-col items-center justify-center text-center">
                        <FileText size={40} className="text-vt-maroon mb-3" />
                        <p className="font-mono text-xs font-bold uppercase tracking-widest text-vt-ink break-all">{invoiceFile.name}</p>
                        <p className="font-mono text-xs uppercase tracking-widest text-gray-500 mt-2">PDF ready for Gemini parsing</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="relative">
                <div className="absolute top-0 left-0 bg-vt-ink text-vt-cream font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border-b-4 border-r-4 border-vt-ink z-10">
                  INVOICE NOTES / OCR TEXT
                </div>
                <textarea
                  value={invoiceText}
                  onChange={(e) => setInvoiceText(e.target.value)}
                  placeholder="Paste OCR text, vendor notes, or extra instructions. Gemini will combine this with the uploaded invoice file."
                  className="w-full h-64 p-8 pt-16 bg-vt-cream border-4 border-vt-ink focus:ring-4 focus:ring-vt-orange outline-none resize-none font-sans text-xl text-vt-ink placeholder-gray-400 shadow-inner"
                />
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || (!invoiceText.trim() && !invoiceFile)}
                  className="absolute bottom-6 right-6 bg-vt-ink text-vt-cream border-4 border-vt-ink p-4 hover:bg-vt-orange disabled:opacity-50 transition-all shadow-[6px_6px_0px_0px_#861F41] hover:-translate-y-1"
                >
                  {isProcessing && !parsedItems.length ? <Loader2 className="animate-spin" size={32} /> : <Send size={32} />}
                </button>
              </div>
            </div>

            <div className="border-4 border-vt-ink bg-vt-orange/10 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <FileText className="text-vt-maroon" size={28} />
                <h2 className="font-serif text-2xl font-bold text-vt-ink uppercase">Invoice Tips</h2>
              </div>
              <p className="font-sans text-gray-700">
                Upload the invoice file first, then paste any OCR text or notes if needed. Gemini will extract structured inventory lines for review before anything is saved.
              </p>
              <ul className="font-mono text-sm text-vt-ink space-y-3 uppercase tracking-wide">
                <li>Use clear photos or scans</li>
                <li>Add vendor/date for audit history</li>
                <li>Review parsed quantities before committing</li>
              </ul>
            </div>

            <div className="border-4 border-vt-ink bg-vt-cream p-6 space-y-5 shadow-[8px_8px_0px_0px_#1A1516]">
              <div className="border-b-4 border-vt-ink pb-4">
                <h2 className="font-serif text-2xl font-bold text-vt-ink uppercase">Invoice Audit Trail</h2>
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">Recent invoice imports and linked records</p>
              </div>
              {recentInvoices.length === 0 ? (
                <div className="border-4 border-dashed border-vt-ink bg-white p-6 text-center font-mono text-sm uppercase tracking-widest text-gray-500">
                  No invoice imports yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentInvoices.slice(0, 4).map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => setSelectedInvoiceId(invoice.id)}
                      className={`w-full text-left border-4 border-vt-ink px-4 py-4 transition-colors ${
                        selectedInvoice?.id === invoice.id ? 'bg-vt-orange/20' : 'bg-white hover:bg-vt-orange/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-sans text-lg font-bold text-vt-ink">{invoice.vendor || 'Unknown vendor'}</p>
                          <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">
                            {invoice.date} // {invoice.transaction_count || invoice.items?.length || 0} linked lines
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-2 py-1 bg-vt-cream">
                          {invoice.status || 'saved'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {statusMessage ? (
        <div className={`border-4 border-vt-ink p-5 shadow-[8px_8px_0px_0px_#1A1516] ${statusMessage.includes('Failed') ? 'bg-red-200 text-vt-ink' : 'bg-vt-cream text-vt-ink'}`}>
          <p className="font-mono font-bold uppercase tracking-widest text-sm">{statusMessage}</p>
        </div>
      ) : null}

      {parsedItems.length > 0 && (
        <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#E87722] mt-12">
          <div className="border-b-4 border-vt-ink pb-4 mb-8">
            <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">
              {mode === 'invoice' ? 'Parsed Invoice Output' : 'Parsed Output'}
            </h2>
          </div>

          <div className="space-y-6 mb-10">
            {parsedItems.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-vt-cream border-4 border-vt-ink shadow-[4px_4px_0px_0px_#1A1516]">
                {mode === 'voice' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Item Name</label>
                      <input
                        value={item.name}
                        onChange={(e) => updateParsedItem(idx, 'name', e.target.value)}
                        className="w-full border-2 border-vt-ink bg-white px-3 py-3 font-sans text-lg text-vt-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Category</label>
                      <input
                        value={item.category}
                        onChange={(e) => updateParsedItem(idx, 'category', e.target.value)}
                        className="w-full border-2 border-vt-ink bg-white px-3 py-3 font-sans text-lg text-vt-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Unit</label>
                      <input
                        value={item.unit}
                        onChange={(e) => updateParsedItem(idx, 'unit', e.target.value)}
                        className="w-full border-2 border-vt-ink bg-white px-3 py-3 font-sans text-lg text-vt-ink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateParsedItem(idx, 'quantity', e.target.value)}
                        className="w-full border-2 border-vt-ink bg-white px-3 py-3 font-mono text-lg text-vt-ink focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Program</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => updateParsedItem(idx, 'program', 'pantry')}
                          className={`px-4 py-3 border-2 border-vt-ink font-mono font-bold uppercase ${item.program === 'pantry' ? 'bg-vt-maroon text-vt-cream' : 'bg-white text-vt-ink'}`}
                        >
                          Pantry
                        </button>
                        <button
                          type="button"
                          onClick={() => updateParsedItem(idx, 'program', 'grocery')}
                          className={`px-4 py-3 border-2 border-vt-ink font-mono font-bold uppercase ${item.program === 'grocery' ? 'bg-vt-orange text-vt-ink' : 'bg-white text-vt-ink'}`}
                        >
                          Grocery
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-sans font-bold text-vt-ink text-2xl">{item.name}</p>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="font-mono text-sm font-bold uppercase tracking-widest text-gray-600">{item.category}</span>
                        <span className="w-2 h-2 bg-vt-ink rounded-full"></span>
                        <span className="font-mono text-sm font-bold uppercase tracking-widest bg-vt-orange text-vt-ink px-3 py-1 border-2 border-vt-ink">{item.program}</span>
                        {('vendor' in item && item.vendor) || (mode === 'text' && textVendor.trim()) ? (
                          <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-3 py-1">
                            Vendor: {String('vendor' in item && item.vendor ? item.vendor : textVendor.trim())}
                          </span>
                        ) : null}
                        {'source_line' in item && item.source_line ? (
                          <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-3 py-1">
                            Invoice line
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-left sm:text-right mt-4 sm:mt-0">
                      <p className="font-mono font-extrabold text-vt-maroon text-4xl">
                        {item.quantity} <span className="text-xl text-vt-ink">{item.unit}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-6 border-t-4 border-vt-ink pt-8">
            <button onClick={() => setParsedItems([])} className="px-8 py-4 font-mono font-bold uppercase text-vt-ink border-4 border-vt-ink hover:bg-vt-ink hover:text-vt-cream transition-colors">
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="bg-vt-maroon text-vt-cream border-4 border-vt-ink px-10 py-4 font-mono font-bold uppercase flex items-center justify-center gap-3 hover:bg-vt-maroon-dark hover:-translate-y-1 shadow-[6px_6px_0px_0px_#1A1516] transition-all"
            >
              {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
              Commit to Database
            </button>
          </div>
        </div>
      )}

      {mode === 'invoice' && selectedInvoice ? (
        <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#861F41]">
          <div className="border-b-4 border-vt-ink pb-4 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Selected Invoice Audit</h2>
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500 mt-2">
                {selectedInvoice.vendor || 'Unknown vendor'} // {selectedInvoice.date}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ReceiptText size={22} className="text-vt-maroon" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-3 py-2 bg-white">
                {selectedInvoice.transaction_count || selectedInvoice.items?.length || 0} linked transactions
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="border-4 border-vt-ink bg-white p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Saved At</p>
              <p className="font-sans text-base font-bold text-vt-ink mt-3">{selectedInvoice.created_at.slice(0, 16).replace('T', ' ')}</p>
            </div>
            <div className="border-4 border-vt-ink bg-white p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">File</p>
              <p className="font-sans text-base font-bold text-vt-ink mt-3">{selectedInvoice.file_name || 'No file attached'}</p>
            </div>
            <div className="border-4 border-vt-ink bg-white p-4">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">Status</p>
              <p className="font-sans text-base font-bold text-vt-ink mt-3">{selectedInvoice.status || 'saved'}</p>
            </div>
          </div>

          <div className="space-y-4">
            {selectedInvoice.items?.length ? (
              selectedInvoice.items.map((item, idx) => (
                <div key={`${selectedInvoice.id}-${idx}`} className="border-4 border-vt-ink bg-white p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="font-sans text-xl font-bold text-vt-ink">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-3 py-1 bg-vt-orange">
                          {item.quantity} {item.unit}
                        </span>
                        <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-3 py-1 bg-white">
                          {item.program}
                        </span>
                        <span className="font-mono text-xs font-bold uppercase tracking-widest border-2 border-vt-ink px-3 py-1 bg-white">
                          {item.category}
                        </span>
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
              <div className="border-4 border-dashed border-vt-ink bg-white p-6 text-center font-mono text-sm uppercase tracking-widest text-gray-500">
                No linked invoice items yet.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isSaved && (
        <div className="bg-green-400 text-vt-ink p-6 border-4 border-vt-ink flex items-center gap-6 shadow-[8px_8px_0px_0px_#1A1516]">
          <div className="p-3 bg-vt-ink text-green-400 border-2 border-vt-ink">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold uppercase">Operation Successful</p>
            <p className="font-mono font-bold mt-1">{mode === 'invoice' ? 'Invoice saved and inventory updated.' : 'Records committed to database.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
