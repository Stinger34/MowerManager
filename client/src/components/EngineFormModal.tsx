import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, safeFormatDateForAPI, safeConvertToDate } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Engine, InsertEngine } from "@shared/schema";
import AttachmentUploadArea from "./AttachmentUploadArea";
import { uploadAttachmentsForEntity } from "@/lib/attachmentUpload";

const engineFormSchema = z.object({
  name: z.string().min(1, "Engine name is required"),
  description: z.string().optional(),
  partNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.date().optional(),
  warrantyExpires: z.date().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor"]).default("good"),
  status: z.enum(["active", "maintenance", "retired"]).default("active"),
  cost: z.string().optional(),
  notes: z.string().optional(),
});

type EngineFormData = z.infer<typeof engineFormSchema>;

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
}

interface EngineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mowerId?: string | null; // Optional for global engines
  engine?: Engine | null;
  onSuccess?: () => void;
}

export default function EngineFormModal({ 
  isOpen, 
  onClose, 
  mowerId = null, 
  engine = null,
  onSuccess 
}: EngineFormModalProps) {
  const { toast } = useToast();
  const isEditing = !!engine;
  const isGlobalEngine = !mowerId || mowerId === "0";
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentFile[]>([]);

  const form = useForm<EngineFormData>({
    resolver: zodResolver(engineFormSchema),
    defaultValues: {
      name: "",
      description: "",
      partNumber: "",
      manufacturer: "",
      model: "",
      serialNumber: "",
      installDate: undefined,
      warrantyExpires: undefined,
      condition: "good",
      status: "active",
      cost: "",
      notes: "",
    },
  });

  // Fetch engines already assigned to this mower (only when creating for a specific mower)
  const { data: mowerEngines = [], isLoading: isMowerEnginesLoading } = useQuery<Engine[]>({
    queryKey: ['/api/mowers', mowerId, 'engines'],
    enabled: isOpen && !isGlobalEngine && !isEditing && !!mowerId,
  });

  // Reset form when engine prop changes
  useEffect(() => {
    if (isOpen) {
      // Check if mower already has an engine (when creating, not editing)
      if (!isEditing && !isGlobalEngine && mowerEngines.length > 0) {
        toast({
          title: "Engine Already Allocated",
          description: "This mower already has an engine allocated. Only one engine per mower is allowed.",
          variant: "destructive",
        });
        onClose();
        return;
      }
      
      form.reset({
        name: engine?.name || "",
        description: engine?.description || "",
        partNumber: engine?.partNumber || "",
        manufacturer: engine?.manufacturer || "",
        model: engine?.model || "",
        serialNumber: engine?.serialNumber || "",
        installDate: safeConvertToDate(engine?.installDate),
        warrantyExpires: safeConvertToDate(engine?.warrantyExpires),
        condition: (engine?.condition as "excellent" | "good" | "fair" | "poor") || "good",
        status: (engine?.status as "active" | "maintenance" | "retired") || "active",
        cost: engine?.cost || "",
        notes: engine?.notes || "",
      });
      // Reset attachments for editing mode
      if (isEditing) {
        setPendingAttachments([]);
      }
    }
  }, [engine, isOpen, isEditing, isGlobalEngine, mowerEngines.length, toast, onClose]);

  const createMutation = useMutation({
    mutationFn: async (data: EngineFormData) => {
      // Validate dates first
      const installDate = safeFormatDateForAPI(data.installDate, (error) => {
        toast({
          title: "Date Error",
          description: "Invalid install date. Please select a valid date.",
          variant: "destructive",
        });
      });
      
      const warrantyExpires = safeFormatDateForAPI(data.warrantyExpires, (error) => {
        toast({
          title: "Date Error", 
          description: "Invalid warranty expiration date. Please select a valid date.",
          variant: "destructive",
        });
      });

      // Stop submission if date validation failed
      if ((data.installDate && installDate === null) || (data.warrantyExpires && warrantyExpires === null)) {
        throw new Error("Please correct the date errors before submitting.");
      }

      const engineData: InsertEngine = {
        ...data,
        mowerId: isGlobalEngine ? null : parseInt(mowerId!), // Global engines have null mowerId
        ...(installDate !== null && { installDate }),
        ...(warrantyExpires !== null && { warrantyExpires }),
        cost: data.cost || null,
        description: data.description || null,
        partNumber: data.partNumber || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      };
      
      // Use different endpoints for global vs mower-specific engines
      const endpoint = isGlobalEngine 
        ? "/api/engines" 
        : `/api/mowers/${mowerId}/engines`;
      
      const response = await apiRequest("POST", endpoint, engineData);
      
      // Safely parse JSON response 
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      
      const createdComponent = await response.json();
      
      // Upload attachments if any
      if (pendingAttachments.length > 0) {
        await uploadAttachmentsForEntity('engines', createdComponent.id, pendingAttachments);
      }
      
      return createdComponent;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      if (isGlobalEngine) {
        queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'engines'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      }
      toast({
        title: "Success",
        description: `${isGlobalEngine ? 'Global' : 'Mower'} engine created successfully${pendingAttachments.length > 0 ? ` with ${pendingAttachments.length} attachment(s)` : ''}`,
      });
      form.reset();
      setPendingAttachments([]);
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Engine creation error:', error);
      toast({
        title: "Failed to Create Engine",
        description: error.message || "An unexpected error occurred while creating the engine. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EngineFormData) => {
      // Validate dates first
      const installDate = safeFormatDateForAPI(data.installDate, (error) => {
        toast({
          title: "Date Error",
          description: "Invalid install date. Please select a valid date.",
          variant: "destructive",
        });
      });
      
      const warrantyExpires = safeFormatDateForAPI(data.warrantyExpires, (error) => {
        toast({
          title: "Date Error",
          description: "Invalid warranty expiration date. Please select a valid date.",
          variant: "destructive",
        });
      });

      // Stop submission if date validation failed
      if ((data.installDate && installDate === null) || (data.warrantyExpires && warrantyExpires === null)) {
        throw new Error("Please correct the date errors before submitting.");
      }

      const engineData = {
        ...data,
        ...(installDate !== null && { installDate }),
        ...(warrantyExpires !== null && { warrantyExpires }),
        cost: data.cost || null,
        description: data.description || null,
        partNumber: data.partNumber || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      };
      
      const response = await apiRequest("PUT", `/api/engines/${engine!.id}`, engineData);
      
      // Safely parse JSON response 
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      if (isGlobalEngine || !engine?.mowerId) {
        queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/mowers', engine?.mowerId.toString(), 'engines'] });
        queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      }
      toast({
        title: "Success",
        description: "Engine updated successfully",
      });
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Engine update error:', error);
      toast({
        title: "Failed to Update Engine",
        description: error.message || "An unexpected error occurred while updating the engine. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EngineFormData) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Engine" : `Add ${isGlobalEngine ? 'Global ' : ''}Engine`}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the engine details below and save your changes."
              : `Create a new ${isGlobalEngine ? 'global ' : ''}engine type for your catalog.`
            }
          </DialogDescription>
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
                      <Input placeholder="Engine name..." {...field} />
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
                    <Textarea placeholder="Engine description..." {...field} />
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
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="Model..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Serial number..." {...field} />
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
                      <Input placeholder="0.00" type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
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
                        <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="installDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Install Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="warrantyExpires"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Warranty Expires</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                    ? "Update Engine" 
                    : "Create Engine"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}