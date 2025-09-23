import AttachmentGallery from '../AttachmentGallery';
import AttachmentMetadataDialog from '../AttachmentMetadataDialog';
import { useState } from 'react';

export default function AttachmentGalleryExample() {
  const [showDialog, setShowDialog] = useState(false);
  
  // Enhanced mock attachments with titles and thumbnails
  const mockAttachments = [
    {
      id: "1",
      fileName: "owners_manual.pdf",
      title: "Owner's Manual",
      fileType: "pdf" as const,
      fileSize: 2048576, // 2MB
      pageCount: 24,
      description: "Original owner's manual and warranty information",
      uploadedAt: "Dec 1, 2024"
    },
    {
      id: "2",
      fileName: "purchase_receipt.pdf",
      title: "Purchase Receipt",
      fileType: "pdf" as const,
      fileSize: 512000, // 500KB
      pageCount: 2,
      description: "Purchase receipt from dealer",
      uploadedAt: "Nov 15, 2024"
    },
    {
      id: "3",
      fileName: "mower_photo_front.jpg",
      title: "Front View After Cleaning",
      fileType: "image" as const,
      fileSize: 1536000, // 1.5MB
      description: "Front view of the mower after cleaning",
      uploadedAt: "Oct 20, 2024"
    },
    {
      id: "4",
      fileName: "service_checklist.pdf",
      title: "Maintenance Checklist",
      fileType: "document" as const,
      fileSize: 256000, // 250KB
      pageCount: 1,
      description: "Maintenance checklist template",
      uploadedAt: "Sep 30, 2024"
    },
    {
      id: "5",
      fileName: "blade_replacement.jpg",
      title: "New Blade Installation",
      fileType: "image" as const,
      fileSize: 1200000, // 1.2MB
      description: "Photo showing new blade installation",
      uploadedAt: "Sep 15, 2024"
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Enhanced Attachment Gallery</h1>
      <p className="text-muted-foreground">
        This shows the enhanced AttachmentGallery with thumbnails for images, titles, and metadata dialog for uploads.
      </p>
      
      <AttachmentGallery
        attachments={mockAttachments}
        onUpload={(files) => setShowDialog(true)}
        onView={(id) => console.log('View attachment:', id)}
        onDownload={(id, fileName) => console.log('Download attachment:', id, fileName)}
        onDelete={(id) => console.log('Delete attachment:', id)}
      />
      
      <AttachmentMetadataDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSubmit={(metadata) => {
          console.log('Upload metadata:', metadata);
          setShowDialog(false);
        }}
        onCancel={() => setShowDialog(false)}
        fileName="example_file.jpg"
      />
    </div>
  );
}