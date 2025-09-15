import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Wrench, DollarSign, ChevronRight, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import type { ServiceRecord } from "@shared/schema";

interface MaintenanceOverviewProps {
  serviceRecords: ServiceRecord[];
  onViewDetails?: () => void;
}

// Service intervals in days
const SERVICE_INTERVALS = {
  maintenance: 90,
  inspection: 180,
  repair: 0, // repairs don't have regular intervals
  warranty: 0
};

export default function MaintenanceOverview({ serviceRecords, onViewDetails }: MaintenanceOverviewProps) {
  // Sort records by date (newest first)
  const sortedRecords = serviceRecords
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

  // Calculate KPIs
  const lastServiceDate = sortedRecords[0]?.serviceDate;
  const daysSinceLastService = lastServiceDate 
    ? Math.floor((Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate average interval between maintenance services
  const maintenanceRecords = serviceRecords
    .filter(r => r.serviceType === 'maintenance')
    .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime());
  
  const avgInterval = maintenanceRecords.length > 1
    ? maintenanceRecords.reduce((acc, record, index) => {
        if (index === 0) return acc;
        const prevDate = new Date(maintenanceRecords[index - 1].serviceDate);
        const currDate = new Date(record.serviceDate);
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        return acc + daysDiff;
      }, 0) / (maintenanceRecords.length - 1)
    : 90; // Default to 90 days if not enough data

  // Calculate 12-month cost
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
  const recentCosts = serviceRecords
    .filter(r => new Date(r.serviceDate) >= twelveMonthsAgo)
    .reduce((sum, r) => sum + (parseFloat(r.cost || '0')), 0);

  // Calculate repairs ratio (indicator of reliability issues)
  const recentRecords = serviceRecords.filter(r => new Date(r.serviceDate) >= twelveMonthsAgo);
  const repairCount = recentRecords.filter(r => r.serviceType === 'repair').length;
  const repairRatio = recentRecords.length > 0 ? (repairCount / recentRecords.length) * 100 : 0;

  // Calculate upcoming maintenance
  const getUpcomingMaintenance = () => {
    const upcoming: Array<{
      type: string;
      lastDate: Date | null;
      nextDue: Date;
      daysUntilDue: number;
      status: 'overdue' | 'due_soon' | 'upcoming';
    }> = [];

    Object.entries(SERVICE_INTERVALS).forEach(([serviceType, intervalDays]) => {
      if (intervalDays === 0) return; // Skip non-recurring services

      const lastService = serviceRecords
        .filter(r => r.serviceType === serviceType)
        .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())[0];

      if (lastService || serviceRecords.length === 0) {
        const lastDate = lastService ? new Date(lastService.serviceDate) : null;
        const nextDue = new Date();
        
        if (lastDate) {
          nextDue.setTime(lastDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        } else {
          // If no service history, assume due in standard interval from now
          nextDue.setTime(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
        }

        const daysUntilDue = Math.floor((nextDue.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        let status: 'overdue' | 'due_soon' | 'upcoming';
        if (daysUntilDue < 0) status = 'overdue';
        else if (daysUntilDue <= 30) status = 'due_soon';
        else status = 'upcoming';

        upcoming.push({
          type: serviceType,
          lastDate,
          nextDue,
          daysUntilDue,
          status
        });
      }
    });

    return upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  };

  const upcomingMaintenance = getUpcomingMaintenance();

  if (serviceRecords.length === 0) {
    return (
      <Card data-testid="card-maintenance-overview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Maintenance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No service history yet</p>
            <p className="text-sm">Maintenance insights will appear here when service records are added</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-maintenance-overview">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Maintenance Overview
          </CardTitle>
          {onViewDetails && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onViewDetails}
              className="text-sm text-primary hover:text-primary/80"
              data-testid="button-view-service-details"
            >
              View Details
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center" data-testid="kpi-last-service">
            <div className="text-2xl font-bold text-primary">
              {daysSinceLastService !== null ? daysSinceLastService : '—'}
            </div>
            <div className="text-xs text-muted-foreground">Days since last service</div>
          </div>
          
          <div className="text-center" data-testid="kpi-avg-interval">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(avgInterval)}
            </div>
            <div className="text-xs text-muted-foreground">Avg service interval</div>
          </div>
          
          <div className="text-center" data-testid="kpi-yearly-cost">
            <div className="text-2xl font-bold text-green-600">
              ${recentCosts.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground">12-month cost</div>
          </div>
          
          <div className="text-center" data-testid="kpi-reliability">
            <div className={`text-2xl font-bold ${repairRatio > 30 ? 'text-red-600' : repairRatio > 15 ? 'text-yellow-600' : 'text-green-600'}`}>
              {repairRatio.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Repair ratio</div>
          </div>
        </div>

        {/* Upcoming Maintenance */}
        {upcomingMaintenance.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled Maintenance
            </h4>
            <div className="space-y-2">
              {upcomingMaintenance.slice(0, 3).map((item, index) => (
                <div 
                  key={`${item.type}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  data-testid={`upcoming-maintenance-${item.type}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={
                        item.status === 'overdue' ? 'destructive' : 
                        item.status === 'due_soon' ? 'default' : 
                        'secondary'
                      }
                      className="text-xs"
                    >
                      {item.type}
                    </Badge>
                    <span className="text-sm">
                      {item.status === 'overdue' ? (
                        <>
                          <AlertTriangle className="h-3 w-3 inline mr-1 text-destructive" />
                          {Math.abs(item.daysUntilDue)} days overdue
                        </>
                      ) : item.status === 'due_soon' ? (
                        `Due in ${item.daysUntilDue} days`
                      ) : (
                        `Due in ${item.daysUntilDue} days`
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.nextDue.toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}