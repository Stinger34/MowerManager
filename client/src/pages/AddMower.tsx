import { Button } from "@/components/ui/button";
import MowerForm from "@/components/MowerForm";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertMower } from "@shared/schema";

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
}

interface ThumbnailFile {
  file: File;
  previewUrl: string;
}

export default function AddMower() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createMowerMutation = useMutation({
    mutationFn: async ({ 
      mowerData, 
      attachments, 
      thumbnail 
    }: { 
      mowerData: InsertMower; 
      attachments?: AttachmentFile[]; 
      thumbnail?: ThumbnailFile;
    }) => {
      console.log('Adding new mower:', mowerData);
      
      // First, create the mower
      const mowerResponse = await apiRequest('POST', '/api/mowers', mowerData);
      const mower = await mowerResponse.json();
      
      console.log('Mower created:', mower);
      
      // If we have attachments or thumbnail, upload them
      if (attachments && attachments.length > 0) {
        console.log('Uploading attachments:', attachments.length);
        for (const attachment of attachments) {
          try {
            const formData = new FormData();
            formData.append('file', attachment.file);
            formData.append('title', attachment.metadata.title);
            formData.append('description', attachment.metadata.description);
            
            const response = await fetch(`/api/mowers/${mower.id}/attachments`, {
              method: 'POST',
              body: formData,
              credentials: 'include',
            });
            
            if (!response.ok) {
              throw new Error(`Failed to upload attachment: ${attachment.metadata.title}`);
            }
          } catch (error) {
            console.error('Failed to upload attachment:', error);
            // Don't fail the entire operation, just log the error
            toast({
              title: "Attachment Upload Warning",
              description: `Failed to upload attachment: ${attachment.metadata.title}`,
              variant: "destructive",
            });
          }
        }
      }
      
      // Handle thumbnail upload and assignment
      if (thumbnail) {
        console.log('Uploading and setting thumbnail');
        try {
          // Upload thumbnail as attachment
          const formData = new FormData();
          formData.append('file', thumbnail.file);
          formData.append('title', 'Mower Thumbnail');
          formData.append('description', 'Main thumbnail image for this mower');
          
          const response = await fetch(`/api/mowers/${mower.id}/attachments`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
          
          if (!response.ok) {
            throw new Error('Failed to upload thumbnail');
          }
          
          const attachment = await response.json();
          
          // Set the uploaded attachment as the thumbnail
          const thumbnailResponse = await apiRequest('PUT', `/api/mowers/${mower.id}/thumbnail`, {
            attachmentId: attachment.id
          });
          
          if (!thumbnailResponse.ok) {
            throw new Error('Failed to set thumbnail');
          }
        } catch (error) {
          console.error('Failed to upload/set thumbnail:', error);
          toast({
            title: "Thumbnail Upload Warning",
            description: "Failed to upload or set thumbnail, but mower was created successfully",
            variant: "destructive",
          });
        }
      }
      
      return mower;
    },
    onSuccess: () => {
      toast({
        title: "Mower added",
        description: "The mower has been successfully added to your fleet.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      setLocation('/');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add mower. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to add mower:', error);
    },
  });

  const handleSubmit = (mowerData: InsertMower, attachments?: AttachmentFile[], thumbnail?: ThumbnailFile) => {
    createMowerMutation.mutate({ mowerData, attachments, thumbnail });
  };

  const handleCancel = () => {
    setLocation('/');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Add New Mower</h1>
          <p className="text-text-muted">
            Add a new lawn mower to your fleet
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <MowerForm 
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEditing={false}
        />
      </div>
    </div>
  );
}