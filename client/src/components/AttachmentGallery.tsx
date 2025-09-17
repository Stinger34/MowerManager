import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Image, Download, Eye, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAttachmentThumbnail } from "@/hooks/useAttachmentThumbnails";

interface Attachment {
  id: string;
  fileName: string;
  title?: string;
  fileType: "pdf" | "image" | "document";
  fileSize: number;
  description?: string;
  uploadedAt: string;
}

interface AttachmentGalleryProps {
  attachments: Attachment[];
  onUpload: () => void;
  onView: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
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
  
  // For PDFs and other documents, or failed image loads, show a larger file icon
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

export default function AttachmentGallery({
  attachments,
  onUpload,
  onView,
  onDownload,
  onDelete,
  isUploading = false,
  isDeleting = false
}: AttachmentGalleryProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Attachments ({attachments.length})
          </CardTitle>
          <Button 
            onClick={onUpload} 
            disabled={isUploading}
            data-testid="button-upload-attachment"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No attachments yet</p>
            <p className="text-sm">Upload PDFs, images, or documents related to this mower</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attachments.map((attachment) => (
              <Card 
                key={attachment.id} 
                className="hover-elevate cursor-pointer"
                data-testid={`card-attachment-${attachment.id}`}
                onClick={() => onView(attachment.id)}
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
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => onView(attachment.id)}
                          data-testid={`button-view-attachment-${attachment.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDownload(attachment.id)}
                          data-testid={`button-download-attachment-${attachment.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => onDelete(attachment.id)}
                          className="text-destructive"
                          disabled={isDeleting}
                          data-testid={`button-delete-attachment-${attachment.id}`}
                        >
                          {isDeleting ? (
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {attachment.fileType.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.fileSize)}
                      </span>
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
  );
}