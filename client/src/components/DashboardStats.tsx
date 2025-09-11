import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tractor, Wrench, AlertTriangle, Calendar } from "lucide-react";
import { useLocation } from "wouter";

interface DashboardStatsProps {
  totalMowers: number;
  activeMowers: number;
  maintenanceMowers: number;
  upcomingServices: number;
  overdueServices: number;
}

export default function DashboardStats({
  totalMowers,
  activeMowers,
  maintenanceMowers,
  upcomingServices,
  overdueServices
}: DashboardStatsProps) {
  const [, setLocation] = useLocation();

  const handleStatClick = (title: string) => {
    switch (title) {
      case "Total Mowers":
        setLocation("/mowers?filter=all");
        break;
      case "Active":
        setLocation("/mowers?filter=active");
        break;
      case "In Maintenance":
        setLocation("/mowers?filter=maintenance");
        break;
      case "Upcoming Services":
        setLocation("/mowers?filter=upcoming-services");
        break;
    }
  };

  const stats = [
    {
      title: "Total Mowers",
      value: totalMowers,
      icon: Tractor,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      clickable: true
    },
    {
      title: "Active",
      value: activeMowers,
      icon: Tractor,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
      clickable: true
    },
    {
      title: "In Maintenance",
      value: maintenanceMowers,
      icon: Wrench,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
      clickable: true
    },
    {
      title: "Upcoming Services",
      value: upcomingServices,
      icon: Calendar,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
      clickable: upcomingServices > 0
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card 
          key={index} 
          data-testid={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
          className={stat.clickable ? "hover-elevate cursor-pointer" : ""}
          onClick={stat.clickable ? () => handleStatClick(stat.title) : undefined}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-md ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid={`text-stat-value-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}>
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
      
      {overdueServices > 0 && (
        <Card 
          className="border-destructive hover-elevate cursor-pointer" 
          data-testid="card-overdue-services"
          onClick={() => setLocation("/mowers?filter=overdue-services")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">
              Overdue Services
            </CardTitle>
            <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-count">
                {overdueServices}
              </div>
              <Badge variant="destructive" className="text-xs">
                Urgent
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}