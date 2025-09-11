import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import AssetCard from "@/components/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ArrowLeft } from "lucide-react";

interface MowerListProps {}

export default function MowerList() {
  const [, params] = useRoute("/mowers");
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get filter from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const filter = urlParams.get('filter') || 'all';
  
  // Mock mower data (should be replaced with real API data)
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

  // Filter mowers based on the filter parameter
  const getFilteredMowers = () => {
    let filtered = mockMowers;
    
    switch (filter) {
      case 'active':
        filtered = mockMowers.filter(m => m.status === 'active');
        break;
      case 'maintenance':
        filtered = mockMowers.filter(m => m.status === 'maintenance');
        break;
      case 'retired':
        filtered = mockMowers.filter(m => m.status === 'retired');
        break;
      case 'upcoming-services':
        filtered = mockMowers.filter(m => m.upcomingService);
        break;
      case 'overdue-services':
        filtered = mockMowers.filter(m => m.serviceOverdue);
        break;
      case 'all':
      default:
        filtered = mockMowers;
        break;
    }
    
    // Apply search filter
    return filtered.filter(mower =>
      `${mower.make} ${mower.model}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mower.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredMowers = getFilteredMowers();

  const handleViewDetails = (id: string) => {
    setLocation(`/mowers/${id}`);
  };

  const handleEdit = (id: string) => {
    setLocation(`/mowers/${id}/edit`);
  };

  const handleAddService = (id: string) => {
    setLocation(`/mowers/${id}/service/new`);
  };

  // Get display info for the current filter
  const getFilterInfo = () => {
    switch (filter) {
      case 'active':
        return { title: "Active Mowers", description: "Mowers currently in active service", count: mockMowers.filter(m => m.status === 'active').length };
      case 'maintenance':
        return { title: "Mowers in Maintenance", description: "Mowers currently undergoing maintenance", count: mockMowers.filter(m => m.status === 'maintenance').length };
      case 'retired':
        return { title: "Retired Mowers", description: "Mowers that are no longer in service", count: mockMowers.filter(m => m.status === 'retired').length };
      case 'upcoming-services':
        return { title: "Upcoming Services", description: "Mowers with services scheduled soon", count: mockMowers.filter(m => m.upcomingService).length };
      case 'overdue-services':
        return { title: "Overdue Services", description: "Mowers with overdue maintenance", count: mockMowers.filter(m => m.serviceOverdue).length };
      case 'all':
      default:
        return { title: "All Mowers", description: "Complete list of your mower fleet", count: mockMowers.length };
    }
  };

  const filterInfo = getFilterInfo();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
                {filterInfo.title}
              </h1>
              <Badge variant="secondary" data-testid="badge-mower-count">
                {filterInfo.count}
              </Badge>
            </div>
            <p className="text-muted-foreground" data-testid="text-page-description">
              {filterInfo.description}
            </p>
          </div>
        </div>
        
        <Button onClick={() => setLocation('/mowers/new')} data-testid="button-add-mower">
          <Plus className="h-4 w-4 mr-2" />
          Add Mower
        </Button>
      </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-mowers">
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
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-search-results">
            <p>No mowers found matching "{searchQuery}"</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        )}

        {filteredMowers.length === 0 && !searchQuery && (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-mowers">
            <p>No mowers found for this filter</p>
            <p className="text-sm">Try a different filter or add a new mower</p>
          </div>
        )}
      </div>
    </div>
  );
}