import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export async function askGemini(prompt: string) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are a creative assistant for a text-based visual art application. You help users come up with interesting phrases, quotes, or patterns to use in a spiral funnel animation. Keep responses concise and inspiring.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
}
