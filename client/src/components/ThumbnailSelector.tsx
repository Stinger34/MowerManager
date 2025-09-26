import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Image, Upload, Camera, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCameraCapture } from '@/hooks/useCameraCapture';

interface ThumbnailFile {
  file: File;
  previewUrl: string;
}

interface ThumbnailSelectorProps {
  onThumbnailChange: (thumbnail: ThumbnailFile | null) => void;
  disabled?: boolean;
}

export default function ThumbnailSelector({ 
  onThumbnailChange, 
  disabled = false 
}: ThumbnailSelectorProps) {
  const { toast } = useToast();
  const [thumbnail, setThumbnail] = useState<ThumbnailFile | null>(null);

  // Camera capture functionality
  const { isMobile, handleCameraCapture, handleGallerySelect } = useCameraCapture({
    onFilesSelected: (files, isCameraCapture) => {
      if (files.length > 0) {
        handleFilesSelected(files[0], isCameraCapture);
      }
    },
    accept: 'image/*',
    multiple: false
  });

  const handleFilesSelected = (file: File, isCameraCapture: boolean = false) => {
    // Validate file size (10MB limit for thumbnails)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum thumbnail file size is 10MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type - only images
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only image files are allowed for thumbnails",
        variant: "destructive",
      });
      return;
    }

    // Show compression info for camera captures
    if (isCameraCapture) {
      toast({
        title: "Camera photo processed",
        description: "Thumbnail image has been optimized",
        variant: "default",
      });
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    
    const newThumbnail: ThumbnailFile = {
      file,
      previewUrl
    };

    setThumbnail(newThumbnail);
    onThumbnailChange(newThumbnail);
    
    toast({
      title: "Thumbnail set",
      description: "Thumbnail image has been selected",
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    handleFilesSelected(file, false);
    
    // Reset input
    event.target.value = '';
  };

  const removeThumbnail = () => {
    if (thumbnail) {
      URL.revokeObjectURL(thumbnail.previewUrl);
    }
    setThumbnail(null);
    onThumbnailChange(null);
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
        <Label htmlFor="thumbnail-upload">Mower Thumbnail (optional)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Set a thumbnail image that will represent this mower
        </p>
        <div className="flex items-center gap-2">
          <Input
            id="thumbnail-upload"
            type="file"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
            accept=".jpg,.jpeg,.png,.gif,.webp"
          />
          
          {isMobile ? (
            // Mobile: Show camera and gallery options
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCameraCapture}
                disabled={disabled}
                className="flex-1 gap-2"
                data-testid="button-camera-thumbnail"
              >
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGallerySelect}
                disabled={disabled}
                className="flex-1 gap-2"
                data-testid="button-gallery-thumbnail"
              >
                <FolderOpen className="h-4 w-4" />
                Gallery
              </Button>
            </div>
          ) : (
            // Desktop: Show single assign button
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('thumbnail-upload')?.click()}
              disabled={disabled}
              className="gap-2"
              data-testid="button-assign-thumbnail"
            >
              <Image className="h-4 w-4" />
              Assign Thumbnail
            </Button>
          )}
          
          <span className="text-sm text-muted-foreground">
            Max 10MB • Images only
            {isMobile && (
              <div className="text-xs">Camera photos auto-compressed</div>
            )}
          </span>
        </div>
      </div>

      {thumbnail && (
        <div className="space-y-2">
          <Label>Selected thumbnail:</Label>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="relative">
              <img
                src={thumbnail.previewUrl}
                alt="Thumbnail preview"
                className="w-16 h-16 object-cover rounded-md"
              />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{thumbnail.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(thumbnail.file.size)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeThumbnail}
              disabled={disabled}
              className="h-8 w-8 p-0"
              data-testid="button-remove-thumbnail"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}