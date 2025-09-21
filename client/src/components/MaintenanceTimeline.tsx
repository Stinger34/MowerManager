import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Wrench, Calendar, ArrowRight, Plus } from "lucide-react";

interface MaintenanceEvent {
  id: string;
  mowerId: string;
  mowerName: string;
  type: 'service' | 'repair' | 'inspection' | 'scheduled';
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'overdue';
  priority: 'low' | 'medium' | 'high';
}

interface MaintenanceTimelineProps {
  events: MaintenanceEvent[];
  onViewAll?: () => void;
  onAddMaintenance?: () => void;
}

const statusColors = {
  completed: "bg-accent-teal-light/10 text-accent-teal-light border-accent-teal-light/20",
  pending: "bg-accent-orange/10 text-accent-orange border-accent-orange/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityColors = {
  low: "text-text-muted",
  medium: "text-accent-orange",
  high: "text-destructive",
};

export default function MaintenanceTimeline({ 
  events, 
  onViewAll, 
  onAddMaintenance 
}: MaintenanceTimelineProps) {
  return (
    <Card className="bg-panel border-panel-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Wrench className="h-5 w-5" />
            Recent Maintenance
          </CardTitle>
          <div className="flex gap-2">
            {onAddMaintenance && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onAddMaintenance}
                className="bg-accent-teal text-white hover:bg-accent-teal/90 border-accent-teal"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            )}
            {onViewAll && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onViewAll}
                className="text-text-muted hover:text-text-primary"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-text-muted">
          Timeline of maintenance activities and upcoming service
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent maintenance</p>
            <p className="text-sm">Add your first maintenance record</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.slice(0, 4).map((event, index) => (
              <div key={event.id} className="relative">
                {/* Timeline line */}
                {index < events.slice(0, 4).length - 1 && (
                  <div className="absolute left-4 top-8 w-0.5 h-12 bg-panel-border" />
                )}
                
                <div className="flex gap-3">
                  {/* Timeline dot */}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    event.status === 'completed' 
                      ? 'bg-accent-teal-light border-accent-teal-light' 
                      : event.status === 'overdue'
                      ? 'bg-destructive border-destructive'
                      : 'bg-accent-orange border-accent-orange'
                  }`}>
                    <Wrench className="h-3 w-3 text-white" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm text-text-primary">{event.title}</p>
                        <p className="text-xs text-text-muted">{event.mowerName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${statusColors[event.status]}`}
                        >
                          {event.status}
                        </Badge>
                        <span className={`text-xs font-medium ${priorityColors[event.priority]}`}>
                          {event.priority}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-text-muted mt-1 line-clamp-2">
                      {event.description}
                    </p>
                    
                    <div className="flex items-center gap-1 mt-2 text-xs text-text-muted">
                      <Clock className="h-3 w-3" />
                      {event.date}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {events.length > 4 && (
          <div className="text-center pt-2 border-t border-panel-border">
            <Button variant="ghost" size="sm" className="text-text-muted">
              View {events.length - 4} more events
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}