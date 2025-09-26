import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ServiceHistoryTable from "@/components/ServiceHistoryTable";
import MaintenanceOverview from "@/components/MaintenanceOverview";
import AttachmentGallery from "@/components/AttachmentGallery";
import UnifiedFileUploadArea from "@/components/UnifiedFileUploadArea";
import AttachmentMetadataDialog from "@/components/AttachmentMetadataDialog";
import EditAttachmentDialog from "@/components/EditAttachmentDialog";
import TaskList from "@/components/TaskList";
import ComponentFormModal from "@/components/ComponentFormModal";
import AllocateComponentModal from "@/components/AllocateComponentModal";
import AllocatePartModal from "@/components/AllocatePartModal";
import PartFormModal from "@/components/PartFormModal";
import { ArrowLeft, Edit, Plus, Calendar, MapPin, DollarSign, FileText, Loader2, Trash2, Wrench, Camera, FolderOpen } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMowerThumbnail } from "@/hooks/useThumbnails";
import { useCameraCapture } from "@/hooks/useCameraCapture";
import { useAssetEventsRefresh } from "@/hooks/useAssetEventsRefresh";
import type { Mower, Task, InsertTask, ServiceRecord, Attachment, Engine, Part, AssetPart, AssetPartWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner, ButtonLoading, CardLoadingSkeleton } from "@/components/ui/loading-components";
import { motion } from "framer-motion";

interface AttachmentFile {
  file: File;
  metadata: {
    title: string;
    description: string;
  };
  previewUrl?: string;
  isThumbnail?: boolean;
}

export default function MowerDetails() {
  const [, params] = useRoute("/mowers/:id");
  const [, setLocation] = useLocation();
  const mowerId = params?.id;
  const { toast } = useToast();
  
  // Check for tab parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get('tab');
  
  // Initialize WebSocket for auto-refresh
  const { isConnected: wsConnected, error: wsError } = useAssetEventsRefresh();
  
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(tabParam || "notes");
  
  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showMetadataDialog, setShowMetadataDialog] = useState(false);
  
  // Unified upload state
  const [unifiedAttachments, setUnifiedAttachments] = useState<AttachmentFile[]>([]);
  const [unifiedThumbnail, setUnifiedThumbnail] = useState<AttachmentFile | null>(null);
  
  // Edit attachment state
  const [showEditAttachmentDialog, setShowEditAttachmentDialog] = useState(false);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);

  // Camera capture functionality
  const { isMobile, handleCameraCapture, handleGallerySelect } = useCameraCapture({
    onFilesSelected: (files, isCameraCapture) => {
      // Show compression info for camera captures
      if (isCameraCapture && files.some(f => f.type.startsWith('image/'))) {
        toast({
          title: "Camera photos processed",
          description: "Images have been optimized for upload",
          variant: "default",
        });
      }
      
      const validFiles: File[] = [];
      
      files.forEach(file => {
        // Check file size (30MB limit)
        if (file.size > 30 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `${file.name} is larger than 30MB limit`,
            variant: "destructive"
          });
          return;
        }
        validFiles.push(file);
      });
      
      if (validFiles.length > 0) {
        setPendingFiles(validFiles);
        setCurrentFileIndex(0);
        setShowMetadataDialog(true);
      }
    },
    accept: '*/*',
    multiple: true
  });

  // Modal states for engines and parts
  const [showEngineModal, setShowEngineModal] = useState(false);
  const [showAllocateEngineModal, setShowAllocateEngineModal] = useState(false);
  const [showAllocatePartModal, setShowAllocatePartModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [editingEngine, setEditingEngine] = useState<Engine | null>(null);
  const [editingAssetPart, setEditingAssetPart] = useState<AssetPart | null>(null);
  const [selectedEngineForAllocation, setSelectedEngineForAllocation] = useState<string | null>(null);
  const [showDeleteEngineDialog, setShowDeleteEngineDialog] = useState(false);
  const [showDeleteAssetPartDialog, setShowDeleteAssetPartDialog] = useState(false);
  const [engineToDelete, setEngineToDelete] = useState<Engine | null>(null);
  const [assetPartToDelete, setAssetPartToDelete] = useState<AssetPart | null>(null);

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

  // Fetch engines data
  const { data: engines = [], isLoading: isEnginesLoading, error: enginesError } = useQuery<Engine[]>({
    queryKey: ['/api/mowers', mowerId, 'engines'],
    enabled: !!mowerId,
  });

  // Fetch parts data for this mower with full part details
  const { data: mowerParts = [], isLoading: isMowerPartsLoading, error: mowerPartsError } = useQuery<AssetPartWithDetails[]>({
    queryKey: ['/api/mowers', mowerId, 'parts'],
    enabled: !!mowerId,
  });

  // Fetch thumbnail for this mower
  const { data: thumbnail } = useMowerThumbnail(mowerId || '');

  // Delete mower mutation
  const deleteMowerMutation = useMutation({
    mutationFn: async () => {
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
      setLocation("/");
      toast({ title: "Success", description: "Mower deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to delete mower", variant: "destructive" });
    },
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
    mutationFn: async ({ file, metadata }: { file: File; metadata: { title: string; description: string } }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', metadata.title);
      formData.append('description', metadata.description);
      
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
      
      // Process next file if there are more
      const nextIndex = currentFileIndex + 1;
      if (nextIndex < pendingFiles.length) {
        setCurrentFileIndex(nextIndex);
        setShowMetadataDialog(true);
      } else {
        // Clear pending files when done
        setPendingFiles([]);
        setCurrentFileIndex(0);
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload Failed", 
        description: error.message.includes('Invalid file type') ? 'Invalid file type. Only PDF, images, documents, and ZIP files are allowed.' : 'Upload failed. Please try again.',
        variant: "destructive" 
      });
      
      // Clear pending files on error
      setPendingFiles([]);
      setCurrentFileIndex(0);
      setShowMetadataDialog(false);
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

  const editAttachmentMutation = useMutation({
    mutationFn: async ({ attachmentId, metadata }: { attachmentId: string; metadata: { title: string; description: string } }) => {
      const response = await apiRequest('PUT', `/api/attachments/${attachmentId}`, metadata);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'attachments'] });
      toast({ title: "Success", description: "Attachment updated successfully" });
      setShowEditAttachmentDialog(false);
      setEditingAttachment(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update attachment", variant: "destructive" });
    },
  });

  // Thumbnail assignment mutation
  const setThumbnailMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const currentThumbnailId = mower?.thumbnailAttachmentId;
      const isRemovingThumbnail = currentThumbnailId === attachmentId;
      
      const response = await apiRequest('PUT', `/api/mowers/${mowerId}/thumbnail`, { 
        attachmentId: isRemovingThumbnail ? null : attachmentId 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId] });
      queryClient.invalidateQueries({ queryKey: ['mower-thumbnail', mowerId] });
      toast({ title: "Success", description: "Thumbnail updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to set thumbnail", variant: "destructive" });
    },
  });

  // Component mutations
  const deleteEngineMutation = useMutation({
    mutationFn: async (engineId: number) => {
      await apiRequest('DELETE', `/api/engines/${engineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'engines'] });
      queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      toast({ title: "Success", description: "Engine deleted successfully" });
      setShowDeleteEngineDialog(false);
      setEngineToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete component", 
        variant: "destructive" 
      });
    },
  });

  // Asset Part mutations
  const deleteAssetPartMutation = useMutation({
    mutationFn: async (assetPartId: number) => {
      await apiRequest('DELETE', `/api/asset-parts/${assetPartId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'parts'] });
      toast({ title: "Success", description: "Part allocation removed successfully" });
      setShowDeleteAssetPartDialog(false);
      setAssetPartToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to remove part allocation", 
        variant: "destructive" 
      });
    },
  });

  // File upload handler (legacy)
  const handleFileUpload = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '*/*';
    fileInput.multiple = true;
    
    fileInput.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const validFiles: File[] = [];
        
        Array.from(files).forEach(file => {
          // Check file size (30MB limit)
          if (file.size > 30 * 1024 * 1024) {
            toast({
              title: "File Too Large",
              description: `${file.name} is larger than 30MB limit`,
              variant: "destructive"
            });
            return;
          }
          validFiles.push(file);
        });
        
        if (validFiles.length > 0) {
          setPendingFiles(validFiles);
          setCurrentFileIndex(0);
          setShowMetadataDialog(true);
        }
      }
    };
    
    fileInput.click();
  };

  // Handle unified attachment uploads
  const handleUnifiedAttachmentsUpload = async (attachments: AttachmentFile[]) => {
    if (attachments.length === 0) return;
    
    // Upload each attachment sequentially
    for (const attachment of attachments) {
      try {
        await uploadAttachmentMutation.mutateAsync({
          file: attachment.file,
          metadata: attachment.metadata
        });
      } catch (error) {
        console.error('Failed to upload attachment:', error);
        break; // Stop uploading on first error
      }
    }
    
    // Clear the unified attachments after successful upload
    setUnifiedAttachments([]);
    setUnifiedThumbnail(null);
  };

  // Handle unified thumbnail change
  const handleUnifiedThumbnailChange = (thumbnail: AttachmentFile | null) => {
    setUnifiedThumbnail(thumbnail);
    
    // If a thumbnail is set and we have a mower, update the server
    if (thumbnail && mower) {
      // First upload the thumbnail attachment, then set it as thumbnail
      uploadAttachmentMutation.mutate({
        file: thumbnail.file,
        metadata: thumbnail.metadata
      });
    }
  };

  // Wrapper for AttachmentGallery onUpload callback
  const handleAttachmentGalleryUpload = (files: FileList) => {
    const validFiles: File[] = [];
    
    Array.from(files).forEach(file => {
      // Check file size (30MB limit)
      if (file.size > 30 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 30MB limit`,
          variant: "destructive"
        });
        return;
      }
      validFiles.push(file);
    });
    
    if (validFiles.length > 0) {
      setPendingFiles(validFiles);
      setCurrentFileIndex(0);
      setShowMetadataDialog(true);
    }
  };
  
  // Handle metadata submission for file upload
  const handleMetadataSubmit = (metadata: { title: string; description: string }) => {
    const currentFile = pendingFiles[currentFileIndex];
    if (currentFile) {
      uploadAttachmentMutation.mutate({ file: currentFile, metadata });
    }
    setShowMetadataDialog(false);
  };
  
  // Handle metadata dialog close
  const handleMetadataCancel = () => {
    setShowMetadataDialog(false);
    setPendingFiles([]);
    setCurrentFileIndex(0);
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

  // View attachment handler - opens file in new browser tab with inline viewing
  const handleViewAttachment = (attachmentId: string, fileName: string) => {
    window.open(`/api/attachments/${attachmentId}/download?inline=1`, '_blank');
  };

  // Delete attachment with confirmation
  const handleDeleteAttachment = (attachmentId: string) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      deleteAttachmentMutation.mutate(attachmentId);
    }
  };

  // Edit attachment handler
  const handleEditAttachment = (attachmentId: string) => {
    const attachment = attachments.find(a => a.id === attachmentId);
    if (attachment) {
      // Convert to the expected type by adding fileData field (not needed for editing)
      setEditingAttachment({ ...attachment, fileData: '' });
      setShowEditAttachmentDialog(true);
    }
  };

  const handleEditAttachmentSubmit = (metadata: { title: string; description: string }) => {
    if (editingAttachment) {
      editAttachmentMutation.mutate({
        attachmentId: editingAttachment.id,
        metadata
      });
    }
  };

  // Engine handlers
  const handleAddEngine = () => {
    setEditingEngine(null);
    setShowEngineModal(true);
  };

  const handleAllocateEngine = () => {
    setShowAllocateEngineModal(true);
  };

  const handleEditEngine = (engine: Engine) => {
    setEditingEngine(engine);
    setShowEngineModal(true);
  };

  const handleDeleteEngine = (engine: Engine) => {
    setEngineToDelete(engine);
    setShowDeleteEngineDialog(true);
  };

  const handleConfirmDeleteEngine = () => {
    if (engineToDelete) {
      deleteEngineMutation.mutate(engineToDelete.id);
    }
  };

  // Part handlers
  const handleCreatePart = () => {
    setShowPartModal(true);
  };

  // Asset Part handlers
  const handleAllocatePart = () => {
    setEditingAssetPart(null);
    setSelectedComponentForAllocation(null);
    setShowAllocatePartModal(true);
  };

  const handleAllocatePartToComponent = (componentId: string) => {
    setEditingAssetPart(null);
    setSelectedComponentForAllocation(componentId);
    setShowAllocatePartModal(true);
  };

  const handleEditAssetPart = (assetPart: AssetPart) => {
    setEditingAssetPart(assetPart);
    setSelectedComponentForAllocation(assetPart.componentId?.toString() || null);
    setShowAllocatePartModal(true);
  };

  const handleDeleteAssetPart = (assetPart: AssetPart) => {
    setAssetPartToDelete(assetPart);
    setShowDeleteAssetPartDialog(true);
  };

  const handleConfirmDeleteAssetPart = () => {
    if (assetPartToDelete) {
      deleteAssetPartMutation.mutate(assetPartToDelete.id);
    }
  };

  const handleModalSuccess = () => {
    // Refresh data after successful operations
    queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'engines'] });
    queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'parts'] });
  };

  // Initialize notes when mower data loads
  useEffect(() => {
    if (mower?.notes && notes === "") {
      setNotes(mower.notes);
    }
  }, [mower?.notes, notes]);

  // Loading and error states
  if (isMowerLoading) {
    return <CardLoadingSkeleton cards={4} className="grid-cols-1 lg:grid-cols-3" />;
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
        
        <div className="flex items-center gap-4 flex-1">
          {thumbnail && (
            <div className="w-20 h-20 rounded-lg overflow-hidden shadow-sm border" data-testid="img-mower-thumbnail">
              <img 
                src={thumbnail.downloadUrl}
                alt={`${mower.make} ${mower.model}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-text-dark">
              {mower.make} {mower.model}
            </h1>
            <p className="text-text-muted">
              {mower.year} • Serial: {mower.serialNumber}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setLocation(`/mowers/${mowerId}/edit`)}
            className="bg-accent-teal text-white hover:bg-accent-teal/90 rounded-button"
            data-testid="button-edit-mower"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                data-testid="button-delete-mower"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Mower</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {mower.make} {mower.model}? This action cannot be undone. All associated service records, tasks, and attachments will also be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteMowerMutation.mutate();
                    setShowDeleteDialog(false);
                  }}
                  disabled={deleteMowerMutation.isPending}
                  data-testid="button-confirm-delete"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <ButtonLoading 
                    isLoading={deleteMowerMutation.isPending} 
                    loadingText="Deleting..."
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Mower
                  </ButtonLoading>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, staggerChildren: 0.1 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
          <CardHeader>
            <CardTitle>Mower Information</CardTitle>
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
            <hr className="border-border" />
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <MaintenanceOverview 
            serviceRecords={serviceRecords}
            onViewDetails={() => setActiveTab("service-history")}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
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
            
            {/* Unified Upload Component */}
            <div className="pt-2">
              <UnifiedFileUploadArea
                onAttachmentsChange={(attachments) => {
                  setUnifiedAttachments(attachments);
                  // Auto-upload when attachments are added
                  if (attachments.length > 0) {
                    handleUnifiedAttachmentsUpload(attachments);
                  }
                }}
                onThumbnailChange={handleUnifiedThumbnailChange}
                disabled={uploadAttachmentMutation.isPending}
                showThumbnailSelection={true}
                mode="details"
              />
            </div>
          </CardContent>
        </Card>
        </motion.div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="parts-engines" data-testid="tab-parts-engines">
            <Wrench className="h-4 w-4 mr-2" />
            Parts/Engines ({components.length + mowerParts.length})
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
                  <ButtonLoading 
                    isLoading={updateNotesMutation.isPending} 
                    loadingText="Saving..."
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditingNotes ? "Save" : "Edit"}
                  </ButtonLoading>
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
          {tasksError ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-destructive">Failed to load tasks data</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'tasks'] })}
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isTasksLoading ? (
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
        
        <TabsContent value="parts-engines">
          {componentsError || mowerPartsError ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-destructive">Failed to load parts and components data</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'components'] });
                      queryClient.invalidateQueries({ queryKey: ['/api/mowers', mowerId, 'parts'] });
                    }}
                  >
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (isComponentsLoading || isMowerPartsLoading) ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading parts and components...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Components Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Engines ({components.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleAllocateComponent} data-testid="button-allocate-component">
                        <Wrench className="h-4 w-4 mr-2" />
                        Allocate Engine
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAddComponent} data-testid="button-add-component">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Engine
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {components.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No engines yet. Use "Allocate Engine" to select from existing engines or "Create Engine" to create a new one.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {components.map((component) => (
                        <div key={component.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  className="p-0 h-auto font-medium text-left justify-start"
                                  onClick={() => setLocation(`/catalog/engines/${component.id}`)}
                                >
                                  {component.name}
                                </Button>
                                <Badge variant="outline" className="text-xs">
                                  {component.status}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {component.condition}
                                </Badge>
                              </div>
                              {component.description && (
                                <p className="text-sm text-muted-foreground mt-1">{component.description}</p>
                              )}
                              <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                                {component.partNumber && <span>Part: {component.partNumber}</span>}
                                {component.manufacturer && <span>Mfg: {component.manufacturer}</span>}
                                {component.model && <span>Model: {component.model}</span>}
                                {component.cost && <span>Cost: ${component.cost}</span>}
                              </div>
                              {(component.installDate || component.warrantyExpires) && (
                                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                  {component.installDate && (
                                    <span>Installed: {new Date(component.installDate).toLocaleDateString()}</span>
                                  )}
                                  {component.warrantyExpires && (
                                    <span>Warranty: {new Date(component.warrantyExpires).toLocaleDateString()}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleAllocatePartToComponent(component.id.toString())}
                                title="Allocate parts to this component"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditComponent(component)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteComponent(component)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Parts Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Allocated Parts ({mowerParts.length})
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleAllocatePart} data-testid="button-add-part">
                        <Plus className="h-4 w-4 mr-2" />
                        Allocate Part
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCreatePart} data-testid="button-create-part">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Part
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {mowerParts.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No parts allocated yet. Click "Allocate Part" to assign parts from inventory.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {mowerParts.map((assetPart) => (
                        <div key={assetPart.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  className="p-0 h-auto font-medium text-left justify-start"
                                  onClick={() => setLocation(`/catalog/parts/${assetPart.partId}`)}
                                >
                                  {assetPart.part?.name || `Part ID: ${assetPart.partId}`}
                                </Button>
                                <Badge variant="outline" className="text-xs">
                                  {assetPart.part?.category || 'Unknown'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Qty: {assetPart.quantity}
                                </span>
                              </div>
                              
                              {assetPart.part && (
                                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                  <span>Part #: {assetPart.part.partNumber}</span>
                                  {assetPart.part.manufacturer && <span>Mfg: {assetPart.part.manufacturer}</span>}
                                  {assetPart.part.unitCost && <span>Unit Cost: ${assetPart.part.unitCost}</span>}
                                </div>
                              )}
                              
                              {assetPart.componentId && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  <span>Allocated to Engine: </span>
                                  {assetPart.component ? (
                                    <Button 
                                      variant="ghost" 
                                      className="p-0 h-auto text-sm text-blue-600 underline"
                                      onClick={() => setLocation(`/catalog/engines/${assetPart.componentId}`)}
                                    >
                                      {assetPart.component.name}
                                    </Button>
                                  ) : (
                                    <span>ID: {assetPart.componentId}</span>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                                {assetPart.installDate && (
                                  <span>Installed: {new Date(assetPart.installDate).toLocaleDateString()}</span>
                                )}
                              </div>
                              
                              {assetPart.part?.description && (
                                <p className="text-sm text-muted-foreground mt-2">{assetPart.part.description}</p>
                              )}
                              
                              {assetPart.notes && (
                                <p className="text-sm text-muted-foreground mt-2 italic">{assetPart.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditAssetPart(assetPart)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteAssetPart(assetPart)}
                              >
                                <Trash2 className="h-4 w-4" />
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
                title: attachment.title ?? undefined,
                description: attachment.description ?? undefined,
              }))}
              onUpload={handleAttachmentGalleryUpload}
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
              onEdit={handleEditAttachment}
              onSetThumbnail={(id) => setThumbnailMutation.mutate(id)}
              thumbnailAttachmentId={mower?.thumbnailAttachmentId ?? null}
              isUploading={uploadAttachmentMutation.isPending}
              isDeleting={deleteAttachmentMutation.isPending}
            />
          )}
        </TabsContent>
      </Tabs>
      
      {/* Attachment Metadata Dialog */}
      {showMetadataDialog && pendingFiles[currentFileIndex] && (
        <AttachmentMetadataDialog
          open={showMetadataDialog}
          onOpenChange={setShowMetadataDialog}
          onSubmit={handleMetadataSubmit}
          onCancel={handleMetadataCancel}
          fileName={pendingFiles[currentFileIndex].name}
        />
      )}

      {/* Edit Attachment Dialog */}
      <EditAttachmentDialog
        open={showEditAttachmentDialog}
        onOpenChange={(open) => {
          setShowEditAttachmentDialog(open);
          if (!open) setEditingAttachment(null);
        }}
        onSubmit={handleEditAttachmentSubmit}
        attachment={editingAttachment}
        isLoading={editAttachmentMutation.isPending}
      />

      {/* Component Form Modal */}
      <ComponentFormModal
        isOpen={showComponentModal}
        onClose={() => {
          setShowComponentModal(false);
          setEditingComponent(null);
        }}
        mowerId={mowerId!}
        component={editingComponent}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Component Modal */}
      <AllocateComponentModal
        isOpen={showAllocateComponentModal}
        onClose={() => setShowAllocateComponentModal(false)}
        mowerId={mowerId!}
        onSuccess={handleModalSuccess}
      />

      {/* Allocate Part Modal */}
      <AllocatePartModal
        isOpen={showAllocatePartModal}
        onClose={() => {
          setShowAllocatePartModal(false);
          setEditingAssetPart(null);
          setSelectedComponentForAllocation(null);
        }}
        mowerId={mowerId!}
        componentId={selectedComponentForAllocation}
        assetPart={editingAssetPart}
        onSuccess={handleModalSuccess}
      />

      {/* Part Form Modal */}
      <PartFormModal
        isOpen={showPartModal}
        onClose={() => setShowPartModal(false)}
        mowerId={mowerId} // Pass mowerId for auto-allocation
        onSuccess={handleModalSuccess}
      />

      {/* Delete Component Confirmation Dialog */}
      <AlertDialog open={showDeleteComponentDialog} onOpenChange={setShowDeleteComponentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Engine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the engine "{componentToDelete?.name}"? This action cannot be undone and will also remove any part allocations to this engine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteComponentDialog(false);
              setComponentToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteComponent}
              disabled={deleteComponentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteComponentMutation.isPending ? "Deleting..." : "Delete Engine"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Asset Part Confirmation Dialog */}
      <AlertDialog open={showDeleteAssetPartDialog} onOpenChange={setShowDeleteAssetPartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Part Allocation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this part allocation? This will unlink the part from this {assetPartToDelete?.componentId ? 'component' : 'mower'} but will not delete the part from inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteAssetPartDialog(false);
              setAssetPartToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteAssetPart}
              disabled={deleteAssetPartMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAssetPartMutation.isPending ? "Removing..." : "Remove Allocation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}