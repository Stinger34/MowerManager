import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Wrench, DollarSign, ChevronRight } from "lucide-react";
import type { ServiceRecord } from "@shared/schema";

interface ServiceActivityProps {
  serviceRecords: ServiceRecord[];
  onViewAll?: () => void;
}

const serviceTypeColors = {
  maintenance: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  repair: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  inspection: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  warranty: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
};

export default function ServiceActivity({ serviceRecords, onViewAll }: ServiceActivityProps) {
  // Get the 5 most recent service records
  const recentServices = serviceRecords
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
    .slice(0, 5);

  if (serviceRecords.length === 0) {
    return (
      <Card data-testid="card-service-activity">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Service Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No service records yet</p>
            <p className="text-sm">Service history will appear here when records are added</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-service-activity">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Service Activity
          </CardTitle>
          {serviceRecords.length > 5 && onViewAll && (
            <button 
              onClick={onViewAll}
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              data-testid="button-view-all-services"
            >
              View All ({serviceRecords.length})
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentServices.map((record, index) => (
            <div 
              key={record.id} 
              className="relative flex items-start gap-4 pb-4 last:pb-0"
              data-testid={`service-activity-item-${record.id}`}
            >
              {/* Timeline line */}
              {index < recentServices.length - 1 && (
                <div className="absolute left-2 top-6 w-px h-full bg-border" />
              )}
              
              {/* Timeline dot */}
              <div className="relative flex-shrink-0">
                <div className="w-4 h-4 bg-primary rounded-full border-2 border-background shadow-sm" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={serviceTypeColors[record.serviceType as keyof typeof serviceTypeColors] || serviceTypeColors.other}
                      data-testid={`badge-service-type-${record.id}`}
                    >
                      {record.serviceType.charAt(0).toUpperCase() + record.serviceType.slice(1)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(record.serviceDate).toLocaleDateString()}
                    </span>
                  </div>
                  {record.cost && (
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span data-testid={`text-service-cost-${record.id}`}>
                        ${record.cost}
                      </span>
                    </div>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-service-description-${record.id}`}>
                  {record.description}
                </p>
                
                {record.performedBy && (
                  <p className="text-xs text-muted-foreground">
                    Performed by: {record.performedBy}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}