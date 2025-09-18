import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Package, Wrench, Edit, Trash2, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import type { Part, Component } from "@shared/schema";

export default function PartsCatalog() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch all parts for inventory management
  const { data: parts = [], isLoading: isPartsLoading } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  // Fetch all components for management
  const { data: allComponents = [], isLoading: isComponentsLoading } = useQuery<Component[]>({
    queryKey: ['/api/components'],
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parts & Components Catalog</h1>
          <p className="text-muted-foreground">
            Manage your inventory and component database
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocation('/catalog/components/new')}>
            <Wrench className="h-4 w-4 mr-2" />
            Add Component Type
          </Button>
          <Button onClick={() => setLocation('/catalog/parts/new')}>
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
          <TabsTrigger value="components">
            <Wrench className="h-4 w-4 mr-2" />
            Component Types ({allComponents.length})
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
                <Card key={part.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{part.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
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

        <TabsContent value="components" className="space-y-4">
          {/* Components Grid */}
          {isComponentsLoading ? (
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
              {allComponents.map((component) => (
                <Card key={component.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{component.name}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {component.partNumber && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Part Number:</span>
                          <span className="font-mono">{component.partNumber}</span>
                        </div>
                      )}
                      {component.manufacturer && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Manufacturer:</span>
                          <span>{component.manufacturer}</span>
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
                        <p className="text-sm text-muted-foreground mt-2">{component.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {allComponents.length === 0 && !isComponentsLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No component types defined yet</p>
              <p className="text-sm">Add component types to organize your mower components</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}