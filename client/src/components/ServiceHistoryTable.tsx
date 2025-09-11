import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, DollarSign, User, FileText } from "lucide-react";

interface ServiceRecord {
  id: string;
  serviceDate: string;
  serviceType: "maintenance" | "repair" | "inspection" | "warranty";
  description: string;
  cost?: string;
  performedBy?: string;
  nextServiceDue?: string;
  mileage?: number;
}

interface ServiceHistoryTableProps {
  serviceRecords: ServiceRecord[];
  onAddService: () => void;
  onEditService: (id: string) => void;
}

const serviceTypeColors = {
  maintenance: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  repair: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  inspection: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  warranty: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
};

export default function ServiceHistoryTable({ 
  serviceRecords, 
  onAddService, 
  onEditService 
}: ServiceHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Service History
          </CardTitle>
          <Button onClick={onAddService} data-testid="button-add-service">
            Add Service Record
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {serviceRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No service records yet</p>
            <p className="text-sm">Add the first service record to track maintenance history</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceRecords.map((record) => (
                <TableRow 
                  key={record.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => onEditService(record.id)}
                  data-testid={`row-service-${record.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {record.serviceDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={serviceTypeColors[record.serviceType]}>
                      {record.serviceType.charAt(0).toUpperCase() + record.serviceType.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {record.description}
                  </TableCell>
                  <TableCell>
                    {record.cost && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {record.cost}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.performedBy && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {record.performedBy}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.nextServiceDue && (
                      <div className="text-sm text-muted-foreground">
                        {record.nextServiceDue}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {record.mileage && (
                      <div className="text-sm">
                        {record.mileage}h
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditService(record.id);
                      }}
                      data-testid={`button-edit-service-${record.id}`}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}