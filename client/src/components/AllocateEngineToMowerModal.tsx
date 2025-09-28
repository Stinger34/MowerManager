import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  installDate: z.date().optional(),
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
  const [showReplaceConfirmation, setShowReplaceConfirmation] = useState(false);
  const [selectedMowerForReplacement, setSelectedMowerForReplacement] = useState<Mower | null>(null);
  const [currentEngineToReplace, setCurrentEngineToReplace] = useState<Engine | null>(null);
  
  // Separate form for replacement specific inputs
  const replaceForm = useForm<{
    installDate?: Date;
    notes: string;
  }>({
    defaultValues: {
      installDate: undefined,
      notes: "",
    },
  });

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
      installDate: undefined,
      notes: "",
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        mowerId: 0,
        installDate: undefined,
        notes: "",
      });
      replaceForm.reset({
        installDate: undefined,
        notes: "",
      });
      setSearchQuery("");
    }
  }, [isOpen, form, replaceForm]);

  const allocateEngineMutation = useMutation({
    mutationFn: async (data: EngineAllocationFormData) => {
      // Validate and format dates early
      const formattedInstallDate = safeFormatDateForAPI(data.installDate);
      const formattedWarrantyExpires = safeFormatDateForAPI(engine.warrantyExpires);
      
      // Stop if date validation failed for provided dates
      if (data.installDate && formattedInstallDate === null) {
        throw new Error("Invalid install date provided. Please select a valid date.");
      }
      
      if (engine.warrantyExpires && formattedWarrantyExpires === null) {
        throw new Error("Invalid warranty expiration date in engine data.");
      }
      
      // Prepare engine data for allocation
      const engineData: InsertComponent = {
        name: engine.name,
        description: engine.description,
        partNumber: engine.partNumber,
        manufacturer: engine.manufacturer,
        model: engine.model,
        serialNumber: engine.serialNumber,
        mowerId: data.mowerId,
        ...(formattedInstallDate && { installDate: formattedInstallDate }),
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

  const replaceEngineMutation = useMutation({
    mutationFn: async (data: { mowerId: number; installDate?: Date; notes?: string }) => {
      if (!currentEngineToReplace) {
        throw new Error("No engine to replace");
      }

      // Validate and format dates early
      const formattedInstallDate = safeFormatDateForAPI(data.installDate);
      const formattedWarrantyExpires = safeFormatDateForAPI(engine.warrantyExpires);
      
      // Stop if date validation failed for provided dates
      if (data.installDate && formattedInstallDate === null) {
        throw new Error("Invalid install date provided. Please select a valid date.");
      }
      
      if (engine.warrantyExpires && formattedWarrantyExpires === null) {
        throw new Error("Invalid warranty expiration date in engine data.");
      }

      // Step 1: Return current engine to catalog (make it global)
      const currentEngineWarrantyExpires = safeFormatDateForAPI(currentEngineToReplace.warrantyExpires);
      await apiRequest("PUT", `/api/engines/${currentEngineToReplace.id}`, {
        ...currentEngineToReplace,
        mowerId: null,
        installDate: null,
        ...(currentEngineWarrantyExpires && { warrantyExpires: currentEngineWarrantyExpires }),
      });

      // Step 2: Allocate new engine to mower
      const engineData: InsertComponent = {
        name: engine.name,
        description: engine.description,
        partNumber: engine.partNumber,
        manufacturer: engine.manufacturer,
        model: engine.model,
        serialNumber: engine.serialNumber,
        mowerId: data.mowerId,
        ...(formattedInstallDate && { installDate: formattedInstallDate }),
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
      
      const response = await apiRequest("POST", `/api/mowers/${data.mowerId}/engines`, engineData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      toast({
        title: "Success",
        description: "Engine replaced successfully. Previous engine returned to catalog with parts history preserved.",
      });
      form.reset();
      replaceForm.reset();
      setShowReplaceConfirmation(false);
      setSelectedMowerForReplacement(null);
      setCurrentEngineToReplace(null);
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to replace engine",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EngineAllocationFormData) => {
    const existingEngine = getMowerEngine(data.mowerId);
    
    if (existingEngine) {
      // Mower already has an engine - show replacement confirmation
      const selectedMower = filteredMowers.find(m => m.id === data.mowerId);
      if (selectedMower) {
        setSelectedMowerForReplacement(selectedMower);
        setCurrentEngineToReplace(existingEngine);
        // Transfer form data to replacement form
        replaceForm.setValue('installDate', data.installDate);
        replaceForm.setValue('notes', data.notes || '');
        setShowReplaceConfirmation(true);
      }
    } else {
      // No existing engine - proceed with direct allocation
      allocateEngineMutation.mutate(data);
    }
  };

  const handleReplaceConfirm = () => {
    if (selectedMowerForReplacement) {
      const replaceFormData = replaceForm.getValues();
      replaceEngineMutation.mutate({
        mowerId: selectedMowerForReplacement.id,
        installDate: replaceFormData.installDate,
        notes: replaceFormData.notes,
      });
    }
  };

  const handleReplaceCancel = () => {
    setShowReplaceConfirmation(false);
    setSelectedMowerForReplacement(null);
    setCurrentEngineToReplace(null);
    replaceForm.reset({
      installDate: undefined,
      notes: "",
    });
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
                                className="flex-1 cursor-pointer"
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
                                  <div className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Current engine: {existingEngine.name}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex gap-2">
                                {hasEngine ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedMowerForReplacement(mower);
                                      setCurrentEngineToReplace(existingEngine);
                                      setShowReplaceConfirmation(true);
                                    }}
                                    className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                  >
                                    Replace
                                  </Button>
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

            <div className="grid grid-cols-2 gap-4">
              {/* Install Date */}
              <FormField
                control={form.control}
                name="installDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Install Date (Optional)</FormLabel>
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
                              <span>Pick install date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                        {field.value && (
                          <div className="p-3 border-t">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => field.onChange(undefined)}
                              className="w-full"
                            >
                              Clear Date
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

    {/* Replacement Confirmation Dialog */}
    <AlertDialog open={showReplaceConfirmation} onOpenChange={setShowReplaceConfirmation}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Replace Engine?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              <strong>{selectedMowerForReplacement?.make} {selectedMowerForReplacement?.model}</strong> already has an engine 
              (<strong>{currentEngineToReplace?.name}</strong>) assigned to it.
            </p>
            <p>
              Replacing it with <strong>"{engine.name}"</strong> will:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Unassign the current engine and return it to the catalog</li>
              <li>Preserve all parts allocation history for the unassigned engine</li>
              <li>Assign the new engine to this mower</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Replace Engine Form */}
        <div className="space-y-4 py-4">
          <Form {...replaceForm}>
            <div className="grid grid-cols-1 gap-4">
              {/* Install Date for Replacement */}
              <FormField
                control={replaceForm.control}
                name="installDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Install Date (Optional)</FormLabel>
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
                              <span>Pick install date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                        {field.value && (
                          <div className="p-3 border-t">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => field.onChange(undefined)}
                              className="w-full"
                            >
                              Clear Date
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes for Replacement */}
              <FormField
                control={replaceForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Replacement Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this engine replacement..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Form>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleReplaceCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReplaceConfirm}
            disabled={replaceEngineMutation.isPending}
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {replaceEngineMutation.isPending ? "Replacing..." : "Replace Engine"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}