import { Button } from "@/components/ui/button";
import MowerForm from "@/components/MowerForm";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function AddMower() {
  const [, setLocation] = useLocation();

  const handleSubmit = (data: any) => {
    console.log('Adding new mower:', data);
    // todo: remove mock functionality - integrate with API
    setLocation('/');
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
          <h1 className="text-3xl font-bold tracking-tight">Add New Mower</h1>
          <p className="text-muted-foreground">
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