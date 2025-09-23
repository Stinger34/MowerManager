import { useState } from "react";
import DashboardStats from "@/components/DashboardStats";
import AssetCard from "@/components/AssetCard";
import NotificationsPanel from "@/components/NotificationsPanel";
import MaintenanceTimeline from "@/components/MaintenanceTimeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Trash2, Loader2, Zap, Calendar, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMowerThumbnails } from "@/hooks/useThumbnails";
import type { Mower, ServiceRecord } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [mowerToDelete, setMowerToDelete] = useState<Mower | null>(null);
  const [showDeleteServiceDialog, setShowDeleteServiceDialog] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: mowers, isLoading, error } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
  });

  // Fetch all service records for Recent Maintenance dashboard card
  const { data: serviceRecords = [], isLoading: isServiceRecordsLoading } = useQuery<ServiceRecord[]>({
    queryKey: ['/api/service-records'],
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

  // Delete service record mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await apiRequest('DELETE', `/api/service/${serviceId}`);
      // Handle 204 No Content responses (empty body)
      if (response.status === 204) {
        return { success: true };
      }
      // Only parse JSON if there's content
      const text = await response.text();
      return text ? JSON.parse(text) : { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mowers'] }); // Also invalidate mowers to update last service dates
      toast({ title: "Success", description: "Service record deleted successfully" });
      setShowDeleteServiceDialog(false);
      setServiceToDelete(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete service record", variant: "destructive" });
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

  const confirmDeleteService = () => {
    if (serviceToDelete) {
      deleteServiceMutation.mutate(serviceToDelete);
    }
  };

  // Enhanced mock data for notifications and maintenance timeline
  const notifications = [
    {
      id: "1",
      type: "warning" as const,
      title: "Service Due",
      message: "Oil change and filter replacement required",
      timestamp: "2 hours ago",
      isRead: false,
      assetId: "JD001",
      assetName: "John Deere X300",
      detailUrl: "/mowers/1",
      priority: "high" as const,
    },
    {
      id: "2", 
      type: "info" as const,
      title: "New Mower Added",
      message: "Craftsman riding mower added to fleet",
      timestamp: "1 day ago",
      isRead: true,
      assetId: "CR002",
      assetName: "Craftsman DYT4000",
      detailUrl: "/mowers/2",
      priority: "medium" as const,
    },
    {
      id: "3",
      type: "success" as const,
      title: "Component Allocated",
      message: "New blade set allocated to mower",
      timestamp: "2 days ago",
      isRead: true,
      assetId: "HV003",
      assetName: "Husqvarna YTH24V48",
      detailUrl: "/mowers/3",
      priority: "low" as const,
    },
    {
      id: "4",
      type: "error" as const,
      title: "Maintenance Overdue",
      message: "Annual inspection is 15 days overdue",
      timestamp: "3 days ago",
      isRead: false,
      assetId: "JD001",
      assetName: "John Deere X300",
      detailUrl: "/mowers/1",
      priority: "high" as const,
    },
  ];

  // Transform service records into maintenance events for the Recent Maintenance timeline
  const maintenanceEvents = serviceRecords
    .map(record => {
      const mower = mowers?.find(m => m.id === record.mowerId);
      if (!mower) return null;
      
      return {
        id: record.id,
        mowerId: record.mowerId.toString(),
        mowerName: `${mower.make} ${mower.model}`,
        type: record.serviceType as 'service' | 'repair' | 'inspection' | 'scheduled',
        title: record.description,
        description: record.description,
        date: new Date(record.serviceDate).toLocaleDateString(),
        status: 'completed' as const, // Service records are always completed
        priority: record.serviceType === 'repair' ? 'high' as const : 'medium' as const,
        notes: record.performedBy ? `Performed by: ${record.performedBy}` : undefined,
        cost: record.cost ? record.cost.toString() : undefined,
        performedBy: record.performedBy || undefined,
        mileage: record.mileage || undefined,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime()) // Sort by date, newest first
    .slice(0, 10); // Limit to 10 most recent


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Dashboard</h1>
          <p className="text-text-muted">
            Overview of your lawn mower fleet and maintenance schedule
          </p>
        </div>
        <Button onClick={() => setLocation('/mowers/new')} className="bg-accent-teal text-white hover:bg-accent-teal/90 rounded-button" data-testid="button-add-mower">
          <Plus className="h-4 w-4 mr-2" />
          Add Mower
        </Button>
      </div>

      {/* Main dashboard grid layout with notifications taking full height on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Stats and Recent Maintenance */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Dashboard Stats - smaller cards */}
          <DashboardStats
            totalMowers={mowers?.length || 0}
            activeMowers={mowers?.filter(m => m.status === 'active').length || 0}
            maintenanceMowers={mowers?.filter(m => m.status === 'maintenance').length || 0}
            upcomingServices={upcomingServices}
            overdueServices={overdueServices}
          />
          
          {/* Recent Maintenance Timeline - flex-grow to match notifications height */}
          <div className="flex-grow">
            <MaintenanceTimeline 
              events={maintenanceEvents}
              onViewAll={() => setLocation('/maintenance/history')}
              onAddMaintenance={() => setLocation('/maintenance/new')}
              onViewNotes={(eventId) => console.log('View notes for event:', eventId)}
              onEditEvent={(eventId) => {
                // Find the service record to get mowerId
                const serviceRecord = serviceRecords.find(sr => sr.id === eventId);
                if (serviceRecord) {
                  setLocation(`/mowers/${serviceRecord.mowerId}/service/${eventId}/edit`);
                }
              }}
              onDeleteEvent={(eventId) => {
                setServiceToDelete(eventId);
                setShowDeleteServiceDialog(true);
              }}
              className="h-full"
            />
          </div>
        </div>
        
        {/* Right column - Notifications taking full height */}
        <div className="lg:col-span-1">
          <NotificationsPanel 
            notifications={notifications}
            onMarkAsRead={(id) => console.log('Mark as read:', id)}
            onClearAll={() => console.log('Clear all notifications')}
            onNotificationClick={(notification) => {
              console.log('Notification clicked:', notification);
              if (notification.detailUrl) {
                setLocation(notification.detailUrl);
              }
            }}
          />
        </div>
      </div>

      {/* Quick Actions Cards - Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-accent-teal text-white border-accent-teal hover:bg-accent-teal/90 transition-all duration-200 cursor-pointer shadow-lg" onClick={() => setLocation('/mowers/new')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Plus className="h-5 w-5" />
              Quick Add
            </CardTitle>
            <CardDescription className="text-white/90">
              Add new mower to your fleet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/95">Click to add a new mower with specs and photos</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-medium-gray hover:shadow-lg hover:border-accent-teal transition-all duration-200 cursor-pointer" onClick={() => setLocation('/maintenance')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Calendar className="h-5 w-5 text-accent-teal" />
              Schedule Service
            </CardTitle>
            <CardDescription className="text-text-muted">
              Plan maintenance activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">Schedule and track service appointments</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-medium-gray hover:shadow-lg hover:border-accent-teal transition-all duration-200 cursor-pointer" onClick={() => setLocation('/reports')}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <FileText className="h-5 w-5 text-accent-teal" />
              Generate Report
            </CardTitle>
            <CardDescription className="text-text-muted">
              View fleet analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">Create detailed reports and insights</p>
          </CardContent>
        </Card>
      </div>

      {/* Mower Asset Quick Views - Bottom section */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight text-text-dark">Mower Asset Quick Views</h2>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              attachmentCount={0}
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

      {/* Delete Service Confirmation Dialog */}
      <AlertDialog open={showDeleteServiceDialog} onOpenChange={setShowDeleteServiceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteServiceMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteService}
              disabled={deleteServiceMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteServiceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Service Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}