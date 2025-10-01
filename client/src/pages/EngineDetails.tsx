import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Wrench, DollarSign, Hash, Building, FileText, AlertTriangle, Calendar, Paperclip, Edit, Trash2, Plus, Package, ImageOff } from "lucide-react";
import { useLocation } from "wouter";
import { useAssetEventsRefresh } from "@/hooks/useAssetEventsRefresh";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { safeFormatDateForDisplay, safeFormatTimeForDisplay, safeIsDateBefore } from "@/lib/utils";
import EngineFormModal from "@/components/EngineFormModal";

import AllocatePartModal from "@/components/AllocatePartModal";
import AllocateEngineToMowerModal from "@/components/AllocateEngineToMowerModal";
import type { Engine, Attachment, AssetPartWithDetails, AssetPart } from "@shared/schema";
import { CardLoadingSkeleton } from "@/components/ui/loading-components";
import GenericAttachmentGallery from "@/components/GenericAttachmentGallery";
import { useEngineThumbnail } from "@/hooks/useThumbnails";

export default function EngineDetails() {
  const [, params] = useRoute("/catalog/engines/:engineId");
  const [, setLocation] = useLocation();
  const engineId = params?.engineId;
  const { toast } = useToast();

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAllocatePartModal, setShowAllocatePartModal] = useState(false);
  const [showAllocateEngineToMowerModal, setShowAllocateEngineToMowerModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingAssetPart, setEditingAssetPart] = useState<AssetPart | null>(null);

  // Initialize WebSocket for auto-refresh
  const { isConnected: wsConnected, error: wsError } = useAssetEventsRefresh();

  // Fetch engine data
  const { data: engine, isLoading, error } = useQuery<Engine>({
    queryKey: ['/api/engines', engineId],
    enabled: !!engineId,
  });

  // Fetch thumbnail for this engine
  const { data: thumbnail } = useEngineThumbnail(engineId || '');

  // Fetch engine attachments
  const { data: attachments = [], isLoading: isAttachmentsLoading } = useQuery<Omit<Attachment, 'fileData'>[]>({
    queryKey: ['/api/engines', engineId, 'attachments'],
    enabled: !!engineId,
  });

  // Fetch parts allocated to this engine
  const { data: allocatedParts = [], isLoading: isPartsLoading } = useQuery<AssetPartWithDetails[]>({
    queryKey: ['/api/engines', engineId, 'parts'],
    enabled: !!engineId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (engineId: number) => {
      await apiRequest('DELETE', `/api/engines/${engineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
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
    if (engine) {
      deleteMutation.mutate(engine.id);
    }
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
    queryClient.invalidateQueries({ queryKey: ['/api/engines', engineId] });
    queryClient.invalidateQueries({ queryKey: ['/api/engines', engineId, 'parts'] });
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

  if (error || !engine) {
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
          <div className="w-20 h-20 rounded-lg overflow-hidden shadow-sm border" data-testid="img-engine-thumbnail">
            {thumbnail ? (
              <img 
                src={thumbnail.downloadUrl}
                alt={engine.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Replace with placeholder on error
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted"><svg class="h-8 w-8 text-muted-foreground opacity-50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg></div>';
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <ImageOff className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">{engine.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {!engine.mowerId && (
            <>
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
                {engine.partNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Part Number</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="font-mono text-sm">{engine.partNumber}</span>
                    </div>
                  </div>
                )}

                {engine.manufacturer && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Manufacturer</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span>{engine.manufacturer}</span>
                    </div>
                  </div>
                )}

                {engine.model && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Model</label>
                    <p className="text-sm text-gray-800 mt-1">{engine.model}</p>
                  </div>
                )}

                {engine.serialNumber && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Serial Number</label>
                    <p className="text-sm text-gray-800 mt-1 font-mono">{engine.serialNumber}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">
                    <Badge variant={engine.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {engine.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Condition</label>
                  <div className="mt-1">
                    <Badge variant="outline" className="capitalize">
                      {engine.condition}
                    </Badge>
                  </div>
                </div>

                {engine.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p className="text-sm text-gray-800 mt-1">{engine.description}</p>
                  </div>
                )}

                {/* Pricing & Dates Information */}
                {engine.cost && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Cost</label>
                    <p className="text-lg font-semibold text-green-600 mt-1">
                      ${parseFloat(engine.cost).toFixed(2)}
                    </p>
                  </div>
                )}

                {engine.installDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Install Date</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{safeFormatDateForDisplay(engine.installDate)}</span>
                    </div>
                  </div>
                )}

                {engine.mowerId && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Associated Mower</label>
                    <Button 
                      variant="ghost" 
                      className="p-0 h-auto text-blue-600 mt-1"
                      onClick={() => setLocation(`/mowers/${engine.mowerId}`)}
                    >
                      View Mower Details
                    </Button>
                  </div>
                )}

                {!engine.mowerId && (
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
                                  • Installed: {safeFormatDateForDisplay(allocation.installDate)}
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
          {engine.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-800 whitespace-pre-wrap">{engine.notes}</p>
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
                    {safeFormatDateForDisplay(engine.createdAt)} at {safeFormatTimeForDisplay(engine.createdAt)}
                  </p>
                </div>
                <div>
                  <label className="font-medium text-gray-600">Last Updated</label>
                  <p className="text-gray-800 mt-1">
                    {safeFormatDateForDisplay(engine.updatedAt)} at {safeFormatTimeForDisplay(engine.updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments">
          <GenericAttachmentGallery
            attachments={attachments}
            entityId={engineId!}
            entityType="engines"
            isLoading={isAttachmentsLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Engine Modal */}
      <EngineFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        engine={engine}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Part Modal */}
      <AllocatePartModal
        isOpen={showAllocatePartModal}
        onClose={() => {
          setShowAllocatePartModal(false);
          setEditingAssetPart(null);
        }}
        mowerId={engine?.mowerId?.toString() || ""}
        engineId={engineId}
        assetPart={editingAssetPart}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Engine to Mower Modal - Only for global engines */}
      {!engine?.mowerId && engine && (
        <AllocateEngineToMowerModal
          isOpen={showAllocateEngineToMowerModal}
          onClose={() => setShowAllocateEngineToMowerModal(false)}
          engine={engine}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Delete Component Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Engine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{engine?.name}"? This action cannot be undone and will remove all related data.
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