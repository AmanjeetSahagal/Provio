export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
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
};

export type TransactionRecord = {
  id: string;
  item_id: string;
  type: 'add' | 'transfer';
  quantity: number;
  timestamp: string;
  from_program?: string;
  to_program?: string;
  notes?: string;
};

export type CheckpointItem = {
  item_id: string;
  name: string;
  pantry_qty: number;
  grocery_qty: number;
};

export type CheckpointRecord = {
  id: string;
  created_at: string;
  baseline_items: CheckpointItem[];
};
