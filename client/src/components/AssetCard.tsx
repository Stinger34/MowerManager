import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
  thumbnailUrl?: string;
  onViewDetails: (id: string) => void;
  onEdit: (id: string) => void;
  onAddService: (id: string) => void;
  onDelete: (id: string) => void;
}

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
  thumbnailUrl,
  onViewDetails,
  onEdit,
  onAddService,
  onDelete
}: AssetCardProps) {
  return (
    <Card className="bg-background-card rounded-card shadow-card border-0 hover-elevate cursor-pointer" data-testid={`card-mower-${id}`}>
      {thumbnailUrl && (
        <div className="w-full h-48 overflow-hidden rounded-t-lg">
          <img 
            src={thumbnailUrl}
            alt={`${make} ${model}`}
            className="w-full h-full object-cover"
            onClick={() => onViewDetails(id)}
            data-testid={`img-thumbnail-${id}`}
          />
        </div>
      )}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1" onClick={() => onViewDetails(id)}>
          <h3 className="font-semibold text-lg text-text" data-testid={`text-mower-name-${id}`}>
            {make} {model}
          </h3>
          <div className="flex items-center gap-2 text-sm text-text-muted">
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
          <StatusBadge status={condition} className="rounded-button" data-testid={`badge-condition-${id}`} />
          <StatusBadge status={status} className="rounded-button" data-testid={`badge-status-${id}`} />
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