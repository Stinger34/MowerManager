import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, Clock, AlertTriangle, Plus, Filter } from "lucide-react";

export default function Maintenance() {
  // Mock maintenance data
  const maintenanceItems = [
    {
      id: "1",
      mowerId: "1",
      mowerName: "John Deere X300",
      type: "Oil Change",
      description: "Regular oil change and filter replacement",
      dueDate: "2024-09-25",
      status: "pending",
      priority: "medium",
    },
    {
      id: "2", 
      mowerId: "2",
      mowerName: "Craftsman DYT4000",
      type: "Blade Sharpening",
      description: "Sharpen cutting blades for optimal performance",
      dueDate: "2024-09-20",
      status: "overdue",
      priority: "high",
    },
    {
      id: "3",
      mowerId: "3", 
      mowerName: "Husqvarna YTH24V48",
      type: "Air Filter Replacement",
      description: "Replace air filter element",
      dueDate: "2024-10-01",
      status: "scheduled",
      priority: "low",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-accent-teal/10 text-accent-teal border-accent-teal/20';
      case 'pending':
        return 'bg-accent-orange/10 text-accent-orange border-accent-orange/20';
      case 'overdue':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'scheduled':
        return 'bg-accent-teal-light/10 text-accent-teal-light border-accent-teal-light/20';
      default:
        return 'bg-text-muted/10 text-text-muted border-text-muted/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-destructive';
      case 'medium':
        return 'text-accent-orange';
      case 'low':
        return 'text-text-muted';
      default:
        return 'text-text-muted';
    }
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
        <div className="flex gap-3">
          <Button variant="outline" className="border-panel-border">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button className="bg-accent-teal text-white hover:bg-accent-teal/90">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Maintenance
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-panel border-panel-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Calendar className="h-5 w-5" />
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-dark">3</div>
            <p className="text-sm text-text-muted">This month</p>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Clock className="h-5 w-5" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-dark">1</div>
            <p className="text-sm text-text-muted">Needs attention</p>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">1</div>
            <p className="text-sm text-text-muted">Requires immediate action</p>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Wrench className="h-5 w-5" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-text-dark">8</div>
            <p className="text-sm text-text-muted">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance List */}
      <Card className="bg-panel border-panel-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Maintenance Schedule</CardTitle>
          <CardDescription className="text-text-muted">
            Upcoming and pending maintenance activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {maintenanceItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 border border-panel-border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-teal/10 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-accent-teal" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary">{item.type}</h3>
                    <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                      {item.status}
                    </Badge>
                    <span className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-sm text-text-muted">{item.mowerName}</p>
                  <p className="text-xs text-text-muted">{item.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-primary">Due: {item.dueDate}</p>
                <Button variant="outline" size="sm" className="mt-2">
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}