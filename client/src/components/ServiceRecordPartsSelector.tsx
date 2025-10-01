import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import type { Part, Engine } from "@shared/schema";

export interface ServiceRecordPart {
  partId: number;
  quantity: number;
  engineId?: number | null;
}

interface ServiceRecordPartsSelectorProps {
  mowerId: string;
  parts: ServiceRecordPart[];
  onPartsChange: (parts: ServiceRecordPart[]) => void;
  onCostChange: (totalCost: number) => void;
}

export default function ServiceRecordPartsSelector({
  mowerId,
  parts,
  onPartsChange,
  onCostChange,
}: ServiceRecordPartsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch available parts
  const { data: availableParts = [] } = useQuery<Part[]>({
    queryKey: ['/api/parts'],
  });

  // Fetch engines for this mower
  const { data: engines = [] } = useQuery<Engine[]>({
    queryKey: ['/api/mowers', mowerId, 'engines'],
    enabled: !!mowerId,
  });

  // Filter parts by search query
  const filteredParts = availableParts.filter((part) =>
    part.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    part.partNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total cost whenever parts change
  useEffect(() => {
    const totalCost = parts.reduce((sum, servicePart) => {
      const part = availableParts.find(p => p.id === servicePart.partId);
      if (part?.unitCost) {
        return sum + (parseFloat(part.unitCost) * servicePart.quantity);
      }
      return sum;
    }, 0);
    onCostChange(totalCost);
  }, [parts, availableParts, onCostChange]);

  const addPart = () => {
    onPartsChange([...parts, { partId: 0, quantity: 1, engineId: null }]);
  };

  const removePart = (index: number) => {
    onPartsChange(parts.filter((_, i) => i !== index));
  };

  const updatePart = (index: number, updates: Partial<ServiceRecordPart>) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], ...updates };
    onPartsChange(newParts);
  };

  const getPartDetails = (partId: number) => {
    return availableParts.find(p => p.id === partId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parts Used</CardTitle>
        <CardDescription>
          Select parts used during this service. Costs will be automatically calculated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {parts.map((servicePart, index) => {
          const part = getPartDetails(servicePart.partId);
          return (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Part {index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePart(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Part Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Part</label>
                <Input
                  type="text"
                  placeholder="Search parts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <Select
                  value={servicePart.partId ? servicePart.partId.toString() : ""}
                  onValueChange={(value) => updatePart(index, { partId: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a part" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredParts.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No parts found
                      </div>
                    ) : (
                      filteredParts.map((part) => (
                        <SelectItem key={part.id} value={part.id.toString()}>
                          <div className="flex flex-col items-start">
                            <div className="flex justify-between w-full">
                              <span className="font-medium">{part.name}</span>
                              <span className="text-muted-foreground ml-2">#{part.partNumber}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {part.unitCost && `$${parseFloat(part.unitCost).toFixed(2)}`}
                              {part.unitCost && " • "}
                              Stock: {part.stockQuantity}
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Show selected part info */}
              {part && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{part.name}</p>
                  <p className="text-muted-foreground">
                    Part #: {part.partNumber} | Category: {part.category}
                    {part.unitCost && ` | Unit Cost: $${parseFloat(part.unitCost).toFixed(2)}`}
                  </p>
                </div>
              )}

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={servicePart.quantity}
                    onChange={(e) => updatePart(index, { quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                {/* Allocate to Engine (optional) */}
                {engines.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Allocate to Engine (Optional)</label>
                    <Select
                      value={servicePart.engineId ? servicePart.engineId.toString() : "none"}
                      onValueChange={(value) => {
                        if (value === "none") {
                          updatePart(index, { engineId: null });
                        } else {
                          updatePart(index, { engineId: parseInt(value) });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Mower (not engine)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Mower (not engine)</SelectItem>
                        {engines.map((engine) => (
                          <SelectItem key={engine.id} value={engine.id.toString()}>
                            {engine.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Show calculated cost for this part */}
              {part?.unitCost && (
                <div className="pt-2 border-t">
                  <p className="text-sm font-medium">
                    Subtotal: ${(parseFloat(part.unitCost) * servicePart.quantity).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={addPart}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Part
        </Button>
      </CardContent>
    </Card>
  );
}
