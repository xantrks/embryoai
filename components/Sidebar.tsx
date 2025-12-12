import React from 'react';
import { 
  Activity, 
  LayoutGrid, 
  Files, 
  Settings, 
  Database,
  Search,
  PenTool,
  Ruler,
  MousePointer2,
  ZoomIn
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  return (
    <div className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 z-20">
      {/* Brand Icon */}
      <div className="mb-8 p-2 bg-teal-500/10 rounded-xl text-teal-400">
        <Activity className="w-6 h-6" />
      </div>

      {/* Main Nav */}
      <nav className="flex-1 w-full flex flex-col items-center space-y-4">
        <SidebarButton icon={<LayoutGrid />} active tooltip="Dashboard" />
        <SidebarButton icon={<Files />} tooltip="Patient Files" />
        <SidebarButton icon={<Database />} tooltip="Archive" />
        <div className="w-8 h-[1px] bg-slate-800 my-2"></div>
        
        {/* Drawing/Tool Simulation */}
        <SidebarButton icon={<MousePointer2 />} tooltip="Select" />
        <SidebarButton icon={<Ruler />} tooltip="Measure" />
        <SidebarButton icon={<PenTool />} tooltip="Annotate" />
        <SidebarButton icon={<ZoomIn />} tooltip="Zoom" />
      </nav>

      {/* Bottom Actions */}
      <div className="mt-auto space-y-4 flex flex-col items-center">
        <SidebarButton icon={<Search />} tooltip="Search" />
        <SidebarButton icon={<Settings />} tooltip="Settings" />
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mt-4 border border-slate-600">
          JS
        </div>
      </div>
    </div>
  );
};

const SidebarButton: React.FC<{ icon: React.ReactNode, active?: boolean, tooltip?: string }> = ({ icon, active, tooltip }) => (
  <button className={`p-3 rounded-lg transition-all group relative ${active ? 'bg-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
    {React.cloneElement(icon as React.ReactElement, { size: 20 } as any)}
    {tooltip && (
      <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
        {tooltip}
      </span>
    )}
  </button>
);