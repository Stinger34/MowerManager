import { useState } from "react";
import DashboardStats from "@/components/DashboardStats";
import AssetCard from "@/components/AssetCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Mower } from "@shared/schema";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: mowers, isLoading, error } = useQuery<Mower[]>({
    queryKey: ['/api/mowers'],
  });

  const filteredMowers = (mowers || []).filter(mower =>
    `${mower.make} ${mower.model}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mower.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingServices = (mowers || []).filter(m => {
    if (!m.nextServiceDate) return false;
    const nextServiceDate = new Date(m.nextServiceDate);
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return nextServiceDate >= today && nextServiceDate <= thirtyDaysFromNow;
  }).length;
  
  const overdueServices = (mowers || []).filter(m => {
    if (!m.nextServiceDate) return false;
    const nextServiceDate = new Date(m.nextServiceDate);
    const today = new Date();
    return nextServiceDate < today;
  }).length;


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
        totalMowers={mowers?.length || 0}
        activeMowers={mowers?.filter(m => m.status === 'active').length || 0}
        maintenanceMowers={mowers?.filter(m => m.status === 'maintenance').length || 0}
        upcomingServices={upcomingServices}
        overdueServices={overdueServices}
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
              id={String(mower.id)}
              attachmentCount={0}
              lastService={mower.lastServiceDate ? new Date(mower.lastServiceDate).toLocaleDateString() : "No service recorded"}
              nextService={mower.nextServiceDate ? new Date(mower.nextServiceDate).toLocaleDateString() : "Not scheduled"}
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