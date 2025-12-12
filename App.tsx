import React from 'react';
import { Sidebar } from './components/Sidebar';
import { AnalysisView } from './components/AnalysisView';

const App: React.FC = () => {
  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-200 overflow-hidden">
      <Sidebar />
      <AnalysisView />
    </div>
  );
};

export default App;