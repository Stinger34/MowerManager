import AttachmentGallery from '../AttachmentGallery';

export default function AttachmentGalleryExample() {
  // todo: remove mock functionality
  const mockAttachments = [
    {
      id: "1",
      fileName: "owners_manual.pdf",
      title: "Owner's Manual",
      fileType: "pdf" as const,
      fileSize: 2048576, // 2MB
      description: "Original owner's manual and warranty information",
      uploadedAt: "Dec 1, 2024"
    },
    {
      id: "2",
      fileName: "purchase_receipt.pdf",
      title: "Purchase Receipt",
      fileType: "pdf" as const,
      fileSize: 512000, // 500KB
      description: "Purchase receipt from dealer",
      uploadedAt: "Nov 15, 2024"
    },
    {
      id: "3",
      fileName: "mower_photo_front.jpg",
      title: "Front View Photo",
      fileType: "image" as const,
      fileSize: 1536000, // 1.5MB
      description: "Front view of the mower after cleaning",
      uploadedAt: "Oct 20, 2024"
    },
    {
      id: "4",
      fileName: "service_checklist.pdf",
      title: "Service Checklist",
      fileType: "document" as const,
      fileSize: 256000, // 250KB
      description: "Maintenance checklist template",
      uploadedAt: "Sep 30, 2024"
    }
  ];

  return (
    <div className="p-6">
      <AttachmentGallery
        attachments={mockAttachments}
        onUpload={() => console.log('Upload files')}
        onView={(id) => console.log('View attachment:', id)}
        onDownload={(id) => console.log('Download attachment:', id)}
        onDelete={(id) => console.log('Delete attachment:', id)}
      />
    </div>
  );
}