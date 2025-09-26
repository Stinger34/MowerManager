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
import { cn } from "@/lib/utils";
import { CalendarIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mower, Component, InsertComponent } from "@shared/schema";

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

  // Fetch all available mowers
  const { data: allMowers = [], isLoading: isMowersLoading } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
    enabled: isOpen,
  });

  // Filter mowers based on search query and availability (no engine already allocated)
  const availableMowers = allMowers.filter(mower => {
    const matchesSearch = mower.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         mower.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (mower.serialNumber || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
      setSearchQuery("");
    }
  }, [isOpen, form]);

  const allocateEngineMutation = useMutation({
    mutationFn: async (data: EngineAllocationFormData) => {
      // Create a copy of the engine and assign it to the selected mower
      const engineData: InsertComponent = {
        name: engine.name,
        description: engine.description,
        partNumber: engine.partNumber,
        manufacturer: engine.manufacturer,
        model: engine.model,
        serialNumber: engine.serialNumber,
        mowerId: data.mowerId,
        installDate: data.installDate ? format(data.installDate, "yyyy-MM-dd") : null,
        warrantyExpires: engine.warrantyExpires,
        condition: engine.condition,
        status: engine.status,
        cost: engine.cost,
        notes: data.notes || engine.notes,
      };
      
      const response = await apiRequest("POST", `/api/mowers/${data.mowerId}/components`, engineData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
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
    allocateEngineMutation.mutate(data);
  };

  return (
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
                  ) : availableMowers.length === 0 ? (
                    <div className="border rounded-md p-8 text-center text-muted-foreground">
                      <p>No mowers found</p>
                      {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                      {availableMowers.map((mower) => (
                        <div
                          key={mower.id}
                          className={cn(
                            "border rounded-lg p-3 cursor-pointer transition-colors",
                            form.watch("mowerId") === mower.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => form.setValue("mowerId", mower.id)}
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
                        </div>
                      ))}
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
  );
}