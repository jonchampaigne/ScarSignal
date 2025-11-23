import React, { Component, ErrorInfo, ReactNode } from 'react';
import { generateId } from '../services/utils';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CRITICAL SYSTEM FAILURE:", error, errorInfo);
    
    // Attempt to inject the error into the save state so it appears in the log on reload
    try {
        const STORAGE_KEY = 'SCAR_SIGNAL_V1_SAVE';
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.log)) {
                parsed.log.push({
                    id: generateId(),
                    type: 'error',
                    content: `SYSTEM RECOVERED FROM CRASH:\n${error.message}\n\nSIGNAL RE-ESTABLISHED.`,
                    timestamp: new Date().toLocaleTimeString(),
                    isRestored: true
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
        }
    } catch (e) {
        console.error("Failed to inject error log:", e);
    }
  }

  handleSoftReset = () => {
    console.log("EXECUTING SOFT RESET...");
    window.location.reload();
  };

  handleHardReset = () => {
    console.log("EXECUTING HARD RESET...");
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#000] text-red-600 font-mono p-8 flex flex-col items-center justify-center z-50 crt">
          <div className="max-w-2xl border border-red-900 p-8 bg-red-950/10 w-full">
            <h1 className="text-4xl mb-4 font-bold tracking-widest glitch-text">SIGNAL INTERRUPTED</h1>
            <p className="mb-4 text-red-400">
              UNEXPECTED TERMINATION DETECTED.
            </p>
            <div className="bg-black/50 p-4 mb-6 border border-red-900/50 text-xs font-mono overflow-auto max-h-32 whitespace-pre-wrap">
              {this.state.error?.toString() || "Unknown Error"}
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
                <button 
                onClick={this.handleSoftReset}
                className="flex-1 px-6 py-3 bg-stone-900 text-stone-200 font-bold hover:bg-stone-700 hover:text-white transition-colors uppercase tracking-widest border border-stone-500"
                >
                [ RESUME SIGNAL ]
                </button>

                <button 
                onClick={this.handleHardReset}
                className="flex-1 px-6 py-3 bg-red-900 text-black font-bold hover:bg-red-600 transition-colors uppercase tracking-widest border border-red-500"
                >
                [ FACTORY RESET ]
                </button>
            </div>
          </div>
          
          <div className="mt-8 animate-pulse text-xs text-red-900">
             // ERROR_CODE: 0xCRASH_RECOVERY //
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;