/**
 * Image compression utility for camera-captured images
 * Compresses images to maximum 5MB while maintaining quality
 */

interface CompressionOptions {
  maxSizeBytes: number;
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
}

export async function compressImage(file: File, options: CompressionOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1920
}): Promise<File> {
  return new Promise((resolve, reject) => {
    // If file is already under the size limit, return as-is
    if (file.size <= options.maxSizeBytes) {
      resolve(file);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const maxWidth = options.maxWidth || 1920;
        const maxHeight = options.maxHeight || 1920;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress the image
        ctx?.drawImage(img, 0, 0, width, height);

        // Try different quality levels to meet size requirements
        let quality = options.quality;
        let attempts = 0;
        const maxAttempts = 10;

        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // If size is acceptable or we've tried enough times, use this result
            if (blob.size <= options.maxSizeBytes || attempts >= maxAttempts || quality <= 0.1) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              // Reduce quality and try again
              attempts++;
              quality = Math.max(0.1, quality - 0.1);
              tryCompress();
            }
          }, file.type, quality);
        };

        tryCompress();
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Check if a file is an image that can be compressed
 */
export function isCompressibleImage(file: File): boolean {
  return file.type.startsWith('image/') && 
         ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
}

/**
 * Check if we're running on a mobile device
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}