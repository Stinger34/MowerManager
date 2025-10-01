import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoIcon } from "lucide-react";
import { addMonths } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import UnifiedFileUploadArea from "@/components/UnifiedFileUploadArea";
import type { InsertMower } from "@shared/schema";

const mowerFormSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.string().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor"]),
  status: z.enum(["active", "maintenance", "retired"]),
  lastServiceDate: z.string().optional(),
  nextServiceDate: z.string().optional(),
  notes: z.string().optional(),
});

type MowerFormData = z.infer<typeof mowerFormSchema>;

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
  previewUrl?: string;
  isThumbnail?: boolean;
}

interface MowerFormProps {
  initialData?: Partial<{
    make: string;
    model: string;
    year: number;
    serialNumber: string;
    purchaseDate: string | Date;
    purchasePrice: string;
    condition: "excellent" | "good" | "fair" | "poor";
    status: "active" | "maintenance" | "retired";
    lastServiceDate: string | Date;
    nextServiceDate: string | Date;
    notes: string;
  }>;
  onSubmit: (data: InsertMower, attachments?: AttachmentFile[], thumbnail?: AttachmentFile) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export default function MowerForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isEditing = false 
}: MowerFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [thumbnail, setThumbnail] = useState<AttachmentFile | null>(null);

  const form = useForm<MowerFormData>({
    resolver: zodResolver(mowerFormSchema),
    defaultValues: {
      make: initialData?.make || "",
      model: initialData?.model || "",
      year: initialData?.year || new Date().getFullYear(),
      serialNumber: initialData?.serialNumber || "",
      purchaseDate: initialData?.purchaseDate 
        ? (typeof initialData.purchaseDate === 'string' 
          ? initialData.purchaseDate.split('T')[0]
          : initialData.purchaseDate.toISOString().split('T')[0])
        : "",
      purchasePrice: initialData?.purchasePrice || "",
      condition: initialData?.condition || "good",
      status: initialData?.status || "active",
      lastServiceDate: initialData?.lastServiceDate
        ? (typeof initialData.lastServiceDate === 'string'
          ? initialData.lastServiceDate.split('T')[0]
          : initialData.lastServiceDate.toISOString().split('T')[0])
        : "",
      nextServiceDate: initialData?.nextServiceDate
        ? (typeof initialData.nextServiceDate === 'string'
          ? initialData.nextServiceDate.split('T')[0]
          : initialData.nextServiceDate.toISOString().split('T')[0])
        : "",
      notes: initialData?.notes || "",
    },
  });

  // Watch for changes in lastServiceDate to auto-calculate nextServiceDate
  const lastServiceDate = form.watch('lastServiceDate');
  
  useEffect(() => {
    if (lastServiceDate && !initialData?.nextServiceDate) {
      // Auto-calculate next service date as 12 months from last service
      const lastDate = new Date(lastServiceDate);
      if (!isNaN(lastDate.getTime())) {
        const nextService = addMonths(lastDate, 12);
        const nextServiceStr = nextService.toISOString().split('T')[0];
        form.setValue('nextServiceDate', nextServiceStr);
      }
    }
  }, [lastServiceDate, form, initialData?.nextServiceDate]);

  const handleSubmit = async (data: MowerFormData) => {
    setIsSubmitting(true);
    console.log('Form submitted:', data);
    
    // Date strings are already in the correct format for API
    const apiData = {
      ...data,
      purchaseDate: data.purchaseDate || null,
      lastServiceDate: data.lastServiceDate || null,
      nextServiceDate: data.nextServiceDate || null,
    };
    
    onSubmit(apiData as any, attachments, thumbnail || undefined);
    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Edit Mower" : "Add New Mower"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input placeholder="John Deere" {...field} data-testid="input-make" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="X350" {...field} data-testid="input-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="2024"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        data-testid="input-year"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input placeholder="JD123456" {...field} data-testid="input-serial" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-purchase-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price</FormLabel>
                    <FormControl>
                      <Input placeholder="2500.00" {...field} data-testid="input-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-condition">
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">In Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Service Schedule Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Service Schedule</h3>
              
              <Alert className="mb-4">
                <InfoIcon className="h-4 w-4" />
                <AlertDescription>
                  Next service date will automatically be set to 12 months after the last service date, but can be manually adjusted if needed.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lastServiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Service Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-last-service-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextServiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Service Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-next-service-date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this mower..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Files & Thumbnail Section - Only show for new mowers */}
            {!isEditing && (
              <div className="border-t pt-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Optional Files & Thumbnail</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    You can add files and set a thumbnail for this mower. These are optional and can also be added later.
                  </p>
                </div>

                <UnifiedFileUploadArea
                  onAttachmentsChange={setAttachments}
                  onThumbnailChange={setThumbnail}
                  disabled={isSubmitting}
                  showThumbnailSelection={true}
                  mode="creation"
                />
              </div>
            )}

            <div className="flex gap-4 justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                data-testid="button-submit"
              >
                {isSubmitting ? "Saving..." : (isEditing ? "Update Mower" : "Add Mower")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}