import { apiRequest } from '@/lib/queryClient';

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
}

export async function uploadAttachmentsForEntity(
  entityType: 'parts' | 'components' | 'engines',
  entityId: string,
  attachments: AttachmentFile[]
): Promise<void> {
  for (const attachment of attachments) {
    const formData = new FormData();
    formData.append('file', attachment.file);
    formData.append('title', attachment.metadata.title);
    formData.append('description', attachment.metadata.description);

    const response = await fetch(`/api/${entityType}/${entityId}/attachments`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload ${attachment.metadata.title}: ${errorText}`);
    }
  }
}