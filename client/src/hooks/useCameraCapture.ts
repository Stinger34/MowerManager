import { useCallback } from 'react';
import { useIsMobile } from './use-mobile';
import { compressImage, isCompressibleImage, isMobileDevice } from '@/lib/imageCompression';

export interface CameraCaptureOptions {
  onFilesSelected: (files: File[], isCameraCapture: boolean) => void;
  accept?: string;
  multiple?: boolean;
}

export function useCameraCapture({ onFilesSelected, accept, multiple = false }: CameraCaptureOptions) {
  const isMobile = useIsMobile();

  const handleCameraCapture = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || 'image/*';
    input.multiple = multiple;
    
    // On mobile, prefer camera capture for images
    if (isMobile && (!accept || accept.includes('image'))) {
      input.capture = 'environment'; // Use rear camera
    }

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const processedFiles: File[] = [];
      
      // Determine if this is likely a camera capture
      // Camera captures typically have specific naming patterns and are recent
      const isCameraCapture = isMobile && fileArray.some(file => {
        const fileName = file.name.toLowerCase();
        const isRecentFile = Date.now() - file.lastModified < 60000; // Within last minute
        const hasCameraPattern = fileName.includes('img_') || fileName.includes('image_') || 
                                fileName.startsWith('photo') || fileName.match(/^\d{8}_\d{6}/);
        return isRecentFile && (hasCameraPattern || fileName === 'image.jpg' || fileName === 'image.png');
      });

      // Process each file
      for (const file of fileArray) {
        try {
          let processedFile = file;
          
          // Only compress camera-captured images that exceed 5MB
          if (isCameraCapture && isCompressibleImage(file) && file.size > 5 * 1024 * 1024) {
            console.log(`Compressing camera-captured image: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            processedFile = await compressImage(file);
            console.log(`Compressed to: ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
          }
          
          processedFiles.push(processedFile);
        } catch (error) {
          console.error('Error processing file:', error);
          // If compression fails, use original file
          processedFiles.push(file);
        }
      }

      onFilesSelected(processedFiles, isCameraCapture);
    };

    input.click();
  }, [isMobile, accept, multiple, onFilesSelected]);

  const handleGallerySelect = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept || '*/*';
    input.multiple = multiple;
    // Don't set capture attribute for gallery selection

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      // Gallery selections are never compressed
      onFilesSelected(fileArray, false);
    };

    input.click();
  }, [accept, multiple, onFilesSelected]);

  return {
    isMobile: isMobile, // Use only screen width detection for better compatibility
    handleCameraCapture,
    handleGallerySelect,
  };
}