import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface WebSocketMessage {
  type: 'asset-created' | 'asset-updated' | 'asset-deleted' | 'service-created' | 'service-updated' | 'service-deleted' | 'task-created' | 'task-updated' | 'task-deleted' | 'component-created' | 'component-updated' | 'component-deleted' | 'part-created' | 'part-updated' | 'part-deleted' | 'asset-part-created' | 'asset-part-updated' | 'asset-part-deleted';
  data: {
    id: string | number;
    entityType: 'mower' | 'component' | 'part' | 'asset-part' | 'task' | 'service-record';
    mowerId?: string | number;
    componentId?: string | number;
    [key: string]: any;
  };
  timestamp: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      perMessageDeflate: false 
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('WebSocket client connected from:', req.socket.remoteAddress);
      this.clients.add(ws);

      // Send a welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        data: { message: 'Connected to MowerManager WebSocket' },
        timestamp: new Date().toISOString()
      }));

      // Handle client messages (for potential future use)
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('WebSocket message received:', data);
          // Handle client messages if needed in future
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log('WebSocket server initialized on /ws');
  }

  broadcast(message: WebSocketMessage) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const messageString = JSON.stringify(message);
    console.log('Broadcasting WebSocket message:', message.type, 'to', this.clients.size, 'clients');

    // Remove closed connections and send to active ones
    const closedConnections: WebSocket[] = [];
    
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageString);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
          closedConnections.push(ws);
        }
      } else {
        closedConnections.push(ws);
      }
    });

    // Clean up closed connections
    closedConnections.forEach((ws) => {
      this.clients.delete(ws);
    });
  }

  // Helper methods for common broadcast scenarios
  broadcastAssetEvent(type: WebSocketMessage['type'], entityType: WebSocketMessage['data']['entityType'], id: string | number, additionalData: any = {}) {
    this.broadcast({
      type,
      data: {
        id,
        entityType,
        ...additionalData
      },
      timestamp: new Date().toISOString()
    });
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  close() {
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      console.log('WebSocket server closed');
    }
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();