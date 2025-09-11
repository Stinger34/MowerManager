import { useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServiceHistoryTable from "@/components/ServiceHistoryTable";
import AttachmentGallery from "@/components/AttachmentGallery";
import { ArrowLeft, Edit, Plus, Calendar, MapPin, DollarSign } from "lucide-react";
import { useLocation } from "wouter";

export default function MowerDetails() {
  const [, params] = useRoute("/mowers/:id");
  const [, setLocation] = useLocation();
  const mowerId = params?.id;

  // todo: remove mock functionality
  const mockMower = {
    id: mowerId,
    make: "John Deere",
    model: "X350",
    year: 2022,
    serialNumber: "JD123456",
    purchaseDate: "Mar 15, 2022",
    purchasePrice: "$2,499.99",
    condition: "excellent" as const,
    status: "active" as const,
    notes: "Purchased from local dealer. Excellent condition with low operating hours. Regular maintenance performed.",
  };

  const mockServiceRecords = [
    {
      id: "1",
      serviceDate: "Dec 15, 2024",
      serviceType: "maintenance" as const,
      description: "Oil change, air filter replacement, blade sharpening",
      cost: "$85.00",
      performedBy: "Mike's Lawn Service",
      nextServiceDue: "Mar 15, 2025",
      mileage: 45
    },
    {
      id: "2",
      serviceDate: "Sep 10, 2024",
      serviceType: "repair" as const,
      description: "Carburetor cleaning and adjustment",
      cost: "$120.00",
      performedBy: "John's Small Engine Repair",
      mileage: 42
    }
  ];

  const mockAttachments = [
    {
      id: "1",
      fileName: "owners_manual.pdf",
      fileType: "pdf" as const,
      fileSize: 2048576,
      description: "Original owner's manual and warranty information",
      uploadedAt: "Dec 1, 2024"
    },
    {
      id: "2",
      fileName: "purchase_receipt.pdf",
      fileType: "pdf" as const,
      fileSize: 512000,
      description: "Purchase receipt from dealer",
      uploadedAt: "Nov 15, 2024"
    }
  ];

  const conditionColors = {
    excellent: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    good: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
    fair: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    poor: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
  };

  const statusColors = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
    maintenance: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
    retired: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {mockMower.make} {mockMower.model}
          </h1>
          <p className="text-muted-foreground">
            {mockMower.year} • Serial: {mockMower.serialNumber}
          </p>
        </div>

        <Button
          onClick={() => setLocation(`/mowers/${mowerId}/edit`)}
          data-testid="button-edit-mower"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Make/Model</span>
              <span className="font-medium">{mockMower.make} {mockMower.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year</span>
              <span className="font-medium">{mockMower.year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serial Number</span>
              <span className="font-medium">{mockMower.serialNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Condition</span>
              <Badge className={conditionColors[mockMower.condition]}>
                {mockMower.condition.charAt(0).toUpperCase() + mockMower.condition.slice(1)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge className={statusColors[mockMower.status]}>
                {mockMower.status.charAt(0).toUpperCase() + mockMower.status.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Purchase Date</p>
                <p className="font-medium">{mockMower.purchaseDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Purchase Price</p>
                <p className="font-medium">{mockMower.purchasePrice}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setLocation(`/mowers/${mowerId}/service/new`)}
              data-testid="button-add-service-record"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service Record
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => console.log('Upload attachment')}
              data-testid="button-upload-attachment"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Attachment
            </Button>
          </CardContent>
        </Card>
      </div>

      {mockMower.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{mockMower.notes}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="service-history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="service-history" data-testid="tab-service-history">
            Service History
          </TabsTrigger>
          <TabsTrigger value="attachments" data-testid="tab-attachments">
            Attachments ({mockAttachments.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="service-history">
          <ServiceHistoryTable
            serviceRecords={mockServiceRecords}
            onAddService={() => setLocation(`/mowers/${mowerId}/service/new`)}
            onEditService={(id) => setLocation(`/mowers/${mowerId}/service/${id}/edit`)}
          />
        </TabsContent>
        
        <TabsContent value="attachments">
          <AttachmentGallery
            attachments={mockAttachments}
            onUpload={() => console.log('Upload files')}
            onView={(id) => console.log('View attachment:', id)}
            onDownload={(id) => console.log('Download attachment:', id)}
            onDelete={(id) => console.log('Delete attachment:', id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}