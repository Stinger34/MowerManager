import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Calendar, Download, Filter, FileText } from "lucide-react";

export default function Reports() {
  // Mock report data
  const reports = [
    {
      id: "1",
      title: "Fleet Utilization Report",
      description: "Monthly analysis of mower usage and efficiency",
      type: "utilization",
      lastGenerated: "2024-09-15",
      status: "ready",
    },
    {
      id: "2",
      title: "Maintenance Cost Analysis",
      description: "Breakdown of maintenance expenses by mower and service type",
      type: "cost",
      lastGenerated: "2024-09-10",
      status: "ready",
    },
    {
      id: "3",
      title: "Service History Summary",
      description: "Comprehensive service record overview",
      type: "service",
      lastGenerated: "2024-09-08",
      status: "ready",
    },
  ];

  const quickStats = [
    {
      label: "Total Fleet Value",
      value: "$45,300",
      trend: "+2.1%",
      trendUp: true,
    },
    {
      label: "Monthly Maintenance Cost",
      value: "$1,230",
      trend: "-5.2%",
      trendUp: false,
    },
    {
      label: "Average Service Interval",
      value: "67 days",
      trend: "+3.1%",
      trendUp: true,
    },
    {
      label: "Fleet Availability",
      value: "94.2%",
      trend: "+1.8%",
      trendUp: true,
    },
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'utilization':
        return 'bg-accent-teal/10 text-accent-teal border-accent-teal/20';
      case 'cost':
        return 'bg-accent-orange/10 text-accent-orange border-accent-orange/20';
      case 'service':
        return 'bg-accent-teal-light/10 text-accent-teal-light border-accent-teal-light/20';
      default:
        return 'bg-text-muted/10 text-text-muted border-text-muted/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Reports</h1>
          <p className="text-text-muted">
            Analytics and insights for your mower fleet
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="border-panel-border">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button className="bg-accent-teal text-white hover:bg-accent-teal/90">
            <FileText className="h-4 w-4 mr-2" />
            Create Report
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <Card key={index} className="bg-panel border-panel-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-text-muted">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-text-dark">{stat.value}</div>
                <div className={`flex items-center gap-1 text-sm ${
                  stat.trendUp ? 'text-accent-teal' : 'text-accent-orange'
                }`}>
                  <TrendingUp className={`h-4 w-4 ${!stat.trendUp ? 'rotate-180' : ''}`} />
                  {stat.trend}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-panel border-panel-border hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <BarChart3 className="h-5 w-5" />
              Fleet Analytics
            </CardTitle>
            <CardDescription className="text-text-muted">
              Performance and utilization metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted mb-4">
              View detailed analytics on fleet performance, usage patterns, and efficiency metrics.
            </p>
            <Button variant="outline" className="w-full">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <Calendar className="h-5 w-5" />
              Maintenance Reports
            </CardTitle>
            <CardDescription className="text-text-muted">
              Service history and scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted mb-4">
              Comprehensive maintenance reports including costs, schedules, and service history.
            </p>
            <Button variant="outline" className="w-full">
              Generate Report
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-panel border-panel-border hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-text-primary">
              <TrendingUp className="h-5 w-5" />
              Cost Analysis
            </CardTitle>
            <CardDescription className="text-text-muted">
              Financial insights and trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted mb-4">
              Analyze maintenance costs, depreciation, and return on investment metrics.
            </p>
            <Button variant="outline" className="w-full">
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card className="bg-panel border-panel-border">
        <CardHeader>
          <CardTitle className="text-text-primary">Recent Reports</CardTitle>
          <CardDescription className="text-text-muted">
            Previously generated reports and analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="flex items-center justify-between p-4 border border-panel-border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent-teal/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent-teal" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary">{report.title}</h3>
                    <Badge className={`text-xs ${getTypeColor(report.type)}`}>
                      {report.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-text-muted">{report.description}</p>
                  <p className="text-xs text-text-muted">Last generated: {report.lastGenerated}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="outline" size="sm">
                  Regenerate
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}