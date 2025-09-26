import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Part, Engine, AssetPart, InsertAssetPart } from "@shared/schema";

const assetPartFormSchema = z.object({
  partId: z.number().min(1, "Part selection is required"),
  mowerId: z.number().optional(),
  engineId: z.number().optional(),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  installDate: z.date().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.mowerId || data.engineId,
  {
    message: "Must allocate to either a mower or engine",
    path: ["mowerId"],
  }
);

type AssetPartFormData = z.infer<typeof assetPartFormSchema>;

interface AllocatePartModalProps {
  isOpen: boolean;
  onClose: () => void;
  mowerId: string;
  engineId?: string | null;
  assetPart?: AssetPart | null;
  onSuccess?: () => void;
}

export default function AllocatePartModal({ 
  isOpen, 
  onClose, 
  mowerId,
  engineId = null,
  assetPart = null,
  onSuccess 
}: AllocatePartModalProps) {
  const { toast } = useToast();
  const isEditing = !!assetPart;
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch available parts
  const { data: parts = [] } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  // Fetch engines for this mower if not allocating to a specific engine
  const { data: engines = [] } = useQuery<Engine[]>({
    queryKey: ['/api/mowers', mowerId, 'engines'],
    enabled: !engineId,
  });

  const form = useForm<AssetPartFormData>({
    resolver: zodResolver(assetPartFormSchema),
    defaultValues: {
      partId: assetPart?.partId || 0,
      mowerId: engineId ? undefined : parseInt(mowerId),
      engineId: engineId ? parseInt(engineId) : assetPart?.engineId || undefined,
      quantity: assetPart?.quantity || 1,
      installDate: assetPart?.installDate ? new Date(assetPart.installDate) : undefined,
      notes: assetPart?.notes || "",
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        partId: assetPart?.partId || 0,
        mowerId: engineId ? undefined : parseInt(mowerId),
        engineId: engineId ? parseInt(engineId) : assetPart?.engineId || undefined,
        quantity: assetPart?.quantity || 1,
        installDate: assetPart?.installDate ? new Date(assetPart.installDate) : undefined,
        notes: assetPart?.notes || "",
      });
    }
  }, [isOpen, assetPart, mowerId, engineId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: AssetPartFormData) => {
      const assetPartData: InsertAssetPart = {
        partId: data.partId,
        mowerId: data.mowerId || null,
        engineId: data.engineId || null,
        quantity: data.quantity,
        installDate: data.installDate ? format(data.installDate, "yyyy-MM-dd") : null,
        notes: data.notes || null,
      };
      
      const response = await apiRequest("POST", "/api/asset-parts", assetPartData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'parts'] });
      if (engineId) {
        queryClient.invalidateQueries({ queryKey: ['/api/engines', engineId, 'parts'] });
      }
      toast({
        title: "Success",
        description: "Part allocated successfully",
      });
      form.reset();
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate part",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AssetPartFormData) => {
      const assetPartData = {
        partId: data.partId,
        mowerId: data.mowerId || null,
        engineId: data.engineId || null,
        quantity: data.quantity,
        installDate: data.installDate ? format(data.installDate, "yyyy-MM-dd") : null,
        notes: data.notes || null,
      };
      
      const response = await apiRequest("PUT", `/api/asset-parts/${assetPart!.id}`, assetPartData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'parts'] });
      if (engineId || assetPart?.engineId) {
        queryClient.invalidateQueries({ queryKey: ['/api/engines', engineId || assetPart?.engineId, 'parts'] });
      }
      toast({
        title: "Success",
        description: "Part allocation updated successfully",
      });
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update part allocation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AssetPartFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  // Filter parts based on search query
  const filteredParts = parts.filter(part => 
    part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (part.manufacturer || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPart = parts.find(p => p.id === form.watch("partId"));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Part Allocation" : "Allocate Part"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Part Selection */}
            <div className="space-y-2">
              <FormLabel>Search and Select Part *</FormLabel>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search parts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <FormField
                control={form.control}
                name="partId"
                render={({ field }) => (
                  <FormItem>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a part" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {filteredParts.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            No parts found
                          </div>
                        ) : (
                          filteredParts.map((part) => (
                            <SelectItem 
                              key={part.id} 
                              value={part.id.toString()}
                              className="flex flex-col items-start"
                            >
                              <div className="flex justify-between w-full">
                                <span className="font-medium">{part.name}</span>
                                <span className="text-muted-foreground">#{part.partNumber}</span>
                              </div>
                              <div className="flex justify-between w-full text-sm text-muted-foreground">
                                <span>{part.category}</span>
                                <span>Stock: {part.stockQuantity}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show selected part info */}
              {selectedPart && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedPart.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Part #: {selectedPart.partNumber} | Category: {selectedPart.category} | 
                    Stock: {selectedPart.stockQuantity}
                    {selectedPart.unitCost && ` | Cost: $${selectedPart.unitCost}`}
                  </p>
                  {selectedPart.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedPart.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Allocation Target */}
            {!engineId && (
              <FormField
                control={form.control}
                name="engineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allocate to Engine (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        if (value === "none") {
                          field.onChange(undefined);
                          form.setValue("mowerId", parseInt(mowerId));
                        } else {
                          field.onChange(parseInt(value));
                          form.setValue("mowerId", undefined);
                        }
                      }}
                      value={field.value ? field.value.toString() : "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select engine or allocate to mower directly" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Allocate to Mower Directly</SelectItem>
                        {engines.map((engine) => (
                          <SelectItem key={engine.id} value={engine.id.toString()}>
                            {engine.name}
                            {engine.partNumber && ` (${engine.partNumber})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Installation notes, location, etc..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    ? "Update Allocation" 
                    : "Allocate Part"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}