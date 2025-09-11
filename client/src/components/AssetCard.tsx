import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Wrench, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface AssetCardProps {
  id: string;
  make: string;
  model: string;
  year?: number;
  serialNumber?: string;
  condition: "excellent" | "good" | "fair" | "poor";
  status: "active" | "maintenance" | "retired";
  lastService?: string;
  nextService?: string;
  attachmentCount: number;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onAddService: (id: string) => void;
  onDelete: (id: string) => void;
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

export default function AssetCard({
  id,
  make,
  model,
  year,
  serialNumber,
  condition,
  status,
  lastService,
  nextService,
  attachmentCount,
  onViewDetails,
  onEdit,
  onAddService,
  onDelete
}: AssetCardProps) {
  return (
    <Card className="hover-elevate cursor-pointer" data-testid={`card-mower-${id}`}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1" onClick={() => onViewDetails(id)}>
          <h3 className="font-semibold text-lg" data-testid={`text-mower-name-${id}`}>
            {make} {model}
          </h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {year && <span>{year}</span>}
            {serialNumber && <span>• SN: {serialNumber}</span>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-menu-${id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails(id)} data-testid={`button-view-${id}`}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(id)} data-testid={`button-edit-${id}`}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddService(id)} data-testid={`button-add-service-${id}`}>
              Add Service Record
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }} 
              data-testid={`button-delete-${id}`}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent className="space-y-4" onClick={() => onViewDetails(id)}>
        <div className="flex gap-2">
          <Badge className={conditionColors[condition]} data-testid={`badge-condition-${id}`}>
            {condition.charAt(0).toUpperCase() + condition.slice(1)}
          </Badge>
          <Badge className={statusColors[status]} data-testid={`badge-status-${id}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          {lastService && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wrench className="h-4 w-4" />
              <span>Last service: {lastService}</span>
            </div>
          )}
          {nextService && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Next service: {nextService}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{attachmentCount} attachment{attachmentCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}