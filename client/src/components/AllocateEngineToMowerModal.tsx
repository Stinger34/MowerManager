import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, safeFormatDateForAPI, validateDateFieldsForAPI } from "@/lib/utils";
import { CalendarIcon, Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mower, Engine, InsertEngine } from "@shared/schema";

// Type alias for backwards compatibility
type Component = Engine;
type InsertComponent = InsertEngine;

const engineAllocationFormSchema = z.object({
  mowerId: z.number().min(1, "Mower selection is required"),
  notes: z.string().optional(),
});

type EngineAllocationFormData = z.infer<typeof engineAllocationFormSchema>;

interface AllocateEngineToMowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: Component;
  onSuccess?: () => void;
}

export default function AllocateEngineToMowerModal({ 
  isOpen, 
  onClose, 
  engine,
  onSuccess 
}: AllocateEngineToMowerModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");


  // Fetch all available mowers
  const { data: allMowers = [], isLoading: isMowersLoading } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
    enabled: isOpen,
  });

  // Fetch engines for all mowers to check availability (need to fetch all engines, not just global ones)
  const { data: allEngines = [] } = useQuery<Engine[]>({
    queryKey: ['/api/components'], // Use deprecated endpoint that returns all engines
    enabled: isOpen,
  });

  // Filter mowers based on search query (show ALL mowers, not just ones without engines)
  const filteredMowers = allMowers.filter(mower => {
    const matchesSearch = mower.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         mower.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (mower.serialNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Helper function to get the engine assigned to a mower
  const getMowerEngine = (mowerId: number) => {
    return allEngines.find(engine => engine.mowerId === mowerId);
  };

  const form = useForm<EngineAllocationFormData>({
    resolver: zodResolver(engineAllocationFormSchema),
    defaultValues: {
      mowerId: 0,
      notes: "",
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        mowerId: 0,
        notes: "",
      });
      setSearchQuery("");
    }
  }, [isOpen, form]);

  const allocateEngineMutation = useMutation({
    mutationFn: async (data: EngineAllocationFormData) => {
      // Validate and format warranty date
      const formattedWarrantyExpires = safeFormatDateForAPI(engine.warrantyExpires);
      
      if (engine.warrantyExpires && formattedWarrantyExpires === null) {
        throw new Error("Invalid warranty expiration date in engine data.");
      }
      
      // Prepare engine data for allocation
      const currentDate = new Date();
      const engineData: InsertComponent = {
        name: engine.name,
        description: engine.description,
        partNumber: engine.partNumber,
        manufacturer: engine.manufacturer,
        model: engine.model,
        serialNumber: engine.serialNumber,
        mowerId: data.mowerId,
        installDate: safeFormatDateForAPI(currentDate), // Set install date to today
        ...(formattedWarrantyExpires && { warrantyExpires: formattedWarrantyExpires }),
        condition: engine.condition,
        status: engine.status,
        cost: engine.cost,
        notes: data.notes || engine.notes,
      };
      
      // Final validation before API submission
      if (!validateDateFieldsForAPI(engineData, ['installDate', 'warrantyExpires'])) {
        throw new Error("Date validation failed. Please check the date formats.");
      }
      
      console.log("Engine allocation payload:", engineData);
      const response = await apiRequest("POST", `/api/mowers/${data.mowerId}/engines`, engineData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      toast({
        title: "Success",
        description: "Engine allocated to mower successfully",
      });
      form.reset();
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate engine to mower",
        variant: "destructive",
      });
    },
  });



  const onSubmit = (data: EngineAllocationFormData) => {
    const existingEngine = getMowerEngine(data.mowerId);
    
    if (existingEngine) {
      // Strict one-engine-per-mower rule - prevent allocation
      toast({
        title: "Engine Already Allocated",
        description: "This mower already has an engine allocated. Only one engine per mower is allowed. Please unallocate the current engine first.",
        variant: "destructive",
      });
      return;
    }
    
    // No existing engine - proceed with direct allocation
    allocateEngineMutation.mutate(data);
  };



  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Allocate "{engine.name}" to Mower</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Search field */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mowers by make, model, or serial number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Mower Selection */}
            <FormField
              control={form.control}
              name="mowerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Mower</FormLabel>
                  {isMowersLoading ? (
                    <div className="border rounded-md p-8 text-center text-muted-foreground">
                      Loading mowers...
                    </div>
                  ) : filteredMowers.length === 0 ? (
                    <div className="border rounded-md p-8 text-center text-muted-foreground">
                      <p>No mowers found</p>
                      {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                      {filteredMowers.map((mower) => {
                        const existingEngine = getMowerEngine(mower.id);
                        const hasEngine = !!existingEngine;
                        
                        return (
                          <div
                            key={mower.id}
                            className={cn(
                              "border rounded-lg p-3 transition-colors",
                              form.watch("mowerId") === mower.id
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div 
                                className={cn(
                                  "flex-1", 
                                  hasEngine ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                )}
                                onClick={() => !hasEngine && form.setValue("mowerId", mower.id)}
                              >
                                <div className="font-medium">{mower.make} {mower.model}</div>
                                <div className="text-sm text-muted-foreground">
                                  {mower.year && `${mower.year} • `}
                                  {mower.serialNumber && `S/N: ${mower.serialNumber} • `}
                                  Status: {mower.status}
                                </div>
                                {mower.location && (
                                  <div className="text-sm text-muted-foreground mt-1">
                                    Location: {mower.location}
                                  </div>
                                )}
                                {hasEngine && (
                                  <div className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Engine already allocated: {existingEngine.name}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                {hasEngine ? (
                                  <Badge variant="destructive" className="text-xs">
                                    Unavailable
                                  </Badge>
                                ) : (
                                  <Button
                                    type="button"
                                    variant={form.watch("mowerId") === mower.id ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => form.setValue("mowerId", mower.id)}
                                  >
                                    {form.watch("mowerId") === mower.id ? "Selected" : "Select"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes about this allocation..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={allocateEngineMutation.isPending}
              >
                {allocateEngineMutation.isPending ? "Allocating..." : "Allocate Engine"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    </>
  );
}