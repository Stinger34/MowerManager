import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Bell, Calendar, Package, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { useLocation } from "wouter";

// Mock data interfaces
interface ServiceReminder {
  id: string;
  mowerId: string;
  mowerName: string;
  serviceType: string;
  dueDate: string;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high';
}

interface StockReminder {
  id: string;
  itemName: string;
  currentStock: number;
  minimumThreshold: number;
  category: string;
  priority: 'low' | 'medium' | 'high';
}

interface RemindersCardProps {
  className?: string;
}

// Mock data - easily replaceable with API calls
const mockServiceReminders: ServiceReminder[] = [
  {
    id: "1",
    mowerId: "101",
    mowerName: "John Deere X350",
    serviceType: "Oil Change",
    dueDate: "2025-01-15",
    daysUntilDue: 5,
    priority: 'medium'
  },
  {
    id: "2", 
    mowerId: "102",
    mowerName: "Cub Cadet XT1",
    serviceType: "Blade Sharpening",
    dueDate: "2025-01-12",
    daysUntilDue: 2,
    priority: 'high'
  },
  {
    id: "3",
    mowerId: "103", 
    mowerName: "Troy-Bilt TB30R",
    serviceType: "Air Filter",
    dueDate: "2025-01-25",
    daysUntilDue: 15,
    priority: 'low'
  },
  {
    id: "4",
    mowerId: "104", 
    mowerName: "Husqvarna YTH24V48",
    serviceType: "Spark Plug",
    dueDate: "2025-02-01",
    daysUntilDue: 22,
    priority: 'medium'
  },
  {
    id: "5",
    mowerId: "105", 
    mowerName: "Craftsman T240",
    serviceType: "Belt Check",
    dueDate: "2025-02-10",
    daysUntilDue: 31,
    priority: 'low'
  },
  {
    id: "6",
    mowerId: "106", 
    mowerName: "Ariens IKON-X 52",
    serviceType: "Deck Cleaning",
    dueDate: "2025-02-15",
    daysUntilDue: 36,
    priority: 'low'
  }
];

const mockStockReminders: StockReminder[] = [
  {
    id: "1",
    itemName: "Engine Oil (5W-30)",
    currentStock: 2,
    minimumThreshold: 5,
    category: "Fluids",
    priority: 'high'
  },
  {
    id: "2",
    itemName: "Air Filters",
    currentStock: 3,
    minimumThreshold: 8,
    category: "Filters",
    priority: 'medium'
  }
];

const priorityColors = {
  low: "text-green-600 bg-green-100 border-green-200",
  medium: "text-yellow-600 bg-yellow-100 border-yellow-200", 
  high: "text-red-600 bg-red-100 border-red-200",
};

export default function RemindersCard({ className = "" }: RemindersCardProps) {
  const [, setLocation] = useLocation();

  const handleViewAllReminders = () => {
    setLocation('/reminders');
  };

  const handleServiceReminderClick = (reminder: ServiceReminder) => {
    setLocation(`/mowers/${reminder.mowerId}`);
  };

  const upcomingServices = mockServiceReminders.filter(r => r.daysUntilDue <= 30);
  const lowStockItems = mockStockReminders.filter(r => r.currentStock <= r.minimumThreshold);
  
  const totalReminders = upcomingServices.length + lowStockItems.length;

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
          <div className="space-y-4 flex-grow">
            {/* Service Reminders Section */}
            {upcomingServices.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-accent-teal" />
                  <h4 className="text-sm font-medium text-text-primary">Upcoming Services</h4>
                </div>
                <Carousel className="w-full">
                  <CarouselContent className="-ml-4">
                    {upcomingServices.map((reminder) => (
                      <CarouselItem key={reminder.id} className="pl-4 basis-full">
                        <div
                          className="p-3 rounded-lg border border-medium-gray bg-white hover:border-accent-teal transition-all duration-200 cursor-pointer"
                          onClick={() => handleServiceReminderClick(reminder)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm text-text-primary truncate">
                                  {reminder.serviceType}
                                </p>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${priorityColors[reminder.priority]}`}
                                >
                                  {reminder.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-text-muted truncate">{reminder.mowerName}</p>
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
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {upcomingServices.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2" />
                      <CarouselNext className="right-2" />
                    </>
                  )}
                </Carousel>
              </div>
            )}

            {/* Stock Level Reminders Section */}
            {lowStockItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-accent-teal" />
                  <h4 className="text-sm font-medium text-text-primary">Low Stock Alerts</h4>
                </div>
                <Carousel className="w-full">
                  <CarouselContent className="-ml-4">
                    {lowStockItems.map((item) => (
                      <CarouselItem key={item.id} className="pl-4 basis-full">
                        <div
                          className="p-3 rounded-lg border border-medium-gray bg-white hover:border-accent-teal transition-all duration-200 cursor-pointer"
                          onClick={() => setLocation('/catalog')}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-sm text-text-primary truncate">
                                  {item.itemName}
                                </p>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${priorityColors[item.priority]}`}
                                >
                                  {item.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-text-muted">{item.category}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <AlertTriangle className="h-3 w-3 text-orange-500" />
                                <span className="text-xs text-orange-600 font-medium">
                                  {item.currentStock} left (min: {item.minimumThreshold})
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {lowStockItems.length > 1 && (
                    <>
                      <CarouselPrevious className="left-2" />
                      <CarouselNext className="right-2" />
                    </>
                  )}
                </Carousel>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}