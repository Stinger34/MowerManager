import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Calendar, Package, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

// Live data interfaces (matching API response)
interface ServiceReminder {
  id: string;
  type: 'service';
  title: string;
  subtitle: string;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high';
  mowerId: number;
  dueDate: string;
}

interface StockReminder {
  id: string;
  type: 'stock';
  title: string;
  subtitle: string;
  priority: 'low' | 'medium' | 'high';
  partId: number;
  currentStock: number;
  minStock: number;
}

// Unified reminder interface
interface UnifiedReminder {
  id: string;
  type: 'service' | 'stock';
  title: string;
  subtitle: string;
  daysUntilDue?: number;
  priority: 'low' | 'medium' | 'high';
  icon: typeof Calendar | typeof Package;
  onClick: () => void;
}

interface RemindersCardProps {
  className?: string;
}

const priorityColors = {
  low: "text-green-600 bg-green-100 border-green-200",
  medium: "text-yellow-600 bg-yellow-100 border-yellow-200", 
  high: "text-red-600 bg-red-100 border-red-200",
};

export default function RemindersCard({ className = "" }: RemindersCardProps) {
  const [, setLocation] = useLocation();

  // Fetch live reminders data
  const { data: reminders = [], isLoading, error } = useQuery<(ServiceReminder | StockReminder)[]>({
    queryKey: ['/api/reminders'],
  });

  const handleViewAllReminders = () => {
    setLocation('/reminders');
  };

  const handleServiceReminderClick = (mowerId: number) => {
    setLocation(`/mowers/${mowerId}`);
  };

  const handleStockReminderClick = () => {
    setLocation('/catalog');
  };
  
  // Create unified reminders list
  const unifiedReminders: UnifiedReminder[] = reminders.map((reminder): UnifiedReminder => {
    if (reminder.type === 'service') {
      return {
        id: reminder.id,
        type: 'service',
        title: reminder.title,
        subtitle: reminder.subtitle,
        daysUntilDue: reminder.daysUntilDue,
        priority: reminder.priority,
        icon: Calendar,
        onClick: () => handleServiceReminderClick(reminder.mowerId),
      };
    } else {
      return {
        id: reminder.id,
        type: 'stock',
        title: reminder.title,
        subtitle: reminder.subtitle,
        priority: reminder.priority,
        icon: Package,
        onClick: () => handleStockReminderClick(),
      };
    }
  });

  const totalReminders = unifiedReminders.length;

  if (isLoading) {
    return (
      <Card className={`bg-panel border-panel-border shadow-lg flex flex-col ${className}`} style={{ height: '449px' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Bell className="h-5 w-5 text-accent-teal" />
            Reminders
          </CardTitle>
          <CardDescription className="text-text-muted">
            Loading reminders...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-grow flex flex-col">
          <div className="text-center py-6 text-text-muted">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`bg-panel border-panel-border shadow-lg flex flex-col ${className}`} style={{ height: '449px' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Bell className="h-5 w-5 text-accent-teal" />
            Reminders
          </CardTitle>
          <CardDescription className="text-text-muted">
            Error loading reminders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-grow flex flex-col">
          <div className="text-center py-6 text-text-muted">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50 text-red-500" />
            <p>Failed to load reminders</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-panel border-panel-border shadow-lg flex flex-col ${className}`} style={{ height: '449px' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Bell className="h-5 w-5 text-accent-teal" />
            Reminders
            {totalReminders > 0 && (
              <Badge variant="secondary" className="ml-2 bg-accent-teal text-white">
                {totalReminders}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleViewAllReminders}
            className="text-text-muted hover:text-accent-teal"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
        <CardDescription className="text-text-muted">
          Upcoming services and stock level alerts (next 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 flex-grow flex flex-col">
        {totalReminders === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active reminders</p>
            <p className="text-sm">All services are up to date</p>
          </div>
        ) : (
          <ScrollArea className="flex-grow h-[300px]">
            <div className="space-y-3 pr-4">
              {unifiedReminders.map((reminder) => {
                const IconComponent = reminder.icon;
                return (
                  <div
                    key={reminder.id}
                    className="p-3 rounded-lg border border-medium-gray bg-white hover:border-accent-teal transition-all duration-200 cursor-pointer"
                    onClick={reminder.onClick}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <IconComponent className="h-4 w-4 text-accent-teal mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm text-text-primary truncate">
                              {reminder.title}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${priorityColors[reminder.priority]} flex-shrink-0`}
                            >
                              {reminder.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted truncate">{reminder.subtitle}</p>
                          {reminder.daysUntilDue !== undefined && (
                            <div className="flex items-center gap-1 mt-1">
                              {reminder.daysUntilDue <= 7 ? (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Clock className="h-3 w-3 text-text-muted" />
                              )}
                              <span className={`text-xs ${
                                reminder.daysUntilDue <= 7 ? 'text-red-600 font-medium' : 'text-text-muted'
                              }`}>
                                {reminder.daysUntilDue <= 0 
                                  ? `${Math.abs(reminder.daysUntilDue)} days overdue`
                                  : `${reminder.daysUntilDue} days`
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}