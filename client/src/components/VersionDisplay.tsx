/**
 * Version Display Component
 * 
 * Displays build version information in the bottom left corner of the UI.
 * Shows version, branch, commit hash, and build date.
 */

import { versionInfo } from "@/version";

interface VersionDisplayProps {
  className?: string;
}

export function VersionDisplay({ className = "" }: VersionDisplayProps) {
  const formatBuildDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm border border-nested-border rounded-md px-2 py-1 shadow-sm ${className}`}>
      <div className="font-mono">
        {versionInfo.fullDisplayText}
      </div>
      <div className="text-xs opacity-75">
        Built: {formatBuildDate(versionInfo.buildDate)}
      </div>
    </div>
  );
}

export default VersionDisplay;