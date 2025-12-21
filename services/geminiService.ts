
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_PROMPT, CAMPUS_NODES } from "../constants";
import { DetectionResult } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async detectLocation(base64Image: string): Promise<DetectionResult | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Identify which campus location this is. Choose from: ${CAMPUS_NODES.map(n => n.name).join(', ')}. Return your answer in JSON format with "locationId" (the internal ID), "confidence" (0-1), and a brief "description" of why you think so.` }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              locationId: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ["locationId", "confidence", "description"]
          }
        }
      });

      const result = JSON.parse(response.text);
      // Map back to ID if it returned a name
      const matchedNode = CAMPUS_NODES.find(n => n.id === result.locationId || n.name.toLowerCase() === result.locationId.toLowerCase());
      if (matchedNode) {
        return { ...result, locationId: matchedNode.id };
      }
      return null;
    } catch (error) {
      console.error("Location detection failed:", error);
      return null;
    }
  }

  async getNavigationAdvice(current: string, destination: string, path: string[]): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am currently at ${current} and want to go to ${destination}. The suggested path is: ${path.join(' -> ')}. Give me some helpful tips or landmarks I should look for along this route.`,
        config: { systemInstruction: SYSTEM_PROMPT }
      });
      return response.text || "Just follow the arrows!";
    } catch (error) {
      return "Stay safe and follow the visible path indicators.";
    }
  }
}
