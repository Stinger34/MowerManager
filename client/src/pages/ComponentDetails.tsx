import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Wrench, DollarSign, Hash, Building, FileText, AlertTriangle, Calendar, Paperclip } from "lucide-react";
import { useLocation } from "wouter";
import type { Component, Attachment } from "@shared/schema";
import { CardLoadingSkeleton } from "@/components/ui/loading-components";
import GenericAttachmentGallery from "@/components/GenericAttachmentGallery";

export default function ComponentDetails() {
  const [, params] = useRoute("/catalog/components/:componentId");
  const [, setLocation] = useLocation();
  const componentId = params?.componentId;

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
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Component Not Found</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <p>The requested component could not be found.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
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
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Component Information
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
              </CardContent>
            </Card>

            {/* Dates and Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing & Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <label className="text-sm font-medium text-gray-600">Component Type</label>
                    <p className="text-sm text-gray-800 mt-1">Global Component (not assigned to specific mower)</p>
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
              <CardTitle>Component Details</CardTitle>
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
    </div>
  );
}