import DashboardStats from '../DashboardStats';

export default function DashboardStatsExample() {
  // todo: remove mock functionality
  return (
    <div className="p-6">
      <DashboardStats
        totalMowers={12}
        activeMowers={9}
        maintenanceMowers={2}
        upcomingServices={5}
        overdueServices={1}
      />
    </div>
  );
}