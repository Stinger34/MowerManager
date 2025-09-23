import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, Calendar, Package, Search, AlertTriangle, Clock, 
  Plus, Filter, SortAsc, Eye, Edit, CheckCircle 
} from "lucide-react";
import { useLocation } from "wouter";

// Using the same interfaces as RemindersCard for consistency
interface ServiceReminder {
  id: string;
  mowerId: string;
  mowerName: string;
  serviceType: string;
  dueDate: string;
  daysUntilDue: number;
  priority: 'low' | 'medium' | 'high';
  lastServiceDate?: string;
  estimatedCost?: string;
}

interface StockReminder {
  id: string;
  itemName: string;
  currentStock: number;
  minimumThreshold: number;
  category: string;
  priority: 'low' | 'medium' | 'high';
  supplier?: string;
  estimatedCost?: string;
}

// Extended mock data for the detailed page
const mockServiceReminders: ServiceReminder[] = [
  {
    id: "1",
    mowerId: "101",
    mowerName: "John Deere X350",
    serviceType: "Oil Change",
    dueDate: "2025-01-15",
    daysUntilDue: 5,
    priority: 'medium',
    lastServiceDate: "2024-10-15",
    estimatedCost: "$45"
  },
  {
    id: "2", 
    mowerId: "102",
    mowerName: "Cub Cadet XT1",
    serviceType: "Blade Sharpening",
    dueDate: "2025-01-12",
    daysUntilDue: 2,
    priority: 'high',
    lastServiceDate: "2024-09-12",
    estimatedCost: "$30"
  },
  {
    id: "3",
    mowerId: "103", 
    mowerName: "Troy-Bilt TB30R",
    serviceType: "Air Filter Replacement",
    dueDate: "2025-01-25",
    daysUntilDue: 15,
    priority: 'low',
    lastServiceDate: "2024-08-25",
    estimatedCost: "$25"
  },
  {
    id: "4",
    mowerId: "104",
    mowerName: "Husqvarna YTH24V48",
    serviceType: "Spark Plug Replacement",
    dueDate: "2025-02-05",
    daysUntilDue: 26,
    priority: 'medium',
    lastServiceDate: "2024-11-05",
    estimatedCost: "$20"
  },
  {
    id: "5",
    mowerId: "105",
    mowerName: "Craftsman T210",
    serviceType: "Belt Inspection",
    dueDate: "2025-02-10",
    daysUntilDue: 31,
    priority: 'low',
    lastServiceDate: "2024-11-10",
    estimatedCost: "$15"
  }
];

const mockStockReminders: StockReminder[] = [
  {
    id: "1",
    itemName: "Engine Oil (5W-30)",
    currentStock: 2,
    minimumThreshold: 5,
    category: "Fluids",
    priority: 'high',
    supplier: "Parts Plus",
    estimatedCost: "$12/qt"
  },
  {
    id: "2",
    itemName: "Air Filters (Standard)",
    currentStock: 3,
    minimumThreshold: 8,
    category: "Filters",
    priority: 'medium',
    supplier: "Auto Zone",
    estimatedCost: "$8/ea"
  },
  {
    id: "3",
    itemName: "Spark Plugs (NGK)",
    currentStock: 1,
    minimumThreshold: 6,
    category: "Ignition",
    priority: 'high',
    supplier: "Parts Plus",
    estimatedCost: "$4/ea"
  },
  {
    id: "4",
    itemName: "Drive Belts",
    currentStock: 0,
    minimumThreshold: 3,
    category: "Drive System",
    priority: 'high',
    supplier: "John Deere Parts",
    estimatedCost: "$35/ea"
  }
];

const priorityColors = {
  low: "text-green-600 bg-green-100 border-green-200",
  medium: "text-yellow-600 bg-yellow-100 border-yellow-200", 
  high: "text-red-600 bg-red-100 border-red-200",
};

export default function Reminders() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("services");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority">("dueDate");

  // Filter and sort service reminders
  const filteredServiceReminders = mockServiceReminders
    .filter(reminder => 
      reminder.mowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reminder.serviceType.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "dueDate") {
        return a.daysUntilDue - b.daysUntilDue;
      } else {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
    });

  // Filter and sort stock reminders
  const filteredStockReminders = mockStockReminders
    .filter(item => 
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "dueDate") {
        // For stock, sort by how far below threshold
        const aDeficit = a.minimumThreshold - a.currentStock;
        const bDeficit = b.minimumThreshold - b.currentStock;
        return bDeficit - aDeficit;
      } else {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
    });

  const handleServiceReminderClick = (reminder: ServiceReminder) => {
    setLocation(`/mowers/${reminder.mowerId}`);
  };

  const handleScheduleService = (reminder: ServiceReminder) => {
    setLocation(`/mowers/${reminder.mowerId}/service/new`);
  };

  const handleOrderStock = (item: StockReminder) => {
    // TODO: Implement stock ordering functionality
    console.log('Order stock for:', item.itemName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Reminders</h1>
          <p className="text-text-muted">
            Manage upcoming services and stock level alerts
          </p>
        </div>
        <Button 
          onClick={() => setLocation('/mowers/new')} 
          className="bg-accent-teal text-white hover:bg-accent-teal/90 rounded-button"
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Service
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted h-4 w-4" />
              <Input
                placeholder="Search reminders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-text-muted" />
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "dueDate" | "priority")}
                className="border border-medium-gray rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="dueDate">Sort by Due Date</option>
                <option value="priority">Sort by Priority</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different reminder types */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Service Reminders ({filteredServiceReminders.length})
          </TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Stock Alerts ({filteredStockReminders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          {filteredServiceReminders.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-text-muted">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No service reminders found</p>
                  <p className="text-sm">All services are up to date or try adjusting your search</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredServiceReminders.map((reminder) => (
                <Card key={reminder.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-text-primary">
                            {reminder.serviceType}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className={`${priorityColors[reminder.priority]}`}
                          >
                            {reminder.priority} priority
                          </Badge>
                          {reminder.daysUntilDue <= 7 && (
                            <Badge variant="destructive" className="bg-red-500 text-white">
                              {reminder.daysUntilDue <= 0 ? 'OVERDUE' : 'DUE SOON'}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-text-muted">Mower</p>
                            <p className="font-medium">{reminder.mowerName}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Due Date</p>
                            <div className="flex items-center gap-1">
                              {reminder.daysUntilDue <= 7 ? (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              ) : (
                                <Clock className="h-4 w-4 text-text-muted" />
                              )}
                              <span className={`font-medium ${
                                reminder.daysUntilDue <= 7 ? 'text-red-600' : 'text-text-primary'
                              }`}>
                                {reminder.dueDate} ({reminder.daysUntilDue <= 0 
                                  ? `${Math.abs(reminder.daysUntilDue)} days overdue`
                                  : `${reminder.daysUntilDue} days`
                                })
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-text-muted">Last Service</p>
                            <p className="font-medium">{reminder.lastServiceDate || 'Never'}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Est. Cost</p>
                            <p className="font-medium">{reminder.estimatedCost || 'TBD'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleServiceReminderClick(reminder)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View Mower
                        </Button>
                        <Button
                          onClick={() => handleScheduleService(reminder)}
                          className="bg-accent-teal text-white hover:bg-accent-teal/90 flex items-center gap-1"
                          size="sm"
                        >
                          <Calendar className="h-4 w-4" />
                          Schedule
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          {filteredStockReminders.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-text-muted">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No stock alerts found</p>
                  <p className="text-sm">All inventory levels are adequate or try adjusting your search</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredStockReminders.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-text-primary">
                            {item.itemName}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className={`${priorityColors[item.priority]}`}
                          >
                            {item.priority} priority
                          </Badge>
                          {item.currentStock === 0 && (
                            <Badge variant="destructive" className="bg-red-500 text-white">
                              OUT OF STOCK
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-text-muted">Category</p>
                            <p className="font-medium">{item.category}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Current Stock</p>
                            <div className="flex items-center gap-1">
                              <AlertTriangle className={`h-4 w-4 ${
                                item.currentStock === 0 ? 'text-red-500' : 'text-orange-500'
                              }`} />
                              <span className={`font-medium ${
                                item.currentStock === 0 ? 'text-red-600' : 'text-orange-600'
                              }`}>
                                {item.currentStock} (min: {item.minimumThreshold})
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-text-muted">Supplier</p>
                            <p className="font-medium">{item.supplier || 'TBD'}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Est. Cost</p>
                            <p className="font-medium">{item.estimatedCost || 'TBD'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation('/catalog')}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View Catalog
                        </Button>
                        <Button
                          onClick={() => handleOrderStock(item)}
                          className="bg-accent-teal text-white hover:bg-accent-teal/90 flex items-center gap-1"
                          size="sm"
                        >
                          <Package className="h-4 w-4" />
                          Order Stock
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}