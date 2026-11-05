/**
 * @file ErrorBoundary.tsx
 * @description Global React error boundary providing graceful crash resilience,
 * curatorial diagnostic stack inspection, and emergency zero-data-loss JSON export.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { IconAlert, IconRefresh, IconDownload } from './Icons';
import { dbService } from '../db/database';
import { createArchiveExportBlob, downloadBlob } from '../utils/archiveSecurity';
import { pointsLedger } from '../utils/pointsLedger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  exporting: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      exporting: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      exporting: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TypoHunter ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = async () => {
    if (window.confirm('Reset local application state? This will reload the app to default.')) {
      sessionStorage.clear();
      window.location.reload();
    }
  };

  handleEmergencyExport = async () => {
    this.setState({ exporting: true });
    try {
      const records = await dbService.getAllDiscoveries();
      if (!pointsLedger.isLoaded()) await pointsLedger.load();
      const nickname = localStorage.getItem('typo_hunter_nickname') || 'Hunter';
      const blob = await createArchiveExportBlob(records, nickname);
      downloadBlob(blob, `typo-hunter-emergency-backup-${Date.now()}.json`);
    } catch (err) {
      alert('Failed to extract emergency backup: ' + (err as Error).message);
    } finally {
      this.setState({ exporting: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4EBDD] flex items-center justify-center p-4">
          <div className="editorial-card p-6 sm:p-8 rounded-2xl bg-white max-w-lg w-full border-2 border-black shadow-brutal-lg text-center">
            {/* Header Badge */}
            <div className="inline-block bg-[#D66A4A] text-white text-[10px] font-mono font-bold px-3 py-1 rounded border border-black uppercase tracking-widest shadow-brutal-sm mb-4">
              Critical Curatorial Fault
            </div>

            <div className="w-16 h-16 bg-[#FDF2F0] border-2 border-[#D66A4A] rounded-full flex items-center justify-center mx-auto mb-4">
              <IconAlert size={28} className="text-[#D66A4A]" />
            </div>

            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-black tracking-tight leading-tight mb-2">
              Museum Gallery Fault
            </h1>

            <p className="text-xs sm:text-sm font-mono text-gray-700 leading-relaxed mb-5">
              An unexpected anomaly interrupted the display engine. Your archived specimens remain safely stored in your device's local database.
            </p>

            {/* Diagnostic Box */}
            {this.state.error && (
              <div className="bg-[#282722] text-[#E8B92D] p-3 rounded-xl border border-black text-left font-mono text-[10px] mb-5 overflow-x-auto max-h-32">
                <div className="font-bold text-white mb-1 uppercase text-[10px] tracking-wider">
                  Engine Fault Trace:
                </div>
                <div className="text-red-300 font-bold mb-1">{this.state.error.toString()}</div>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-gray-400 whitespace-pre-wrap leading-tight">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            {/* Recovery Actions */}
            <div className="space-y-2">
              <button
                onClick={this.handleReload}
                className="w-full btn-primary py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                <span className="flex items-center justify-center gap-2"><IconRefresh size={14} /> Restart Museum Engine</span>
              </button>

              <button
                onClick={this.handleEmergencyExport}
                disabled={this.state.exporting}
                className="w-full btn-secondary py-3 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                {this.state.exporting ? 'Exporting Archive...' : <span className="flex items-center justify-center gap-2"><IconDownload size={14} /> Emergency Archive Backup (Save Photos)</span>}
              </button>

              <button
                onClick={this.handleResetStorage}
                className="w-full text-xs font-mono text-gray-500 hover:text-black underline pt-2 cursor-pointer"
              >
                Reset Session Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
