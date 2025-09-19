import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import AttachmentGallery from './AttachmentGallery';
import AttachmentMetadataDialog from './AttachmentMetadataDialog';
import EditAttachmentDialog from './EditAttachmentDialog';

interface GenericAttachmentGalleryProps {
  attachments: any[];
  entityId: string;
  entityType: 'mowers' | 'components' | 'parts';
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
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to upload attachment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`, entityId, 'attachments'] });
      toast({ title: "Success", description: "Attachment uploaded successfully" });
      
      // Process next file if any
      if (currentFileIndex < pendingFiles.length - 1) {
        setCurrentFileIndex(currentFileIndex + 1);
      } else {
        // Reset state after all files are processed
        setPendingFiles([]);
        setCurrentFileIndex(0);
        setShowMetadataDialog(false);
      }
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to upload attachment", 
        variant: "destructive" 
      });
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}`, entityId, 'attachments'] });
      toast({ title: "Success", description: "Attachment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete attachment", variant: "destructive" });
    },
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
        credentials: 'include',
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
      toast({ title: "Error", description: "Failed to update attachment", variant: "destructive" });
    },
  });

  // Handlers
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt';
    
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        setPendingFiles(files);
        setCurrentFileIndex(0);
        setShowMetadataDialog(true);
      }
    };
    
    input.click();
  };

  const handleViewAttachment = (id: string, fileName: string) => {
    window.open(`/api/attachments/${id}/download?inline=1`, '_blank');
  };

  const handleDownloadAttachment = (id: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/attachments/${id}/download`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAttachment = (id: string) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      deleteAttachmentMutation.mutate(id);
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
            handleViewAttachment(id, attachment.fileName);
          }
        }}
        onDownload={(id) => {
          const attachment = attachments.find(a => a.id === id);
          if (attachment) {
            handleDownloadAttachment(id, attachment.fileName);
          }
        }}
        onDelete={handleDeleteAttachment}
        onEdit={handleEditAttachment}
        onSetThumbnail={onSetThumbnail}
        thumbnailAttachmentId={thumbnailAttachmentId}
        isUploading={uploadAttachmentMutation.isPending}
        isDeleting={deleteAttachmentMutation.isPending}
      />

      {/* Attachment Metadata Dialog */}
      {showMetadataDialog && pendingFiles[currentFileIndex] && (
        <AttachmentMetadataDialog
          isOpen={showMetadataDialog}
          onClose={handleMetadataCancel}
          onSubmit={handleMetadataSubmit}
          fileName={pendingFiles[currentFileIndex].name}
        />
      )}

      {/* Edit Attachment Dialog */}
      <EditAttachmentDialog
        isOpen={showEditAttachmentDialog}
        onClose={() => {
          setShowEditAttachmentDialog(false);
          setEditingAttachment(null);
        }}
        onSubmit={handleEditAttachmentSubmit}
        attachment={editingAttachment}
        isLoading={editAttachmentMutation.isPending}
      />
    </>
  );
}