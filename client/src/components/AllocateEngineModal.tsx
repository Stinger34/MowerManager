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
import { CalendarIcon, Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EngineFormModal from "./EngineFormModal";
import type { Engine, InsertEngine } from "@shared/schema";

const engineAllocationFormSchema = z.object({
  engineId: z.number().min(1, "Engine selection is required"),
  installDate: z.date().optional(),
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
    const isNotAssigned = !mowerEngines.some(mowerComp => mowerComp.id === engine.id);
    const matchesSearch = engine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (engine.partNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (engine.manufacturer || "").toLowerCase().includes(searchQuery.toLowerCase());
    return isGlobal && isNotAssigned && matchesSearch;
  });

  const form = useForm<EngineAllocationFormData>({
    resolver: zodResolver(engineAllocationFormSchema),
    defaultValues: {
      engineId: 0,
      installDate: undefined,
      notes: "",
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        engineId: 0,
        installDate: undefined,
        notes: "",
      });
      setSearchQuery("");
    }
  }, [isOpen, form]);

  const allocateEngineMutation = useMutation({
    mutationFn: async (data: EngineAllocationFormData) => {
      // We create a copy of the selected global engine and assign it to this mower
      const selectedEngine = globalEngines.find(c => c.id === data.engineId);
      if (!selectedEngine) {
        throw new Error('Selected engine not found');
      }

      const engineData: InsertEngine = {
        name: selectedEngine.name,
        description: selectedEngine.description,
        partNumber: selectedEngine.partNumber,
        manufacturer: selectedEngine.manufacturer,
        model: selectedEngine.model,
        serialNumber: selectedEngine.serialNumber,
        mowerId: parseInt(mowerId),
        installDate: data.installDate ? format(data.installDate, "yyyy-MM-dd") : null,
        warrantyExpires: selectedEngine.warrantyExpires,
        condition: selectedEngine.condition,
        status: selectedEngine.status,
        cost: selectedEngine.cost,
        notes: data.notes || selectedEngine.notes,
      };
      
      const response = await apiRequest("POST", `/api/mowers/${mowerId}/engines`, engineData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'engines'] });
      toast({
        title: "Success",
        description: "Engine allocated successfully",
      });
      form.reset();
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate engine",
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

  const handleCreateNewEngine = () => {
    setShowCreateModal(true);
  };

  const handleCreateEngineSuccess = () => {
    setShowCreateModal(false);
    // Refresh global engines list
    queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocate Engine to Mower</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Create Section */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search available engines..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCreateNewEngine}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </Button>
              </div>

              {/* Available Engines List */}
              {isGlobalEnginesLoading || isMowerEnginesLoading ? (
                <div className="text-center py-4">Loading engines...</div>
              ) : availableEngines.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No available engines found</p>
                  {searchQuery && <p className="text-sm mt-1">Try adjusting your search or create a new engine</p>}
                  {!searchQuery && (
                    <p className="text-sm mt-1">
                      All global engines are already allocated to this mower, or none exist yet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                  {availableEngines.map((engine) => (
                    <div
                      key={engine.id}
                      className={cn(
                        "border rounded-lg p-3 cursor-pointer transition-colors",
                        form.watch("engineId") === engine.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => form.setValue("engineId", engine.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{engine.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {engine.status}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {engine.condition}
                            </Badge>
                          </div>
                          {engine.description && (
                            <p className="text-sm text-muted-foreground mt-1">{engine.description}</p>
                          )}
                          <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                            {engine.partNumber && <span>Part: {engine.partNumber}</span>}
                            {engine.manufacturer && <span>Mfg: {engine.manufacturer}</span>}
                            {engine.model && <span>Model: {engine.model}</span>}
                            {engine.cost && <span>Cost: ${engine.cost}</span>}
                          </div>
                        </div>
                        {form.watch("engineId") === engine.id && (
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
                    >
                      {allocateEngineMutation.isPending 
                        ? "Allocating..." 
                        : "Allocate Engine"
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Engine Modal */}
      <EngineFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mowerId={null} // Global engine
        onSuccess={handleCreateEngineSuccess}
      />
    </>
  );
}