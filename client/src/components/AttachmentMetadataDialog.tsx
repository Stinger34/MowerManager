import { useState } from "react";
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

interface AttachmentMetadataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (metadata: { title: string; description: string }) => void;
  fileName: string;
}

export default function AttachmentMetadataDialog({
  isOpen,
  onClose,
  onSubmit,
  fileName,
}: AttachmentMetadataDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    onSubmit({
      title: title.trim() || fileName, // Use filename as default if title is empty
      description: description.trim(),
    });
    // Reset form
    setTitle("");
    setDescription("");
    onClose();
  };

  const handleCancel = () => {
    setTitle("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Attachment Details</DialogTitle>
          <DialogDescription>
            Provide a title and description for "{fileName}". The filename will be used as the title if left blank.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder={fileName}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a description for this attachment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Upload File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}