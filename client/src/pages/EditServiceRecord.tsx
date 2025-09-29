import { useState, useEffect } from "react";
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
import { safeFormatDateForAPI } from "@/lib/utils";
import type { Mower, ServiceRecord } from "@shared/schema";

const serviceRecordSchema = z.object({
  serviceType: z.string().min(1, "Service type is required"),
  description: z.string().min(1, "Description is required"),
  serviceDate: z.string().min(1, "Service date is required"),
  cost: z.string().optional(),
  performedBy: z.string().optional(),
  mileage: z.string().optional(),
});

type ServiceRecordData = z.infer<typeof serviceRecordSchema>;

export default function EditServiceRecord() {
  const [, params] = useRoute("/mowers/:id/service/:serviceId/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const mowerId = params?.id;
  const serviceId = params?.serviceId;

  const { data: mower, isLoading: mowerLoading } = useQuery<Mower>({
    queryKey: ['/api/mowers', mowerId],
    enabled: !!mowerId,
  });

  // Get all service records for the mower, then find the specific one
  const { data: serviceRecords, isLoading: serviceLoading } = useQuery<ServiceRecord[]>({
    queryKey: ['/api/mowers', mowerId, 'service'],
    enabled: !!mowerId,
  });

  const serviceRecord = serviceRecords?.find(record => record.id === serviceId);

  const form = useForm<ServiceRecordData>({
    resolver: zodResolver(serviceRecordSchema),
    defaultValues: {
      serviceType: "",
      description: "",
      serviceDate: "",
      cost: "",
      performedBy: "",
      mileage: "",
    },
  });

  // Update form values when service record is loaded
  useEffect(() => {
    if (serviceRecord) {
      const serviceDate = safeFormatDateForAPI(serviceRecord.serviceDate) || "";

      form.reset({
        serviceType: serviceRecord.serviceType,
        description: serviceRecord.description,
        serviceDate,
        cost: serviceRecord.cost || "",
        performedBy: serviceRecord.performedBy || "",
        mileage: serviceRecord.mileage ? String(serviceRecord.mileage) : "",
      });
    }
  }, [serviceRecord, form]);

  const updateServiceMutation = useMutation({
    mutationFn: async (data: ServiceRecordData) => {
      const serviceData = {
        serviceType: data.serviceType,
        description: data.description,
        serviceDate: new Date(data.serviceDate),
        cost: data.cost ? parseFloat(data.cost) : null,
        performedBy: data.performedBy || null,
        mileage: data.mileage ? parseInt(data.mileage) : null,
      };
      
      return apiRequest('PUT', `/api/service/${serviceId}`, serviceData);
    },
    onSuccess: () => {
      toast({
        title: "Service record updated",
        description: "The service record has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'service'] });
      setLocation(`/mowers/${mowerId}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update service record. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to update service record:', error);
    },
  });

  const handleSubmit = (data: ServiceRecordData) => {
    updateServiceMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation(`/mowers/${mowerId}`);
  };

  if (mowerLoading || serviceLoading) {
    return <div>Loading...</div>;
  }

  if (!mower) {
    return <div>Mower not found</div>;
  }

  if (!serviceRecord) {
    return <div>Service record not found</div>;
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
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Edit Service Record</h1>
          <p className="text-text-muted">
            Edit service record for {mower.make} {mower.model}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card className="bg-white border-panel-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Wrench className="h-5 w-5 text-accent-teal" />
              Service Record Details
            </CardTitle>
            <CardDescription className="text-text-muted">
              Update maintenance, repair, or inspection details for this mower
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-type">
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="repair">Repair</SelectItem>
                            <SelectItem value="inspection">Inspection</SelectItem>
                            <SelectItem value="warranty">Warranty</SelectItem>
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
                    disabled={updateServiceMutation.isPending}
                    data-testid="button-save-service"
                  >
                    {updateServiceMutation.isPending ? "Updating..." : "Update Service Record"}
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