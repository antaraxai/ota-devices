# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React + TypeScript + Vite)
- `npm run dev` - Start development server with Vite
- `npm run build` - Build for production
- `npm run lint` - Run ESLint for code quality checks
- `npm run preview` - Preview built application

### Backend Python Services
- `npm run server` - Start Node.js Express server (src/server.ts)
- Python services are in `/python/` directory, run with `python app.py` or specific controller scripts

## Architecture Overview

This is an OTA (Over-The-Air) device management platform with a hybrid architecture:

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling and development server
- **Tailwind CSS** for styling
- **React Router** for client-side routing
- **Supabase** for authentication and real-time database

### Key Frontend Components
- **Context Architecture**: Uses React contexts for state management
  - `AuthContext` - User authentication and session management
  - `DeviceContext` - Device CRUD operations and script generation
  - `NotificationContext` - Real-time notifications
- **Main Views**: Dashboard with card/table view toggle for device management
- **Device Scripts**: Generates and downloads customized Python scripts for devices

### Backend Services
- **Node.js Express Server** (`src/server.ts`) - API middleware
- **Python Flask Services** (`python/modular-version/v0.1/`) - Device controllers
  - Modular architecture with separate managers for connections, files, and OTA operations
  - GitLab integration for device script management
  - Device workspace management with UUID-based isolation

### Database & Storage
- **Supabase** - PostgreSQL database with real-time subscriptions
- **Supabase Storage** - File storage for device scripts
- Database tables: `devices` table with device management and token-based authentication

### Device Integration
- Devices run generated Python scripts that connect back to the platform
- Each device has a unique token for secure communication
- Support for both GitHub and GitLab repository integrations
- Device status tracking: `AWAITING_CONNECTION`, `CONNECTED`, `FAILED`

## Development Workflow

### Adding New Device Features
1. Update TypeScript types in `src/types/device.ts` 
2. Modify `DeviceContext` for new operations
3. Update UI components in `src/components/`
4. Test with Python device scripts in `python/` directory

### Device Script Templates
- Located in `src/templates/` directory
- Templates are dynamically populated with device-specific tokens and IDs
- Scripts handle OTA updates and maintain connection with the platform

### Real-time Features
- Uses Supabase real-time subscriptions for live device status updates
- Notification system for device script updates from repositories
- Live dashboard updates without page refresh

## Configuration
- Environment variables handled through Vite (VITE_* prefix)
- Supabase configuration required: URL, anon key, and service role key
- Docker support with separate frontend and backend containers