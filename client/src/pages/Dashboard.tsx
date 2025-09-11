import { useState } from "react";
import DashboardStats from "@/components/DashboardStats";
import AssetCard from "@/components/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // todo: remove mock functionality
  const mockMowers = [
    {
      id: "1",
      make: "John Deere",
      model: "X350",
      year: 2022,
      serialNumber: "JD123456",
      condition: "excellent" as const,
      status: "active" as const,
      lastService: "Dec 15, 2024",
      nextService: "Mar 15, 2025",
      attachmentCount: 3,
      serviceOverdue: false,
      upcomingService: true
    },
    {
      id: "2",
      make: "Cub Cadet",
      model: "XT1 LT42",
      year: 2021,
      serialNumber: "CC789012", 
      condition: "good" as const,
      status: "maintenance" as const,
      lastService: "Nov 20, 2024",
      nextService: "Jan 20, 2025",
      attachmentCount: 1,
      serviceOverdue: true,
      upcomingService: false
    },
    {
      id: "3",
      make: "Troy-Bilt",
      model: "TB30R",
      year: 2019,
      serialNumber: "TB345678",
      condition: "fair" as const,
      status: "active" as const,
      lastService: "Oct 5, 2024",
      nextService: "Apr 5, 2025",
      attachmentCount: 0,
      serviceOverdue: false,
      upcomingService: true
    },
    {
      id: "4",
      make: "Craftsman",
      model: "T110",
      year: 2020,
      serialNumber: "CR987654",
      condition: "good" as const,
      status: "retired" as const,
      lastService: "Sep 10, 2024",
      nextService: "N/A",
      attachmentCount: 2,
      serviceOverdue: true,
      upcomingService: false
    }
  ];

  const filteredMowers = mockMowers.filter(mower =>
    `${mower.make} ${mower.model}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mower.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const handleViewDetails = (id: string) => {
    console.log('Navigate to mower details:', id);
    setLocation(`/mowers/${id}`);
  };

  const handleEdit = (id: string) => {
    console.log('Navigate to edit mower:', id);
    setLocation(`/mowers/${id}/edit`);
  };

  const handleAddService = (id: string) => {
    console.log('Navigate to add service:', id);
    setLocation(`/mowers/${id}/service/new`);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your lawn mower fleet and maintenance schedule
          </p>
        </div>
        <Button onClick={() => setLocation('/mowers/new')} data-testid="button-add-mower">
          <Plus className="h-4 w-4 mr-2" />
          Add Mower
        </Button>
      </div>

      <DashboardStats
        totalMowers={mockMowers.length}
        activeMowers={mockMowers.filter(m => m.status === 'active').length}
        maintenanceMowers={mockMowers.filter(m => m.status === 'maintenance').length}
        upcomingServices={mockMowers.filter(m => m.upcomingService).length}
        overdueServices={mockMowers.filter(m => m.serviceOverdue).length}
      />

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search mowers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-mowers"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMowers.map((mower) => (
            <AssetCard
              key={mower.id}
              {...mower}
              onViewDetails={handleViewDetails}
              onEdit={handleEdit}
              onAddService={handleAddService}
            />
          ))}
        </div>

        {filteredMowers.length === 0 && searchQuery && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No mowers found matching "{searchQuery}"</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}