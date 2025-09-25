import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Tractor, Wrench, AlertTriangle, Calendar, Search, Plus, Eye, CheckCircle 
} from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Mower, ServiceRecord } from "@shared/schema";

// Service intervals in days
const SERVICE_INTERVALS = {
  maintenance: 90,
  inspection: 180,
  repair: 0, // repairs don't have regular intervals
  warranty: 0
};

interface UpcomingMaintenanceItem {
  type: string;
  mowerId: number;
  mowerName: string;
  lastDate: Date | null;
  nextDue: Date;
  daysUntilDue: number;
  status: 'overdue' | 'due_soon' | 'upcoming';
}

const priorityColors = {
  low: "text-green-600 bg-green-100 border-green-200",
  medium: "text-yellow-600 bg-yellow-100 border-yellow-200", 
  high: "text-red-600 bg-red-100 border-red-200",
};

export default function Maintenance() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch mowers data
  const { data: mowers = [], isLoading: isMowersLoading } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
  });

  // Fetch all service records for calculating upcoming maintenance
  const { data: serviceRecords = [], isLoading: isServiceRecordsLoading } = useQuery<ServiceRecord[]>({
    queryKey: ['/api/service-records'],
  });

  // Calculate stats
  const activeMowers = mowers.filter(m => m.status === 'active').length;
  const maintenanceMowers = mowers.filter(m => m.status === 'maintenance');
  
  const upcomingServices = mowers.filter(m => {
    if (!m.nextServiceDate) return false;
    const nextServiceDate = new Date(m.nextServiceDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return nextServiceDate >= today && nextServiceDate <= thirtyDaysFromNow;
  }).length;
  
  const overdueServices = mowers.filter(m => {
    if (!m.nextServiceDate) return false;
    const nextServiceDate = new Date(m.nextServiceDate);
    const today = new Date();
    return nextServiceDate < today;
  }).length;

  // Calculate upcoming maintenance for next 12 months using live data
  const getUpcomingMaintenance = (): UpcomingMaintenanceItem[] => {
    const upcoming: UpcomingMaintenanceItem[] = [];
    const twelveMonthsFromNow = new Date();
    twelveMonthsFromNow.setFullYear(twelveMonthsFromNow.getFullYear() + 1);

    Object.entries(SERVICE_INTERVALS).forEach(([serviceType, intervalDays]) => {
      if (intervalDays === 0) return; // Skip non-recurring services

      mowers.forEach(mower => {
        const mowerServiceRecords = serviceRecords.filter(r => r.mowerId === mower.id && r.serviceType === serviceType);
        
        let lastService: Date | null = null;
        if (mowerServiceRecords.length > 0) {
          const sortedRecords = mowerServiceRecords.sort((a, b) => 
            new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
          );
          lastService = new Date(sortedRecords[0].serviceDate);
        }

        // Calculate next due date
        const nextDue = lastService 
          ? new Date(lastService.getTime() + (intervalDays * 24 * 60 * 60 * 1000))
          : new Date(); // If no previous service, assume due now

        // Only include if within 12 months
        if (nextDue <= twelveMonthsFromNow) {
          const today = new Date();
          const daysUntilDue = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          let status: 'overdue' | 'due_soon' | 'upcoming';
          if (daysUntilDue < 0) status = 'overdue';
          else if (daysUntilDue <= 30) status = 'due_soon';
          else status = 'upcoming';

          upcoming.push({
            type: serviceType,
            mowerId: mower.id,
            mowerName: `${mower.make} ${mower.model}`,
            lastDate: lastService,
            nextDue,
            daysUntilDue,
            status
          });
        }
      });
    });

    return upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  };

  const upcomingMaintenance = getUpcomingMaintenance();

  // Filter maintenance mowers and upcoming maintenance based on search
  const filteredMaintenanceMowers = maintenanceMowers.filter(mower =>
    `${mower.make} ${mower.model}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mower.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUpcomingMaintenance = upcomingMaintenance.filter(item =>
    item.mowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMowerClick = (mowerId: number) => {
    setLocation(`/mowers/${mowerId}`);
  };

  const handleScheduleService = (mowerId: number) => {
    setLocation(`/mowers/${mowerId}/service/new`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Maintenance</h1>
          <p className="text-text-muted">
            Manage maintenance schedules and service records
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

      {/* Stats Cards - Only show Active, In Maintenance, Upcoming Services, Overdue Services */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-panel border-panel-border" onClick={() => setLocation("/mowers?filter=active")} role="button">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Tractor className="h-5 w-5" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-dark">{activeMowers}</div>
            <p className="text-sm text-text-muted">Mowers in service</p>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border" onClick={() => setLocation("/mowers?filter=maintenance")} role="button">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Wrench className="h-5 w-5" />
              In Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-dark">{maintenanceMowers.length}</div>
            <p className="text-sm text-text-muted">Currently servicing</p>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border" onClick={() => setLocation("/mowers?filter=upcoming-services")} role="button">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Calendar className="h-5 w-5" />
              Upcoming Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-dark">{upcomingServices}</div>
            <p className="text-sm text-text-muted">Next 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border" onClick={() => setLocation("/mowers?filter=overdue-services")} role="button">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Overdue Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overdueServices}</div>
            <p className="text-sm text-text-muted">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted h-4 w-4" />
            <Input
              placeholder="Search maintenance items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In Maintenance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              In Maintenance ({filteredMaintenanceMowers.length})
            </CardTitle>
            <CardDescription>
              Mowers currently undergoing maintenance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredMaintenanceMowers.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No mowers in maintenance</p>
                <p className="text-sm">All mowers are currently active or retired</p>
              </div>
            ) : (
              filteredMaintenanceMowers.map((mower) => (
                <Card key={mower.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-text-primary">
                            {mower.make} {mower.model}
                          </h3>
                          <Badge variant="outline" className="text-orange-600 bg-orange-100 border-orange-200">
                            In Maintenance
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-text-muted">Serial Number</p>
                            <p className="font-medium">{mower.serialNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Last Service</p>
                            <p className="font-medium">{mower.lastServiceDate ? new Date(mower.lastServiceDate).toLocaleDateString() : 'Never'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMowerClick(mower.id)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          onClick={() => handleScheduleService(mower.id)}
                          className="bg-accent-teal text-white hover:bg-accent-teal/90 flex items-center gap-1"
                          size="sm"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming Maintenance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Maintenance ({filteredUpcomingMaintenance.length})
            </CardTitle>
            <CardDescription>
              Services scheduled for the next 12 months
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredUpcomingMaintenance.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming maintenance</p>
                <p className="text-sm">All maintenance is up to date</p>
              </div>
            ) : (
              filteredUpcomingMaintenance.slice(0, 10).map((item, index) => (
                <Card key={`${item.mowerId}-${item.type}-${index}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-text-primary">
                            {item.type}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className={
                              item.status === 'overdue' ? 'text-red-600 bg-red-100 border-red-200' : 
                              item.status === 'due_soon' ? 'text-yellow-600 bg-yellow-100 border-yellow-200' : 
                              'text-green-600 bg-green-100 border-green-200'
                            }
                          >
                            {item.status === 'overdue' ? 'OVERDUE' : 
                             item.status === 'due_soon' ? 'DUE SOON' : 
                             'SCHEDULED'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-text-muted">Mower</p>
                            <p className="font-medium">{item.mowerName}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Due Date</p>
                            <div className="flex items-center gap-1">
                              {item.status === 'overdue' && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              <span className={`font-medium ${
                                item.status === 'overdue' ? 'text-red-600' : 'text-text-primary'
                              }`}>
                                {item.nextDue.toLocaleDateString()} 
                                ({item.daysUntilDue <= 0 
                                  ? `${Math.abs(item.daysUntilDue)} days overdue`
                                  : `${item.daysUntilDue} days`
                                })
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMowerClick(item.mowerId)}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View Mower
                        </Button>
                        <Button
                          onClick={() => handleScheduleService(item.mowerId)}
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}