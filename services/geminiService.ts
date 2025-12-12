import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, EmbryoGrade, PatientData, ChatMessage } from "../types";

const mapQualityToEnum = (quality: string): EmbryoGrade => {
  const q = quality.toLowerCase();
  if (q.includes('excellent')) return EmbryoGrade.EXCELLENT;
  if (q.includes('good')) return EmbryoGrade.GOOD;
  if (q.includes('fair') || q.includes('average')) return EmbryoGrade.FAIR;
  return EmbryoGrade.POOR;
};

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeEmbryoMedia = async (file: File, patientData: PatientData): Promise<AnalysisResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3-pro-preview"; // Use Pro for multimodal analysis
  
  const isVideo = file.type.startsWith('video/');

  let contentParts: any[] = [];
  
  try {
      const base64Data = await fileToBase64(file);
      contentParts = [{
        inlineData: { mimeType: file.type, data: base64Data }
      }];
  } catch (err) {
    console.error("Media processing failed", err);
    throw new Error("Failed to process media file.");
  }

  const prompt = isVideo ? `
    You are an expert Clinical Embryologist performing Time-Lapse Morphokinetic (TLM) analysis.
    Analyze this video of embryo development.

    PATIENT CONTEXT:
    - Maternal Age: ${patientData.age} years.
    - Retrieval Date: ${patientData.retrievalDate}.

    Tasks:
    1. GRADE: Assign a final Gardner Score (e.g., 4AA).
    2. SEGMENTATION: Identify coordinates for ICM and TE.
    3. TIMELINE: Identify the developmental milestones (t2, t3, Morula, Blastocyst) visible or inferred. 
       - Estimate hours post-insemination (hpi) if typical, or judge "Normal/Delayed" based on visual progression.
    4. ALERTS: Detect specific anomalies: Direct Cleavage, Reverse Cleavage, Multinucleation, Vacuoles.
    5. RISK: Estimate Implantation Probability & Aneuploidy Risk (consider Age: ${patientData.age}).

    Output must be raw JSON adhering to the schema.
  ` : `
    You are an expert Clinical Embryologist and Reproductive Endocrinologist.
    Perform a rigorous assessment of this static microscopic image using the Gardner Grading System.

    PATIENT CONTEXT:
    - Maternal Age: ${patientData.age} years old.
    - Retrieval Date: ${patientData.retrievalDate}.

    Tasks:
    1. GRADE: Assign a Gardner Score (e.g., 4AA, 3BB).
    2. SEGMENTATION: Identify bounding boxes for ICM, TE, and Vacuoles.
    3. TIMELINE: Infer the likely developmental stage based on the image (e.g., "Expanded Blastocyst").
    4. ALERTS: Check for cytoplasmic anomalies (vacuoles, granulation) or heavy fragmentation.
    5. RISK: Estimate Implantation Probability and Aneuploidy Risk (Age > 35 increases risk).

    Output must be raw JSON adhering to the schema.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      gardnerScore: { type: Type.STRING, description: "e.g., 4AA, 3BB" },
      aiGrade: { type: Type.STRING, description: "Excellent, Good, Fair, Poor" },
      implantationProbability: { type: Type.NUMBER, description: "0-100" },
      aneuploidyRisk: { type: Type.STRING, description: "Low, Medium, High" },
      confidenceScore: { type: Type.NUMBER, description: "0-100" },
      morphology: {
        type: Type.OBJECT,
        properties: {
          expansion: { type: Type.STRING },
          innerCellMass: { type: Type.STRING },
          trophectoderm: { type: Type.STRING },
          fragmentationLevel: { type: Type.NUMBER },
          symmetry: { type: Type.NUMBER },
          zonaThickness: { type: Type.STRING },
          vacuoles: { type: Type.BOOLEAN },
        }
      },
      timeline: {
        type: Type.ARRAY,
        description: "Morphokinetic timeline events",
        items: {
          type: Type.OBJECT,
          properties: {
            stage: { type: Type.STRING, description: "t2, t3, Morula, Blastocyst" },
            timeHours: { type: Type.NUMBER, description: "Approximate hours post-insemination" },
            status: { type: Type.STRING, description: "Normal, Delayed, Accelerated, Abnormal" },
            description: { type: Type.STRING, description: "Brief observation" }
          }
        }
      },
      rois: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            color: { type: Type.STRING },
            confidence: { type: Type.NUMBER }
          }
        }
      },
      clinicalFindings: { type: Type.STRING },
      medicalReference: { type: Type.STRING },
      recommendation: { type: Type.STRING },
      anomalies: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["gardnerScore", "aiGrade", "rois", "aneuploidyRisk", "timeline"]
  };

  try {
    const result = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          ...contentParts,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const jsonText = result.text;
    if (!jsonText) throw new Error("No response from AI model.");

    const parsed = JSON.parse(jsonText);

    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      gardnerScore: parsed.gardnerScore || "N/A",
      aiGrade: mapQualityToEnum(parsed.aiGrade || "Fair"),
      implantationProbability: parsed.implantationProbability || 0,
      aneuploidyRisk: parsed.aneuploidyRisk || "Unknown",
      confidenceScore: parsed.confidenceScore || 85,
      morphology: {
        expansion: parsed.morphology?.expansion || "?",
        innerCellMass: parsed.morphology?.innerCellMass || "?",
        trophectoderm: parsed.morphology?.trophectoderm || "?",
        fragmentationLevel: parsed.morphology?.fragmentationLevel || 0,
        symmetry: parsed.morphology?.symmetry || 0,
        zonaThickness: parsed.morphology?.zonaThickness || "Normal",
        vacuoles: parsed.morphology?.vacuoles || false,
      },
      timeline: parsed.timeline || [],
      rois: parsed.rois || [],
      medicalReference: parsed.medicalReference || "Gardner & Schoolcraft, 1999",
      clinicalFindings: parsed.clinicalFindings || "Assessment complete.",
      recommendation: parsed.recommendation || "Re-evaluate",
      anomalies: parsed.anomalies || []
    };
  } catch (error) {
    console.error("Analysis Failed:", error);
    throw error;
  }
};

export const sendChatMessage = async (
  history: ChatMessage[], 
  newMessage: string, 
  contextResult?: AnalysisResult,
  useSearch: boolean = false
): Promise<{ text: string; citations?: { uri: string; title: string }[] }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found.");
  
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-3-pro-preview";

  const contextPrompt = contextResult ? `
    CONTEXT: You are "Dr. Gemini", an AI Embryology Assistant.
    You are discussing an embryo with Gardner Score: ${contextResult.gardnerScore}.
    Morphology: ICM=${contextResult.morphology.innerCellMass}, TE=${contextResult.morphology.trophectoderm}, Exp=${contextResult.morphology.expansion}.
    Timeline Events: ${JSON.stringify(contextResult.timeline)}.
    Anomalies Detected: ${contextResult.anomalies.join(', ')}.
    Findings: ${contextResult.clinicalFindings}.
    Recommendation: ${contextResult.recommendation}.
    
    If "Web Search" is active, use the search tool to find recent medical literature (ASRM/ESHRE guidelines) to support your answer. 
    Always cite sources if search is used.
    
    Answer the user's question specifically about this embryo or general protocols. Keep answers clinical and concise.
  ` : `You are "Dr. Gemini", an AI Embryology Assistant. Answer clinical questions. Use search if requested to find latest literature.`;

  const chat = ai.chats.create({
    model: modelId,
    config: {
      systemInstruction: contextPrompt,
      tools: useSearch ? [{ googleSearch: {} }] : undefined
    },
    history: history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }))
  });

  const result = await chat.sendMessage({ message: newMessage });
  
  // Extract grounding chunks if available
  const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const citations: { uri: string; title: string }[] = [];
  
  if (groundingChunks) {
    groundingChunks.forEach(chunk => {
      if (chunk.web) {
        citations.push({
          uri: chunk.web.uri || '',
          title: chunk.web.title || 'Source'
        });
      }
    });
  }

  return { text: result.text, citations };
};