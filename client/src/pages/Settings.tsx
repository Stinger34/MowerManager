import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Database, Settings as SettingsIcon, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Settings() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setBackupProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearInterval(progressInterval);
      setBackupProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Backup failed');
      }

      // Download the backup file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `mower-manager-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Backup completed successfully",
        description: "Your backup has been downloaded.",
        variant: "default",
      });
    } catch (error) {
      console.error('Backup error:', error);
      toast({
        title: "Backup failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Accept ZIP files with various MIME types or .zip extension
      const allowedTypes = [
        'application/zip',
        'application/x-zip-compressed',
        'multipart/x-zip'
      ];
      
      if (allowedTypes.includes(file.type) || file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a ZIP file",
          variant: "destructive",
        });
        event.target.value = '';
      }
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a backup file to restore",
        variant: "destructive",
      });
      return;
    }

    setIsRestoring(true);
    setRestoreProgress(0);

    try {
      const formData = new FormData();
      formData.append('backup', selectedFile);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setRestoreProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch('/api/restore', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setRestoreProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Restore failed');
      }

      const result = await response.json();
      
      toast({
        title: "Restore completed successfully",
        description: `Restored ${result.stats?.totalRecords || 'all'} records from backup.`,
        variant: "default",
      });

      // Refresh the page after successful restore
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(0);
      setSelectedFile(null);
      // Clear the file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Settings</h1>
          <p className="text-text-muted">
            Manage your application settings and data backups
          </p>
        </div>
      </div>

      {/* Backup & Restore Section */}
      <Card className="bg-white border-panel-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Database className="h-5 w-5 text-accent-teal" />
            Backup & Restore
          </CardTitle>
          <CardDescription className="text-text-muted">
            Create backups of your mower data or restore from a previous backup. 
            Backups include all mowers, service records, attachments, and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Backup Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Create Backup</h3>
                <p className="text-sm text-text-muted">
                  Download a complete backup of all your data as a ZIP file
                </p>
              </div>
              <Button 
                onClick={handleBackup} 
                disabled={isBackingUp || isRestoring}
                className="bg-accent-teal text-white hover:bg-accent-teal/90 rounded-button flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isBackingUp ? 'Creating Backup...' : 'Create Backup'}
              </Button>
            </div>
            
            {isBackingUp && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-text-muted">
                  <span>Creating backup...</span>
                  <span>{backupProgress}%</span>
                </div>
                <Progress value={backupProgress} className="h-2" />
              </div>
            )}
          </div>

          <div className="border-t border-panel-border pt-6">
            {/* Restore Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Restore from Backup</h3>
                <p className="text-sm text-text-muted">
                  Upload a backup file to restore your data. This will replace all current data.
                </p>
              </div>

              <Alert className="border-accent-orange/20 bg-accent-orange/10">
                <AlertCircle className="h-4 w-4 text-accent-orange" />
                <AlertDescription className="text-text-primary">
                  <strong>Warning:</strong> Restoring from a backup will permanently replace all current data. 
                  Consider creating a backup first.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed,multipart/x-zip"
                  onChange={handleFileSelect}
                  disabled={isBackingUp || isRestoring}
                  className="flex-1"
                />
                <Button
                  onClick={handleRestore}
                  disabled={!selectedFile || isBackingUp || isRestoring}
                  variant="destructive"
                  className="flex items-center gap-2 rounded-button"
                >
                  <Upload className="h-4 w-4" />
                  {isRestoring ? 'Restoring...' : 'Restore Backup'}
                </Button>
              </div>

              {selectedFile && (
                <div className="text-sm text-text-muted">
                  Selected file: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}

              {isRestoring && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-text-muted">
                    <span>Restoring backup...</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <Progress value={restoreProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup Information */}
      <Card className="bg-white border-panel-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <CheckCircle className="h-5 w-5 text-accent-teal" />
            Backup Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-text-primary"><strong>What's included in backups:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-text-muted">
              <li>All mower records and details</li>
              <li>Service history and maintenance records</li>
              <li>File attachments (images, PDFs, documents)</li>
              <li>Tasks and maintenance schedules</li>
              <li>Parts catalog and inventory</li>
              <li>Component information</li>
            </ul>
            <p className="mt-4 text-text-primary"><strong>File format:</strong> ZIP archive with JSON database dump and attachments</p>
            <p className="text-text-primary"><strong>Compatibility:</strong> Works with all versions of Mower Manager</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}