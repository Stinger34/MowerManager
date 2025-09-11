import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import ServiceHistoryTable from "@/components/ServiceHistoryTable";
import AttachmentGallery from "@/components/AttachmentGallery";
import TaskList from "@/components/TaskList";
import { ArrowLeft, Edit, Plus, Calendar, MapPin, DollarSign, FileText, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Mower, Task, InsertTask, ServiceRecord, Attachment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function MowerDetails() {
  const [, params] = useRoute("/mowers/:id");
  const [, setLocation] = useLocation();
  const mowerId = params?.id;
  const { toast } = useToast();
  
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Fetch mower data
  const { data: mower, isLoading: isMowerLoading, error: mowerError } = useQuery<Mower>({
    queryKey: ['/api/mowers', mowerId],
    enabled: !!mowerId,
  });

  // Fetch tasks data  
  const { data: tasks = [], isLoading: isTasksLoading, error: tasksError } = useQuery<Task[]>({
    queryKey: ['/api/mowers', mowerId, 'tasks'],
    enabled: !!mowerId,
  });

  // Fetch service records data
  const { data: serviceRecords = [], isLoading: isServiceRecordsLoading, error: serviceRecordsError } = useQuery<ServiceRecord[]>({
    queryKey: ['/api/mowers', mowerId, 'service'],
    enabled: !!mowerId,
  });

  // Fetch attachments data
  const { data: attachments = [], isLoading: isAttachmentsLoading, error: attachmentsError } = useQuery<Omit<Attachment, 'fileData'>[]>({
    queryKey: ['/api/mowers', mowerId, 'attachments'],
    enabled: !!mowerId,
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const response = await apiRequest('PUT', `/api/mowers/${mowerId}`, { notes: newNotes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId] });
      setIsEditingNotes(false);
      toast({ title: "Success", description: "Notes updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update notes", variant: "destructive" });
    },
  });

  // Task mutations
  const addTaskMutation = useMutation({
    mutationFn: async (taskData: Omit<InsertTask, 'mowerId'>) => {
      // Convert date and sanitize cost
      const processedData = {
        ...taskData,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
        estimatedCost: taskData.estimatedCost ? taskData.estimatedCost.replace(/[$,]/g, '') : undefined,
      };
      const response = await apiRequest('POST', `/api/mowers/${mowerId}/tasks`, processedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'tasks'] });
      toast({ title: "Success", description: "Task added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<InsertTask> }) => {
      // Convert date and sanitize cost
      const processedData = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        estimatedCost: data.estimatedCost ? data.estimatedCost.replace(/[$,]/g, '') : undefined,
      };
      const response = await apiRequest('PUT', `/api/tasks/${id}`, processedData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'tasks'] });
      toast({ title: "Success", description: "Task updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest('DELETE', `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'tasks'] });
      toast({ title: "Success", description: "Task deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest('POST', `/api/tasks/${taskId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'tasks'] });
      toast({ title: "Success", description: "Task completed successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete task", variant: "destructive" });
    },
  });

  // Attachment mutations
  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      // Optional description can be added later
      const response = await fetch(`/api/mowers/${mowerId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'attachments'] });
      toast({ title: "Success", description: "File uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload Failed", 
        description: error.message.includes('Invalid file type') ? 'Invalid file type. Only PDF, images, and documents are allowed.' : 'Upload failed. Please try again.',
        variant: "destructive" 
      });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest('DELETE', `/api/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'attachments'] });
      toast({ title: "Success", description: "Attachment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete attachment", variant: "destructive" });
    },
  });

  // File upload handler
  const handleFileUpload = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '*/*';
    fileInput.multiple = true;
    
    fileInput.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach(file => {
          // Check file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            toast({
              title: "File Too Large",
              description: `${file.name} is larger than 10MB limit`,
              variant: "destructive"
            });
            return;
          }
          uploadAttachmentMutation.mutate(file);
        });
      }
    };
    
    fileInput.click();
  };

  // Download attachment handler
  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/attachments/${attachmentId}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Success", description: "File downloaded successfully" });
    } catch (error) {
      toast({ 
        title: "Download Failed", 
        description: "Unable to download file",
        variant: "destructive" 
      });
    }
  };

  // View attachment handler (same as download for now)
  const handleViewAttachment = (attachmentId: string, fileName: string) => {
    handleDownloadAttachment(attachmentId, fileName);
  };

  // Delete attachment with confirmation
  const handleDeleteAttachment = (attachmentId: string) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      deleteAttachmentMutation.mutate(attachmentId);
    }
  };

  // Initialize notes when mower data loads
  useEffect(() => {
    if (mower?.notes && notes === "") {
      setNotes(mower.notes);
    }
  }, [mower?.notes, notes]);

  // Loading and error states
  if (isMowerLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading mower details...</span>
      </div>
    );
  }

  if (mowerError || !mower) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Failed to load mower details</p>
        <Button onClick={() => setLocation("/")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }


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
            {mower.make} {mower.model}
          </h1>
          <p className="text-muted-foreground">
            {mower.year} • Serial: {mower.serialNumber}
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
              <span className="font-medium">{mower.make} {mower.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year</span>
              <span className="font-medium">{mower.year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serial Number</span>
              <span className="font-medium">{mower.serialNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Condition</span>
              <Badge className={conditionColors[mower.condition as keyof typeof conditionColors]}>
                {mower.condition.charAt(0).toUpperCase() + mower.condition.slice(1)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge className={statusColors[mower.status as keyof typeof statusColors]}>
                {mower.status.charAt(0).toUpperCase() + mower.status.slice(1)}
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
                <p className="font-medium">{mower.purchaseDate ? new Date(mower.purchaseDate).toLocaleDateString() : 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Purchase Price</p>
                <p className="font-medium">{mower.purchasePrice ? `$${mower.purchasePrice}` : 'N/A'}</p>
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
              onClick={handleFileUpload}
              disabled={uploadAttachmentMutation.isPending}
              data-testid="button-upload-attachment"
            >
              {uploadAttachmentMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Upload Attachment
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="notes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="service-history" data-testid="tab-service-history">
            Service History
          </TabsTrigger>
          <TabsTrigger value="attachments" data-testid="tab-attachments">
            Attachments ({attachments.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditingNotes) {
                      updateNotesMutation.mutate(notes);
                    } else {
                      setIsEditingNotes(true);
                    }
                  }}
                  disabled={updateNotesMutation.isPending}
                  data-testid="button-edit-notes"
                >
                  {updateNotesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Edit className="h-4 w-4 mr-2" />
                  )}
                  {isEditingNotes ? "Save" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isEditingNotes ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this mower..."
                  className="min-h-[150px]"
                  data-testid="textarea-notes"
                />
              ) : (
                <div className="min-h-[150px]">
                  {notes ? (
                    <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-notes-content">
                      {notes}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-center py-8" data-testid="text-no-notes">
                      No notes yet. Click Edit to add notes about this mower.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          {isTasksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading tasks...</span>
            </div>
          ) : (
            <TaskList
              tasks={tasks.map(task => ({
                ...task,
                description: task.description || undefined,
                priority: task.priority as "low" | "medium" | "high" | "urgent",
                status: task.status as "pending" | "in_progress" | "completed" | "cancelled",
                category: task.category as "maintenance" | "repair" | "parts" | "inspection" | "other",
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : undefined,
                estimatedCost: task.estimatedCost ? `$${task.estimatedCost}` : undefined,
                partNumber: task.partNumber || undefined,
                createdAt: new Date(task.createdAt).toISOString(),
                completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : undefined,
              }))}
              onAddTask={(task) => addTaskMutation.mutate({
                ...task,
                dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                estimatedCost: task.estimatedCost ? task.estimatedCost.replace(/[$,]/g, '') : undefined,
              })}
              onEditTask={(id, task) => updateTaskMutation.mutate({ 
                id, 
                data: {
                  ...task,
                  dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
                  estimatedCost: task.estimatedCost ? task.estimatedCost.replace(/[$,]/g, '') : undefined,
                }
              })}
              onDeleteTask={(id) => deleteTaskMutation.mutate(id)}
              onCompleteTask={(id) => completeTaskMutation.mutate(id)}
            />
          )}
        </TabsContent>
        
        <TabsContent value="service-history">
          <ServiceHistoryTable
            serviceRecords={serviceRecords.map(record => ({
              ...record,
              serviceDate: new Date(record.serviceDate).toLocaleDateString(),
              serviceType: record.serviceType as "maintenance" | "repair" | "inspection" | "warranty",
              cost: record.cost || undefined,
              performedBy: record.performedBy || undefined,
              nextServiceDue: record.nextServiceDue ? new Date(record.nextServiceDue).toLocaleDateString() : undefined,
              mileage: record.mileage ?? undefined,
            }))}
            onAddService={() => setLocation(`/mowers/${mowerId}/service/new`)}
            onEditService={(id) => setLocation(`/mowers/${mowerId}/service/${id}/edit`)}
          />
        </TabsContent>
        
        <TabsContent value="attachments">
          {isAttachmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading attachments...</span>
            </div>
          ) : (
            <AttachmentGallery
              attachments={attachments.map(attachment => ({
                ...attachment,
                fileType: attachment.fileType as "pdf" | "image" | "document",
                uploadedAt: new Date(attachment.uploadedAt).toLocaleDateString(),
                description: attachment.description ?? undefined,
              }))}
              onUpload={handleFileUpload}
              onView={(id) => {
                const attachment = attachments.find(a => a.id === id);
                if (attachment) {
                  handleViewAttachment(id, attachment.fileName);
                }
              }}
              onDownload={(id) => {
                const attachment = attachments.find(a => a.id === id);
                if (attachment) {
                  handleDownloadAttachment(id, attachment.fileName);
                }
              }}
              onDelete={handleDeleteAttachment}
              isUploading={uploadAttachmentMutation.isPending}
              isDeleting={deleteAttachmentMutation.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}