import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import AssetCard from "@/components/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMowerThumbnails } from "@/hooks/useThumbnails";
import type { Mower } from "@shared/schema";

interface MowerListProps {}

export default function MowerList() {
  const [, params] = useRoute("/mowers");
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Get filter from URL search params
  const urlParams = new URLSearchParams(window.location.search);
  const filter = urlParams.get('filter') || 'all';
  
  const { data: mowers, isLoading, error } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
  });

  // Fetch thumbnails for all mowers
  const { data: thumbnails } = useMowerThumbnails(mowers || []);

  // Filter mowers based on the filter parameter
  const getFilteredMowers = () => {
    let filtered = mowers || [];
    
    switch (filter) {
      case 'active':
        filtered = (mowers || []).filter(m => m.status === 'active');
        break;
      case 'maintenance':
        filtered = (mowers || []).filter(m => m.status === 'maintenance');
        break;
      case 'retired':
        filtered = (mowers || []).filter(m => m.status === 'retired');
        break;
      case 'upcoming-services':
        // Filter mowers with next service date within 30 days
        filtered = (mowers || []).filter(m => {
          if (!m.nextServiceDate) return false;
          const nextServiceDate = new Date(m.nextServiceDate);
          const today = new Date();
          const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
          return nextServiceDate >= today && nextServiceDate <= thirtyDaysFromNow;
        });
        break;
      case 'overdue-services':
        // Filter mowers with next service date in the past
        filtered = (mowers || []).filter(m => {
          if (!m.nextServiceDate) return false;
          const nextServiceDate = new Date(m.nextServiceDate);
          const today = new Date();
          return nextServiceDate < today;
        });
        break;
      case 'all':
      default:
        filtered = mowers || [];
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
        return { title: "Active Mowers", description: "Mowers currently in active service", count: (mowers || []).filter(m => m.status === 'active').length };
      case 'maintenance':
        return { title: "Mowers in Maintenance", description: "Mowers currently undergoing maintenance", count: (mowers || []).filter(m => m.status === 'maintenance').length };
      case 'retired':
        return { title: "Retired Mowers", description: "Mowers that are no longer in service", count: (mowers || []).filter(m => m.status === 'retired').length };
      case 'upcoming-services':
        const upcomingCount = (mowers || []).filter(m => {
          if (!m.nextServiceDate) return false;
          const nextServiceDate = new Date(m.nextServiceDate);
          const today = new Date();
          const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
          return nextServiceDate >= today && nextServiceDate <= thirtyDaysFromNow;
        }).length;
        return { title: "Upcoming Services", description: "Mowers with services scheduled within 30 days", count: upcomingCount };
      case 'overdue-services':
        const overdueCount = (mowers || []).filter(m => {
          if (!m.nextServiceDate) return false;
          const nextServiceDate = new Date(m.nextServiceDate);
          const today = new Date();
          return nextServiceDate < today;
        }).length;
        return { title: "Overdue Services", description: "Mowers with overdue maintenance", count: overdueCount };
      case 'all':
      default:
        return { title: "All Mowers", description: "Complete list of your mower fleet", count: mowers?.length || 0 };
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
              id={String(mower.id)}
              make={mower.make}
              model={mower.model}
              year={mower.year ?? undefined}
              serialNumber={mower.serialNumber ?? undefined}
              condition={mower.condition as "excellent" | "good" | "fair" | "poor"}
              status={mower.status as "active" | "maintenance" | "retired"}
              attachmentCount={0} // TODO: Fetch real attachment count from API
              thumbnailUrl={thumbnails?.[mower.id.toString()]}
              lastService={mower.lastServiceDate ? new Date(mower.lastServiceDate).toLocaleDateString() : "No service recorded"}
              nextService={mower.nextServiceDate ? new Date(mower.nextServiceDate).toLocaleDateString() : "Not scheduled"}
              onViewDetails={handleViewDetails}
              onEdit={handleEdit}
              onAddService={handleAddService}
              onDelete={() => {}} // No delete functionality on MowerList page
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