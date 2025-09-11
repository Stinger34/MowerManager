import AssetCard from '../AssetCard';

export default function AssetCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <AssetCard
        id="1"
        make="John Deere"
        model="X350"
        year={2022}
        serialNumber="JD123456"
        condition="excellent"
        status="active"
        lastService="Dec 15, 2024"
        nextService="Mar 15, 2025"
        attachmentCount={3}
        onViewDetails={(id) => console.log('View details for mower:', id)}
        onEdit={(id) => console.log('Edit mower:', id)}
        onAddService={(id) => console.log('Add service for mower:', id)}
      />
      <AssetCard
        id="2"
        make="Cub Cadet"
        model="XT1 LT42"
        year={2021}
        serialNumber="CC789012"
        condition="good"
        status="maintenance"
        lastService="Nov 20, 2024"
        nextService="Jan 20, 2025"
        attachmentCount={1}
        onViewDetails={(id) => console.log('View details for mower:', id)}
        onEdit={(id) => console.log('Edit mower:', id)}
        onAddService={(id) => console.log('Add service for mower:', id)}
      />
      <AssetCard
        id="3"
        make="Troy-Bilt"
        model="TB30R"
        year={2019}
        serialNumber="TB345678"
        condition="fair"
        status="active"
        lastService="Oct 5, 2024"
        nextService="Apr 5, 2025"
        attachmentCount={0}
        onViewDetails={(id) => console.log('View details for mower:', id)}
        onEdit={(id) => console.log('Edit mower:', id)}
        onAddService={(id) => console.log('Add service for mower:', id)}
      />
    </div>
  );
}