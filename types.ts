export enum EmbryoGrade {
  EXCELLENT = 'Excellent',
  GOOD = 'Good',
  FAIR = 'Fair',
  POOR = 'Poor'
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ROI {
  label: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  color: string; // Hex code for UI rendering
  confidence?: number; // 0-100 score for this specific detection
}

export interface MorphologyData {
  expansion: string; // 1-6
  innerCellMass: string; // A, B, C
  trophectoderm: string; // A, B, C
  fragmentationLevel: number; // 0-100
  symmetry: number; // 0-100
  zonaThickness: string; // Descriptive
  vacuoles: boolean;
}

export interface TimelineEvent {
  stage: string; // e.g., "t2", "t3", "Morula", "Blastocyst"
  timeHours?: number; // Estimated hours post-insemination (hpi)
  status: 'Normal' | 'Delayed' | 'Accelerated' | 'Abnormal';
  description: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: string;
  gardnerScore: string; // e.g., "4AA"
  aiGrade: EmbryoGrade;
  implantationProbability: number; // 0-100
  aneuploidyRisk: string; // Low, Medium, High
  confidenceScore: number; // 0-100 (AI confidence)
  morphology: MorphologyData;
  clinicalFindings: string;
  recommendation: 'Transfer' | 'Cryopreserve' | 'Discard' | 'Re-evaluate';
  anomalies: string[];
  rois: ROI[]; // Regions of interest detected by AI
  medicalReference: string; // Literature citation
  timeline: TimelineEvent[]; // Morphokinetic timeline
}

export interface PatientData {
  id: string;
  age: number;
  retrievalDate: string;
}

export interface EmbryoFile {
  id: string;
  name: string;
  url: string;
  file?: File; // Optional because of local storage serialization
  type: 'image' | 'video'; 
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  result?: AnalysisResult;
  patientData?: PatientData;
  calibrationScale?: number; // pixels per micron
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  citations?: { uri: string; title: string }[];
}