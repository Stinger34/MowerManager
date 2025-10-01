import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Wrench } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mower } from "@shared/schema";
import ServiceRecordPartsSelector, { type ServiceRecordPart } from "@/components/ServiceRecordPartsSelector";

const serviceRecordSchema = z.object({
  serviceType: z.string().min(1, "Service type is required"),
  description: z.string().min(1, "Description is required"),
  serviceDate: z.string().min(1, "Service date is required"),
  cost: z.string().optional(),
  performedBy: z.string().optional(),
  mileage: z.string().optional(),
});

type ServiceRecordData = z.infer<typeof serviceRecordSchema>;

export default function AddServiceRecord() {
  const [, params] = useRoute("/mowers/:id/service/new");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mowerId = params?.id;
  const [selectedParts, setSelectedParts] = useState<ServiceRecordPart[]>([]);
  const [calculatedCost, setCalculatedCost] = useState<number>(0);

  const { data: mower, isLoading } = useQuery<Mower>({
    queryKey: ['/api/mowers', mowerId],
    enabled: !!mowerId,
  });

  const form = useForm<ServiceRecordData>({
    resolver: zodResolver(serviceRecordSchema),
    defaultValues: {
      serviceType: "",
      description: "",
      serviceDate: new Date().toISOString().split('T')[0], // Today's date
      cost: "",
      performedBy: "",
      mileage: "",
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: ServiceRecordData) => {
      const serviceData = {
        mowerId: parseInt(mowerId!),
        serviceType: data.serviceType,
        description: data.description,
        serviceDate: new Date(data.serviceDate),
        cost: data.cost ? parseFloat(data.cost) : null,
        performedBy: data.performedBy || null,
        mileage: data.mileage ? parseInt(data.mileage) : null,
      };
      
      // Create the service record first
      const response = await apiRequest('POST', `/api/mowers/${mowerId}/service`, serviceData);
      const serviceRecord = await response.json();
      
      // Then create asset parts for each selected part
      if (selectedParts.length > 0) {
        for (const part of selectedParts) {
          if (part.partId) {
            const assetPartData = {
              partId: part.partId,
              mowerId: part.engineId ? undefined : parseInt(mowerId!),
              engineId: part.engineId || undefined,
              quantity: part.quantity,
              serviceRecordId: serviceRecord.id,
            };
            await apiRequest('POST', '/api/asset-parts', assetPartData);
          }
        }
      }
      
      return serviceRecord;
    },
    onSuccess: () => {
      toast({
        title: "Service record added",
        description: "The service record has been successfully added.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'service'] });
      queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
      setLocation(`/mowers/${mowerId}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add service record. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to add service record:', error);
    },
  });

  const handleSubmit = (data: ServiceRecordData) => {
    createServiceMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation(`/mowers/${mowerId}`);
  };

  const handleCostChange = (totalCost: number) => {
    setCalculatedCost(totalCost);
    // Update the cost field with the calculated value
    if (totalCost > 0) {
      form.setValue("cost", totalCost.toFixed(2));
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!mower) {
    return <div>Mower not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/mowers/${mowerId}`)}
          data-testid="button-back-to-mower"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Add Service Record</h1>
          <p className="text-text-muted">
            Add a new service record for {mower.make} {mower.model}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Service Record Details
            </CardTitle>
            <CardDescription>
              Record maintenance, repairs, or inspections performed on this mower
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-type">
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="repair">Repair</SelectItem>
                            <SelectItem value="inspection">Inspection</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-service-date"
                          />
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
                        <Textarea
                          placeholder="Describe the service performed..."
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Parts Selection */}
                <div className="pt-4">
                  <ServiceRecordPartsSelector
                    mowerId={mowerId!}
                    parts={selectedParts}
                    onPartsChange={setSelectedParts}
                    onCostChange={handleCostChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            data-testid="input-cost"
                          />
                        </FormControl>
                        {calculatedCost > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Auto-calculated from parts: ${calculatedCost.toFixed(2)}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="performedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Performed By (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Service provider name"
                            {...field}
                            data-testid="input-performed-by"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hours (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Operating hours"
                            {...field}
                            data-testid="input-mileage"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={createServiceMutation.isPending}
                    data-testid="button-save-service"
                  >
                    {createServiceMutation.isPending ? "Saving..." : "Save Service Record"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}