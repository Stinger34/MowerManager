import { Button } from "@/components/ui/button";
import MowerForm from "@/components/MowerForm";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertMower } from "@shared/schema";

export default function AddMower() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createMowerMutation = useMutation({
    mutationFn: async (data: InsertMower) => {
      console.log('Adding new mower:', data);
      const response = await apiRequest('POST', '/api/mowers', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mower added",
        description: "The mower has been successfully added to your fleet.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      setLocation('/');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add mower. Please try again.",
        variant: "destructive",
      });
      console.error('Failed to add mower:', error);
    },
  });

  const handleSubmit = (data: InsertMower) => {
    createMowerMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation('/');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back-to-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Add New Mower</h1>
          <p className="text-text-muted">
            Add a new lawn mower to your fleet
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <MowerForm 
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEditing={false}
        />
      </div>
    </div>
  );
}