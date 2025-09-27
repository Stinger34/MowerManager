import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCameraCapture } from '@/hooks/useCameraCapture';
import AttachmentGallery from './AttachmentGallery';
import AttachmentMetadataDialog from './AttachmentMetadataDialog';
import EditAttachmentDialog from './EditAttachmentDialog';

interface GenericAttachmentGalleryProps {
  attachments: any[];
  entityId: string;
  entityType: 'mowers' | 'components' | 'parts' | 'engines';
  isLoading?: boolean;
  onSetThumbnail?: (id: string) => void;
  thumbnailAttachmentId?: string | null;
}

export default function GenericAttachmentGallery({
  attachments,
  entityId,
  entityType,
  isLoading = false,
  onSetThumbnail,
  thumbnailAttachmentId
}: GenericAttachmentGalleryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for file upload and dialogs
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [showEditAttachmentDialog, setShowEditAttachmentDialog] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<any>(null);

  // Camera capture functionality
  const { isMobile, handleCameraCapture, handleGallerySelect } = useCameraCapture({
    onFilesSelected: (files, isCameraCapture) => {
      // Show compression info for camera captures
      if (isCameraCapture && files.some(f => f.type.startsWith('image/'))) {
        toast({
          title: "Camera photos processed",
          description: "Images have been optimized for upload",
          variant: "default",
        });
      }
      
      const validFiles: File[] = [];
      
      files.forEach(file => {
        // Check file size (30MB limit)
        if (file.size > 30 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `${file.name} is larger than 30MB limit`,
            variant: "destructive"
          });
          return;
        }
        validFiles.push(file);
      });
      
      if (validFiles.length > 0) {
        setPendingFiles(validFiles);
        setCurrentFileIndex(0);
        setShowMetadataDialog(true);
      }
    },
    accept: '*/*',
    multiple: true
  });

  // Upload attachment mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, metadata }: { file: File; metadata: { title: string; description: string } }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);

      const response = await fetch(`/api/${entityType}/${entityId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`, entityId, 'attachments'] });
      toast({ title: "Success", description: "File uploaded successfully" });
      
      // Process next file if there are more
      const nextIndex = currentFileIndex + 1;
      if (nextIndex < pendingFiles.length) {
        setCurrentFileIndex(nextIndex);
        setShowMetadataDialog(true);
      } else {
        // Clear pending files when done
        setPendingFiles([]);
        setCurrentFileIndex(0);
        setShowMetadataDialog(false);
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload Failed", 
        description: error.message || 'Upload failed. Please try again.',
        variant: "destructive" 
      });
      
      // Clear pending files on error
      setPendingFiles([]);
      setCurrentFileIndex(0);
      setShowMetadataDialog(false);
    }
  });

  // Edit attachment mutation
  const editAttachmentMutation = useMutation({
    mutationFn: async ({ attachmentId, metadata }: { attachmentId: string; metadata: { title: string; description: string } }) => {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        throw new Error('Failed to update attachment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`, entityId, 'attachments'] });
      toast({ title: "Success", description: "Attachment updated successfully" });
      setShowEditAttachmentDialog(false);
      setEditingAttachment(null);
    },
    onError: () => {
      toast({ 
        title: "Update Failed", 
        description: "Failed to update attachment. Please try again.",
        variant: "destructive" 
      });
    }
  });

  // File input handler (legacy for non-mobile)
  const handleFileUpload = (files: FileList) => {
    const validFiles = Array.from(files);
    if (validFiles.length > 0) {
      setPendingFiles(validFiles);
      setCurrentFileIndex(0);
      setShowMetadataDialog(true);
    }
  };

  const handleEditAttachment = (attachmentId: string) => {
    const attachment = attachments.find(a => a.id === attachmentId);
    if (attachment) {
      setEditingAttachment({ ...attachment, fileData: '' });
      setShowEditAttachmentDialog(true);
    }
  };

  const handleMetadataSubmit = (metadata: { title: string; description: string }) => {
    if (pendingFiles[currentFileIndex]) {
      uploadAttachmentMutation.mutate({
        file: pendingFiles[currentFileIndex],
        metadata
      });
    }
  };

  const handleMetadataCancel = () => {
    setPendingFiles([]);
    setCurrentFileIndex(0);
    setShowMetadataDialog(false);
  };

  const handleEditAttachmentSubmit = (metadata: { title: string; description: string }) => {
    if (editingAttachment) {
      editAttachmentMutation.mutate({
        attachmentId: editingAttachment.id,
        metadata
      });
    }
  };

  return (
    <>
      <AttachmentGallery
        attachments={attachments.map(attachment => ({
          ...attachment,
          fileType: attachment.fileType as "pdf" | "image" | "document",
          uploadedAt: new Date(attachment.uploadedAt).toLocaleDateString(),
          title: attachment.title ?? undefined,
          description: attachment.description ?? undefined,
        }))}
        onUpload={handleFileUpload}
        onView={(id) => {
          const attachment = attachments.find(a => a.id === id);
          if (attachment) {
            window.open(`/api/attachments/${id}/download?inline=1`, '_blank');
          }
        }}
        onDownload={(id: string, fileName: string) => {
          const link = document.createElement('a');
          link.href = `/api/attachments/${id}/download`;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
        onEdit={handleEditAttachment}
        onDelete={(id) => {
          // Delete mutation can be added here if needed
          queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`, entityId, 'attachments'] });
        }}
        onSetThumbnail={onSetThumbnail}
        thumbnailAttachmentId={thumbnailAttachmentId}
        isUploading={uploadAttachmentMutation.isPending}
        isDeleting={false}
      />

      {/* Dialogs */}
      <AttachmentMetadataDialog
        open={showMetadataDialog}
        onOpenChange={setShowMetadataDialog}
        onSubmit={handleMetadataSubmit}
        onCancel={handleMetadataCancel}
        fileName={pendingFiles[currentFileIndex]?.name || ''}
        fileIndex={currentFileIndex + 1}
        totalFiles={pendingFiles.length}
      />

      <EditAttachmentDialog
        open={showEditAttachmentDialog}
        onOpenChange={setShowEditAttachmentDialog}
        attachment={editingAttachment}
        onSubmit={handleEditAttachmentSubmit}
      />
    </>
  );
}