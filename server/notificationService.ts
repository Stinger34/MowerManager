import { type InsertNotification } from "@shared/schema";
import { storage } from "./storage";

export class NotificationService {
  static async createPartNotification(action: 'created' | 'allocated' | 'deleted', partName: string, partId: string, mowerName?: string, mowerId?: string) {
    let title: string;
    let message: string;
    let type: 'success' | 'info' | 'warning' | 'error';
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let detailUrl: string;

    switch (action) {
      case 'created':
        title = 'Part Created';
        message = `New part "${partName}" has been added to inventory`;
        type = 'success';
        detailUrl = `/catalog/parts/${partId}`;
        break;
      case 'allocated':
        title = 'Part Allocated';
        message = `Part "${partName}" has been allocated${mowerName ? ` to ${mowerName}` : ''}`;
        type = 'info';
        detailUrl = mowerId ? `/mowers/${mowerId}` : `/catalog/parts/${partId}`;
        break;
      case 'deleted':
        title = 'Part Deleted';
        message = `Part "${partName}" has been removed from inventory`;
        type = 'warning';
        priority = 'high';
        detailUrl = '/catalog';
        break;
    }

    const notification: InsertNotification = {
      type,
      title,
      message,
      priority,
      entityType: 'part',
      entityId: partId,
      entityName: partName,
      detailUrl,
    };

    try {
      await storage.createNotification(notification);
    } catch (error) {
      console.error('Failed to create part notification:', error);
    }
  }

  static async createEngineNotification(action: 'created' | 'allocated' | 'deleted', engineName: string, engineId: string, mowerName?: string, mowerId?: string) {
    let title: string;
    let message: string;
    let type: 'success' | 'info' | 'warning' | 'error';
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let detailUrl: string;

    switch (action) {
      case 'created':
        title = 'Engine Created';
        message = `New engine "${engineName}" has been created${mowerName ? ` for ${mowerName}` : ''}`;
        type = 'success';
        detailUrl = `/catalog/engines/${engineId}`;
        break;
      case 'allocated':
        title = 'Engine Allocated';
        message = `Engine "${engineName}" has been allocated${mowerName ? ` to ${mowerName}` : ''}`;
        type = 'info';
        detailUrl = mowerId ? `/mowers/${mowerId}` : `/catalog/engines/${engineId}`;
        break;
      case 'deleted':
        title = 'Engine Deleted';
        message = `Engine "${engineName}" has been removed`;
        type = 'warning';
        priority = 'high';
        detailUrl = '/catalog';
        break;
    }

    const notification: InsertNotification = {
      type,
      title,
      message,
      priority,
      entityType: 'engine',
      entityId: engineId,
      entityName: engineName,
      detailUrl,
    };

    try {
      await storage.createNotification(notification);
    } catch (error) {
      console.error('Failed to create engine notification:', error);
    }
  }

  static async createMowerNotification(action: 'added' | 'deleted' | 'sold', mowerName: string, mowerId: string) {
    let title: string;
    let message: string;
    let type: 'success' | 'info' | 'warning' | 'error';
    let priority: 'high' | 'medium' | 'low' = 'medium';
    let detailUrl: string;

    switch (action) {
      case 'added':
        title = 'Mower Added';
        message = `New mower "${mowerName}" has been added to the fleet`;
        type = 'success';
        detailUrl = `/mowers/${mowerId}`;
        break;
      case 'deleted':
        title = 'Mower Deleted';
        message = `Mower "${mowerName}" has been removed from the fleet`;
        type = 'warning';
        priority = 'high';
        detailUrl = '/mowers';
        break;
      case 'sold':
        title = 'Mower Sold';
        message = `Mower "${mowerName}" has been sold`;
        type = 'info';
        priority = 'high';
        detailUrl = '/mowers';
        break;
    }

    const notification: InsertNotification = {
      type,
      title,
      message,
      priority,
      entityType: 'mower',
      entityId: mowerId,
      entityName: mowerName,
      detailUrl,
    };

    try {
      await storage.createNotification(notification);
    } catch (error) {
      console.error('Failed to create mower notification:', error);
    }
  }
}