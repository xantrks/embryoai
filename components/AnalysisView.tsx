import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, AlertCircle, Loader2, Microscope, 
  Sun, Contrast, Check, BrainCircuit, Scan, Eye, FileText,
  Image as ImageIcon, Plus, Trash2, Columns, X,
  Target, MessageSquare, Calculator, Crown, Ruler, ChevronRight, Send, Download, Scale,
  Clock, AlertTriangle, Globe, BookOpen, Mic, MicOff, MousePointer
} from 'lucide-react';
import { 
  ResponsiveContainer, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { EmbryoFile, AnalysisResult, EmbryoGrade, MorphologyData, PatientData, ChatMessage } from '../types';
import { analyzeEmbryoMedia, sendChatMessage } from '../services/geminiService';
import { generateEmbryoReport } from '../utils/pdfExport';

// --- Helper: Voice Dictation Hook ---
const useDictation = (onResult: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [onResult]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start dictation", e);
      }
    } else if (!recognitionRef.current) {
      alert("Dictation not supported in this browser. Please use Chrome or Safari.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return { isListening, startListening, stopListening };
};

// --- Components ---

const PatientModal: React.FC<{ 
  onSubmit: (data: PatientData) => void; 
  onCancel: () => void 
}> = ({ onSubmit, onCancel }) => {
  const [data, setData] = useState<PatientData>({
    id: '',
    age: 32,
    retrievalDate: new Date().toISOString().split('T')[0]
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-semibold text-white mb-1">New Assessment</h3>
        <p className="text-sm text-slate-400 mb-6">Enter patient context for accurate risk grading.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Patient ID / MRN</label>
            <input 
              type="text" 
              value={data.id}
              onChange={e => setData({...data, id: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-teal-500 outline-none"
              placeholder="e.g. PT-8942"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Maternal Age (Years)</label>
            <input 
              type="number" 
              value={data.age}
              onChange={e => setData({...data, age: Number(e.target.value)})}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-teal-500 outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">Used for Aneuploidy Risk calculation.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Oocyte Retrieval Date</label>
            <input 
              type="date" 
              value={data.retrievalDate}
              onChange={e => setData({...data, retrievalDate: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
           <button onClick={onCancel} className="flex-1 py-2 text-sm text-slate-400 hover:bg-slate-800 rounded transition-colors">Cancel</button>
           <button 
             onClick={() => data.id ? onSubmit(data) : alert('Patient ID required')}
             className="flex-1 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded transition-colors"
           >
             Continue to Upload
           </button>
        </div>
      </div>
    </div>
  );
};

const CalibrationModal: React.FC<{
  pixelLength: number;
  onSubmit: (microns: number) => void;
  onCancel: () => void;
}> = ({ pixelLength, onSubmit, onCancel }) => {
  const [microns, setMicrons] = useState<string>('100');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl">
        <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wide flex items-center gap-2">
          <Scale size={16} className="text-yellow-400"/> Calibrate Scale
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Enter the physical length of the line you just drawn in microns (µm).
        </p>
        
        <div className="bg-slate-800 p-3 rounded mb-4 text-center">
          <div className="text-[10px] text-slate-500 mb-1">Measured Pixels</div>
          <div className="text-lg font-mono text-white">{pixelLength.toFixed(1)} px</div>
        </div>

        <div className="mb-6">
          <label className="block text-[10px] font-bold text-slate-500 mb-1">ACTUAL LENGTH (µm)</label>
          <input 
            type="number" 
            value={microns}
            onChange={(e) => setMicrons(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white focus:ring-1 focus:ring-yellow-500 outline-none font-mono text-right"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-1.5 text-xs text-slate-400 hover:bg-slate-800 rounded">Cancel</button>
          <button 
            onClick={() => onSubmit(Number(microns))}
            className="flex-1 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded"
          >
            Set Scale
          </button>
        </div>
      </div>
    </div>
  );
};

const MetricBox = ({label, value}: {label: string, value: string|number}) => (
  <div className="bg-slate-800/50 p-2 rounded border border-slate-800">
    <div className="text-[10px] text-slate-500 uppercase">{label}</div>
    <div className="text-sm font-medium text-slate-200">{value}</div>
  </div>
);

export const AnalysisView: React.FC = () => {
  // --- State ---
  const [files, setFiles] = useState<EmbryoFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hoveredRoiIndex, setHoveredRoiIndex] = useState<number | null>(null);
  
  // Modal & Flow
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);

  // Tabs (Right Panel)
  const [activeTab, setActiveTab] = useState<'analysis' | 'chat'>('analysis');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Image Adjustment
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  // Tools: Measure & Calibrate
  const [toolMode, setToolMode] = useState<'none' | 'measure' | 'calibrate'>('none');
  const [drawPoints, setDrawPoints] = useState<{x:number, y:number}[]>([]);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Voice Hook
  const { isListening, startListening, stopListening } = useDictation((text) => {
    setChatInput(text);
  });

  // Derived
  const selectedFiles = files.filter(f => selectedIds.has(f.id));
  const activeFile = selectedFiles.length === 1 ? selectedFiles[0] : null;
  const isComparisonMode = selectedFiles.length > 1;

  // Persistence Load
  useEffect(() => {
    const saved = localStorage.getItem('embryo_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFiles(parsed.map((f: any) => ({...f, status: f.result ? 'complete' : 'error', url: ''}))); 
      } catch (e) { console.error("Load failed", e); }
    }
  }, []);

  // Persistence Save
  useEffect(() => {
    if (files.length > 0) {
      // Don't save URL blobs to local storage
      const safeFiles = files.map(({ url, file, ...rest }) => rest);
      localStorage.setItem('embryo_session', JSON.stringify(safeFiles));
    }
  }, [files]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // --- Handlers ---

  const initiateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPendingUpload(e.target.files[0]);
      setShowPatientModal(true);
      e.target.value = '';
    }
  };

  const handlePatientSubmit = async (patientData: PatientData) => {
    setShowPatientModal(false);
    if (!pendingUpload) return;

    const file = pendingUpload;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError("Invalid format. Supported: Images (PNG, JPG) and Videos (MP4).");
      setPendingUpload(null);
      return;
    }

    const newId = crypto.randomUUID();
    const newFile: EmbryoFile = {
      id: newId,
      name: file.name,
      url: URL.createObjectURL(file),
      file: file,
      type: isVideo ? 'video' : 'image',
      status: 'analyzing',
      patientData
    };

    setFiles(prev => [...prev, newFile]);
    setSelectedIds(new Set([newId]));
    setPendingUpload(null);

    try {
      const result = await analyzeEmbryoMedia(file, patientData);
      setFiles(prev => prev.map(f => f.id === newId ? { ...f, status: 'complete', result } : f));
      // Init chat
      setChatHistory([{
        role: 'model', 
        text: `Analysis complete for ${patientData.id}. I've graded this embryo as ${result.gardnerScore}. Ask me anything about the morphology.`,
        timestamp: new Date()
      }]);
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === newId ? { ...f, status: 'error' } : f));
      setError("Analysis failed. " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !activeFile?.result) return;
    
    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Use Search logic
      const response = await sendChatMessage(chatHistory, chatInput, activeFile.result, useSearch);
      setChatHistory(prev => [...prev, { 
        role: 'model', 
        text: response.text, 
        timestamp: new Date(),
        citations: response.citations
      }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'model', text: "Connection error. Please try again.", timestamp: new Date() }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Measure & Calibrate Tool Logic
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (toolMode === 'none' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawPoints.length === 0) {
      setDrawPoints([{x, y}]);
    } else {
      const p1 = drawPoints[0];
      const p2 = {x, y};
      setDrawPoints([p1, p2]);
      
      // If calibration mode, trigger modal immediately after second point
      if (toolMode === 'calibrate') {
        setShowCalibrationModal(true);
      } else {
        // Measure mode just finishes the line
        setToolMode('none');
      }
    }
  };

  const getPixelDistance = () => {
    if (drawPoints.length < 2) return 0;
    const p1 = drawPoints[0];
    const p2 = drawPoints[1];
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const handleCalibrationSubmit = (microns: number) => {
    const pixels = getPixelDistance();
    if (pixels > 0 && activeFile) {
      const scale = pixels / microns;
      setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, calibrationScale: scale } : f));
    }
    setShowCalibrationModal(false);
    setToolMode('none');
    setDrawPoints([]);
  };

  // Helper
  const safeParseInt = (val: string | undefined) => {
    if (!val) return 0;
    const num = parseInt(val);
    return isNaN(num) ? 0 : num;
  };

  const getSpecificMorphologyDetail = (label: string, morphology: MorphologyData) => {
    const l = label.toLowerCase();
    if (l.includes('icm') || l.includes('inner')) return { label: 'Grading', value: morphology.innerCellMass };
    if (l.includes('te') || l.includes('troph')) return { label: 'Grading', value: morphology.trophectoderm };
    return null;
  };

  const toggleSelection = (id: string, multiSelect: boolean) => {
    const newSet = new Set(multiSelect ? selectedIds : []);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    if (!multiSelect && newSet.size === 0) newSet.add(id);
    setSelectedIds(newSet);
  };

  const removeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(prev => prev.filter(f => f.id !== id));
    const newSet = new Set(selectedIds);
    newSet.delete(id);
    setSelectedIds(newSet);
  };

  // Identify best candidate logic
  const bestCandidateId = isComparisonMode ? selectedFiles.reduce((best, current) => {
    if (!best.result || !current.result) return best;
    const bestScore = best.result.implantationProbability - (best.result.aneuploidyRisk === 'High' ? 50 : 0);
    const currScore = current.result.implantationProbability - (current.result.aneuploidyRisk === 'High' ? 50 : 0);
    return currScore > bestScore ? current : best;
  }, selectedFiles[0])?.id : null;


  // --- Render ---

  const renderSingleView = (file: EmbryoFile) => (
    <div className="flex-1 flex overflow-hidden">
        {/* Center Canvas */}
        <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
           {/* Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-10" 
               style={{backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px'}}>
          </div>

          <div 
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`relative inline-block max-w-full max-h-full ${toolMode !== 'none' ? 'cursor-crosshair' : ''}`}
          >
            {/* Visual Guide for Calibration */}
            {toolMode === 'calibrate' && drawPoints.length === 0 && (
              <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                <style>{`
                  @keyframes guideMove {
                    0% { transform: translate(-40px, 0); opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translate(40px, 0); opacity: 0; }
                  }
                  @keyframes guideLine {
                    0% { width: 0; opacity: 0; }
                    20% { opacity: 1; }
                    100% { width: 80px; opacity: 1; }
                  }
                `}</style>
                <div className="bg-slate-900/90 border border-slate-700 p-6 rounded-xl shadow-2xl backdrop-blur-md max-w-sm text-center animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-full h-32 bg-slate-800/50 rounded-lg mb-4 relative overflow-hidden flex items-center justify-center border border-slate-700/50">
                     <div className="relative h-20 w-full flex items-center justify-center">
                        {/* Start Dot */}
                        <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10" />
                        
                        {/* Growing Line */}
                        <div className="h-0.5 bg-yellow-400 absolute left-1/2 top-1/2 -translate-y-1/2 origin-left animate-[guideLine_2s_ease-in-out_infinite]" />
                        
                        {/* End Dot */}
                        <div className="w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)] absolute left-[calc(50%+80px)] top-1/2 -translate-y-1/2 opacity-0 animate-[guideMove_2s_ease-in-out_infinite] delay-1000" style={{animationName: 'fadeDot', animationDuration: '2s'}} />

                        {/* Mouse Cursor */}
                        <MousePointer 
                          className="absolute text-white drop-shadow-md z-20" 
                          size={24} 
                          style={{
                            animation: 'guideMove 2s ease-in-out infinite',
                            top: '50%',
                            left: '50%',
                            marginTop: '10px'
                          }}
                        />
                     </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">Calibrate Scale</h4>
                  <p className="text-sm text-slate-400">
                    Click two points to define a known distance (e.g., scale bar).
                  </p>
                </div>
              </div>
            )}

            {file.url ? (
              <div style={{
                filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert ? 1 : 0})`,
                transition: 'filter 0.2s'
              }}>
                 {file.type === 'video' ? (
                   <video 
                     src={file.url} 
                     controls 
                     loop 
                     autoPlay
                     muted
                     className="max-h-[80vh] rounded shadow-2xl border border-slate-800 block"
                   />
                 ) : (
                   <img src={file.url} alt="Embryo" className="max-h-[80vh] rounded shadow-2xl border border-slate-800 block" />
                 )}
              </div>
            ) : (
              <div className="w-[500px] h-[500px] bg-slate-900 flex items-center justify-center border border-slate-800 rounded">
                <p className="text-slate-500">Media Expired (Session Reloaded)</p>
              </div>
            )}

            {/* ROI Overlay */}
            {showOverlay && file.result?.rois && file.result.rois.map((roi, idx) => {
              const top = roi.box_2d[0] / 10;
              const left = roi.box_2d[1] / 10;
              const height = (roi.box_2d[2] - roi.box_2d[0]) / 10;
              const width = (roi.box_2d[3] - roi.box_2d[1]) / 10;
              const isHovered = hoveredRoiIndex === idx;
              
              // Determine toolip position based on horizontal space
              const isRightSide = left > 50;

              return (
                <div 
                  key={idx} 
                  onMouseEnter={() => setHoveredRoiIndex(idx)}
                  onMouseLeave={() => setHoveredRoiIndex(null)}
                  onClick={(e) => { e.stopPropagation(); setHoveredRoiIndex(idx); }}
                  className={`absolute border-2 flex flex-col cursor-pointer transition-all duration-200 z-10 
                    ${isHovered ? 'z-20 bg-teal-500/10' : ''}`}
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                    borderColor: isHovered ? '#fff' : (roi.color || '#2dd4bf'),
                    boxShadow: isHovered ? '0 0 15px rgba(45, 212, 191, 0.5)' : '0 0 5px rgba(0,0,0,0.5)'
                  }}
                >
                  <span className={`text-[10px] px-1 py-0.5 w-fit -mt-6 rounded border whitespace-nowrap backdrop-blur-sm transition-colors
                    ${isHovered ? 'bg-white text-slate-900 border-white font-bold' : 'bg-slate-900/80 text-white border-slate-700'}`}>
                    {roi.label}
                  </span>
                  {/* Tooltip */}
                  {isHovered && file.result && (
                    <div 
                      className={`absolute top-0 w-48 bg-slate-900/95 border border-slate-600 rounded-lg p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 z-50`}
                      style={{
                        [isRightSide ? 'right' : 'left']: '105%',
                      }}
                    >
                       <div className="flex items-center gap-2 mb-2 border-b border-slate-700 pb-2">
                         <Target size={14} className="text-teal-400" />
                         <span className="text-xs font-bold text-slate-200">{roi.label}</span>
                       </div>
                       <div className="space-y-2">
                         {roi.confidence && (
                           <div className="flex justify-between items-center text-xs">
                             <span className="text-slate-400">Confidence</span>
                             <span className="text-teal-400 font-mono">{roi.confidence}%</span>
                           </div>
                         )}
                         {(() => {
                           const detail = getSpecificMorphologyDetail(roi.label, file.result.morphology);
                           if (detail) return (
                             <div className="flex justify-between items-center text-xs bg-slate-800/50 p-1.5 rounded">
                               <span className="text-slate-400">{detail.label}</span>
                               <span className="text-white font-bold">{detail.value}</span>
                             </div>
                           );
                           return null;
                         })()}
                       </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drawing Layer (Measure/Calibrate) */}
            {(drawPoints.length > 0) && (
              <svg className="absolute inset-0 pointer-events-none z-30" style={{width: '100%', height: '100%'}}>
                 <line 
                   x1={drawPoints[0].x} y1={drawPoints[0].y}
                   x2={drawPoints[1]?.x || drawPoints[0].x} y2={drawPoints[1]?.y || drawPoints[0].y}
                   stroke={toolMode === 'calibrate' ? '#facc15' : '#f43f5e'} 
                   strokeWidth="2" 
                   strokeDasharray={toolMode === 'calibrate' ? "0" : "5,5"}
                 />
                 {drawPoints.map((p, i) => (
                   <circle key={i} cx={p.x} cy={p.y} r="4" fill={toolMode === 'calibrate' ? '#facc15' : '#f43f5e'} />
                 ))}
                 {drawPoints.length === 2 && toolMode !== 'calibrate' && (
                   <text x={(drawPoints[0].x + drawPoints[1].x)/2} y={(drawPoints[0].y + drawPoints[1].y)/2 - 10} fill="#f43f5e" fontSize="12" fontWeight="bold">
                     {file.calibrationScale 
                       ? `${(getPixelDistance() / file.calibrationScale).toFixed(1)} µm` 
                       : `${getPixelDistance().toFixed(0)} px`}
                   </text>
                 )}
              </svg>
            )}
          </div>

          {/* Loading */}
          {file.status === 'analyzing' && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
               <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
               <h3 className="text-xl font-light text-white tracking-widest uppercase">
                 {file.type === 'video' ? 'Processing Time-Lapse' : 'Analyzing Morphology'}
               </h3>
             </div>
          )}
        </div>

        {/* Right Panel (Split View) */}
        {file.result && (
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
             <button 
               onClick={() => setActiveTab('analysis')}
               className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider ${activeTab === 'analysis' ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
             >
               Analysis
             </button>
             <button 
               onClick={() => setActiveTab('chat')}
               className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider ${activeTab === 'chat' ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
             >
               AI Assistant
             </button>
          </div>

          {activeTab === 'analysis' ? (
             <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Score */}
                <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gardner Score</h3>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-4xl font-bold text-white tracking-tight">{file.result.gardnerScore}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border 
                            ${file.result.aiGrade === EmbryoGrade.EXCELLENT ? 'border-green-500/30 text-green-400 bg-green-500/10' : 
                              file.result.aiGrade === EmbryoGrade.POOR ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'}`}>
                            {file.result.aiGrade}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 mb-1">AI Confidence</div>
                        <div className="text-sm font-mono text-teal-400">{file.result.confidenceScore}%</div>
                      </div>
                  </div>
                  
                  {/* Bars */}
                  <div className="space-y-4 mt-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Viability</span>
                        <span className="text-white font-bold">{file.result.implantationProbability}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-teal-500 rounded-full" style={{width: `${file.result.implantationProbability}%`}}></div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                      <span className="text-xs text-slate-400">Est. Aneuploidy Risk</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded border 
                        ${file.result.aneuploidyRisk === 'High' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 
                          'text-green-400 border-green-500/30 bg-green-500/10'}`}>
                        {file.result.aneuploidyRisk}
                      </span>
                  </div>
                </div>

                {/* Anomalies Alerts */}
                {file.result.anomalies && file.result.anomalies.length > 0 && (
                  <div className="p-6 border-b border-slate-800 bg-red-900/10">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle size={14} className="text-red-400" />
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Clinical Alerts</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {file.result.anomalies.map((anom, i) => (
                        <span key={i} className="text-[10px] bg-red-500/20 text-red-200 border border-red-500/30 px-2 py-1 rounded">
                          {anom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Timeline */}
                {file.result.timeline && file.result.timeline.length > 0 && (
                  <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock size={14} className="text-teal-400" />
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Morphokinetics</h4>
                    </div>
                    <div className="relative pl-2 ml-1 border-l border-slate-700 space-y-6">
                      {file.result.timeline.map((event, idx) => (
                        <div key={idx} className="relative pl-6">
                          {/* Dot */}
                          <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            event.status === 'Normal' ? 'bg-teal-500' : 
                            event.status === 'Delayed' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          
                          {/* Content */}
                          <div>
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-xs font-bold text-slate-200">{event.stage}</span>
                              {event.timeHours && <span className="text-[10px] text-slate-500 font-mono">{event.timeHours}hpi</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 leading-snug">{event.description}</div>
                            {event.status !== 'Normal' && (
                              <span className={`inline-block mt-1 text-[9px] px-1.5 rounded ${
                                event.status === 'Delayed' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'
                              }`}>
                                {event.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Morphology Grid */}
                <div className="p-6 border-b border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Morphology</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-slate-800/50 rounded border border-slate-800">
                      <div className="text-slate-500 text-xs mb-1">Expansion</div>
                      <div className="text-slate-200 font-medium">{file.result.morphology.expansion}</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded border border-slate-800">
                      <div className="text-slate-500 text-xs mb-1">ICM</div>
                      <div className="text-slate-200 font-medium">{file.result.morphology.innerCellMass}</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded border border-slate-800">
                      <div className="text-slate-500 text-xs mb-1">TE</div>
                      <div className="text-slate-200 font-medium">{file.result.morphology.trophectoderm}</div>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded border border-slate-800">
                      <div className="text-slate-500 text-xs mb-1">Fragmentation</div>
                      <div className="text-slate-200 font-medium">{file.result.morphology.fragmentationLevel}%</div>
                    </div>
                  </div>
                </div>

                {/* Radar */}
                <div className="h-64 border-b border-slate-800 bg-slate-900/30">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={[
                      { subject: 'Symm.', A: file.result.morphology.symmetry, fullMark: 100 },
                      { subject: 'Frag. (Inv)', A: 100 - file.result.morphology.fragmentationLevel, fullMark: 100 },
                      { subject: 'Exp.', A: safeParseInt(file.result.morphology.expansion) * 16.6, fullMark: 100 },
                      { subject: 'Viability', A: file.result.implantationProbability, fullMark: 100 },
                    ]}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Metrics" dataKey="A" stroke="#14b8a6" strokeWidth={2} fill="#14b8a6" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="p-6">
                  <button onClick={() => generateEmbryoReport(file)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center justify-center gap-2 text-sm transition-colors">
                    <Download size={14} /> Download Clinical Report (PDF)
                  </button>
                </div>
             </div>
          ) : (
             <div className="flex-1 flex flex-col bg-slate-950">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {/* Chat Mode Toggles */}
                  <div className="flex justify-end px-2">
                     <button 
                       onClick={() => setUseSearch(!useSearch)}
                       className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                         useSearch 
                           ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                           : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                       }`}
                     >
                       <Globe size={12} />
                       {useSearch ? 'Medical Literature Active' : 'Search Off'}
                     </button>
                  </div>

                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-teal-600/20 text-teal-100 border border-teal-600/30' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                         {msg.text}
                      </div>
                      
                      {/* Render Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 max-w-[85%] bg-slate-900 border border-slate-800 rounded p-2">
                          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <BookOpen size={10} /> Research Grounding
                          </div>
                          <div className="space-y-1">
                            {msg.citations.map((cite, cIdx) => (
                              <a 
                                key={cIdx} 
                                href={cite.uri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="block text-[10px] text-blue-400 hover:underline truncate"
                              >
                                {cite.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                       <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                         <Loader2 size={16} className="animate-spin text-teal-400" />
                       </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-slate-800 bg-slate-900">
                   <div className="flex gap-2">
                     <div className="relative flex-1">
                       <input 
                         className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white focus:ring-1 focus:ring-teal-500 outline-none"
                         placeholder={isListening ? "Listening..." : "Ask Dr. Gemini..."}
                         value={chatInput}
                         onChange={(e) => setChatInput(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                       />
                       <button 
                         onClick={isListening ? stopListening : startListening}
                         className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-500 hover:text-teal-400'}`}
                       >
                         {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                       </button>
                     </div>
                     <button onClick={handleChatSend} className="p-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-white transition-colors">
                       <Send size={16} />
                     </button>
                   </div>
                </div>
             </div>
          )}
        </div>
        )}
      </div>
  );

  return (
    <div className="flex-1 relative flex">
      {/* Left Panel */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col absolute left-0 top-0 bottom-0 z-10">
        {/* Upload Section */}
        <div className="p-4 border-b border-slate-800">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">New Analysis</h3>
           <label className="flex flex-col items-center justify-center w-full h-24 border border-slate-700 border-dashed rounded-lg cursor-pointer hover:bg-slate-800 transition-all group">
              <div className="flex flex-col items-center justify-center">
                <div className="bg-slate-800 p-2 rounded-full mb-1 group-hover:bg-slate-700">
                  <Plus className="w-4 h-4 text-teal-500" />
                </div>
                <span className="text-[10px] text-slate-400">Add Micrograph / Video</span>
              </div>
              <input type="file" className="hidden" onChange={initiateUpload} accept="image/*,video/mp4" />
           </label>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <h3 className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Session Files</h3>
          <div className="space-y-1">
            {files.map(file => {
               const isSelected = selectedIds.has(file.id);
               return (
                 <div 
                   key={file.id} 
                   onClick={() => toggleSelection(file.id, false)}
                   className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all
                     ${isSelected ? 'bg-slate-800 border-teal-500/50' : 'hover:bg-slate-800/50 border-transparent hover:border-slate-700'}`}
                 >
                   {/* Thumbnail */}
                   <div className="w-10 h-10 bg-black rounded overflow-hidden flex-shrink-0 border border-slate-700 relative">
                     {file.url && (
                       file.type === 'video' ? 
                       <div className="w-full h-full flex items-center justify-center text-slate-500 text-[8px]">VIDEO</div> :
                       <img src={file.url} className="w-full h-full object-cover opacity-80" alt="thumb" />
                     )}
                   </div>
                   
                   {/* Info */}
                   <div className="flex-1 min-w-0">
                     <div className="text-xs text-slate-200 truncate font-medium">{file.name}</div>
                     <div className="text-[10px] text-slate-500 flex items-center gap-1">
                       {file.status === 'analyzing' ? <Loader2 size={10} className="animate-spin" /> : 
                        file.status === 'error' ? <AlertCircle size={10} className="text-red-400" /> : 
                        <span className="text-teal-400">{file.result?.gardnerScore || 'Done'}</span>}
                     </div>
                   </div>

                   {/* Compare Checkbox */}
                   <div onClick={(e) => e.stopPropagation()}>
                     <input 
                       type="checkbox" 
                       checked={isSelected}
                       onChange={() => toggleSelection(file.id, true)}
                       className="w-3 h-3 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-0 cursor-pointer"
                     />
                   </div>
                   
                   {/* Delete Button */}
                   <button 
                     onClick={(e) => removeFile(file.id, e)}
                     className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-slate-500 transition-opacity"
                   >
                     <Trash2 size={12} />
                   </button>
                 </div>
               );
            })}
            {files.length === 0 && (
              <div className="text-center py-8 opacity-30">
                <div className="text-[10px] text-slate-500">No files in session</div>
              </div>
            )}
          </div>
        </div>

        {/* View Settings */}
        {!isComparisonMode && activeFile && (
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">View Settings</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Sun size={12}/> Brightness</span>
              </div>
              <input 
                type="range" min="50" max="150" value={brightness} 
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
               <span className="text-xs text-slate-400 flex items-center gap-1"><Scan size={12}/> AI Overlay</span>
               <button 
                onClick={() => setShowOverlay(!showOverlay)}
                className={`w-8 h-4 rounded-full relative transition-colors ${showOverlay ? 'bg-teal-600' : 'bg-slate-700'}`}
               >
                 <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showOverlay ? 'left-4.5' : 'left-0.5'}`} style={{left: showOverlay ? '18px' : '2px'}}></div>
               </button>
            </div>
          </div>

          {/* Tools Section */}
          <div className="mt-6 pt-4 border-t border-slate-800">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Tools</h3>
             <div className="flex gap-2">
                <button 
                  onClick={() => setToolMode(toolMode === 'measure' ? 'none' : 'measure')}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-2 border transition-all
                    ${toolMode === 'measure' ? 'bg-teal-600 border-teal-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  <Ruler size={14} /> Measure
                </button>
                <button 
                  onClick={() => setToolMode(toolMode === 'calibrate' ? 'none' : 'calibrate')}
                  className={`flex-1 py-2 px-3 rounded text-xs font-medium flex items-center justify-center gap-2 border transition-all
                    ${toolMode === 'calibrate' ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                >
                  <Scale size={14} /> Calibrate
                </button>
             </div>
          </div>
        </div>
        )}
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex overflow-hidden">
         {isComparisonMode ? (
           <div className="flex-1 bg-slate-950 overflow-x-auto overflow-y-auto p-8 custom-scrollbar">
             <div className="min-w-max">
               <h2 className="text-xl font-light text-white mb-6 flex items-center gap-2">
                 <Columns size={24} className="text-teal-500"/>
                 Cohort Comparison
                 <span className="text-sm text-slate-500 ml-2 border-l border-slate-700 pl-2">
                   {selectedFiles.length} Embryos Selected
                 </span>
               </h2>
               
               <div className="flex gap-4">
                 {selectedFiles.map(file => {
                   const isBest = file.id === bestCandidateId;
                   const result = file.result;
                   
                   if (!result) return null;
         
                   return (
                     <div key={file.id} className={`w-80 flex-shrink-0 bg-slate-900 rounded-xl border-2 flex flex-col relative overflow-hidden transition-all
                       ${isBest ? 'border-teal-500 shadow-[0_0_30px_rgba(20,184,166,0.15)]' : 'border-slate-800'}`}>
                       
                       {isBest && (
                         <div className="absolute top-0 inset-x-0 h-1 bg-teal-500 z-20"></div>
                       )}
                       
                       {/* Header / Image */}
                       <div className="relative h-48 bg-black group">
                         {file.url ? (
                            file.type === 'video' ? 
                            <video src={file.url} className="w-full h-full object-cover opacity-80" muted /> :
                            <img src={file.url} className="w-full h-full object-cover opacity-80" alt="embryo" />
                         ) : <div className="w-full h-full bg-slate-800" />}
                         
                         <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                         
                         {isBest && (
                           <div className="absolute top-3 right-3 bg-teal-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
                             <Crown size={12} fill="currentColor" /> Top Candidate
                           </div>
                         )}
         
                         <div className="absolute bottom-4 left-4 z-10">
                           <div className="text-xs text-slate-400 font-mono mb-0.5">{file.patientData?.id || 'Unknown ID'}</div>
                           <div className="text-white font-medium truncate w-64">{file.name}</div>
                         </div>
                       </div>
         
                       {/* Metrics */}
                       <div className="p-5 space-y-6 flex-1">
                         {/* Score Block */}
                         <div className="flex justify-between items-end pb-4 border-b border-slate-800">
                           <div>
                             <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Gardner</div>
                             <div className="text-3xl font-bold text-white">{result.gardnerScore}</div>
                           </div>
                           <div className="text-right">
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border ${
                                 result.aiGrade === EmbryoGrade.EXCELLENT ? 'border-green-500/30 text-green-400 bg-green-500/10' : 
                                 result.aiGrade === EmbryoGrade.POOR ? 'border-red-500/30 text-red-400 bg-red-500/10' : 
                                 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                              }`}>
                                 {result.aiGrade}
                              </div>
                           </div>
                         </div>
         
                         {/* Probabilities */}
                         <div className="space-y-3">
                            <div>
                               <div className="flex justify-between text-xs mb-1.5">
                                 <span className="text-slate-400">Implantation Prob.</span>
                                 <span className="text-white font-mono">{result.implantationProbability}%</span>
                               </div>
                               <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-teal-500 rounded-full" style={{width: `${result.implantationProbability}%`}}></div>
                               </div>
                            </div>
                            
                            <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                               <span className="text-xs text-slate-400">Aneuploidy Risk</span>
                               <span className={`text-xs font-bold ${result.aneuploidyRisk === 'High' ? 'text-red-400' : 'text-slate-200'}`}>
                                 {result.aneuploidyRisk}
                               </span>
                            </div>
                         </div>
         
                         {/* Morphology Details */}
                         <div className="grid grid-cols-2 gap-2">
                            <MetricBox label="ICM" value={result.morphology.innerCellMass} />
                            <MetricBox label="TE" value={result.morphology.trophectoderm} />
                            <MetricBox label="Exp" value={result.morphology.expansion} />
                            <MetricBox label="Frag" value={`${result.morphology.fragmentationLevel}%`} />
                         </div>
         
                         {/* Anomalies */}
                         {result.anomalies.length > 0 ? (
                           <div className="flex flex-wrap gap-1.5 pt-2">
                             {result.anomalies.map((a, i) => (
                               <span key={i} className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                                 {a}
                               </span>
                             ))}
                           </div>
                         ) : (
                           <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
                             <Check size={14} /> No anomalies detected
                           </div>
                         )}
                       </div>
                       
                       <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                          <button onClick={() => { setSelectedIds(new Set([file.id])); }} className="w-full py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
                             View Detailed Analysis
                          </button>
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           </div>
         ) : (
           activeFile ? renderSingleView(activeFile) : (
           <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-500">
              <div className="flex flex-col items-center">
                 <div className="bg-slate-900 p-4 rounded-full mb-4">
                   <Microscope size={48} className="text-slate-700" />
                 </div>
                 <p>Select a file to view analysis</p>
              </div>
           </div>
         ))}
      </div>
      
      {/* Modals */}
      {showPatientModal && (
        <PatientModal 
          onSubmit={handlePatientSubmit} 
          onCancel={() => { setShowPatientModal(false); setPendingUpload(null); }} 
        />
      )}
      {showCalibrationModal && (
        <CalibrationModal 
          pixelLength={getPixelDistance()} 
          onSubmit={handleCalibrationSubmit} 
          onCancel={() => { setShowCalibrationModal(false); setToolMode('none'); setDrawPoints([]); }} 
        />
      )}
    </div>
  );
};