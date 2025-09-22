import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Wrench, Calendar, ArrowRight, Plus, FileText, Edit3, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

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
  notes?: string;
}

interface MaintenanceTimelineProps {
  events: MaintenanceEvent[];
  onViewAll?: () => void;
  onAddMaintenance?: () => void;
  onViewNotes?: (eventId: string) => void;
  onEditEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  className?: string;
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

const priorityDots = {
  low: "bg-green-500",
  medium: "bg-yellow-500", 
  high: "bg-red-500",
};

export default function MaintenanceTimeline({ 
  events, 
  onViewAll, 
  onAddMaintenance,
  onViewNotes,
  onEditEvent,
  onDeleteEvent,
  className = ""
}: MaintenanceTimelineProps) {
  const [, setLocation] = useLocation();
  
  const handleViewNotes = (eventId: string) => {
    // Find the event to get the mowerId
    const event = events.find(e => e.id === eventId);
    if (event) {
      // Navigate to the mower's detail page with service-history tab
      setLocation(`/mowers/${event.mowerId}?tab=service-history`);
    } else if (onViewNotes) {
      onViewNotes(eventId);
    } else {
      // Default behavior - navigate to maintenance detail
      setLocation(`/maintenance/${eventId}`);
    }
  };

  const handleEditEvent = (eventId: string) => {
    if (onEditEvent) {
      onEditEvent(eventId);
    } else {
      // Default behavior - navigate to edit form
      setLocation(`/maintenance/${eventId}/edit`);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    if (onDeleteEvent) {
      onDeleteEvent(eventId);
    }
  };

  return (
    <Card className={`bg-panel border-panel-border shadow-lg flex flex-col ${className}`} style={{ height: '449px' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Wrench className="h-5 w-5 text-accent-teal" />
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
                className="text-text-muted hover:text-accent-teal"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-text-muted">
          Timeline of maintenance activities across all mowers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col">
        {events.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent maintenance</p>
            <p className="text-sm">Add your first maintenance record</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.slice(0, 2).map((event, index) => (
              <div key={event.id} className="relative">
                {/* Timeline line */}
                {index < events.slice(0, 2).length - 1 && (
                  <div className="absolute left-4 top-10 w-0.5 h-16 bg-medium-gray" />
                )}
                
                <div className="flex gap-3">
                  {/* Timeline dot with priority color */}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${priorityDots[event.priority]} border-white shadow-md`}>
                    <Wrench className="h-3 w-3 text-white" />
                  </div>
                  
                  <div 
                    className="flex-1 min-w-0 bg-white rounded-lg border border-medium-gray p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-accent-teal transition-all duration-200"
                    onClick={() => {
                      setLocation(`/mowers/${event.mowerId}?tab=service-history`);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm text-text-primary">{event.title}</p>
                          <span className={`text-xs font-medium ${priorityColors[event.priority]}`}>
                            {event.priority}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted font-medium">{event.mowerName}</p>
                        <p className="text-xs text-text-muted mt-1 line-clamp-2">
                          {event.description}
                        </p>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${statusColors[event.status]}`}
                            >
                              {event.status}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-text-muted">
                              <Clock className="h-3 w-3" />
                              {event.date}
                            </div>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center gap-1">
                            {event.notes && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewNotes(event.id)}
                                className="h-7 w-7 p-0 text-text-muted hover:text-accent-teal"
                                title="View notes"
                              >
                                <FileText className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEvent(event.id)}
                              className="h-7 w-7 p-0 text-text-muted hover:text-accent-teal"
                              title="Edit maintenance"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="h-7 w-7 p-0 text-text-muted hover:text-red-600"
                              title="Delete maintenance"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {events.length > 2 && (
          <div className="text-center pt-2 border-t border-medium-gray">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-text-muted hover:text-accent-teal"
              onClick={onViewAll}
            >
              View more events
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}