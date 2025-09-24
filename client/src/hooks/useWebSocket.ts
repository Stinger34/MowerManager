import { useEffect, useRef, useState, useCallback } from 'react';
import { queryClient } from '@/lib/queryClient';

export interface WebSocketMessage {
  type: 'connection' | 'asset-created' | 'asset-updated' | 'asset-deleted' | 'service-created' | 'service-updated' | 'service-deleted' | 'task-created' | 'task-updated' | 'task-deleted' | 'component-created' | 'component-updated' | 'component-deleted' | 'part-created' | 'part-updated' | 'part-deleted' | 'asset-part-created' | 'asset-part-updated' | 'asset-part-deleted';
  data: {
    id: string | number;
    entityType?: 'mower' | 'component' | 'part' | 'asset-part' | 'task' | 'service-record';
    mowerId?: string | number;
    componentId?: string | number;
    [key: string]: any;
  };
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  sendMessage: (message: any) => void;
  disconnect: () => void;
  connect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    onMessage,
    onError,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  };

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle message with custom handler
      onMessage?.(message);

      // Auto-invalidate queries based on message type
      handleAutoRefresh(message);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [onMessage]);

  const handleAutoRefresh = useCallback((message: WebSocketMessage) => {
    const { type, data } = message;

    // Define query keys to invalidate based on the event type
    const queriesToInvalidate: string[][] = [];

    switch (type) {
      case 'asset-created':
      case 'asset-updated':
      case 'asset-deleted':
        if (data.entityType === 'mower') {
          queriesToInvalidate.push(['/api/mowers']);
          if (data.id) {
            queriesToInvalidate.push(['/api/mowers', data.id.toString()]);
          }
        }
        break;

      case 'task-created':
      case 'task-updated':
      case 'task-deleted':
        if (data.mowerId) {
          queriesToInvalidate.push(['/api/mowers', data.mowerId.toString(), 'tasks']);
        }
        break;

      case 'service-created':
      case 'service-updated':
      case 'service-deleted':
        // Invalidate mower data since service affects mower status
        queriesToInvalidate.push(['/api/service-records']);
        if (data.mowerId) {
          queriesToInvalidate.push(['/api/mowers', data.mowerId.toString()]);
          queriesToInvalidate.push(['/api/mowers', data.mowerId.toString(), 'service']);
        }
        // Also invalidate general mowers list for dashboard stats
        queriesToInvalidate.push(['/api/mowers']);
        break;

      case 'component-created':
      case 'component-updated':
      case 'component-deleted':
        queriesToInvalidate.push(['/api/components']);
        if (data.mowerId) {
          queriesToInvalidate.push(['/api/mowers', data.mowerId.toString(), 'components']);
        }
        break;

      case 'part-created':
      case 'part-updated':
      case 'part-deleted':
        queriesToInvalidate.push(['/api/parts']);
        break;

      case 'asset-part-created':
      case 'asset-part-updated':
      case 'asset-part-deleted':
        if (data.mowerId) {
          queriesToInvalidate.push(['/api/mowers', data.mowerId.toString(), 'parts']);
        }
        if (data.componentId) {
          queriesToInvalidate.push(['/api/components', data.componentId.toString(), 'parts']);
        }
        break;
    }

    // Invalidate all relevant queries
    queriesToInvalidate.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey });
    });

    if (queriesToInvalidate.length > 0) {
      console.log('WebSocket auto-refresh: invalidated queries for', type, queriesToInvalidate);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        setError(null);
        onConnect?.();
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        // Auto-reconnect if enabled
        if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
          setReconnectAttempts(prev => prev + 1);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        if (!isMountedRef.current) return;
        
        console.error('WebSocket error:', event);
        const errorMessage = 'WebSocket connection error';
        setError(errorMessage);
        setIsConnecting(false);
        onError?.(event);
      };

    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('Error creating WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  }, [handleMessage, onConnect, onDisconnect, onError, autoReconnect, reconnectAttempts, maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setReconnectAttempts(0);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', message);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnectAttempts,
    sendMessage,
    disconnect,
    connect
  };
}

// Simpler hook for just auto-refresh functionality
export function useWebSocketAutoRefresh() {
  return useWebSocket({
    onMessage: (message) => {
      console.log('WebSocket message received:', message.type);
    },
    onConnect: () => {
      console.log('WebSocket auto-refresh connected');
    },
    onError: (error) => {
      console.error('WebSocket auto-refresh error:', error);
    }
  });
}