import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Package, Wrench, Edit, Trash2, AlertTriangle, ImageOff } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAssetEventsRefresh } from "@/hooks/useAssetEventsRefresh";
import { usePartThumbnail, useEngineThumbnail } from "@/hooks/useThumbnails";
import EngineFormModal from "@/components/EngineFormModal";
import PartFormModal from "@/components/PartFormModal";
import type { Part, Engine } from "@shared/schema";

// Helper component for rendering part thumbnail with fallback
function PartThumbnailImage({ partId, partName, onClick }: { partId: number; partName: string; onClick: () => void }) {
  const { data: thumbnail, isLoading } = usePartThumbnail(partId);
  
  if (isLoading) {
    return (
      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md bg-muted animate-pulse" />
    );
  }
  
  if (!thumbnail) {
    return (
      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors" onClick={onClick}>
        <ImageOff className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    );
  }
  
  return (
    <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md">
      <img 
        src={thumbnail.downloadUrl}
        alt={partName}
        className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
        onClick={onClick}
        onError={(e) => {
          // Replace with placeholder on error
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted"><svg class="h-8 w-8 text-muted-foreground opacity-50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg></div>';
          }
        }}
      />
    </div>
  );
}

// Helper component for rendering engine thumbnail with fallback
function EngineThumbnailImage({ engineId, engineName, onClick }: { engineId: number; engineName: string; onClick: () => void }) {
  const { data: thumbnail, isLoading } = useEngineThumbnail(engineId);
  
  if (isLoading) {
    return (
      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md bg-muted animate-pulse" />
    );
  }
  
  if (!thumbnail) {
    return (
      <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors" onClick={onClick}>
        <ImageOff className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>
    );
  }
  
  return (
    <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md">
      <img 
        src={thumbnail.downloadUrl}
        alt={engineName}
        className="w-full h-full object-cover transition-transform duration-200 hover:scale-105"
        onClick={onClick}
        onError={(e) => {
          // Replace with placeholder on error
          const parent = e.currentTarget.parentElement;
          if (parent) {
            parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted"><svg class="h-8 w-8 text-muted-foreground opacity-50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M10.41 10.41a2 2 0 1 1-2.83-2.83"/><line x1="13.5" x2="6" y1="13.5" y2="21"/><line x1="18" x2="21" y1="12" y2="15"/><path d="M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59"/><path d="M21 15V5a2 2 0 0 0-2-2H9"/></svg></div>';
          }
        }}
      />
    </div>
  );
}

export default function PartsCatalog() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  // Initialize WebSocket for auto-refresh
  const { isConnected: wsConnected, error: wsError } = useAssetEventsRefresh();

  // Modal states
  const [showPartModal, setShowPartModal] = useState(false);
  const [showEngineModal, setShowEngineModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editingEngine, setEditingEngine] = useState<Engine | null>(null);
  const [showDeletePartDialog, setShowDeletePartDialog] = useState(false);
  const [showDeleteEngineDialog, setShowDeleteEngineDialog] = useState(false);
  const [partToDelete, setPartToDelete] = useState<Part | null>(null);
  const [componentToDelete, setEngineToDelete] = useState<Engine | null>(null);

  // Fetch all parts for inventory management
  const { data: parts = [], isLoading: isPartsLoading } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  // Fetch all components for management
  const { data: allEngines = [], isLoading: isEnginesLoading } = useQuery<Engine[]>({
    queryKey: ['/api/engines'],
  });

  // Delete mutations
  const deletePartMutation = useMutation({
    mutationFn: async (partId: number) => {
      await apiRequest('DELETE', `/api/parts/${partId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
      toast({ title: "Success", description: "Part deleted successfully" });
      setShowDeletePartDialog(false);
      setPartToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete part", 
        variant: "destructive" 
      });
    },
  });

  const deleteEngineMutation = useMutation({
    mutationFn: async (engineId: number) => {
      await apiRequest('DELETE', `/api/engines/${engineId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
      toast({ title: "Success", description: "Engine deleted successfully" });
      setShowDeleteEngineDialog(false);
      setEngineToDelete(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete component", 
        variant: "destructive" 
      });
    },
  });

  // Filter parts based on search and category
  const filteredParts = parts.filter(part => {
    const matchesSearch = part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         part.partNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (part.manufacturer || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || part.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from parts
  const categories = Array.from(new Set(parts.map(part => part.category)));

  // Calculate low stock parts
  const lowStockParts = parts.filter(part => 
    part.minStockLevel && part.stockQuantity <= part.minStockLevel
  );

  // Handlers
  const handleAddPart = () => {
    setEditingPart(null);
    setShowPartModal(true);
  };

  const handleEditPart = (part: Part) => {
    setEditingPart(part);
    setShowPartModal(true);
  };

  const handleDeletePart = (part: Part) => {
    setPartToDelete(part);
    setShowDeletePartDialog(true);
  };

  const handleAddEngine = () => {
    setEditingEngine(null);
    setShowEngineModal(true);
  };

  const handleEditEngine = (component: Engine) => {
    setEditingEngine(component);
    setShowEngineModal(true);
  };

  const handleDeleteEngine = (component: Engine) => {
    setEngineToDelete(component);
    setShowDeleteEngineDialog(true);
  };

  const handleViewPartDetails = (partId: number) => {
    setLocation(`/catalog/parts/${partId}`);
  };

  const handleViewEngineDetails = (engineId: number) => {
    setLocation(`/catalog/engines/${engineId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-dark">Parts & Engine Catalog</h1>
          <p className="text-text-muted">
            Manage your inventory and engine database
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddEngine} className="border-panel-border rounded-button">
            <Wrench className="h-4 w-4 mr-2" />
            Add Engine Type
          </Button>
          <Button onClick={handleAddPart} className="bg-accent-teal text-white hover:bg-accent-teal/90 rounded-button">
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockParts.length > 0 && (
        <Card className="border-accent-orange/20 bg-accent-orange/10 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent-orange">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert ({lowStockParts.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockParts.map(part => (
                <div key={part.id} className="text-sm">
                  <span className="font-medium text-text-primary">{part.name}</span> - 
                  <span className="text-accent-orange ml-1">
                    {part.stockQuantity} left (min: {part.minStockLevel})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="parts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="parts">
            <Package className="h-4 w-4 mr-2" />
            Parts Inventory ({parts.length})
          </TabsTrigger>
          <TabsTrigger value="engines">
            <Wrench className="h-4 w-4 mr-2" />
            Engine Types ({allEngines.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted h-4 w-4" />
              <Input
                placeholder="Search parts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Parts Grid */}
          {isPartsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-1/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredParts.map((part) => (
                <Card key={part.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    <PartThumbnailImage partId={part.id} partName={part.name} onClick={() => handleViewPartDetails(part.id)} />
                    <div className="flex-1 min-w-0">
                      <CardHeader className="p-0 pb-3" onClick={() => handleViewPartDetails(part.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg leading-tight">{part.name}</CardTitle>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPart(part);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePart(part);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0" onClick={() => handleViewPartDetails(part.id)}>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Part Number:</span>
                            <span className="font-mono text-xs">{part.partNumber}</span>
                          </div>
                          {part.manufacturer && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Manufacturer:</span>
                              <span className="truncate ml-2">{part.manufacturer}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Category:</span>
                            <Badge variant="secondary">{part.category}</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Stock:</span>
                            <span className={`font-medium ${
                              part.minStockLevel && part.stockQuantity <= part.minStockLevel 
                                ? 'text-amber-600' 
                                : 'text-green-600'
                            }`}>
                              {part.stockQuantity} units
                            </span>
                          </div>
                          {part.unitCost && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Unit Cost:</span>
                              <span className="font-medium">${part.unitCost}</span>
                            </div>
                          )}
                          {part.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{part.description}</p>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {filteredParts.length === 0 && !isPartsLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No parts found matching your criteria</p>
              <p className="text-sm">Try adjusting your search or category filter</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="engines" className="space-y-4">
          {/* Engines Grid */}
          {isEnginesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                      <div className="h-3 bg-muted rounded w-1/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allEngines.map((component) => (
                <Card key={component.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex gap-4 p-4">
                    <EngineThumbnailImage engineId={component.id} engineName={component.name} onClick={() => handleViewEngineDetails(component.id)} />
                    <div className="flex-1 min-w-0">
                      <CardHeader className="p-0 pb-3" onClick={() => handleViewEngineDetails(component.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg leading-tight">{component.name}</CardTitle>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditEngine(component);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEngine(component);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0" onClick={() => handleViewEngineDetails(component.id)}>
                        <div className="space-y-2">
                          {component.partNumber && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Part Number:</span>
                              <span className="font-mono text-xs">{component.partNumber}</span>
                            </div>
                          )}
                          {component.manufacturer && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Manufacturer:</span>
                              <span className="truncate ml-2">{component.manufacturer}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={component.status === 'active' ? 'default' : 'secondary'}>
                              {component.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Condition:</span>
                            <Badge variant="outline">{component.condition}</Badge>
                          </div>
                          {component.cost && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Cost:</span>
                              <span className="font-medium">${component.cost}</span>
                            </div>
                          )}
                          {component.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{component.description}</p>
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {allEngines.length === 0 && !isEnginesLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No engine types defined yet</p>
              <p className="text-sm">Add engine types to organize your mower engines</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Part Form Modal */}
      <PartFormModal
        isOpen={showPartModal}
        onClose={() => {
          setShowPartModal(false);
          setEditingPart(null);
        }}
        part={editingPart}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/parts'] });
        }}
      />

      {/* Engine Form Modal */}
      <EngineFormModal
        isOpen={showEngineModal}
        onClose={() => {
          setShowEngineModal(false);
          setEditingEngine(null);
        }}
        mowerId={null} // Global component type
        engine={editingEngine}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/engines'] });
        }}
      />

      {/* Delete Part Confirmation Dialog */}
      <AlertDialog open={showDeletePartDialog} onOpenChange={setShowDeletePartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Part</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the part "{partToDelete?.name}"? This action cannot be undone and will also remove any allocations of this part.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeletePartDialog(false);
              setPartToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => partToDelete && deletePartMutation.mutate(partToDelete.id)}
              disabled={deletePartMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePartMutation.isPending ? "Deleting..." : "Delete Part"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Engine Confirmation Dialog */}
      <AlertDialog open={showDeleteEngineDialog} onOpenChange={setShowDeleteEngineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Engine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the engine "{componentToDelete?.name}"? This action cannot be undone and will also remove any allocations of this engine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteEngineDialog(false);
              setEngineToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => componentToDelete && deleteEngineMutation.mutate(componentToDelete.id)}
              disabled={deleteEngineMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEngineMutation.isPending ? "Deleting..." : "Delete Engine"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}