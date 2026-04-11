import { GoogleGenAI } from "@google/genai";
import { InvoiceLineItem, ParsedInventoryItem } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const RETRY_DELAYS_MS = [400, 1200];
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

function ensureAi() {
  if (!ai) {
    throw new Error('Missing VITE_GEMINI_API_KEY');
  }
  return ai;
}

function normalizeInventoryItems(parsed: unknown[]): ParsedInventoryItem[] {
  return parsed.map((item) => ({
    name: String((item as ParsedInventoryItem).name || 'Unknown item'),
    category: String((item as ParsedInventoryItem).category || 'Uncategorized'),
    unit: String((item as ParsedInventoryItem).unit || 'items'),
    quantity: Number((item as ParsedInventoryItem).quantity || 0),
    program: (item as ParsedInventoryItem).program === 'grocery' ? 'grocery' : 'pantry',
    weight_value: (item as ParsedInventoryItem).weight_value ? Number((item as ParsedInventoryItem).weight_value) : undefined,
    weight_unit: (item as ParsedInventoryItem).weight_unit || undefined,
    unit_price: (item as ParsedInventoryItem).unit_price ? Number((item as ParsedInventoryItem).unit_price) : undefined,
    price_basis: (item as ParsedInventoryItem).price_basis === 'per_weight' ? 'per_weight' : 'per_unit',
  }));
}

function inferCategory(name: string) {
  const lower = name.toLowerCase();
  const match = CATEGORY_KEYWORDS.find(({ keywords }) => keywords.some((keyword) => lower.includes(keyword)));
  return match?.category || 'Uncategorized';
}

function parseLineItems(rawText: string, defaultProgram: 'pantry' | 'grocery'): ParsedInventoryItem[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const quantityMatch = line.match(/(\d+(?:\.\d+)?)/);
      const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
      const priceMatch = line.match(/\$(\d+(?:\.\d+)?)/);
      const weightMatch = line.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|oz|kg|g)\b/i);
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

      const name = scrubbed.length ? scrubbed.trim() : 'Unknown item';

      return {
        name,
        quantity,
        unit,
        category: inferCategory(name),
        program,
        weight_value: weightMatch ? Number(weightMatch[1]) : undefined,
        weight_unit: weightMatch ? (weightMatch[2].toLowerCase() as ParsedInventoryItem['weight_unit']) : undefined,
        unit_price: priceMatch ? Number(priceMatch[1]) : undefined,
        price_basis: (weightMatch && /\bper\s*(lb|lbs|oz|kg|g)\b/i.test(line) ? 'per_weight' : 'per_unit') as ParsedInventoryItem['price_basis'],
      };
    })
    .filter((item) => item.name && item.quantity > 0);
}

function parseJsonArrayResponse(responseText: string) {
  const trimmed = responseText.trim();
  const withoutFences = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(withoutFences || '[]');

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini returned a non-array response.');
  }

  return parsed;
}

function isRetryableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /503|ServiceUnavailable|UNAVAILABLE|overloaded|temporarily unavailable/i.test(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateJsonContent(parameters: Parameters<GoogleGenAI['models']['generateContent']>[0]) {
  const client = ensureAi();

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await client.models.generateContent(parameters);
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length || !isRetryableGeminiError(error)) {
        throw error;
      }
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  throw new Error('Gemini request failed.');
}

export const parseInventoryText = async (text: string): Promise<ParsedInventoryItem[]> => {
  const prompt = `
    You are an AI assistant for a food pantry inventory system.
    Extract the inventory items from the following text.
    Return a JSON array of objects, where each object has:
    - name (string)
    - category (string)
    - unit (string, e.g., "cans", "boxes", "lbs")
    - quantity (number)
    - program (string, either "pantry" or "grocery", default to "pantry" if unspecified)
    - weight_value (number, optional)
    - weight_unit (string, optional: lb, lbs, oz, kg, g)
    - unit_price (number, optional)
    - price_basis (string, optional: per_unit or per_weight)

    Text: "${text}"
  `;

  try {
    const response = await generateJsonContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = parseJsonArrayResponse(response.text || '[]');
    return normalizeInventoryItems(parsed);
  } catch (error) {
    console.error("Error parsing inventory text:", error);
    const fallback = parseLineItems(text, 'pantry');
    if (fallback.length > 0) {
      return fallback;
    }
    throw new Error(error instanceof Error ? error.message : 'Gemini could not parse the intake text.');
  }
};

type InvoiceParseInput = {
  vendor: string;
  date: string;
  defaultProgram: 'pantry' | 'grocery';
  rawText?: string;
  file?: {
    mimeType: string;
    data: string;
  };
};

export const parseInvoiceInput = async ({
  vendor,
  date,
  defaultProgram,
  rawText,
  file,
}: InvoiceParseInput): Promise<InvoiceLineItem[]> => {
  const prompt = `
    You are parsing a food pantry invoice into structured inventory items.
    Extract the received goods only.
    Return a JSON array of objects with:
    - name (string)
    - category (string)
    - unit (string)
    - quantity (number)
    - program (string: pantry or grocery)
    - weight_value (number, optional)
    - weight_unit (string, optional: lb, lbs, oz, kg, g)
    - unit_price (number, optional)
    - price_basis (string, optional: per_unit or per_weight)
    - source_line (string, optional)

    Rules:
    - Default program to "${defaultProgram}" when not obvious.
    - Ignore totals, taxes, addresses, invoice numbers, and summary rows.
    - Use short operational item names.
    - If vendor context helps, vendor is "${vendor || 'Unknown vendor'}".
    - Invoice date is "${date || 'Unknown date'}".

    Extra notes / OCR text:
    ${rawText || 'None provided'}
  `;

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
  if (file) {
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data,
      },
    });
  }

  try {
    const response = await generateJsonContent({
      model: 'gemini-2.5-flash',
      contents: parts,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = parseJsonArrayResponse(response.text || '[]');

    return parsed.map((item) => ({
      name: String(item.name || 'Unknown item'),
      category: String(item.category || 'Uncategorized'),
      unit: String(item.unit || 'items'),
      quantity: Number(item.quantity || 0),
      program: item.program === 'grocery' ? 'grocery' : 'pantry',
      vendor: vendor || undefined,
      weight_value: item.weight_value ? Number(item.weight_value) : undefined,
      weight_unit: item.weight_unit ? String(item.weight_unit) as InvoiceLineItem['weight_unit'] : undefined,
      unit_price: item.unit_price ? Number(item.unit_price) : undefined,
      price_basis: item.price_basis === 'per_weight' ? 'per_weight' : 'per_unit',
      source_line: item.source_line ? String(item.source_line) : undefined,
    }));
  } catch (error) {
    console.error('Error parsing invoice input:', error);
    if (rawText?.trim()) {
      return parseLineItems(rawText, defaultProgram).map((item) => ({
        ...item,
        vendor: vendor || undefined,
      }));
    }
    throw new Error(error instanceof Error ? error.message : 'Gemini could not parse the invoice input.');
  }
};
