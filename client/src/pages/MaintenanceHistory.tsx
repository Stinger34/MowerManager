import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Clock, Wrench, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ServiceRecord, Mower } from "@shared/schema";

const ITEMS_PER_PAGE = 10;

export default function MaintenanceHistory() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all mowers to get mower names
  const { data: mowers } = useQuery<Mower[]>({
    queryKey: ["/api/mowers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/mowers");
      return response.json();
    },
  });

  // Fetch all service records from all mowers
  const { data: allServiceRecords, isLoading } = useQuery<(ServiceRecord & { mowerName: string; technician?: string })[]>({
    queryKey: ["/api/service-records"],
    queryFn: async () => {
      if (!mowers || mowers.length === 0) return [];
      
      // Fetch service records for all mowers
      const recordPromises = mowers.map(async (mower: Mower) => {
        try {
          const response = await apiRequest("GET", `/api/mowers/${mower.id}/service-records`);
          if (!response.ok) return [];
          return response.json();
        } catch {
          return [];
        }
      });
      
      const allRecords = await Promise.all(recordPromises);
      
      // Flatten and add mower info to each record
      return allRecords.flat().map((record: ServiceRecord) => ({
        ...record,
        mowerName: mowers.find((m: Mower) => m.id === record.mowerId)?.make + " " + mowers.find((m: Mower) => m.id === record.mowerId)?.model || "Unknown Mower",
        technician: record.performedBy || undefined // Map performedBy to technician for compatibility
      }));
    },
    enabled: !!mowers && mowers.length > 0,
  });

  // Filter and sort service records
  const filteredAndSortedRecords = useMemo(() => {
    if (!allServiceRecords) return [];

    let filtered = allServiceRecords.filter((record: ServiceRecord & { mowerName: string; technician?: string }) => {
      const matchesSearch = 
        searchQuery === "" ||
        record.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.mowerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.serviceType?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = 
        statusFilter === "all" || 
        (record.serviceDate && new Date(record.serviceDate) <= new Date() ? "completed" : "pending") === statusFilter;

      const matchesType = 
        typeFilter === "all" || 
        record.serviceType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });

    // Sort by service date (newest first)
    return filtered.sort((a: ServiceRecord & { mowerName: string; technician?: string }, b: ServiceRecord & { mowerName: string; technician?: string }) => 
      new Date(b.serviceDate || 0).getTime() - new Date(a.serviceDate || 0).getTime()
    );
  }, [allServiceRecords, searchQuery, statusFilter, typeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusColor = (record: ServiceRecord) => {
    const isCompleted = record.serviceDate && new Date(record.serviceDate) <= new Date();
    return isCompleted 
      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400"
      : "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400";
  };

  const getStatusLabel = (record: ServiceRecord) => {
    const isCompleted = record.serviceDate && new Date(record.serviceDate) <= new Date();
    return isCompleted ? "Completed" : "Pending";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-dark">Maintenance History</h1>
            <p className="text-text-muted">Loading maintenance records...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Maintenance History</h1>
          <p className="text-text-muted">
            Complete maintenance history for all mowers ({filteredAndSortedRecords.length} records)
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-panel border-card-border shadow-card hover:shadow-md hover:border-accent-teal transition-all duration-200">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search maintenance records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
                <SelectItem value="warranty">Warranty</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Records */}
      <Card className="bg-panel border-card-border shadow-card hover:shadow-md hover:border-accent-teal transition-all duration-200">
        <CardHeader>
          <CardTitle className="text-text-primary">Maintenance Records</CardTitle>
          <CardDescription className="text-text-muted">
            Chronological list of all maintenance activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paginatedRecords.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No maintenance records found</p>
              <p className="text-sm">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedRecords.map((record: ServiceRecord & { mowerName: string; technician?: string }) => (
                <div 
                  key={record.id} 
                  className="flex items-center justify-between p-4 border border-card-border rounded-lg hover:bg-accent-card transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent-teal/10 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-accent-teal" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-text-primary">
                          {record.serviceType} - {record.mowerName}
                        </h3>
                        <Badge className={`text-xs ${getStatusColor(record)}`}>
                          {getStatusLabel(record)}
                        </Badge>
                      </div>
                      <p className="text-sm text-text-muted">{record.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {record.serviceDate ? new Date(record.serviceDate).toLocaleDateString() : "No date"}
                        </div>
                        {record.cost && (
                          <div className="flex items-center gap-1">
                            <span>Cost: ${record.cost}</span>
                          </div>
                        )}
                        {record.technician && (
                          <div className="flex items-center gap-1">
                            <span>Tech: {record.technician}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setLocation(`/mowers/${record.mowerId}`)}
                    >
                      View Mower
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-card-border">
              <div className="text-sm text-text-muted">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedRecords.length)} of {filteredAndSortedRecords.length} records
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && <span className="text-text-muted">...</span>}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}