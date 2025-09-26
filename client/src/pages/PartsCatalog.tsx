import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Package, Wrench, Edit, Trash2, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import EngineFormModal from "@/components/EngineFormModal";
import PartFormModal from "@/components/PartFormModal";
import type { Part, Engine } from "@shared/schema";

export default function PartsCatalog() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { toast } = useToast();

  // Modal states
  const [showPartModal, setShowPartModal] = useState(false);
  const [showEngineModal, setShowEngineModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editingEngine, setEditingEngine] = useState<Engine | null>(null);
  const [showDeletePartDialog, setShowDeletePartDialog] = useState(false);
  const [showDeleteEngineDialog, setShowDeleteEngineDialog] = useState(false);
  const [partToDelete, setPartToDelete] = useState<Part | null>(null);
  const [engineToDelete, setEngineToDelete] = useState<Engine | null>(null);

  // Fetch all parts for inventory management
  const { data: parts = [], isLoading: isPartsLoading } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  // Fetch all engines for management
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
        description: error.message || "Failed to delete engine", 
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

  const handleEditEngine = (engine: Engine) => {
    setEditingEngine(engine);
    setShowEngineModal(true);
  };

  const handleDeleteEngine = (engine: Engine) => {
    setEngineToDelete(engine);
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
          <h1 className="text-3xl font-bold tracking-tight">Parts & Engines Catalog</h1>
          <p className="text-muted-foreground">
            Manage your inventory and component database
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddEngine}>
            <Wrench className="h-4 w-4 mr-2" />
            Add Engine Type
          </Button>
          <Button onClick={handleAddPart}>
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockParts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alert ({lowStockParts.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockParts.map(part => (
                <div key={part.id} className="text-sm">
                  <span className="font-medium">{part.name}</span> - 
                  <span className="text-amber-700 ml-1">
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParts.map((part) => (
                <Card key={part.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader onClick={() => handleViewPartDetails(part.id)}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{part.name}</CardTitle>
                      <div className="flex items-center gap-1">
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
                  <CardContent onClick={() => handleViewPartDetails(part.id)}>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Part Number:</span>
                        <span className="font-mono">{part.partNumber}</span>
                      </div>
                      {part.manufacturer && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Manufacturer:</span>
                          <span>{part.manufacturer}</span>
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
                        <p className="text-sm text-muted-foreground mt-2">{part.description}</p>
                      )}
                    </div>
                  </CardContent>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allEngines.map((engine) => (
                <Card key={engine.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader onClick={() => handleViewEngineDetails(engine.id)}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{engine.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEngine(engine);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEngine(engine);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent onClick={() => handleViewEngineDetails(engine.id)}>
                    <div className="space-y-2">
                      {engine.partNumber && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Part Number:</span>
                          <span className="font-mono">{engine.partNumber}</span>
                        </div>
                      )}
                      {engine.manufacturer && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Manufacturer:</span>
                          <span>{engine.manufacturer}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={engine.status === 'active' ? 'default' : 'secondary'}>
                          {engine.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Condition:</span>
                        <Badge variant="outline">{engine.condition}</Badge>
                      </div>
                      {engine.cost && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-medium">${engine.cost}</span>
                        </div>
                      )}
                      {engine.description && (
                        <p className="text-sm text-muted-foreground mt-2">{engine.description}</p>
                      )}
                    </div>
                  </CardContent>
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
        mowerId={null} // Global engine type
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
              Are you sure you want to delete the engine "{engineToDelete?.name}"? This action cannot be undone and will also remove any allocations of this engine.
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
              onClick={() => engineToDelete && deleteEngineMutation.mutate(engineToDelete.id)}
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