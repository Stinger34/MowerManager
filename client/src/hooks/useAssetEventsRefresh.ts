import { useWebSocket, WebSocketMessage } from './useWebSocket';
import { queryClient } from '@/lib/queryClient';

/**
 * Centralized hook for asset-related WebSocket auto-refresh functionality.
 * This hook provides comprehensive cache invalidation for all asset-related pages and components.
 * 
 * Usage:
 * ```tsx
 * const { isConnected, error, reconnectAttempts } = useAssetEventsRefresh();
 * ```
 * 
 * The hook automatically invalidates React Query cache keys based on WebSocket events:
 * - Mower events: invalidate mower lists, mower details, related components/parts
 * - Component events: invalidate component lists, component details, related mower data
 * - Part events: invalidate part lists, part details, related allocations
 * - Asset-part events: invalidate part allocations for mowers and components
 * - Service events: invalidate service records, mower maintenance data
 * - Task events: invalidate task lists for mowers
 */
export function useAssetEventsRefresh() {
  return useWebSocket({
    onMessage: (message: WebSocketMessage) => {
      handleComprehensiveAutoRefresh(message);
      console.log('Asset events: WebSocket message received:', message.type);
    },
    onConnect: () => {
      console.log('Asset events: WebSocket connected for auto-refresh');
    },
    onError: (error) => {
      console.error('Asset events: WebSocket error:', error);
    },
    onDisconnect: () => {
      console.log('Asset events: WebSocket disconnected');
    },
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });
}

/**
 * Comprehensive auto-refresh handler that invalidates all relevant cache keys
 * based on WebSocket events. This ensures all asset-related pages stay in sync.
 */
function handleComprehensiveAutoRefresh(message: WebSocketMessage) {
  const { type, data } = message;
  const queriesToInvalidate: string[][] = [];

  switch (type) {
    case 'asset-created':
    case 'asset-updated':
    case 'asset-deleted':
      if (data.entityType === 'mower') {
        // Invalidate all mower-related queries
        queriesToInvalidate.push(
          ['/api/mowers'], // Dashboard, MowerList
          ['/api/mowers', data.id.toString()], // MowerDetails
          ['/api/mowers', data.id.toString(), 'components'], // MowerDetails components tab
          ['/api/mowers', data.id.toString(), 'parts'], // MowerDetails parts tab
          ['/api/mowers', data.id.toString(), 'service'], // MowerDetails service history
          ['/api/mowers', data.id.toString(), 'tasks'], // MowerDetails tasks
          ['/api/service-records'] // Dashboard maintenance timeline
        );
      }
      break;

    case 'component-created':
    case 'component-updated':
    case 'component-deleted':
      // Invalidate component-related queries
      queriesToInvalidate.push(
        ['/api/components'], // PartsCatalog components tab
        ['/api/components', data.id.toString()], // ComponentDetails
        ['/api/components', data.id.toString(), 'parts'], // ComponentDetails parts
        ['/api/components', data.id.toString(), 'attachments'] // ComponentDetails attachments
      );
      
      // If component belongs to a mower, invalidate mower data too
      if (data.mowerId) {
        queriesToInvalidate.push(
          ['/api/mowers', data.mowerId.toString(), 'components'], // MowerDetails components tab
          ['/api/mowers', data.mowerId.toString()] // MowerDetails general data
        );
      }
      break;

    case 'part-created':
    case 'part-updated':
    case 'part-deleted':
      // Invalidate part-related queries
      queriesToInvalidate.push(
        ['/api/parts'], // PartsCatalog parts tab
        ['/api/parts', data.id.toString()], // PartDetails
        ['/api/parts', data.id.toString(), 'attachments'] // PartDetails attachments
      );
      break;

    case 'asset-part-created':
    case 'asset-part-updated':
    case 'asset-part-deleted':
      // Invalidate asset-part allocation queries
      if (data.mowerId) {
        queriesToInvalidate.push(
          ['/api/mowers', data.mowerId.toString(), 'parts'], // MowerDetails parts tab
          ['/api/mowers', data.mowerId.toString()] // MowerDetails (may affect status/condition)
        );
      }
      
      if (data.componentId) {
        queriesToInvalidate.push(
          ['/api/components', data.componentId.toString(), 'parts'], // ComponentDetails parts
          ['/api/components', data.componentId.toString()] // ComponentDetails general
        );
      }
      
      // Also invalidate parts catalog to update available quantities
      queriesToInvalidate.push(['/api/parts']);
      break;

    case 'service-created':
    case 'service-updated':
    case 'service-deleted':
      // Invalidate service-related queries
      queriesToInvalidate.push(
        ['/api/service-records'], // Dashboard maintenance timeline, service history
        ['/api/service-records', data.id.toString()] // Specific service record
      );
      
      if (data.mowerId) {
        queriesToInvalidate.push(
          ['/api/mowers', data.mowerId.toString()], // MowerDetails (affects last/next service dates)
          ['/api/mowers', data.mowerId.toString(), 'service'], // MowerDetails service history
          ['/api/mowers'] // Dashboard (affects service status)
        );
      }
      break;

    case 'task-created':
    case 'task-updated':
    case 'task-deleted':
      // Invalidate task-related queries
      if (data.mowerId) {
        queriesToInvalidate.push(
          ['/api/mowers', data.mowerId.toString(), 'tasks'], // MowerDetails tasks tab
          ['/api/mowers', data.mowerId.toString()], // MowerDetails (may affect status)
          ['/api/mowers'] // Dashboard (may affect overall status)
        );
      }
      break;

    default:
      // For connection messages or unknown types, don't invalidate anything
      break;
  }

  // Invalidate all relevant queries
  queriesToInvalidate.forEach(queryKey => {
    queryClient.invalidateQueries({ queryKey });
  });

  if (queriesToInvalidate.length > 0) {
    console.log(`Asset events: invalidated ${queriesToInvalidate.length} query groups for ${type}:`, 
                queriesToInvalidate.map(q => q.join('/')));
  }
}

/**
 * Hook that provides WebSocket connection status without auto-refresh logic.
 * Useful for showing connection status in the UI without triggering refreshes.
 */
export function useAssetEventsStatus() {
  return useWebSocket({
    onMessage: (message) => {
      // Don't handle auto-refresh, just track connection status
      console.log('Asset events status: message received:', message.type);
    },
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 10
  });
}