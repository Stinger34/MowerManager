import { StatCard } from "@/components/ui/stat-card";
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
      type: "totalMowers" as const,
      clickable: true
    },
    {
      title: "Active",
      value: activeMowers,
      icon: Tractor,
      type: "active" as const,
      clickable: true
    },
    {
      title: "In Maintenance",
      value: maintenanceMowers,
      icon: Wrench,
      type: "maintenance" as const,
      clickable: true
    },
    {
      title: "Upcoming Services",
      value: upcomingServices,
      icon: Calendar,
      type: "upcomingServices" as const,
      clickable: upcomingServices > 0
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          type={stat.type}
          clickable={stat.clickable}
          onClick={stat.clickable ? () => handleStatClick(stat.title) : undefined}
          testId={`card-stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
          className="h-24"
        />
      ))}
      
      {overdueServices > 0 && (
        <StatCard
          title="Overdue Services"
          value={overdueServices}
          icon={AlertTriangle}
          type="overdue"
          clickable={true}
          onClick={() => setLocation("/mowers?filter=overdue-services")}
          badge={{ text: "Urgent", variant: "destructive" }}
          className="border-destructive h-24"
          testId="card-overdue-services"
        />
      )}
    </div>
  );
}