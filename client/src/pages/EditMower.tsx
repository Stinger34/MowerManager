import { Button } from "@/components/ui/button";
import MowerForm from "@/components/MowerForm";
import { ArrowLeft } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Mower } from "@shared/schema";

export default function EditMower() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/mowers/:id/edit");
  const mowerId = params?.id;

  const { data: mower, isLoading, error } = useQuery<Mower>({
    queryKey: ['/api/mowers', mowerId],
    enabled: !!mowerId,
  });

  const handleSubmit = (data: any) => {
    console.log('Updating mower:', mowerId, data);
    // todo: remove mock functionality - integrate with API to update mower
    setLocation(`/mowers/${mowerId}`);
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