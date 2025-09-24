# WebSocket Auto-Refresh Implementation

This document describes the WebSocket-based auto-refresh functionality implemented in the MowerManager application.

## Overview

The WebSocket implementation provides real-time data synchronization between the backend and frontend, automatically refreshing relevant UI components when asset-related operations occur on the server.

## Architecture

### Backend (Server-side)

#### WebSocket Server (`server/websocketService.ts`)
- **Location**: `/ws` endpoint
- **Technology**: `ws` package (already in dependencies)
- **Features**:
  - Connection management with automatic cleanup
  - Message broadcasting to all connected clients
  - Error handling and connection monitoring
  - Support for multiple concurrent clients

#### Message Broadcasting
WebSocket messages are automatically broadcast for the following operations:
- **Mower operations**: Create, update, delete
- **Task operations**: Create, update, delete
- **Service record operations**: Create, update, delete
- **Component operations**: Create, update, delete
- **Part operations**: Create, update, delete
- **Asset-part operations**: Create, update, delete

#### Message Format
```typescript
interface WebSocketMessage {
  type: 'asset-created' | 'asset-updated' | 'asset-deleted' | 'service-created' | 'service-updated' | 'service-deleted' | 'task-created' | 'task-updated' | 'task-deleted' | 'component-created' | 'component-updated' | 'component-deleted' | 'part-created' | 'part-updated' | 'part-deleted' | 'asset-part-created' | 'asset-part-updated' | 'asset-part-deleted' | 'connection';
  data: {
    id: string | number;
    entityType: 'mower' | 'component' | 'part' | 'asset-part' | 'task' | 'service-record';
    mowerId?: string | number;
    componentId?: string | number;
    [key: string]: any;
  };
  timestamp: string;
}
```

### Frontend (Client-side)

#### WebSocket Client Hook (`client/src/hooks/useWebSocket.ts`)
Provides two main hooks:

1. **`useWebSocket(options)`** - Full-featured WebSocket client with:
   - Connection state management
   - Auto-reconnection with exponential backoff
   - Custom message handlers
   - Error handling
   - Connection status indicators

2. **`useWebSocketAutoRefresh()`** - Simplified hook for auto-refresh functionality:
   - Automatically connects to WebSocket server
   - Listens for asset-related events
   - Triggers React Query cache invalidation
   - Provides connection status

#### Auto-Refresh Logic
When WebSocket messages are received, the client automatically invalidates relevant React Query cache entries:

- **Asset events** → Invalidates `/api/mowers` queries
- **Task events** → Invalidates mower-specific task queries
- **Service events** → Invalidates service records and mower data
- **Component events** → Invalidates component queries
- **Part events** → Invalidates part-related queries

## Integration Points

### Pages with WebSocket Auto-Refresh

1. **Dashboard** (`client/src/pages/Dashboard.tsx`)
   - Real-time updates for mower statistics
   - Instant refresh of asset cards
   - Live updates to maintenance reminders

2. **MowerDetails** (`client/src/pages/MowerDetails.tsx`)
   - Real-time updates for mower information
   - Live refresh of tasks, parts, and service records
   - Instant updates when related components change

### API Endpoints with WebSocket Broadcasting

The following API endpoints now broadcast WebSocket messages:

- `POST /api/mowers` - Broadcasts `asset-created`
- `PUT /api/mowers/:id` - Broadcasts `asset-updated`
- `DELETE /api/mowers/:id` - Broadcasts `asset-deleted`
- `POST /api/mowers/:mowerId/tasks` - Broadcasts `task-created`
- `POST /api/mowers/:id/service` - Broadcasts `service-created`
- `POST /api/components` - Broadcasts `component-created`
- `POST /api/asset-parts` - Broadcasts `asset-part-created`
- `DELETE /api/asset-parts/:id` - Broadcasts `asset-part-deleted`

## Benefits

### User Experience
- **Instant Updates**: Changes are reflected immediately across all connected clients
- **Multi-User Support**: Multiple users can work simultaneously with real-time synchronization
- **Improved Responsiveness**: No need to manually refresh pages to see changes

### Technical Benefits
- **Efficient**: Only invalidates relevant queries, not entire page reloads
- **Compatible**: Works alongside existing mutation-based refresh logic
- **Extensible**: Easy to add WebSocket support to new pages and operations
- **Reliable**: Includes error handling and automatic reconnection

## Configuration

### WebSocket Connection
- **Development**: `ws://localhost:5000/ws`
- **Production**: `wss://yourdomain.com/ws`

### Connection Management
- **Auto-reconnect**: Enabled by default
- **Max reconnection attempts**: 10
- **Reconnection interval**: 3 seconds
- **Connection timeout**: 30 seconds

## Error Handling

### Server-side
- Graceful handling of client disconnections
- Automatic cleanup of closed connections
- Error logging for debugging

### Client-side
- Automatic reconnection on connection loss
- Exponential backoff for failed connections
- Error state management in UI
- Fallback to manual refresh if WebSocket fails

## Testing

### Verification Steps
1. Open multiple browser tabs/windows to the Dashboard
2. Create, update, or delete a mower in one tab
3. Verify that changes appear instantly in all other tabs
4. Check browser console for WebSocket connection messages
5. Confirm that server logs show WebSocket broadcasts

### Expected Behavior
- Dashboard statistics update immediately
- Asset cards appear/disappear/update in real-time
- MowerDetails page reflects changes instantly
- No manual page refresh required

## Future Enhancements

### Planned Features
- **User-specific notifications**: Targeted messages for specific users
- **Batch operations**: Optimized broadcasting for multiple changes
- **Connection indicators**: UI indicators for WebSocket connection status
- **Message persistence**: Offline message queue for disconnected clients

### Extensibility
The WebSocket system is designed to be easily extended to other pages and operations:

1. Add WebSocket broadcasts to new API endpoints
2. Import `useWebSocketAutoRefresh()` in new pages
3. Define query invalidation rules for new message types
4. Test real-time updates

## Troubleshooting

### Common Issues

1. **WebSocket connection fails**
   - Check if server is running on correct port
   - Verify firewall settings
   - Check browser console for connection errors

2. **Auto-refresh not working**
   - Verify WebSocket messages are being broadcast (check server logs)
   - Confirm client is receiving messages (check browser console)
   - Ensure query keys match between broadcast and invalidation logic

3. **Multiple connections**
   - Normal behavior during navigation
   - Connections are automatically cleaned up
   - Monitor server logs for connection count

### Debug Information
- **Server logs**: WebSocket connections and broadcasts
- **Browser console**: Connection status and received messages
- **Network tab**: WebSocket connection details
- **React Query DevTools**: Cache invalidation events