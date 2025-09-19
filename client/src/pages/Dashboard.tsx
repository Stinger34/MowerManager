import { useState } from "react";
import DashboardStats from "@/components/DashboardStats";
import AssetCard from "@/components/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMowerThumbnails } from "@/hooks/useThumbnails";
import type { Mower } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mowerToDelete, setMowerToDelete] = useState<Mower | null>(null);
  const { toast } = useToast();

  const { data: mowers, isLoading, error } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
  });

  // Fetch thumbnails for all mowers
  const { data: thumbnails } = useMowerThumbnails(mowers || []);

  // Delete mower mutation
  const deleteMowerMutation = useMutation({
    mutationFn: async (mowerId: string) => {
      const response = await apiRequest('DELETE', `/api/mowers/${mowerId}`);
      // Handle 204 No Content responses (empty body)
      if (response.status === 204) {
        return { success: true };
      }
      // Only parse JSON if there's content
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] });
      toast({ title: "Success", description: "Mower deleted successfully" });
      setShowDeleteDialog(false);
      setMowerToDelete(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete mower", variant: "destructive" });
    },
  });

  const filteredMowers = (mowers || []).filter(mower =>
    `${mower.make} ${mower.model}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mower.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingServices = (mowers || []).filter(m => {
    if (!m.nextServiceDate) return false;
    const nextServiceDate = new Date(m.nextServiceDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return nextServiceDate >= today && nextServiceDate <= thirtyDaysFromNow;
  }).length;
  
  const overdueServices = (mowers || []).filter(m => {
    if (!m.nextServiceDate) return false;
    const nextServiceDate = new Date(m.nextServiceDate);
    const today = new Date();
    return nextServiceDate < today;
  }).length;


  const handleViewDetails = (id: string) => {
    console.log('Navigate to mower details:', id);
    setLocation(`/mowers/${id}`);
  };

  const handleEdit = (id: string) => {
    console.log('Navigate to edit mower:', id);
    setLocation(`/mowers/${id}/edit`);
  };

  const handleAddService = (id: string) => {
    console.log('Navigate to add service:', id);
    setLocation(`/mowers/${id}/service/new`);
  };

  const handleDelete = (id: string) => {
    const mower = mowers?.find(m => String(m.id) === id);
    if (mower) {
      setMowerToDelete(mower);
      setShowDeleteDialog(true);
    }
  };

  const confirmDelete = () => {
    if (mowerToDelete) {
      deleteMowerMutation.mutate(String(mowerToDelete.id));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Dashboard</h1>
          <p className="text-text-muted">
            Overview of your lawn mower fleet and maintenance schedule
          </p>
        </div>
        <Button onClick={() => setLocation('/mowers/new')} className="bg-accent-orange text-white hover:bg-accent-orange/90 rounded-button" data-testid="button-add-mower">
          <Plus className="h-4 w-4 mr-2" />
          Add Mower
        </Button>
      </div>

      <DashboardStats
        totalMowers={mowers?.length || 0}
        activeMowers={mowers?.filter(m => m.status === 'active').length || 0}
        maintenanceMowers={mowers?.filter(m => m.status === 'maintenance').length || 0}
        upcomingServices={upcomingServices}
        overdueServices={overdueServices}
      />

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted h-4 w-4" />
            <Input
              placeholder="Search mowers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-mowers"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMowers.map((mower) => (
            <AssetCard
              key={mower.id}
              id={String(mower.id)}
              make={mower.make}
              model={mower.model}
              year={mower.year ?? undefined}
              serialNumber={mower.serialNumber ?? undefined}
              condition={mower.condition as "excellent" | "good" | "fair" | "poor"}
              status={mower.status as "active" | "maintenance" | "retired"}
              attachmentCount={0} // TODO: Fetch real attachment count from API
              thumbnailUrl={thumbnails?.[mower.id.toString()]}
              lastService={mower.lastServiceDate ? new Date(mower.lastServiceDate).toLocaleDateString() : "No service recorded"}
              nextService={mower.nextServiceDate ? new Date(mower.nextServiceDate).toLocaleDateString() : "Not scheduled"}
              onViewDetails={handleViewDetails}
              onEdit={handleEdit}
              onAddService={handleAddService}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {filteredMowers.length === 0 && searchQuery && (
          <div className="text-center py-8 text-text-muted">
            <p>No mowers found matching "{searchQuery}"</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mower</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {mowerToDelete?.make} {mowerToDelete?.model}? This action cannot be undone. All associated service records, tasks, and attachments will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              data-testid="button-cancel-delete"
              disabled={deleteMowerMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMowerMutation.isPending}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMowerMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Mower
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}