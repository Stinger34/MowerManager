import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EditAttachmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (metadata: { title: string; description: string }) => void;
  attachment: {
    fileName: string;
    title?: string | null;
    description?: string | null;
  } | null;
  isLoading?: boolean;
}

export default function EditAttachmentDialog({
  isOpen,
  onClose,
  onSubmit,
  attachment,
  isLoading = false,
}: EditAttachmentDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Initialize form values when attachment changes
  useEffect(() => {
    if (attachment) {
      setTitle(attachment.title || attachment.fileName);
      setDescription(attachment.description || "");
    }
  }, [attachment]);

  const handleSubmit = () => {
    onSubmit({
      title: title.trim() || attachment?.fileName || "",
      description: description.trim(),
    });
  };

  const handleCancel = () => {
    // Reset form to original values
    if (attachment) {
      setTitle(attachment.title || attachment.fileName);
      setDescription(attachment.description || "");
    }
    onClose();
  };

  if (!attachment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Attachment Details</DialogTitle>
          <DialogDescription>
            Update the title and description for "{attachment.fileName}".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              placeholder={attachment.fileName}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Add a description for this attachment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}