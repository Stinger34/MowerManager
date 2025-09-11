# Lawn Mower Asset Tracker

## Overview

The Lawn Mower Asset Tracker is a comprehensive fleet management application designed for tracking and managing lawn mower assets. The system enables users to maintain detailed records of their lawn mower fleet, including asset information, service history, task management, and file attachments. Built as a modern web application, it provides a dashboard-style interface optimized for asset management workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The client-side is built using React with TypeScript, leveraging a modern component-based architecture. The UI framework is based on shadcn/ui components with Radix UI primitives, providing a consistent and accessible design system. The application uses Wouter for lightweight routing and TanStack Query for server state management and API communication. Styling is implemented with Tailwind CSS following a utility-first approach with custom design tokens for colors, spacing, and typography.

### Backend Architecture
The server is built with Express.js and TypeScript, following a REST API pattern. The application uses a modular approach with separate route handlers for different entity types (mowers, tasks, service records). Database operations are abstracted through a storage interface, currently implemented with an in-memory storage class but designed to be easily swapped with persistent storage solutions.

### Data Storage Solutions
The application is configured to use PostgreSQL as the primary database, accessed through Drizzle ORM for type-safe database operations. The schema defines four main entities: mowers (primary assets), service records (maintenance history), attachments (file management), and tasks (work items). Database configuration supports Neon serverless PostgreSQL with connection pooling for production environments.

### Authentication and Authorization
Currently, the application does not implement authentication mechanisms, but the architecture includes session management configuration using connect-pg-simple for PostgreSQL-backed sessions, indicating preparation for future user authentication features.

### Design System and UI Components
The application follows a utility-focused design system approach with professional dashboard styling. It implements both light and dark theme support through a custom theme provider. The color palette uses professional blues and grays with HSL color space for consistent theming. Typography is based on Inter font family for optimal readability in data-heavy interfaces. The component library includes specialized components for asset management like AssetCard, ServiceHistoryTable, TaskList, and AttachmentGallery.

### File Management Architecture
The system includes infrastructure for file attachment management through Dropbox integration, enabling users to upload and manage documents, images, and other files associated with their mowers. The attachment system supports categorization by file type and includes metadata tracking for file size, upload dates, and descriptions.

## External Dependencies

- **Database**: PostgreSQL via Neon serverless with connection pooling
- **ORM**: Drizzle ORM for type-safe database operations and schema management
- **File Storage**: Dropbox API integration for attachment management
- **UI Framework**: Radix UI primitives for accessible component foundation
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono) for typography
- **Development**: Vite for build tooling and development server
- **State Management**: TanStack Query for server state and API caching
- **Form Management**: React Hook Form with Zod validation
- **Date Utilities**: date-fns for date manipulation and formatting