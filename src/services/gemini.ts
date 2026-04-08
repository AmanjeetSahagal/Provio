import { GoogleGenAI } from "@google/genai";
import { InvoiceLineItem, ParsedInventoryItem } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const RETRY_DELAYS_MS = [400, 1200];

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
  }));
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
      source_line: item.source_line ? String(item.source_line) : undefined,
    }));
  } catch (error) {
    console.error('Error parsing invoice input:', error);
    throw new Error(error instanceof Error ? error.message : 'Gemini could not parse the invoice input.');
  }
};
