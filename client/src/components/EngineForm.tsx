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
import { safeFormatDateForAPI, validateDateFieldsForAPI } from "@/lib/utils";
import type { Engine, InsertEngine } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const engineFormSchema = z.object({
  name: z.string().min(1, "Engine name is required"),
  description: z.string().optional(),
  partNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor"]).default("good"),
  status: z.enum(["active", "maintenance", "retired"]).default("active"),
  cost: z.string().optional(),
  notes: z.string().optional(),
});

type EngineFormData = z.infer<typeof engineFormSchema>;

interface EngineFormProps {
  initialData?: Engine;
  onSubmit: (data: InsertEngine) => void;
  onCancel: () => void;
  isEditing?: boolean;
}

export default function EngineForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isEditing = false 
}: EngineFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EngineFormData>({
    resolver: zodResolver(engineFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      partNumber: initialData?.partNumber || "",
      manufacturer: initialData?.manufacturer || "",
      model: initialData?.model || "",
      serialNumber: initialData?.serialNumber || "",
      installDate: initialData?.installDate 
        ? (typeof initialData.installDate === 'string' 
          ? initialData.installDate.split('T')[0]
          : new Date(initialData.installDate).toISOString().split('T')[0])
        : "",
      condition: (initialData?.condition as "excellent" | "good" | "fair" | "poor") || "good",
      status: (initialData?.status as "active" | "maintenance" | "retired") || "active",
      cost: initialData?.cost || "",
      notes: initialData?.notes || "",
    },
  });

  const handleSubmit = async (data: EngineFormData) => {
    setIsSubmitting(true);
    try {
      // Convert date string to API format if present
      const installDate = data.installDate || null;

      const engineData: InsertEngine = {
        name: data.name,
        condition: data.condition,
        status: data.status,
        mowerId: 1, // TODO: This should be selected from a mower dropdown
        installDate,
        cost: data.cost || null,
        description: data.description || null,
        partNumber: data.partNumber || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      };
      
      // Validate date fields before API submission
      if (!validateDateFieldsForAPI(engineData, ['installDate'])) {
        throw new Error("Date validation failed. Please check the date formats.");
      }
      
      await onSubmit(engineData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? "Edit Engine" : "New Engine Type"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Engine name..." {...field} data-testid="input-name" />
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
                    <FormLabel>Part Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Part number..." {...field} data-testid="input-part-number" />
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
                    <Textarea placeholder="Engine description..." {...field} data-testid="textarea-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer..." {...field} data-testid="input-manufacturer" />
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
                      <Input placeholder="Model..." {...field} data-testid="input-model" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Serial number..." {...field} data-testid="input-serial-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" type="number" step="0.01" {...field} data-testid="input-cost" />
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="installDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Install Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-install-date"
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
                    <Textarea placeholder="Additional notes..." {...field} data-testid="textarea-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                data-testid="button-submit"
              >
                {isSubmitting ? "Creating..." : isEditing ? "Update Engine" : "Create Engine"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}