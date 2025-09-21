import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Part, InsertPart, InsertAssetPart } from "@shared/schema";
import AttachmentUploadArea from "./AttachmentUploadArea";
import { uploadAttachmentsForEntity } from "@/lib/attachmentUpload";

const partFormSchema = z.object({
  name: z.string().min(1, "Part name is required"),
  description: z.string().optional(),
  partNumber: z.string().min(1, "Part number is required"),
  manufacturer: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  unitCost: z.string().optional(),
  stockQuantity: z.number().min(0, "Stock quantity must be 0 or greater").default(0),
  minStockLevel: z.number().min(0, "Minimum stock level must be 0 or greater").default(0),
  notes: z.string().optional(),
});

type PartFormData = z.infer<typeof partFormSchema>;

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
}

interface PartFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  part?: Part | null;
  mowerId?: string | null; // New prop for auto-allocation
  onSuccess?: () => void;
}

export default function PartFormModal({ 
  isOpen, 
  onClose, 
  part = null,
  mowerId = null, // New prop for auto-allocation
  onSuccess 
}: PartFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!part;
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentFile[]>([]);

  const form = useForm<PartFormData>({
    resolver: zodResolver(partFormSchema),
    defaultValues: {
      name: "",
      description: "",
      partNumber: "",
      manufacturer: "",
      category: "",
      unitCost: "",
      stockQuantity: 0,
      minStockLevel: 0,
      notes: "",
    },
  });

  // Reset form when part prop changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: part?.name || "",
        description: part?.description || "",
        partNumber: part?.partNumber || "",
        manufacturer: part?.manufacturer || "",
        category: part?.category || "",
        unitCost: part?.unitCost || "",
        stockQuantity: part?.stockQuantity || 0,
        minStockLevel: part?.minStockLevel || 0,
        notes: part?.notes || "",
      });
      // Reset attachments for editing mode
      if (isEditing) {
        setPendingAttachments([]);
      }
    }
  }, [part, isOpen, form, isEditing]);

  const createMutation = useMutation({
    mutationFn: async (data: PartFormData) => {
      const partData: InsertPart = {
        ...data,
        description: data.description || null,
        manufacturer: data.manufacturer || null,
        unitCost: data.unitCost || null,
        notes: data.notes || null,
      };
      
      const response = await apiRequest("POST", "/api/parts", partData);
      
      // Safely parse JSON response 
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      
      const createdPart = await response.json();
      
      // Upload attachments if any
      if (pendingAttachments.length > 0) {
        await uploadAttachmentsForEntity('parts', createdPart.id, pendingAttachments);
      }
      
      // Auto-allocate to mower if mowerId is provided
      if (mowerId) {
        const assetPartData: InsertAssetPart = {
          partId: createdPart.id,
          mowerId: parseInt(mowerId),
          componentId: null,
          quantity: 1, // Default quantity
          installDate: null,
          notes: null,
        };
        
        await apiRequest("POST", "/api/asset-parts", assetPartData);
      }
      
      return createdPart;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
      if (mowerId) {
        // Also invalidate mower parts if auto-allocated
        queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'parts'] });
      }
      toast({
        title: "Success",
        description: `Part created successfully${pendingAttachments.length > 0 ? ` with ${pendingAttachments.length} attachment(s)` : ''}${mowerId ? ' and allocated to mower' : ''}`,
      });
      form.reset();
      setPendingAttachments([]);
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create part",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PartFormData) => {
      const partData = {
        ...data,
        description: data.description || null,
        manufacturer: data.manufacturer || null,
        unitCost: data.unitCost || null,
        notes: data.notes || null,
      };
      
      const response = await apiRequest("PUT", `/api/parts/${part!.id}`, partData);
      
      // Safely parse JSON response 
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
      toast({
        title: "Success",
        description: "Part updated successfully",
      });
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update part",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: PartFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleClose = () => {
    form.reset();
    setPendingAttachments([]);
    onClose();
  };

  // Common part categories
  const categories = [
    "engine",
    "transmission", 
    "hydraulic",
    "electrical",
    "cutting",
    "maintenance",
    "filter",
    "belt",
    "bearing",
    "fastener",
    "other"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Part" : "Add Part"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Part name..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="partNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Part Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Part number..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Part description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Category..." 
                        {...field} 
                        list="categories"
                      />
                    </FormControl>
                    <datalist id="categories">
                      {categories.map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Cost</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stockQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock Quantity *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Stock Level</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Only show attachment upload during creation */}
            {!isEditing && (
              <AttachmentUploadArea
                onAttachmentsChange={setPendingAttachments}
                disabled={createMutation.isPending}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "Saving..." 
                  : isEditing 
                    ? "Update Part" 
                    : "Create Part"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}