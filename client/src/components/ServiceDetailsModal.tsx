import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, DollarSign, User, FileText, Edit, Trash2, Clock, Wrench } from "lucide-react";
import { useLocation } from "wouter";

interface ServiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceRecord: {
    id: string;
    mowerId: string;
    mowerName: string;
    serviceType: string;
    description: string;
    date: string;
    status: 'completed' | 'pending' | 'overdue';
    priority: 'low' | 'medium' | 'high';
    notes?: string;
    cost?: string;
    performedBy?: string;
    mileage?: number;
  };
  onEdit?: (serviceId: string) => void;
  onDelete?: (serviceId: string) => void;
}

const statusColors = {
  completed: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
};

const priorityColors = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-red-600",
};

const typeIcons = {
  maintenance: Calendar,
  repair: Wrench,
  inspection: FileText,
  warranty: FileText,
  service: Wrench,
  scheduled: Calendar,
};

export default function ServiceDetailsModal({ 
  isOpen, 
  onClose, 
  serviceRecord, 
  onEdit, 
  onDelete 
}: ServiceDetailsModalProps) {
  const [, setLocation] = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const handleEdit = () => {
    if (onEdit) {
      onEdit(serviceRecord.id);
    } else {
      // Default navigation to edit service record
      setLocation(`/mowers/${serviceRecord.mowerId}/service/${serviceRecord.id}/edit`);
    }
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(serviceRecord.id);
    }
    setShowDeleteDialog(false);
    onClose();
  };

  const TypeIcon = typeIcons[serviceRecord.serviceType as keyof typeof typeIcons] || Wrench;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5 text-accent-teal" />
              Service Details
            </DialogTitle>
            <DialogDescription>
              View and manage service record for {serviceRecord.mowerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Service Type and Status */}
            <div className="flex items-center justify-between">
              <Badge 
                variant="outline" 
                className="capitalize"
              >
                {serviceRecord.serviceType}
              </Badge>
              <Badge 
                variant="outline" 
                className={`text-xs ${statusColors[serviceRecord.status]}`}
              >
                {serviceRecord.status}
              </Badge>
            </div>

            {/* Service Description */}
            <div>
              <h4 className="font-medium text-sm mb-1">{serviceRecord.description}</h4>
              <p className="text-sm text-muted-foreground">
                Service performed on {serviceRecord.mowerName}
              </p>
            </div>

            {/* Service Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{serviceRecord.date}</p>
                </div>
              </div>

              {serviceRecord.cost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Cost</p>
                    <p className="font-medium">${serviceRecord.cost}</p>
                  </div>
                </div>
              )}

              {serviceRecord.performedBy && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Performed By</p>
                    <p className="font-medium">{serviceRecord.performedBy}</p>
                  </div>
                </div>
              )}

              {serviceRecord.mileage && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Hours</p>
                    <p className="font-medium">{serviceRecord.mileage}h</p>
                  </div>
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <span className={`text-sm font-medium capitalize ${priorityColors[serviceRecord.priority]}`}>
                {serviceRecord.priority}
              </span>
            </div>

            {/* Notes */}
            {serviceRecord.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{serviceRecord.notes}</p>
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={handleDelete}
              className="flex items-center gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}