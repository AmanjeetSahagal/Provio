import { useState } from 'react';
import { parseInventoryText } from '../services/gemini';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { Camera, Mic, Send, CheckCircle2, Loader2, Cpu } from 'lucide-react';
import { ParsedInventoryItem } from '../types';

export default function SmartIntake() {
 const [input, setInput] = useState('');
 const [isProcessing, setIsProcessing] = useState(false);
 const [parsedItems, setParsedItems] = useState<ParsedInventoryItem[]>([]);
 const [isSaved, setIsSaved] = useState(false);

 const handleProcess = async () => {
 if (!input.trim()) return;
 setIsProcessing(true);
 setIsSaved(false);
 try {
 const items = await parseInventoryText(input);
 setParsedItems(items);
 } catch (error) {
 alert("Failed to process text. Please try again.");
 } finally {
 setIsProcessing(false);
 }
 };

 const handleSave = async () => {
 setIsProcessing(true);
 try {
 for (const item of parsedItems) {
 const isPantry = item.program?.toLowerCase() === 'pantry';
 
 const docRef = await addDoc(collection(db, 'items'), {
 name: item.name,
 category: item.category || 'Uncategorized',
 unit: item.unit || 'items',
 pantry_quantity: isPantry ? Number(item.quantity) : 0,
 grocery_quantity: !isPantry ? Number(item.quantity) : 0,
 created_at: new Date().toISOString(),
 updated_at: new Date().toISOString(),
 });

 await addDoc(collection(db, 'transactions'), {
 item_id: docRef.id,
 type: 'add',
 quantity: Number(item.quantity),
 to_program: item.program || 'pantry',
 timestamp: new Date().toISOString(),
 notes: 'Added via Smart Intake'
 });
 }
 setIsSaved(true);
 setParsedItems([]);
 setInput('');
 } catch (error) {
 alert("Failed to save items.");
 } finally {
 setIsProcessing(false);
 }
 };

 return (
 <div className="space-y-10 max-w-5xl mx-auto">
 <div className="border-b-4 border-vt-ink pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
 <div>
 <div className="inline-flex items-center justify-center p-3 bg-vt-ink border-4 border-vt-ink mb-6 shadow-[4px_4px_0px_0px_#861F41] ">
 <Cpu className="text-vt-cream " size={36} />
 </div>
 <h1 className="font-serif text-5xl font-bold text-vt-ink uppercase tracking-tight">Smart Intake</h1>
 <p className="font-mono text-gray-600 mt-3 text-lg uppercase tracking-widest">AI Parsing Module</p>
 </div>
 </div>

 <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#861F41] space-y-8">
 
 <div className="flex flex-col sm:flex-row gap-6">
 <button className="flex-1 py-5 bg-vt-cream border-4 border-vt-ink hover:bg-vt-orange text-vt-ink hover:text-vt-ink flex items-center justify-center gap-4 font-mono font-bold text-lg uppercase tracking-wider transition-all shadow-[6px_6px_0px_0px_#1A1516] hover:-translate-y-1">
 <Mic size={28} /> Voice Input
 </button>
 <button className="flex-1 py-5 bg-vt-cream border-4 border-vt-ink hover:bg-vt-maroon text-vt-ink hover:text-vt-cream flex items-center justify-center gap-4 font-mono font-bold text-lg uppercase tracking-wider transition-all shadow-[6px_6px_0px_0px_#1A1516] hover:-translate-y-1">
 <Camera size={28} /> Scan Invoice
 </button>
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

 {parsedItems.length > 0 && (
 <div className="bg-vt-cream border-4 border-vt-ink p-8 shadow-[12px_12px_0px_0px_#E87722] mt-12">
 <div className="border-b-4 border-vt-ink pb-4 mb-8">
 <h2 className="font-serif text-3xl font-bold text-vt-ink uppercase">Parsed Output</h2>
 </div>
 
 <div className="space-y-6 mb-10">
 {parsedItems.map((item, idx) => (
 <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-vt-cream border-4 border-vt-ink shadow-[4px_4px_0px_0px_#1A1516] ">
 <div>
 <p className="font-sans font-bold text-vt-ink text-2xl">{item.name}</p>
 <div className="flex items-center gap-3 mt-3">
 <span className="font-mono text-sm font-bold uppercase tracking-widest text-gray-600 ">{item.category}</span>
 <span className="w-2 h-2 bg-vt-ink rounded-full"></span>
 <span className="font-mono text-sm font-bold uppercase tracking-widest bg-vt-orange text-vt-ink px-3 py-1 border-2 border-vt-ink">{item.program}</span>
 </div>
 </div>
 <div className="text-left sm:text-right mt-4 sm:mt-0">
 <p className="font-mono font-extrabold text-vt-maroon text-4xl">{item.quantity} <span className="text-xl text-vt-ink ">{item.unit}</span></p>
 </div>
 </div>
 ))}
 </div>
 
 <div className="flex flex-col sm:flex-row justify-end gap-6 border-t-4 border-vt-ink pt-8">
 <button onClick={() => setParsedItems([])} className="px-8 py-4 font-mono font-bold uppercase text-vt-ink border-4 border-vt-ink hover:bg-vt-ink hover:text-vt-cream transition-colors">Discard</button>
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

 {isSaved && (
 <div className="bg-green-400 text-vt-ink p-6 border-4 border-vt-ink flex items-center gap-6 shadow-[8px_8px_0px_0px_#1A1516] ">
 <div className="p-3 bg-vt-ink text-green-400 border-2 border-vt-ink">
 <CheckCircle2 size={32} />
 </div>
 <div>
 <p className="font-serif text-2xl font-bold uppercase">Operation Successful</p>
 <p className="font-mono font-bold mt-1">Records committed to database.</p>
 </div>
 </div>
 )}
 </div>
 );
}
