import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Wrench, DollarSign, Hash, Building, FileText, AlertTriangle, Calendar, Paperclip, Edit, Trash2, Plus, Package } from "lucide-react";
import { useLocation } from "wouter";
import { useAssetEventsRefresh } from "@/hooks/useAssetEventsRefresh";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ComponentFormModal from "@/components/ComponentFormModal";
import AllocateComponentModal from "@/components/AllocateComponentModal";
import AllocatePartModal from "@/components/AllocatePartModal";
import AllocateEngineToMowerModal from "@/components/AllocateEngineToMowerModal";
import type { Engine, Attachment, AssetPartWithDetails, AssetPart } from "@shared/schema";
import { CardLoadingSkeleton } from "@/components/ui/loading-components";
import GenericAttachmentGallery from "@/components/GenericAttachmentGallery";

export default function ComponentDetails() {
  const [, params] = useRoute("/catalog/engines/:componentId");
  const [, setLocation] = useLocation();
  const componentId = params?.componentId;
  const { toast } = useToast();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showAllocatePartModal, setShowAllocatePartModal] = useState(false);
  const [showAllocateEngineToMowerModal, setShowAllocateEngineToMowerModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingAssetPart, setEditingAssetPart] = useState<AssetPart | null>(null);

  // Initialize WebSocket for auto-refresh
  const { isConnected: wsConnected, error: wsError } = useAssetEventsRefresh();

  // Fetch component data
  const { data: component, isLoading, error } = useQuery<Component>({
    queryKey: ['/api/components', componentId],
    enabled: !!componentId,
  });

  // Fetch component attachments
  const { data: attachments = [], isLoading: isAttachmentsLoading } = useQuery<Omit<Attachment, 'fileData'>[]>({
    queryKey: ['/api/components', componentId, 'attachments'],
    enabled: !!componentId,
  });

  // Fetch parts allocated to this engine
  const { data: allocatedParts = [], isLoading: isPartsLoading } = useQuery<AssetPartWithDetails[]>({
    queryKey: ['/api/components', componentId, 'parts'],
    enabled: !!componentId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (componentId: number) => {
      await apiRequest('DELETE', `/api/components/${componentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      toast({ title: "Success", description: "Engine deleted successfully" });
      setLocation('/catalog');
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete engine", 
        variant: "destructive" 
      });
    },
  });

  // Handlers
  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (component) {
      deleteMutation.mutate(component.id);
    }
  };

  const handleAllocate = () => {
    // We need to pass a mowerId to allocate to a mower, or handle global engines differently
    setShowAllocateModal(true);
  };

  const handleAllocatePart = () => {
    setEditingAssetPart(null);
    setShowAllocatePartModal(true);
  };

  const handleEditAssetPart = (assetPart: AssetPart) => {
    setEditingAssetPart(assetPart);
    setShowAllocatePartModal(true);
  };

  const handleAllocateEngineToMower = () => {
    setShowAllocateEngineToMowerModal(true);
  };

  const handleModalSuccess = () => {
    // Refetch data after successful operations
    queryClient.invalidateQueries({ queryKey: ['/api/components', componentId] });
    queryClient.invalidateQueries({ queryKey: ['/api/components', componentId, 'parts'] });
    // Show success toast
    toast({
      title: "Success",
      description: "Operation completed successfully",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation('/catalog')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Catalog
          </Button>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <CardLoadingSkeleton />
      </div>
    );
  }

  if (error || !component) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation('/catalog')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Catalog
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Engine Not Found</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>The requested engine could not be found.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLocation('/catalog')}
            data-testid="button-back-to-catalog"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Catalog
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">{component.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {!component.mowerId && (
            <>
              <Button variant="outline" size="sm" onClick={handleAllocate}>
                <Plus className="h-4 w-4 mr-2" />
                Allocate
              </Button>
              <Button variant="outline" size="sm" onClick={handleAllocateEngineToMower}>
                <Wrench className="h-4 w-4 mr-2" />
                Allocate to Mower
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <Wrench className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="attachments">
            <Paperclip className="h-4 w-4 mr-2" />
            Attachments ({attachments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {/* Component Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information with Pricing & Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Engine Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {component.partNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Part Number</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="font-mono text-sm">{component.partNumber}</span>
                    </div>
                  </div>
                )}

                {component.manufacturer && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Manufacturer</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span>{component.manufacturer}</span>
                    </div>
                  </div>
                )}

                {component.model && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Model</label>
                    <p className="text-sm text-gray-800 mt-1">{component.model}</p>
                  </div>
                )}

                {component.serialNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Serial Number</label>
                    <p className="text-sm text-gray-800 mt-1 font-mono">{component.serialNumber}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">
                    <Badge variant={component.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {component.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Condition</label>
                  <div className="mt-1">
                    <Badge variant="outline" className="capitalize">
                      {component.condition}
                    </Badge>
                  </div>
                </div>

                {component.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p className="text-sm text-gray-800 mt-1">{component.description}</p>
                  </div>
                )}

                {/* Pricing & Dates Information */}
                {component.cost && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cost</label>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      ${parseFloat(component.cost).toFixed(2)}
                    </p>
                  </div>
                )}

                {component.installDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Install Date</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{new Date(component.installDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                {component.warrantyExpires && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Warranty Expires</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className={new Date(component.warrantyExpires) < new Date() ? 'text-red-600' : 'text-gray-800'}>
                        {new Date(component.warrantyExpires).toLocaleDateString()}
                      </span>
                      {new Date(component.warrantyExpires) < new Date() && (
                        <Badge variant="destructive" className="ml-2">Expired</Badge>
                      )}
                    </div>
                  </div>
                )}

                {component.mowerId && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Associated Mower</label>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto text-blue-600 mt-1"
                      onClick={() => setLocation(`/mowers/${component.mowerId}`)}
                    >
                      View Mower Details
                    </Button>
                  </div>
                )}

                {!component.mowerId && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Engine Type</label>
                    <p className="text-sm text-gray-800 mt-1">Global Engine (not assigned to specific mower)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Allocated Parts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Allocated Parts ({allocatedParts.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleAllocatePart}>
                    <Plus className="h-4 w-4 mr-2" />
                    Allocate Part
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isPartsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  </div>
                ) : allocatedParts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No parts allocated to this engine yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allocatedParts.map((allocation) => (
                      <div key={allocation.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{allocation.part.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Part #: {allocation.part.partNumber} • Quantity: {allocation.quantity}
                              {allocation.installDate && (
                                <span className="ml-2">
                                  • Installed: {new Date(allocation.installDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {allocation.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{allocation.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/catalog/parts/${allocation.part.id}`)}
                            >
                              View Part
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAssetPart(allocation)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {component.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 whitespace-pre-wrap">{component.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Engine Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="font-medium text-gray-600">Created</label>
                  <p className="text-gray-800 mt-1">
                    {new Date(component.createdAt).toLocaleDateString()} at {new Date(component.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <label className="font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-800 mt-1">
                    {new Date(component.updatedAt).toLocaleDateString()} at {new Date(component.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <GenericAttachmentGallery
            attachments={attachments}
            entityId={componentId!}
            entityType="components"
            isLoading={isAttachmentsLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Component Modal */}
      <ComponentFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        component={component}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Component Modal - Only for global engines */}
      {!component?.mowerId && (
        <AllocateComponentModal
          isOpen={showAllocateModal}
          onClose={() => setShowAllocateModal(false)}
          mowerId=""
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Allocate Part Modal */}
      <AllocatePartModal
        isOpen={showAllocatePartModal}
        onClose={() => {
          setShowAllocatePartModal(false);
          setEditingAssetPart(null);
        }}
        mowerId={component?.mowerId?.toString() || ""}
        componentId={componentId}
        assetPart={editingAssetPart}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Engine to Mower Modal - Only for global engines */}
      {!component?.mowerId && component && (
        <AllocateEngineToMowerModal
          isOpen={showAllocateEngineToMowerModal}
          onClose={() => setShowAllocateEngineToMowerModal(false)}
          engine={component}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Delete Component Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Engine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{component?.name}"? This action cannot be undone and will remove all related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}