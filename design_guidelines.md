# Mower Manager Design Guidelines

## Design Approach
**Utility-Focused Design System Approach** - Using a professional, dashboard-style interface optimized for asset management workflows. Drawing inspiration from modern productivity tools like Linear and Notion for clean data presentation.

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 220 85% 40% (Professional blue)
- Secondary: 220 15% 20% (Charcoal gray)
- Background: 0 0% 98% (Off-white)
- Surface: 0 0% 100% (Pure white)

**Dark Mode:**
- Primary: 220 85% 60% (Lighter blue for contrast)
- Secondary: 220 15% 80% (Light gray)
- Background: 220 15% 8% (Dark charcoal)
- Surface: 220 15% 12% (Slightly lighter surface)

### Typography
- Primary Font: Inter (Google Fonts) - clean, readable for data
- Headings: 600 weight for hierarchy
- Body: 400 weight for content
- Labels: 500 weight for form elements

### Layout System
- Tailwind spacing units: 2, 4, 6, 8, 12, 16
- Container max-width: 7xl for dashboard views
- Card-based layout with consistent p-6 padding
- Grid system: 12-column responsive layout

### Component Library

**Navigation:**
- Top navigation bar with app logo and user actions
- Sidebar navigation for main sections (Dashboard, Mowers, Service History)

**Data Display:**
- Asset cards with thumbnail, key details, and quick actions
- Table views for service history with sortable columns
- Status badges for maintenance schedules

**Forms:**
- Clean input fields with proper labels
- File upload dropzones with drag-and-drop
- Multi-step form for adding new mowers

**File Management:**
- Thumbnail previews for images
- PDF icons with document names
- Download and view actions

## Key Features Layout

### Dashboard
- Summary cards showing total mowers, upcoming maintenance, recent activity
- Recent mowers grid with 3-4 columns on desktop
- Quick action buttons for adding new assets

### Mower Detail View
- Header with mower photo and key specs
- Tabbed interface: Details, Attachments, Service History
- Attachment gallery with organized file types

### Service History
- Chronological timeline view
- Form for adding new service records
- Filterable by mower and service type

## Visual Hierarchy
- Use consistent card elevation (shadow-sm)
- Clear typography scale (text-sm to text-2xl)
- Strategic use of primary color for CTAs and active states
- Subtle borders (border-gray-200/300) for content separation

## No Hero Image
This is a utility-focused dashboard application without marketing elements or large hero images. The interface prioritizes data density and workflow efficiency over visual impact.