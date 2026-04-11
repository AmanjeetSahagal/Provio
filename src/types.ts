export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  vendor?: string;
  weight_value?: number;
  weight_unit?: 'lb' | 'lbs' | 'oz' | 'kg' | 'g';
  unit_price?: number;
  price_basis?: 'per_unit' | 'per_weight';
  low_stock_threshold?: number;
  pantry_quantity: number;
  grocery_quantity: number;
  created_at?: string;
  updated_at?: string;
};

export type InventoryInput = Omit<InventoryItem, 'id'>;

export type ParsedInventoryItem = {
  name: string;
  category: string;
  unit: string;
  quantity: number;
  program: 'pantry' | 'grocery';
  weight_value?: number;
  weight_unit?: 'lb' | 'lbs' | 'oz' | 'kg' | 'g';
  unit_price?: number;
  price_basis?: 'per_unit' | 'per_weight';
};

export type TransactionRecord = {
  id: string;
  item_id: string;
  type: 'add' | 'transfer' | 'invoice' | 'rollover';
  quantity: number;
  timestamp: string;
  from_program?: string;
  to_program?: string;
  vendor?: string;
  invoice_id?: string;
  notes?: string;
};

export type InvoiceLineItem = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  program: 'pantry' | 'grocery';
  vendor?: string;
  weight_value?: number;
  weight_unit?: 'lb' | 'lbs' | 'oz' | 'kg' | 'g';
  unit_price?: number;
  price_basis?: 'per_unit' | 'per_weight';
  source_line?: string;
  linked_item_id?: string;
  transaction_id?: string;
};

export type InvoiceRecord = {
  id: string;
  vendor: string;
  date: string;
  items: InvoiceLineItem[];
  raw_text: string;
  created_at: string;
  file_name?: string;
  status?: 'parsed' | 'saved';
  transaction_count?: number;
};

export type AlertRecord = {
  id: string;
  item_id: string;
  type: 'low_stock';
  message: string;
  created_at: string;
  resolved: boolean;
};

export type CheckpointItem = {
  item_id: string;
  name: string;
  category?: string;
  pantry_qty: number;
  grocery_qty: number;
};

export type CheckpointSummaryCategory = {
  category: string;
  total: number;
};

export type CheckpointSummary = {
  total_items: number;
  items_carried_forward: number;
  total_units: number;
  pantry_units: number;
  grocery_units: number;
  category_totals: CheckpointSummaryCategory[];
  rollover_year?: string;
};

export type CheckpointRecord = {
  id: string;
  created_at: string;
  baseline_items: CheckpointItem[];
  type?: 'checkpoint' | 'rollover';
  label?: string;
  notes?: string;
  summary?: CheckpointSummary;
  is_active_baseline?: boolean;
  previous_baseline_id?: string;
};
