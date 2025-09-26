import { Button } from "@/components/ui/button";
import ComponentForm from "@/components/ComponentForm";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertEngine } from "@shared/schema";

export default function AddComponent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: InsertComponent) => {
      const response = await apiRequest("POST", "/api/components", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      toast({
        title: "Success",
        description: "Engine created successfully",
      });
      setLocation('/catalog');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create component",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertComponent) => {
    createMutation.mutate(data);
  };

  const handleCancel = () => {
    setLocation('/catalog');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/catalog")}
          data-testid="button-back-to-catalog"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Add New Engine Type</h1>
          <p className="text-text-muted">
            Add a new global engine type to the parts catalog
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <ComponentForm 
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEditing={false}
        />
      </div>
    </div>
  );
}