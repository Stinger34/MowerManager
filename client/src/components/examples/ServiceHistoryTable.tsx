import ServiceHistoryTable from '../ServiceHistoryTable';

export default function ServiceHistoryTableExample() {
  // todo: remove mock functionality
  const mockServiceRecords = [
    {
      id: "1",
      serviceDate: "Dec 15, 2024",
      serviceType: "maintenance" as const,
      description: "Oil change, air filter replacement, blade sharpening",
      cost: "$85.00",
      performedBy: "Mike's Lawn Service",
      nextServiceDue: "Mar 15, 2025",
      mileage: 45
    },
    {
      id: "2", 
      serviceDate: "Sep 10, 2024",
      serviceType: "repair" as const,
      description: "Carburetor cleaning and adjustment",
      cost: "$120.00",
      performedBy: "John's Small Engine Repair",
      mileage: 42
    },
    {
      id: "3",
      serviceDate: "Jun 5, 2024",
      serviceType: "inspection" as const,
      description: "Annual safety inspection",
      cost: "$35.00",
      performedBy: "Certified Inspector",
      mileage: 38
    }
  ];

  return (
    <div className="p-6">
      <ServiceHistoryTable
        serviceRecords={mockServiceRecords}
        onAddService={() => console.log('Add service record')}
        onEditService={(id) => console.log('Edit service record:', id)}
      />
    </div>
  );
}