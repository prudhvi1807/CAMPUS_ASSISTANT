
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SYSTEM_PROMPT, CAMPUS_NODES } from "../constants";
import { DetectionResult, LocationMetadata, LocationProfile, ChatMessage } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async chat(message: string, history: ChatMessage[]): Promise<string> {
    try {
      const chatHistory = history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [...chatHistory, { role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction: "You are a helpful campus assistant. You provide information about buildings, directions, and campus life. Keep responses helpful and concise."
        }
      });

      return response.text || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("Chat error:", error);
      return "I encountered an error connecting to my brain. Please try again.";
    }
  }

  async trainLocation(images: string[], metadata: LocationMetadata): Promise<string> {
    try {
      const imageParts = images.map(data => ({
        inlineData: { mimeType: 'image/jpeg', data }
      }));

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            ...imageParts,
            { text: `SYSTEM: You are a Location Learning Engine. 
            Analyze these ${images.length} images of: ${metadata.name} (Type: ${metadata.type}, Block: ${metadata.block}, Floor: ${metadata.floor}).
            Extract permanent visual features (layout, specific furniture, signage text, door patterns, lighting).
            Create a "Learned Feature Profile" that summarizes how to recognize this exact place later.
            Be concise.` }
          ]
        },
        config: {
          systemInstruction: "You are an AI specialized in campus mapping and visual feature extraction. Your goal is to learn and remember specific locations for future navigation tasks."
        }
      });

      return response.text || "No features extracted.";
    } catch (error) {
      console.error("Training error:", error);
      throw error;
    }
  }

  async detectLocation(base64Image: string): Promise<DetectionResult | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Identify the current campus location. Available: ${CAMPUS_NODES.map(n => n.name).join(', ')}. Return JSON with "locationId", "confidence", and "description" (mentioning landmarks).` }
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

      const result = JSON.parse(response.text || '{}');
      const matchedNode = CAMPUS_NODES.find(n => n.id === result.locationId || n.name.toLowerCase().includes(result.locationId.toLowerCase()));
      
      return {
        locationId: matchedNode ? matchedNode.id : result.locationId,
        confidence: result.confidence,
        description: result.description
      };
    } catch (error) {
      console.error("Vision detection error:", error);
      return null;
    }
  }

  async detectDestination(base64Image: string): Promise<DetectionResult | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Look at this sign or building and identify it as a DESTINATION. Available: ${CAMPUS_NODES.map(n => n.name).join(', ')}. Return JSON with "locationId", "confidence", and "description" explaining why you identified this as the target.` }
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

      const result = JSON.parse(response.text || '{}');
      const matchedNode = CAMPUS_NODES.find(n => n.id === result.locationId || n.name.toLowerCase().includes(result.locationId.toLowerCase()));
      
      return {
        locationId: matchedNode ? matchedNode.id : result.locationId,
        confidence: result.confidence,
        description: result.description
      };
    } catch (error) {
      console.error("Destination detection error:", error);
      return null;
    }
  }

  async verifyArrival(base64Image: string, destinationName: string): Promise<{ arrived: boolean; confidence: number }> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: `Is this user currently at or inside ${destinationName}? Look for signage, door numbers, or specific layout. Return JSON: {"arrived": boolean, "confidence": number}` }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              arrived: { type: Type.BOOLEAN },
              confidence: { type: Type.NUMBER }
            },
            required: ["arrived", "confidence"]
          }
        }
      });
      return JSON.parse(response.text || '{}');
    } catch {
      return { arrived: false, confidence: 0 };
    }
  }

  async getDynamicInstructions(pathNames: string[], detailed: boolean = false): Promise<string[]> {
    try {
      const prompt = detailed 
        ? `Generate extremely detailed, descriptive step-by-step navigation instructions for a visually impaired user for this path: ${pathNames.join(' -> ')}. Include sensory details, landmarks, and safety warnings. Return a JSON array of strings.`
        : `Generate step-by-step navigation instructions for this path: ${pathNames.join(' -> ')}. Keep it simple. Use landmarks. Return a JSON array of strings.`;
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    } catch {
      return pathNames.map(name => `Proceed to ${name}`);
    }
  }

  async generateSpeech(text: string): Promise<string | undefined> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Speak clearly and helpfully: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (e) {
      console.error("TTS failed", e);
      return undefined;
    }
  }
}
