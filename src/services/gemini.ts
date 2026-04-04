import { GoogleGenAI } from "@google/genai";
import { ParsedInventoryItem } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const parseInventoryText = async (text: string): Promise<ParsedInventoryItem[]> => {
  if (!ai) {
    throw new Error('Missing VITE_GEMINI_API_KEY');
  }

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
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const jsonStr = response.text?.trim() || "[]";
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => ({
      name: String(item.name || 'Unknown item'),
      category: String(item.category || 'Uncategorized'),
      unit: String(item.unit || 'items'),
      quantity: Number(item.quantity || 0),
      program: item.program === 'grocery' ? 'grocery' : 'pantry',
    }));
  } catch (error) {
    console.error("Error parsing inventory text:", error);
    throw error;
  }
};
