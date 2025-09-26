-- Test data for MowerManager to test unified maintenance page
-- This file contains sample data to demonstrate the maintenance functionality

-- Sample mowers with different statuses
INSERT INTO mowers (make, model, year, serialNumber, condition, status, lastServiceDate, nextServiceDate, notes) VALUES
-- Mowers in maintenance (should appear at top)
('John Deere', 'X350', 2022, 'JD2022001', 'good', 'maintenance', '2024-12-15', NULL, 'Currently undergoing blade replacement'),
('Cub Cadet', 'XT1 LT42', 2021, 'CC2021001', 'fair', 'maintenance', '2024-11-20', NULL, 'Engine repair in progress'),

-- Active mowers with overdue maintenance
('Troy-Bilt', 'TB30R', 2023, 'TB2023001', 'excellent', 'active', '2024-09-01', '2024-12-01', 'Overdue for oil change'),
('Husqvarna', 'YTH24V48', 2020, 'HV2020001', 'good', 'active', '2024-08-15', '2024-11-15', 'Overdue for maintenance'),

-- Active mowers with upcoming maintenance
('Craftsman', 'T210', 2022, 'CM2022001', 'good', 'active', '2024-11-01', '2025-02-01', 'Due soon for service'),
('Ariens', 'Edge 52', 2021, 'AR2021001', 'excellent', 'active', '2024-10-15', '2025-01-15', 'Upcoming maintenance'),

-- Active mowers with no immediate maintenance needs
('Toro', 'TimeCutter', 2023, 'TO2023001', 'good', 'active', '2024-12-01', '2025-03-01', 'Recently serviced');

-- Sample service records
INSERT INTO service_records (mowerId, serviceDate, serviceType, description, cost, performedBy) VALUES
-- For John Deere (in maintenance)
(1, '2024-12-15', 'maintenance', 'Blade replacement and sharpening', 85.00, 'Service Center A'),
(1, '2024-09-15', 'maintenance', 'Oil change and filter replacement', 45.00, 'Service Center A'),

-- For Cub Cadet (in maintenance)  
(2, '2024-11-20', 'repair', 'Engine diagnostic and repair', 250.00, 'Engine Specialists'),
(2, '2024-08-10', 'maintenance', 'Regular maintenance service', 60.00, 'Service Center B'),

-- For Troy-Bilt (overdue)
(3, '2024-09-01', 'maintenance', 'Oil change and inspection', 40.00, 'Self'),

-- For Husqvarna (overdue)
(4, '2024-08-15', 'maintenance', 'Seasonal maintenance', 75.00, 'Service Center A'),

-- For Craftsman (upcoming)
(5, '2024-11-01', 'maintenance', 'Fall maintenance service', 55.00, 'Service Center B'),

-- For Ariens (upcoming)
(6, '2024-10-15', 'maintenance', 'Oil change and blade service', 65.00, 'Local Mechanic'),

-- For Toro (recently serviced)
(7, '2024-12-01', 'maintenance', 'Complete winter prep service', 95.00, 'Service Center A');