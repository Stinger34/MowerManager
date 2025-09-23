import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Upload, FileText, Image, File, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AttachmentMetadataDialog from './AttachmentMetadataDialog';

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
}

interface AttachmentUploadAreaProps {
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  disabled?: boolean;
}

export default function AttachmentUploadArea({ 
  onAttachmentsChange, 
  disabled = false 
}: AttachmentUploadAreaProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file size (30MB limit)
    if (file.size > 30 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 30MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed',
      'multipart/x-zip'
    ];

    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.zip')) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, images, documents, and ZIP files are allowed",
        variant: "destructive",
      });
      return;
    }

    setPendingFile(file);
    setShowMetadataDialog(true);
    
    // Reset input
    event.target.value = '';
  };

  const handleMetadataSubmit = (metadata: { title: string; description: string }) => {
    if (!pendingFile) return;

    const newAttachment: AttachmentFile = {
      file: pendingFile,
      metadata
    };

    const updatedAttachments = [...attachments, newAttachment];
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);

    setPendingFile(null);
    setShowMetadataDialog(false);

    toast({
      title: "Attachment added",
      description: `${metadata.title} will be uploaded when the item is created`,
    });
  };

  const handleMetadataCancel = () => {
    setPendingFile(null);
    setShowMetadataDialog(false);
  };

  const removeAttachment = (index: number) => {
    const updatedAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-4 w-4" />;
    } else if (fileType === 'application/zip' || fileType === 'application/x-zip-compressed' || fileType === 'multipart/x-zip') {
      return <Archive className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="attachment-upload">Attachments (optional)</Label>
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Input
              id="attachment-upload"
              type="file"
              onChange={handleFileSelect}
              disabled={disabled}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('attachment-upload')?.click()}
              disabled={disabled}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Add Attachment
            </Button>
            <span className="text-sm text-muted-foreground">
              Max 30MB • PDF, Images, Documents, ZIP
            </span>
          </div>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="space-y-2">
          <Label>Files to upload:</Label>
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(attachment.file.type)}
                  <div>
                    <p className="font-medium text-sm">{attachment.metadata.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {attachment.file.name} • {formatFileSize(attachment.file.size)}
                    </p>
                    {attachment.metadata.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {attachment.metadata.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAttachment(index)}
                  disabled={disabled}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showMetadataDialog && pendingFile && (
        <AttachmentMetadataDialog
          open={showMetadataDialog}
          onOpenChange={setShowMetadataDialog}
          onSubmit={handleMetadataSubmit}
          onCancel={handleMetadataCancel}
          fileName={pendingFile.name}
        />
      )}
    </div>
  );
}