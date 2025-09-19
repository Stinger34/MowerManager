import { useQuery } from '@tanstack/react-query';

interface ThumbnailData {
  id: string;
  fileName: string;
  fileType: string;
  downloadUrl: string;
}

// Hook to fetch thumbnail for a single attachment if it's an image
export function useAttachmentThumbnail(attachmentId: string, fileType: string) {
  return useQuery<string | null>({
    queryKey: ['attachment-thumbnail', attachmentId],
    queryFn: async () => {
      // For images, we can use the direct download URL with inline parameter
      if (fileType.startsWith('image')) {
        return `/api/attachments/${attachmentId}/download?inline=1`;
      }
      
      // For PDFs, we could potentially get a thumbnail from server
      // For now, return null to show file icon instead
      if (fileType === 'pdf') {
        // TODO: Implement PDF thumbnail generation on server side
        return null;
      }
      
      return null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: fileType.startsWith('image') || fileType === 'pdf',
  });
}

// Hook to get PDF thumbnail (placeholder for now, could be enhanced later)
export function usePDFThumbnail(attachmentId: string, fileType: string) {
  return useQuery<string | null>({
    queryKey: ['pdf-thumbnail', attachmentId],
    queryFn: async () => {
      // For PDFs, we could potentially generate thumbnails server-side
      // For now, return null to show file icon instead
      return null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: fileType === 'pdf',
  });
}