import { useQuery } from '@tanstack/react-query';
import type { Mower, Part, Engine } from '@shared/schema';

interface ThumbnailData {
  id: string;
  fileName: string;
  fileType: string;
  downloadUrl: string;
}

// Hook to fetch thumbnail for a single mower
export function useMowerThumbnail(mowerId: string | number) {
  return useQuery<ThumbnailData | null>({
    queryKey: ['mower-thumbnail', mowerId],
    queryFn: async () => {
      const response = await fetch(`/api/mowers/${mowerId}/thumbnail`);
      if (response.status === 404) {
        return null; // No thumbnail available
      }
      if (!response.ok) {
        throw new Error('Failed to fetch thumbnail');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch thumbnail for a single part
export function usePartThumbnail(partId: string | number) {
  return useQuery<ThumbnailData | null>({
    queryKey: ['part-thumbnail', partId],
    queryFn: async () => {
      const response = await fetch(`/api/parts/${partId}/thumbnail`);
      if (response.status === 404) {
        return null; // No thumbnail available
      }
      if (!response.ok) {
        throw new Error('Failed to fetch thumbnail');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch thumbnail for a single engine
export function useEngineThumbnail(engineId: string | number) {
  return useQuery<ThumbnailData | null>({
    queryKey: ['engine-thumbnail', engineId],
    queryFn: async () => {
      const response = await fetch(`/api/engines/${engineId}/thumbnail`);
      if (response.status === 404) {
        return null; // No thumbnail available
      }
      if (!response.ok) {
        throw new Error('Failed to fetch thumbnail');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to fetch thumbnails for multiple mowers
export function useMowerThumbnails(mowers: Mower[]) {
  return useQuery<Record<string, string>>({
    queryKey: ['mower-thumbnails', mowers.map(m => m.id).sort().join(',')],
    queryFn: async () => {
      const thumbnailPromises = mowers.map(async (mower) => {
        try {
          const response = await fetch(`/api/mowers/${mower.id}/thumbnail`);
          if (response.status === 404) {
            return [mower.id.toString(), null];
          }
          if (!response.ok) {
            return [mower.id.toString(), null];
          }
          const thumbnail: ThumbnailData = await response.json();
          return [mower.id.toString(), thumbnail.downloadUrl];
        } catch (error) {
          return [mower.id.toString(), null];
        }
      });
      
      const thumbnailResults = await Promise.all(thumbnailPromises);
      
      // Convert to object, filtering out null values
      const thumbnails: Record<string, string> = {};
      thumbnailResults.forEach((result) => {
        const [mowerId, thumbnailUrl] = result;
        if (thumbnailUrl && mowerId) {
          thumbnails[mowerId] = thumbnailUrl;
        }
      });
      
      return thumbnails;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: mowers.length > 0,
  });
}