'use client';

import { useState } from 'react';

export default function HmemPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [graph, setGraph] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hmem');
      const data = await res.json();
      setLogs(data.logs || [
        "[04:15:02] INITIALIZING HMEM ENGINE...",
        "[04:15:03] ALLOCATING NODE MEMORY BUFFER [OK]",
        "[04:15:04] EXECUTING TOPOLOGICAL GRAPH TRAVERSAL...",
        "[04:15:05] CONVERGENCE CRITERIA MET IN 4 ITERATIONS."
      ]);
      setGraph(data.graphSnapshot || '(A: Cyan) ---> (B: Violet) \n |               |  \n v               v  \n(C: Amber) <--- (D: Green)');
    } catch (err) {
      setLogs(['Error running simulation']);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F1F5F9] font-['Inter',sans-serif] antialiased selection:bg-[#7C3AED] selection:text-white">
      {/* Top Glassmorphic Navbar */}
      <nav className="border-b border-[#2A2A3E] bg-[#13131A]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 rounded-full bg-[#06B6D4] animate-pulse" />
            <span className="font-['Space_Grotesk',sans-serif] font-bold text-lg tracking-wider bg-gradient-to-r from-[#06B6D4] to-[#7C3AED] bg-clip-text text-transparent">
              HMEM // CONSOLE
            </span>
          </div>
          <div className="text-xs font-mono text-[#475569] hidden sm:block">
            STATUS: READY
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header Section */}
        <div className="bg-[#13131A] border border-[#2A2A3E] rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 shadow-xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk',sans-serif] text-[#F1F5F9] tracking-tight">
              HMEM Engine Simulation
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1 max-w-xl">
              Execute runtime topology sweeps, inspect internal memory graphs, and stream raw execution nodes down to the log block below.
            </p>
          </div>
          
          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full md:w-auto relative group inline-flex items-center justify-center font-['Space_Grotesk',sans-serif] text-sm font-semibold tracking-wide text-white px-6 py-3 rounded-lg overflow-hidden bg-[#7C3AED] hover:bg-[#8B5CF6] transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:shadow-[0_0_25px_rgba(124,58,237,0.4)]"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>RUNNING SWEEP...</span>
              </span>
            ) : (
              <span>RUN SIMULATION</span>
            )}
          </button>
        </div>

        {/* Dynamic Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Execution Logs Pane */}
          <div className="bg-[#13131A] border border-[#2A2A3E] rounded-xl flex flex-col overflow-hidden shadow-lg h-[500px]">
            <div className="bg-[#1A1A26] px-4 py-3 border-b border-[#2A2A3E] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] font-['Space_Grotesk',sans-serif] flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7C3AED]" />
                Runtime Logs
              </h2>
              <span className="text-[10px] font-mono text-[#475569] bg-[#0A0A0F] px-2 py-0.5 rounded border border-[#2A2A3E]">
                STDOUT
              </span>
            </div>
            
            <div className="flex-1 p-4 bg-[#0A0A0F] overflow-auto font-['DM_Mono',monospace] text-xs leading-relaxed text-[#94A3B8]">
              {logs.length > 0 ? (
                <pre className="whitespace-pre-wrap select-all selection:bg-[#2A2A3E]">
                  {logs.map((log, idx) => (
                    <div key={idx} className="hover:bg-[#13131A] py-0.5 px-1 rounded transition-colors">
                      {log}
                    </div>
                  ))}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#475569] font-sans italic text-center p-6">
                  <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 2 0 002-2V6a2 2 2 0 00-2-2H5a2 2 2 0 00-2 2v12a2 2 2 0 002 2z" />
                  </svg>
                  Console idle. Trigger the simulation framework to stream matrix logs.
                </div>
              )}
            </div>
          </div>

          {/* Graph Snapshot Pane */}
          <div className="bg-[#13131A] border border-[#2A2A3E] rounded-xl flex flex-col overflow-hidden shadow-lg h-[500px]">
            <div className="bg-[#1A1A26] px-4 py-3 border-b border-[#2A2A3E] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] font-['Space_Grotesk',sans-serif] flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#06B6D4]" />
                Topology Diagram
              </h2>
              <span className="text-[10px] font-mono text-[#475569] bg-[#0A0A0F] px-2 py-0.5 rounded border border-[#2A2A3E]">
                SNAPSHOT_LATEST
              </span>
            </div>
            
            <div className="flex-1 p-4 bg-[#0A0A0F] overflow-auto font-['DM_Mono',monospace] text-xs leading-relaxed text-[#06B6D4]">
              {graph ? (
                <pre className="p-4 bg-[#13131A] border border-[#2A2A3E] rounded-lg h-full overflow-auto text-center flex items-center justify-center whitespace-pre selection:bg-[#3D3D5C]">
                  {graph}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#475569] font-sans italic text-center p-6">
                  <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  No topology context. Run a simulation cycle to generate state vectors.
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
