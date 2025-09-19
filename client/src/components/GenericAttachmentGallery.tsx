import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image, Download, Eye, Trash2, Loader2, EllipsisVertical, Edit, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAttachmentThumbnail } from "@/hooks/useAttachmentThumbnails";
import { toast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import AttachmentMetadataDialog from "./AttachmentMetadataDialog";
import EditAttachmentDialog from "./EditAttachmentDialog";

interface Attachment {
  id: string;
  fileName: string;
  title?: string;
  fileType: "pdf" | "image" | "document";
  fileSize: number;
  pageCount?: number | null;
  description?: string;
  uploadedAt: string;
}

interface GenericAttachmentGalleryProps {
  attachments: Attachment[];
  entityType: 'component' | 'part';
  entityId: string;
  queryKey: string[];
  isUploading?: boolean;
  isDeleting?: boolean;
}

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "pdf":
      return <FileText className="h-8 w-8 text-red-500" />;
    case "image":
      return <Image className="h-8 w-8 text-blue-500" />;
    default:
      return <FileText className="h-8 w-8 text-gray-500" />;
  }
};

// Thumbnail component for individual attachments
const AttachmentThumbnail = ({ attachment }: { attachment: Attachment }) => {
  const { data: thumbnailUrl } = useAttachmentThumbnail(attachment.id, attachment.fileType);
  const [imageError, setImageError] = useState(false);
  
  if (thumbnailUrl && attachment.fileType === 'image' && !imageError) {
    return (
      <div className="w-full h-24 mb-3 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        <img 
          src={thumbnailUrl} 
          alt={attachment.title || attachment.fileName}
          className="max-w-full max-h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }
  
  // For PDFs, show thumbnail if available, otherwise show icon
  if (attachment.fileType === 'pdf') {
    if (thumbnailUrl && !imageError) {
      return (
        <div className="w-full h-24 mb-3 rounded-md overflow-hidden bg-red-50 border border-red-200 flex items-center justify-center">
          <img 
            src={thumbnailUrl} 
            alt={`PDF preview: ${attachment.title || attachment.fileName}`}
            className="max-w-full max-h-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      );
    } else {
      return (
        <div className="w-full h-24 mb-3 rounded-md bg-red-50 border border-red-200 flex flex-col items-center justify-center p-2">
          <FileText className="h-8 w-8 text-red-500 mb-1" />
          <span className="text-xs text-red-600 text-center font-medium truncate w-full">
            PDF
          </span>
        </div>
      );
    }
  }
  
  // For other document types or failed image loads, show a generic file icon
  return (
    <div className="w-full h-24 mb-3 rounded-md bg-gray-50 flex items-center justify-center">
      {getFileIcon(attachment.fileType)}
    </div>
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function GenericAttachmentGallery({
  attachments,
  entityType,
  entityId,
  queryKey,
  isUploading = false,
  isDeleting = false
}: GenericAttachmentGalleryProps) {
  const queryClient = useQueryClient();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [showEditAttachmentDialog, setShowEditAttachmentDialog] = useState(false);

  // Upload mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, metadata }: { file: File; metadata: { title: string; description: string } }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);

      const response = await fetch(`/api/${entityType}s/${entityId}/attachments`, {
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
      queryClient.invalidateQueries({ queryKey });
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
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload Failed", 
        description: error.message.includes('Invalid file type') ? 'Invalid file type. Only PDF, images, and documents are allowed.' : 'Upload failed. Please try again.',
        variant: "destructive" 
      });
      
      // Clear pending files on error
      setPendingFiles([]);
      setCurrentFileIndex(0);
    }
  });

  // Delete mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Success", description: "Attachment deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Delete Failed", 
        description: "Failed to delete attachment. Please try again.",
        variant: "destructive" 
      });
    }
  });

  // Edit mutation
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
      queryClient.invalidateQueries({ queryKey });
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

  const handleFileUpload = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '*/*';
    fileInput.multiple = true;
    
    fileInput.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const validFiles: File[] = [];
        
        Array.from(files).forEach(file => {
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
      }
    };
    
    fileInput.click();
  };

  const handleMetadataSubmit = (metadata: { title: string; description: string }) => {
    const currentFile = pendingFiles[currentFileIndex];
    if (currentFile) {
      uploadAttachmentMutation.mutate({ file: currentFile, metadata });
    }
    setShowMetadataDialog(false);
  };

  const handleViewAttachment = async (id: string, fileName: string) => {
    try {
      const response = await fetch(`/api/attachments/${id}/download?inline=1`);
      if (!response.ok) throw new Error('Failed to fetch attachment');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>${fileName}</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5">
              <div style="max-width:90%;max-height:90%;">
                ${blob.type.startsWith('image/') 
                  ? `<img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${fileName}" />`
                  : `<iframe src="${url}" style="width:80vw;height:90vh;border:none;" title="${fileName}"></iframe>`
                }
              </div>
            </body>
          </html>
        `);
      }
    } catch (error) {
      toast({
        title: "View Failed",
        description: "Failed to open attachment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadAttachment = async (id: string, fileName: string) => {
    try {
      const response = await fetch(`/api/attachments/${id}/download`);
      if (!response.ok) throw new Error('Failed to download attachment');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Success", description: "File downloaded successfully" });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download attachment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAttachment = (id: string) => {
    deleteAttachmentMutation.mutate(id);
  };

  const handleEditAttachment = (attachmentId: string) => {
    const attachment = attachments.find(a => a.id === attachmentId);
    if (attachment) {
      setEditingAttachment(attachment);
      setShowEditAttachmentDialog(true);
    }
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Attachments ({attachments.length})
            </CardTitle>
            <Button 
              onClick={handleFileUpload} 
              disabled={uploadAttachmentMutation.isPending}
              variant="outline"
            >
              {uploadAttachmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {uploadAttachmentMutation.isPending ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No attachments yet</p>
              <p className="text-sm">Upload PDFs, images, or documents related to this {entityType}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attachments.map((attachment) => (
                <Card 
                  key={attachment.id} 
                  className="hover-elevate cursor-pointer relative"
                  onClick={() => handleViewAttachment(attachment.id, attachment.fileName)}
                >
                  <CardContent className="p-4">
                    <AttachmentThumbnail attachment={attachment} />
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate mb-1" title={attachment.title || attachment.fileName}>
                          {attachment.title || attachment.fileName}
                        </h4>
                        {attachment.title && attachment.title !== attachment.fileName && (
                          <p className="text-xs text-muted-foreground truncate" title={attachment.fileName}>
                            {attachment.fileName}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAttachment(attachment.id, attachment.fileName);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadAttachment(attachment.id, attachment.fileName);
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditAttachment(attachment.id);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAttachment(attachment.id);
                            }}
                            className="text-destructive"
                            disabled={deleteAttachmentMutation.isPending}
                          >
                            {deleteAttachmentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {attachment.fileType.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)}
                        </span>
                        {attachment.pageCount && attachment.pageCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {attachment.pageCount} {attachment.pageCount === 1 ? 'page' : 'pages'}
                          </span>
                        )}
                      </div>
                      
                      {attachment.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {attachment.description}
                        </p>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        Uploaded {attachment.uploadedAt}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Dialog */}
      {showMetadataDialog && pendingFiles[currentFileIndex] && (
        <AttachmentMetadataDialog
          isOpen={showMetadataDialog}
          onClose={() => setShowMetadataDialog(false)}
          onSubmit={handleMetadataSubmit}
          fileName={pendingFiles[currentFileIndex].name}
        />
      )}

      {/* Edit Attachment Dialog */}
      {editingAttachment && (
        <EditAttachmentDialog
          isOpen={showEditAttachmentDialog}
          onClose={() => {
            setShowEditAttachmentDialog(false);
            setEditingAttachment(null);
          }}
          onSubmit={handleEditAttachmentSubmit}
          attachment={editingAttachment}
        />
      )}
    </>
  );
}