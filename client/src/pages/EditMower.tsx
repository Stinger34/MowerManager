import { Button } from "@/components/ui/button";
import MowerForm from "@/components/MowerForm";
import { ArrowLeft } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Mower, InsertMower } from "@shared/schema";

export default function EditMower() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/mowers/:id/edit");
  const mowerId = params?.id;
  const { toast } = useToast();

  const { data: mower, isLoading, error } = useQuery<Mower>({
    queryKey: ['/api/mowers', mowerId],
    enabled: !!mowerId,
  });

  const updateMowerMutation = useMutation({
    mutationFn: async (data: InsertMower) => {
      console.log('Updating mower:', mowerId, data);
      const response = await apiRequest('PUT', `/api/mowers/${mowerId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mower updated",
        description: "The mower has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId] });
      setLocation(`/mowers/${mowerId}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update mower. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to update mower:', error);
    },
  });

  const handleSubmit = (data: InsertMower) => {
    updateMowerMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation(`/mowers/${mowerId}`);
  };

  if (!match) {
    return <div>Invalid mower ID</div>;
  }

  if (isLoading) {
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
            <h1 className="text-3xl font-bold tracking-tight">Edit Mower</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !mower) {
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
            <h1 className="text-3xl font-bold tracking-tight">Edit Mower</h1>
            <p className="text-muted-foreground text-red-600">
              {error ? 'Error loading mower data' : 'Mower not found'}
            </p>
          </div>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">Edit Mower</h1>
          <p className="text-muted-foreground">
            Edit details for {mower?.make} {mower?.model}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <MowerForm 
          initialData={{
            make: mower?.make || '',
            model: mower?.model || '',
            year: mower?.year || undefined,
            serialNumber: mower?.serialNumber || '',
            purchaseDate: mower?.purchaseDate ? new Date(mower.purchaseDate) : undefined,
            purchasePrice: mower?.purchasePrice || '',
            condition: (mower?.condition as "excellent" | "good" | "fair" | "poor") || 'good',
            status: (mower?.status as "active" | "maintenance" | "retired") || 'active',
            lastServiceDate: mower?.lastServiceDate ? new Date(mower.lastServiceDate) : undefined,
            nextServiceDate: mower?.nextServiceDate ? new Date(mower.nextServiceDate) : undefined,
            notes: mower?.notes || ''
          }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEditing={true}
        />
      </div>
    </div>
  );
}