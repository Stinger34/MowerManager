import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Package, DollarSign, Hash, Building, FileText, AlertTriangle, Paperclip, Edit, Trash2, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useAssetEventsRefresh } from "@/hooks/useAssetEventsRefresh";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PartFormModal from "@/components/PartFormModal";
import AllocatePartModal from "@/components/AllocatePartModal";
import type { Part, Attachment, AssetPartWithDetails } from "@shared/schema";
import { CardLoadingSkeleton } from "@/components/ui/loading-components";
import GenericAttachmentGallery from "@/components/GenericAttachmentGallery";

export default function PartDetails() {
  const [, params] = useRoute("/catalog/parts/:partId");
  const [, setLocation] = useLocation();
  const partId = params?.partId;
  const { toast } = useToast();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Initialize WebSocket for auto-refresh
  const { isConnected: wsConnected, error: wsError } = useAssetEventsRefresh();

  // Fetch part data
  const { data: part, isLoading, error } = useQuery<Part>({
    queryKey: ['/api/parts', partId],
    enabled: !!partId,
  });

  // Fetch part attachments
  const { data: attachments = [], isLoading: isAttachmentsLoading } = useQuery<Omit<Attachment, 'fileData'>[]>({
    queryKey: ['/api/parts', partId, 'attachments'],
    enabled: !!partId,
  });

  // Fetch part allocations (where this part has been allocated)
  const { data: partAllocations = [], isLoading: isAllocationsLoading } = useQuery<AssetPartWithDetails[]>({
    queryKey: ['/api/parts', partId, 'allocations'],
    enabled: !!partId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (partId: number) => {
      await apiRequest('DELETE', `/api/parts/${partId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
      toast({ title: "Success", description: "Part deleted successfully" });
      setLocation('/catalog');
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete part", 
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
    if (part) {
      deleteMutation.mutate(part.id);
    }
  };

  const handleAllocate = () => {
    setShowAllocateModal(true);
  };

  const handleModalSuccess = () => {
    // Refetch data after successful operations
    queryClient.invalidateQueries({ queryKey: ['/api/parts', partId] });
    queryClient.invalidateQueries({ queryKey: ['/api/parts', partId, 'allocations'] });
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

  if (error || !part) {
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
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Part Not Found</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>The requested part could not be found.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stockStatus = part.stockQuantity <= (part.minStockLevel || 0) ? 'low' : 'good';

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
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">{part.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleAllocate}>
            <Plus className="h-4 w-4 mr-2" />
            Allocate
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <Package className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="attachments">
            <Paperclip className="h-4 w-4 mr-2" />
            Attachments ({attachments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {/* Part Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Part Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Part Number</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <span className="font-mono text-sm">{part.partNumber}</span>
                  </div>
                </div>

                {part.manufacturer && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Manufacturer</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span>{part.manufacturer}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Category</label>
                  <div className="mt-1">
                    <Badge variant="secondary" className="capitalize">
                      {part.category}
                    </Badge>
                  </div>
                </div>

                {part.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p className="text-sm text-gray-800 mt-1">{part.description}</p>
                  </div>
                )}

                {/* Stock Information */}
                <div>
                  <label className="text-sm font-medium text-gray-600">Stock Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant={stockStatus === 'low' ? 'destructive' : 'default'}
                      className="flex items-center gap-1"
                    >
                      {stockStatus === 'low' && <AlertTriangle className="h-3 w-3" />}
                      {part.stockQuantity} in stock
                    </Badge>
                  </div>
                </div>

                {part.minStockLevel !== null && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Minimum Stock Level</label>
                    <p className="text-sm text-gray-800 mt-1">{part.minStockLevel}</p>
                  </div>
                )}

                {/* Pricing Information */}
                {part.unitCost && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Unit Cost</label>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      ${parseFloat(part.unitCost).toFixed(2)}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Total Value</label>
                  <p className="text-lg font-semibold text-blue-600 mt-1">
                    ${part.unitCost 
                      ? (parseFloat(part.unitCost) * part.stockQuantity).toFixed(2)
                      : 'N/A'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Allocations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Allocated To ({partAllocations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isAllocationsLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
                  </div>
                ) : partAllocations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    This part hasn't been allocated yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {partAllocations.map((allocation) => (
                      <div key={allocation.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">
                              {allocation.component ? allocation.component.name : allocation.mower?.make + ' ' + allocation.mower?.model}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Quantity: {allocation.quantity}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (allocation.component) {
                                setLocation(`/catalog/engines/${allocation.component.id}`);
                              } else if (allocation.mower) {
                                setLocation(`/mowers/${allocation.mower.id}`);
                              }
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {part.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 whitespace-pre-wrap">{part.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Part Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="font-medium text-gray-600">Created</label>
                  <p className="text-gray-800 mt-1">
                    {new Date(part.createdAt).toLocaleDateString()} at {new Date(part.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <label className="font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-800 mt-1">
                    {new Date(part.updatedAt).toLocaleDateString()} at {new Date(part.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <GenericAttachmentGallery
            attachments={attachments}
            entityId={partId!}
            entityType="parts"
            isLoading={isAttachmentsLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Part Modal */}
      <PartFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        part={part}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Part Modal */}
      <AllocatePartModal
        isOpen={showAllocateModal}
        onClose={() => setShowAllocateModal(false)}
        mowerId=""
        onSuccess={handleModalSuccess}
      />

      {/* Delete Part Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{part?.name}"? This action cannot be undone and will remove all related data.
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