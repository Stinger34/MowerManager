import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Camera, FolderOpen, Star, StarOff, FileText, Image, File, Archive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import AttachmentMetadataDialog from './AttachmentMetadataDialog';

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
  previewUrl?: string;
  isThumbnail?: boolean;
}

interface UnifiedFileUploadAreaProps {
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  onThumbnailChange?: (thumbnail: AttachmentFile | null) => void;
  disabled?: boolean;
  showThumbnailSelection?: boolean; // For creation vs details view
  mode?: 'creation' | 'details';
}

export default function UnifiedFileUploadArea({ 
  onAttachmentsChange, 
  onThumbnailChange,
  disabled = false,
  showThumbnailSelection = true,
  mode = 'creation'
}: UnifiedFileUploadAreaProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [thumbnailAttachment, setThumbnailAttachment] = useState<AttachmentFile | null>(null);

  // Camera capture functionality
  const { isMobile, handleCameraCapture, handleGallerySelect } = useCameraCapture({
    onFilesSelected: (files, isCameraCapture) => {
      if (files.length > 0) {
        handleFilesSelected(files[0], isCameraCapture);
      }
    },
    accept: '*/*', // Accept all file types for attachments
    multiple: false
  });

  const handleFilesSelected = (file: File, isCameraCapture: boolean = false) => {
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

    // Show compression info for camera captures
    if (isCameraCapture && file.type.startsWith('image/')) {
      toast({
        title: "Camera photo processed",
        description: "Image has been optimized for upload",
        variant: "default",
      });
    }

    setPendingFile(file);
    setShowMetadataDialog(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    handleFilesSelected(file, false);
    
    // Reset input
    event.target.value = '';
  };

  const handleMetadataSubmit = (metadata: { title: string; description: string }) => {
    if (!pendingFile) return;

    // Create preview URL for images
    let previewUrl: string | undefined;
    if (pendingFile.type.startsWith('image/')) {
      previewUrl = URL.createObjectURL(pendingFile);
    }

    const newAttachment: AttachmentFile = {
      file: pendingFile,
      metadata,
      previewUrl,
      isThumbnail: false
    };

    const updatedAttachments = [...attachments, newAttachment];
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);

    // If this is the first image and no thumbnail is set, automatically set it as thumbnail
    if (showThumbnailSelection && pendingFile.type.startsWith('image/') && !thumbnailAttachment) {
      setThumbnailAsDefault(newAttachment);
    }

    setPendingFile(null);
    setShowMetadataDialog(false);

    toast({
      title: "File added",
      description: `${metadata.title} will be uploaded when the ${mode === 'creation' ? 'mower is created' : 'changes are saved'}`,
    });
  };

  const handleMetadataCancel = () => {
    setPendingFile(null);
    setShowMetadataDialog(false);
  };

  const removeAttachment = (index: number) => {
    const attachmentToRemove = attachments[index];
    
    // Clean up preview URL if it exists
    if (attachmentToRemove.previewUrl) {
      URL.revokeObjectURL(attachmentToRemove.previewUrl);
    }

    // If removing the thumbnail, clear the thumbnail
    if (thumbnailAttachment && attachmentToRemove === thumbnailAttachment) {
      setThumbnailAttachment(null);
      onThumbnailChange?.(null);
    }

    const updatedAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);
  };

  const setThumbnailAsDefault = (attachment: AttachmentFile) => {
    if (!attachment.file.type.startsWith('image/')) {
      toast({
        title: "Invalid thumbnail",
        description: "Only images can be set as thumbnails",
        variant: "destructive",
      });
      return;
    }

    // Update thumbnail state
    setThumbnailAttachment(attachment);
    onThumbnailChange?.(attachment);

    // Update attachments to mark the thumbnail
    const updatedAttachments = attachments.map(att => ({
      ...att,
      isThumbnail: att === attachment
    }));
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);

    toast({
      title: "Thumbnail set",
      description: `${attachment.metadata.title} is now the mower thumbnail`,
    });
  };

  const removeThumbnail = () => {
    setThumbnailAttachment(null);
    onThumbnailChange?.(null);

    // Update attachments to remove thumbnail marking
    const updatedAttachments = attachments.map(att => ({
      ...att,
      isThumbnail: false
    }));
    setAttachments(updatedAttachments);
    onAttachmentsChange(updatedAttachments);

    toast({
      title: "Thumbnail removed",
      description: "No thumbnail is set for this mower",
    });
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
        <Label htmlFor="unified-file-upload">
          {mode === 'creation' ? 'Files & Thumbnail (optional)' : 'Upload Files'}
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          {mode === 'creation' 
            ? 'Add attachments and optionally set a thumbnail image for your mower'
            : 'Upload files and select which image should be the mower thumbnail'
          }
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            id="unified-file-upload"
            type="file"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
            accept="*/*"
          />
          
          {isMobile ? (
            // Mobile: Show camera and gallery options
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleCameraCapture}
                disabled={disabled}
                className="gap-2"
                data-testid="button-camera-upload"
              >
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGallerySelect}
                disabled={disabled}
                className="gap-2"
                data-testid="button-gallery-upload"
              >
                <FolderOpen className="h-4 w-4" />
                Choose File
              </Button>
            </>
          ) : (
            // Desktop: Show single upload button
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('unified-file-upload')?.click()}
              disabled={disabled}
              className="gap-2"
              data-testid="button-upload-file"
            >
              <Upload className="h-4 w-4" />
              {mode === 'creation' ? 'Add File' : 'Upload File'}
            </Button>
          )}
          
          <span className="text-sm text-muted-foreground">
            Max 30MB • All file types supported
            {isMobile && (
              <div className="text-xs">Camera photos auto-compressed if &gt;5MB</div>
            )}
          </span>
        </div>
      </div>

      {/* Current thumbnail display */}
      {showThumbnailSelection && thumbnailAttachment && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Current Thumbnail</p>
                <p className="text-xs text-blue-700">{thumbnailAttachment.metadata.title}</p>
              </div>
              {thumbnailAttachment.previewUrl && (
                <img
                  src={thumbnailAttachment.previewUrl}
                  alt="Thumbnail preview"
                  className="w-8 h-8 object-cover rounded"
                />
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeThumbnail}
              disabled={disabled}
              className="text-blue-600 hover:text-blue-800"
              data-testid="button-remove-thumbnail"
            >
              <StarOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <Label>Files to {mode === 'creation' ? 'upload' : 'upload'}:</Label>
          <div className="space-y-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  attachment.isThumbnail ? 'bg-blue-50 border border-blue-200' : 'bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  {attachment.previewUrl ? (
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.metadata.title}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    getFileIcon(attachment.file.type)
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{attachment.metadata.title}</p>
                      {attachment.isThumbnail && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          <Star className="h-3 w-3 mr-1" />
                          Thumbnail
                        </Badge>
                      )}
                    </div>
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
                <div className="flex items-center gap-2">
                  {/* Thumbnail selection button for images */}
                  {showThumbnailSelection && 
                   attachment.file.type.startsWith('image/') && 
                   !attachment.isThumbnail && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setThumbnailAsDefault(attachment)}
                      disabled={disabled}
                      className="h-8 px-2 text-xs"
                      data-testid={`button-set-thumbnail-${index}`}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    disabled={disabled}
                    className="h-8 w-8 p-0"
                    data-testid={`button-remove-attachment-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
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