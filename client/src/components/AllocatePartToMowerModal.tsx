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
import { CalendarIcon, Search, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Part, Mower, InsertAssetPart } from "@shared/schema";

const allocateToMowerFormSchema = z.object({
  mowerId: z.number().min(1, "Mower selection is required"),
  quantity: z.number().min(1, "Quantity must be at least 1").default(1),
  installDate: z.date().optional(),
  notes: z.string().optional(),
});

type AllocateToMowerFormData = z.infer<typeof allocateToMowerFormSchema>;

interface AllocatePartToMowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  part: Part | null | undefined;
  onSuccess?: () => void;
}

export default function AllocatePartToMowerModal({ 
  isOpen, 
  onClose, 
  part,
  onSuccess 
}: AllocatePartToMowerModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all mowers for selection
  const { data: mowers = [] } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
    enabled: isOpen,
  });

  // For Engine parts, check if already allocated
  const { data: allAssetParts = [] } = useQuery({
    queryKey: ['/api/asset-parts'],
    enabled: isOpen && part?.category?.toLowerCase() === 'engine',
  });

  const isEngineAlreadyAllocated = part?.category?.toLowerCase() === 'engine' && 
    allAssetParts.some((allocation: any) => allocation.partId === part?.id);

  // Filter mowers based on search
  const filteredMowers = mowers.filter(mower =>
    mower.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mower.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mower.serialNumber && mower.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const form = useForm<AllocateToMowerFormData>({
    resolver: zodResolver(allocateToMowerFormSchema),
    defaultValues: {
      mowerId: 0,
      quantity: part?.category?.toLowerCase() === 'engine' ? 1 : 1, // Default to 1, especially for engines
      installDate: undefined,
      notes: "",
    },
  });

  // Reset form when modal opens/closes or part changes
  useEffect(() => {
    if (isOpen && part) {
      const isEngine = part.category?.toLowerCase() === 'engine';
      form.reset({
        mowerId: 0,
        quantity: isEngine ? 1 : 1, // Engines should always be quantity 1
        installDate: undefined,
        notes: "",
      });
    }
  }, [isOpen, part, form]);

  const createAllocationMutation = useMutation({
    mutationFn: async (data: AllocateToMowerFormData) => {
      if (!part) throw new Error('Part is required');
      
      const allocationData: InsertAssetPart = {
        partId: part.id,
        mowerId: data.mowerId,
        componentId: null, // Allocating directly to mower, not to component
        quantity: data.quantity,
        installDate: data.installDate ? format(data.installDate, "yyyy-MM-dd") : null,
        notes: data.notes || null,
      };
      
      const response = await apiRequest("POST", "/api/asset-parts", allocationData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      // Also invalidate specific mower parts
      const mowerId = form.getValues('mowerId');
      if (mowerId) {
        queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId.toString(), 'parts'] });
      }
      toast({
        title: "Success",
        description: `${part?.name || 'Part'} allocated to mower successfully`,
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Allocation error:', error);
      let errorMessage = error.message || "Failed to allocate part to mower";
      
      // Handle specific Engine allocation errors
      if (errorMessage.includes('Engine Asset Allocation Error') || 
          errorMessage.includes('already allocated')) {
        errorMessage = "This Engine asset is already allocated to another mower. Engine assets can only be allocated to one mower at a time.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: AllocateToMowerFormData) => {
    createAllocationMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  if (!part) return null;

  const isEngine = part.category?.toLowerCase() === 'engine';
  const selectedMower = mowers.find(m => m.id === form.watch("mowerId"));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Allocate {part.name} to Mower
            {isEngine && <span className="text-sm text-muted-foreground ml-2">(Engine Asset)</span>}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Engine Already Allocated Warning */}
            {isEngineAlreadyAllocated && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-medium">Engine Already Allocated</h3>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  This Engine asset is already allocated to another mower. Engine assets can only be allocated to one mower at a time.
                  You cannot proceed with this allocation.
                </p>
              </div>
            )}

            {/* Part Information Display */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium mb-2">Part Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Part:</span>
                  <span className="ml-2 font-medium">{part.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Part Number:</span>
                  <span className="ml-2 font-mono">{part.partNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 capitalize">{part.category}</span>
                </div>
                {!isEngine && (
                  <div>
                    <span className="text-muted-foreground">Available Stock:</span>
                    <span className="ml-2">{part.stockQuantity}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mower Selection */}
            <div className="space-y-2">
              <FormLabel>Search and Select Mower *</FormLabel>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search mowers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <FormField
                control={form.control}
                name="mowerId"
                render={({ field }) => (
                  <FormItem>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a mower" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
                        {filteredMowers.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            No mowers found
                          </div>
                        ) : (
                          filteredMowers.map((mower) => (
                            <SelectItem 
                              key={mower.id} 
                              value={mower.id.toString()}
                              className="flex flex-col items-start"
                            >
                              <div className="font-medium">
                                {mower.make} {mower.model}
                                {mower.year && ` (${mower.year})`}
                              </div>
                              {mower.serialNumber && (
                                <div className="text-xs text-muted-foreground">
                                  S/N: {mower.serialNumber}
                                </div>
                              )}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Show selected mower details */}
              {selectedMower && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-900">
                    Selected: {selectedMower.make} {selectedMower.model}
                  </div>
                  {selectedMower.location && (
                    <div className="text-blue-700">Location: {selectedMower.location}</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Quantity - disabled for engines */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        disabled={isEngine} // Engines always have quantity 1
                        min={1}
                      />
                    </FormControl>
                    {isEngine && (
                      <p className="text-xs text-muted-foreground">
                        Engine assets are always allocated with quantity 1
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Install Date */}
              <FormField
                control={form.control}
                name="installDate"
                render={({ field }) => (
                  <FormItem>
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

            {/* Notes */}
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
                disabled={createAllocationMutation.isPending || isEngineAlreadyAllocated}
              >
                {createAllocationMutation.isPending 
                  ? "Allocating..." 
                  : isEngineAlreadyAllocated 
                    ? "Already Allocated"
                    : "Allocate to Mower"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}