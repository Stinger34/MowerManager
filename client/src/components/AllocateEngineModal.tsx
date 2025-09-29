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
import { CalendarIcon, Search, Plus, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn, safeFormatDateForAPI, validateDateFieldsForAPI } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EngineFormModal from "./EngineFormModal";
import type { Engine, InsertEngine } from "@shared/schema";

const engineAllocationFormSchema = z.object({
  engineId: z.number().min(1, "Engine selection is required"),
  notes: z.string().optional(),
});

type EngineAllocationFormData = z.infer<typeof engineAllocationFormSchema>;

interface AllocateEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  mowerId: string;
  onSuccess?: () => void;
}

export default function AllocateEngineModal({ 
  isOpen, 
  onClose, 
  mowerId,
  onSuccess 
}: AllocateEngineModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch all available global engines (not assigned to any mower)
  const { data: globalEngines = [], isLoading: isGlobalEnginesLoading } = useQuery<Engine[]>({
    queryKey: ['/api/engines'],
    enabled: isOpen,
  });

  // Fetch engines already assigned to this mower
  const { data: mowerEngines = [], isLoading: isMowerEnginesLoading } = useQuery<Engine[]>({
    queryKey: ['/api/mowers', mowerId, 'engines'],
    enabled: isOpen && !!mowerId,
  });

  // Get available engines (global engines not already assigned to this mower)
  const availableEngines = globalEngines.filter(engine => {
    // Show global engines that aren't already assigned to this mower
    const isGlobal = !engine.mowerId;
    const isNotAssigned = !mowerEngines.some(mowerEngine => mowerEngine.id === engine.id);
    const matchesSearch = engine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (engine.partNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (engine.manufacturer || "").toLowerCase().includes(searchQuery.toLowerCase());
    return isGlobal && isNotAssigned && matchesSearch;
  });

  const form = useForm<EngineAllocationFormData>({
    resolver: zodResolver(engineAllocationFormSchema),
    defaultValues: {
      engineId: 0,
      notes: "",
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        engineId: 0,
        notes: "",
      });
      setSearchQuery("");
    }
  }, [isOpen, form]);

  const allocateEngineMutation = useMutation({
    mutationFn: async (data: EngineAllocationFormData) => {
      // Find the selected engine
      const selectedEngine = globalEngines.find(c => c.id === data.engineId);
      if (!selectedEngine) {
        throw new Error('Selected engine not found');
      }

      // Validate and format warranty date
      const formattedWarrantyExpires = safeFormatDateForAPI(selectedEngine.warrantyExpires);
      
      if (selectedEngine.warrantyExpires && formattedWarrantyExpires === null) {
        throw new Error("Invalid warranty expiration date in selected engine data.");
      }

      // Handle existing engine replacement if needed
      if (mowerEngines.length > 0) {
        const currentEngine = mowerEngines[0];
        
        // Return current engine to catalog (make it global again)
        const currentEngineWarrantyExpires = safeFormatDateForAPI(currentEngine.warrantyExpires);
        
        if (currentEngine.warrantyExpires && currentEngineWarrantyExpires === null) {
          throw new Error("Invalid warranty expiration date in current engine data during replacement.");
        }
        
        await apiRequest("PUT", `/api/engines/${currentEngine.id}`, {
          ...currentEngine,
          mowerId: null,
          installDate: null,
          ...(currentEngineWarrantyExpires !== null && { warrantyExpires: currentEngineWarrantyExpires }),
        });
      }

      // Prepare engine data for allocation
      const currentDate = new Date();
      const engineData: InsertEngine = {
        name: selectedEngine.name,
        description: selectedEngine.description,
        partNumber: selectedEngine.partNumber,
        manufacturer: selectedEngine.manufacturer,
        model: selectedEngine.model,
        serialNumber: selectedEngine.serialNumber,
        mowerId: parseInt(mowerId),
        installDate: safeFormatDateForAPI(currentDate), // Set install date to today
        ...(formattedWarrantyExpires && { warrantyExpires: formattedWarrantyExpires }),
        condition: selectedEngine.condition,
        status: selectedEngine.status,
        cost: selectedEngine.cost,
        notes: data.notes || selectedEngine.notes,
      };
      
      // Final validation before API submission
      if (!validateDateFieldsForAPI(engineData, ['installDate', 'warrantyExpires'])) {
        throw new Error("Date validation failed. Please check the date formats.");
      }
      
      const response = await apiRequest("POST", `/api/mowers/${mowerId}/engines`, engineData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      
      const hasExistingEngine = mowerEngines.length > 0;
      toast({
        title: "Success",
        description: hasExistingEngine 
          ? "Engine replaced successfully. Previous engine returned to catalog with parts history preserved." 
          : "Engine allocated successfully",
      });
      form.reset();
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate component",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: EngineAllocationFormData) => {
    allocateEngineMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    setSearchQuery("");
    onClose();
  };

  const handleCreateNewComponent = () => {
    setShowCreateModal(true);
  };

  const handleCreateComponentSuccess = () => {
    setShowCreateModal(false);
    // Refresh global components list
    queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mowerEngines.length > 0 ? "Replace Engine on Mower" : "Allocate Engine to Mower"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Replacement Warning */}
            {mowerEngines.length > 0 && (
              <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Replacing Existing Engine</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  Current engine: <strong>{mowerEngines[0]?.name}</strong> will be unassigned and returned to the catalog with its parts history preserved.
                </p>
              </div>
            )}
            
            {/* Search and Create Section */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search available components..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCreateNewComponent}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </div>

              {/* Available Components List */}
              {isGlobalEnginesLoading || isMowerEnginesLoading ? (
                <div className="text-center py-4">Loading components...</div>
              ) : availableEngines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No available components found</p>
                  {searchQuery && <p className="text-sm mt-1">Try adjusting your search or create a new component</p>}
                  {!searchQuery && (
                    <p className="text-sm mt-1">
                      All global components are already allocated to this mower, or none exist yet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border border-nested-border rounded-md p-2">
                  {availableEngines.map((component) => (
                    <div
                      key={component.id}
                      className={cn(
                        "border border-nested-border rounded-lg p-3 cursor-pointer transition-colors",
                        form.watch("engineId") === component.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      )}
                      onClick={() => form.setValue("engineId", component.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{component.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {component.status}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {component.condition}
                            </Badge>
                          </div>
                          {component.description && (
                            <p className="text-sm text-muted-foreground mt-1">{component.description}</p>
                          )}
                          <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                            {component.partNumber && <span>Part: {component.partNumber}</span>}
                            {component.manufacturer && <span>Mfg: {component.manufacturer}</span>}
                            {component.model && <span>Model: {component.model}</span>}
                            {component.cost && <span>Cost: ${component.cost}</span>}
                          </div>
                        </div>
                        {form.watch("engineId") === component.id && (
                          <div className="text-primary">
                            ✓ Selected
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Allocation Form */}
            {form.watch("engineId") > 0 && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allocation Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any notes specific to this allocation..." 
                            {...field} 
                          />
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
                      disabled={allocateEngineMutation.isPending}
                      className={mowerEngines.length > 0 ? "bg-orange-600 hover:bg-orange-700" : ""}
                    >
                      {allocateEngineMutation.isPending 
                        ? (mowerEngines.length > 0 ? "Replacing..." : "Allocating...") 
                        : (mowerEngines.length > 0 ? "Replace Engine" : "Allocate Engine")
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Component Modal */}
      <EngineFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mowerId={null} // Global component
        onSuccess={handleCreateComponentSuccess}
      />
    </>
  );
}