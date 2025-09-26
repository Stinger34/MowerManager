import { type Mower, type InsertMower, type ServiceRecord, type InsertServiceRecord, type Attachment, type InsertAttachment, type Task, type InsertTask, type Engine, type InsertEngine, type Part, type InsertPart, type AssetPart, type InsertAssetPart, type AssetPartWithDetails, type Notification, type InsertNotification, mowers, tasks, serviceRecords, attachments, engines, parts, assetParts, notifications } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Mower methods
  getMower(id: string): Promise<Mower | undefined>;
  getAllMowers(): Promise<Mower[]>;
  createMower(mower: InsertMower): Promise<Mower>;
  updateMower(id: string, mower: Partial<InsertMower>): Promise<Mower | undefined>;
  updateMowerThumbnail(mowerId: string, thumbnailAttachmentId: string | null): Promise<boolean>;
  deleteMower(id: string): Promise<boolean>;
  
  // Task methods
  getTask(id: string): Promise<Task | undefined>;
  getTasksByMowerId(mowerId: string): Promise<Task[]>;
  getAllTasks(): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  markTaskComplete(id: string): Promise<Task | undefined>;
  
  // Service Record methods
  getServiceRecord(id: string): Promise<ServiceRecord | undefined>;
  getServiceRecordsByMowerId(mowerId: string): Promise<ServiceRecord[]>;
  getAllServiceRecords(): Promise<ServiceRecord[]>;
  createServiceRecordWithMowerUpdate(serviceRecord: InsertServiceRecord): Promise<ServiceRecord>;
  updateServiceRecord(id: string, serviceRecord: Partial<InsertServiceRecord>): Promise<ServiceRecord | undefined>;
  deleteServiceRecord(id: string): Promise<boolean>;
  
  // Attachment methods
  getAttachment(id: string): Promise<Attachment | undefined>;
  getAttachmentsByMowerId(mowerId: string): Promise<Attachment[]>;
  getAttachmentsByEngineId(engineId: string): Promise<Attachment[]>;
  getAttachmentsByPartId(partId: string): Promise<Attachment[]>;
  getAllAttachments(): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  updateAttachmentMetadata(id: string, metadata: { title?: string; description?: string }): Promise<Attachment | undefined>;
  deleteAttachment(id: string): Promise<boolean>;
  
  // Engine methods
  getEngine(id: string): Promise<Engine | undefined>;
  getEnginesByMowerId(mowerId: string): Promise<Engine[]>;
  getAllEngines(): Promise<Engine[]>;
  createEngine(engine: InsertEngine): Promise<Engine>;
  updateEngine(id: string, engine: Partial<InsertEngine>): Promise<Engine | undefined>;
  deleteEngine(id: string): Promise<boolean>;
  
  // Part methods
  getPart(id: string): Promise<Part | undefined>;
  getAllParts(): Promise<Part[]>;
  createPart(part: InsertPart): Promise<Part>;
  updatePart(id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<boolean>;
  
  // Asset Part allocation methods
  getAssetPartsByMowerId(mowerId: string): Promise<AssetPart[]>;
  getAssetPartsWithDetailsByMowerId(mowerId: string): Promise<AssetPartWithDetails[]>;
  getAssetPartsByEngineId(engineId: string): Promise<AssetPart[]>;
  getAssetPartsByPartId(partId: string): Promise<AssetPartWithDetails[]>;
  getAllAssetParts(): Promise<AssetPart[]>;
  getAssetPart(id: string): Promise<AssetPart | undefined>;
  createAssetPart(assetPart: InsertAssetPart): Promise<AssetPart>;
  updateAssetPart(id: string, assetPart: Partial<InsertAssetPart>): Promise<AssetPart | undefined>;
  deleteAssetPart(id: string): Promise<boolean>;

  // Reminders methods
  getLowStockParts(): Promise<Part[]>;
  getUpcomingServiceReminders(): Promise<{ mower: Mower; serviceType: string; daysUntilDue: number; dueDate: Date }[]>;

  // Notification methods
  getNotifications(): Promise<Notification[]>;
  getUnreadNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string): Promise<boolean>;
  markAllNotificationsAsRead(): Promise<boolean>;
  deleteNotification(id: string): Promise<boolean>;
  deleteAllNotifications(): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private mowers: Map<string, Mower>;
  private tasks: Map<string, Task>;
  private serviceRecords: Map<string, ServiceRecord>;
  private attachments: Map<string, Attachment>;
  private engines: Map<string, Engine>;
  private parts: Map<string, Part>;
  private assetParts: Map<string, AssetPart>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.mowers = new Map();
    this.tasks = new Map();
    this.serviceRecords = new Map();
    this.attachments = new Map();
    this.engines = new Map();
    this.parts = new Map();
    this.assetParts = new Map();
    this.notifications = new Map();
  }

  async getMower(id: string): Promise<Mower | undefined> {
    return this.mowers.get(id);
  }

  async getAllMowers(): Promise<Mower[]> {
    return Array.from(this.mowers.values());
  }

  async createMower(insertMower: InsertMower): Promise<Mower> {
    const id = Math.floor(Math.random() * 1000000); // Mock serial ID for MemStorage
    const mower: Mower = { 
      ...insertMower,
      id,
      year: insertMower.year || null,
      serialNumber: insertMower.serialNumber || null,
      purchaseDate: insertMower.purchaseDate || null,
      purchasePrice: insertMower.purchasePrice || null,
      location: insertMower.location || null,
      condition: insertMower.condition || "good",
      status: insertMower.status || "active",
      notes: insertMower.notes || null,
      lastServiceDate: insertMower.lastServiceDate || null,
      nextServiceDate: insertMower.nextServiceDate || null,
      thumbnailAttachmentId: insertMower.thumbnailAttachmentId || null
    };
    this.mowers.set(id.toString(), mower);
    return mower;
  }

  async updateMower(id: string, updateData: Partial<InsertMower>): Promise<Mower | undefined> {
    const existingMower = this.mowers.get(id);
    if (!existingMower) return undefined;
    
    const updatedMower: Mower = {
      ...existingMower,
      ...updateData
    };
    this.mowers.set(id, updatedMower);
    return updatedMower;
  }

  async updateMowerThumbnail(mowerId: string, thumbnailAttachmentId: string | null): Promise<boolean> {
    const existingMower = this.mowers.get(mowerId);
    if (!existingMower) return false;
    
    const updatedMower: Mower = {
      ...existingMower,
      thumbnailAttachmentId
    };
    this.mowers.set(mowerId, updatedMower);
    return true;
  }

  async deleteMower(id: string): Promise<boolean> {
    return this.mowers.delete(id);
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByMowerId(mowerId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.mowerId === parseInt(mowerId));
  }

  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const task: Task = {
      ...insertTask,
      id,
      priority: insertTask.priority || "medium",
      status: insertTask.status || "pending",
      category: insertTask.category || "maintenance",
      dueDate: insertTask.dueDate || null,
      estimatedCost: insertTask.estimatedCost || null,
      partNumber: insertTask.partNumber || null,
      description: insertTask.description || null,
      createdAt: now,
      completedAt: null
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const existingTask = this.tasks.get(id);
    if (!existingTask) return undefined;
    
    const updatedTask: Task = {
      ...existingTask,
      ...updateData,
      dueDate: updateData.dueDate !== undefined ? updateData.dueDate || null : existingTask.dueDate,
      estimatedCost: updateData.estimatedCost !== undefined ? updateData.estimatedCost || null : existingTask.estimatedCost,
      partNumber: updateData.partNumber !== undefined ? updateData.partNumber || null : existingTask.partNumber,
      description: updateData.description !== undefined ? updateData.description || null : existingTask.description,
    };
    this.tasks.set(id, updatedTask);
    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }

  async markTaskComplete(id: string): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const completedTask: Task = {
      ...task,
      status: "completed",
      completedAt: new Date()
    };
    this.tasks.set(id, completedTask);
    return completedTask;
  }

  // Service Record methods
  async getServiceRecord(id: string): Promise<ServiceRecord | undefined> {
    return this.serviceRecords.get(id);
  }

  async getServiceRecordsByMowerId(mowerId: string): Promise<ServiceRecord[]> {
    return Array.from(this.serviceRecords.values()).filter(record => record.mowerId === parseInt(mowerId));
  }

  async getAllServiceRecords(): Promise<ServiceRecord[]> {
    return Array.from(this.serviceRecords.values());
  }

  async createServiceRecordWithMowerUpdate(insertServiceRecord: InsertServiceRecord): Promise<ServiceRecord> {
    // Create service record
    const id = randomUUID();
    const now = new Date();
    const serviceRecord: ServiceRecord = {
      ...insertServiceRecord,
      id,
      cost: insertServiceRecord.cost || null,
      performedBy: insertServiceRecord.performedBy || null,
      nextServiceDue: insertServiceRecord.nextServiceDue || null,
      mileage: insertServiceRecord.mileage || null,
      createdAt: now,
    };

    // Store the service record
    this.serviceRecords.set(id, serviceRecord);

    // Update mower's service dates
    const mowerId = insertServiceRecord.mowerId.toString();
    const mower = this.mowers.get(mowerId);
    if (mower) {
      const serviceDate = insertServiceRecord.serviceDate;
      const nextServiceDate = new Date(serviceDate);
      nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1); // Add 12 months

      const updatedMower: Mower = {
        ...mower,
        lastServiceDate: serviceDate.toISOString().split('T')[0], // Convert to date string
        nextServiceDate: nextServiceDate.toISOString().split('T')[0], // Convert to date string
      };
      this.mowers.set(mowerId, updatedMower);
    }

    return serviceRecord;
  }

  async updateServiceRecord(id: string, updateData: Partial<InsertServiceRecord>): Promise<ServiceRecord | undefined> {
    const existingRecord = this.serviceRecords.get(id);
    if (!existingRecord) return undefined;
    
    const updatedRecord: ServiceRecord = {
      ...existingRecord,
      ...updateData,
      cost: updateData.cost !== undefined ? updateData.cost || null : existingRecord.cost,
      performedBy: updateData.performedBy !== undefined ? updateData.performedBy || null : existingRecord.performedBy,
      nextServiceDue: updateData.nextServiceDue !== undefined ? updateData.nextServiceDue || null : existingRecord.nextServiceDue,
      mileage: updateData.mileage !== undefined ? updateData.mileage || null : existingRecord.mileage,
    };
    this.serviceRecords.set(id, updatedRecord);
    return updatedRecord;
  }

  async deleteServiceRecord(id: string): Promise<boolean> {
    return this.serviceRecords.delete(id);
  }

  // Attachment methods
  async getAttachment(id: string): Promise<Attachment | undefined> {
    return this.attachments.get(id);
  }

  async getAttachmentsByMowerId(mowerId: string): Promise<Attachment[]> {
    return Array.from(this.attachments.values()).filter(attachment => attachment.mowerId === parseInt(mowerId));
  }

  async getAttachmentsByEngineId(engineId: string): Promise<Attachment[]> {
    return Array.from(this.attachments.values()).filter(attachment => attachment.engineId === parseInt(engineId));
  }

  async getAttachmentsByPartId(partId: string): Promise<Attachment[]> {
    return Array.from(this.attachments.values()).filter(attachment => attachment.partId === parseInt(partId));
  }

  async getAllAttachments(): Promise<Attachment[]> {
    return Array.from(this.attachments.values());
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const id = randomUUID();
    const now = new Date();
    const attachment: Attachment = {
      ...insertAttachment,
      id,
      title: insertAttachment.title || null,
      description: insertAttachment.description || null,
      pageCount: insertAttachment.pageCount ?? null,
      uploadedAt: now,
      mowerId: insertAttachment.mowerId ?? null,
      engineId: insertAttachment.engineId ?? null,
      partId: insertAttachment.partId ?? null,
    };
    this.attachments.set(id, attachment);
    return attachment;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    return this.attachments.delete(id);
  }

  async updateAttachmentMetadata(id: string, metadata: { title?: string; description?: string }): Promise<Attachment | undefined> {
    const attachment = this.attachments.get(id);
    if (!attachment) return undefined;
    
    const updated = {
      ...attachment,
      title: metadata.title ?? attachment.title,
      description: metadata.description ?? attachment.description,
    };
    
    this.attachments.set(id, updated);
    return updated;
  }

  // Engine methods
  async getEngine(id: string): Promise<Engine | undefined> {
    return this.engines.get(id);
  }

  async getEnginesByMowerId(mowerId: string): Promise<Engine[]> {
    return Array.from(this.engines.values()).filter(engine => 
      engine.mowerId !== null && engine.mowerId.toString() === mowerId
    );
  }

  async getAllEngines(): Promise<Engine[]> {
    return Array.from(this.engines.values());
  }

  async createEngine(insertEngine: InsertEngine): Promise<Engine> {
    const id = (this.engines.size + 1).toString();
    const now = new Date();
    const engine: Engine = {
      ...insertEngine,
      id: parseInt(id),
      mowerId: insertEngine.mowerId,
      condition: insertEngine.condition || "good",
      status: insertEngine.status || "active",
      description: insertEngine.description || null,
      partNumber: insertEngine.partNumber || null,
      manufacturer: insertEngine.manufacturer || null,
      model: insertEngine.model || null,
      serialNumber: insertEngine.serialNumber || null,
      installDate: insertEngine.installDate || null,
      warrantyExpires: insertEngine.warrantyExpires || null,
      cost: insertEngine.cost || null,
      notes: insertEngine.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.engines.set(id, engine);
    return engine;
  }

  async updateEngine(id: string, updateData: Partial<InsertEngine>): Promise<Engine | undefined> {
    const engine = this.engines.get(id);
    if (!engine) return undefined;
    
    const updatedEngine: Engine = {
      ...engine,
      ...updateData,
      updatedAt: new Date(),
    };
    this.engines.set(id, updatedEngine);
    return updatedEngine;
  }

  async deleteEngine(id: string): Promise<boolean> {
    return this.engines.delete(id);
  }

  // Part methods
  async getPart(id: string): Promise<Part | undefined> {
    return this.parts.get(id);
  }

  async getAllParts(): Promise<Part[]> {
    return Array.from(this.parts.values());
  }

  async createPart(insertPart: InsertPart): Promise<Part> {
    const id = (this.parts.size + 1).toString();
    const now = new Date();
    const part: Part = {
      ...insertPart,
      id: parseInt(id),
      description: insertPart.description || null,
      manufacturer: insertPart.manufacturer || null,
      unitCost: insertPart.unitCost || null,
      minStockLevel: insertPart.minStockLevel || 0,
      stockQuantity: insertPart.stockQuantity || 0,
      notes: insertPart.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.parts.set(id, part);
    return part;
  }

  async updatePart(id: string, updateData: Partial<InsertPart>): Promise<Part | undefined> {
    const part = this.parts.get(id);
    if (!part) return undefined;
    
    const updatedPart: Part = {
      ...part,
      ...updateData,
      updatedAt: new Date(),
    };
    this.parts.set(id, updatedPart);
    return updatedPart;
  }

  async deletePart(id: string): Promise<boolean> {
    return this.parts.delete(id);
  }

  // Asset Part allocation methods
  async getAssetPartsByMowerId(mowerId: string): Promise<AssetPart[]> {
    return Array.from(this.assetParts.values()).filter(assetPart => 
      assetPart.mowerId && assetPart.mowerId.toString() === mowerId
    );
  }

  async getAssetPartsWithDetailsByMowerId(mowerId: string): Promise<AssetPartWithDetails[]> {
    const assetPartsList = Array.from(this.assetParts.values()).filter(assetPart => 
      assetPart.mowerId && assetPart.mowerId.toString() === mowerId
    );
    
    return assetPartsList.map(assetPart => {
      const part = this.parts.get(assetPart.partId.toString());
      return {
        ...assetPart,
        part: part!
      } as AssetPartWithDetails;
    }).filter(item => item.part); // Filter out any where part wasn't found
  }

  async getAssetPartsByEngineId(engineId: string): Promise<AssetPart[]> {
    return Array.from(this.assetParts.values()).filter(assetPart => 
      assetPart.engineId && assetPart.engineId.toString() === engineId
    );
  }

  async getAssetPartsByPartId(partId: string): Promise<AssetPartWithDetails[]> {
    const assetPartsList = Array.from(this.assetParts.values()).filter(assetPart => 
      assetPart.partId.toString() === partId
    );
    
    return assetPartsList.map(assetPart => {
      const part = this.parts.get(assetPart.partId.toString());
      const mower = assetPart.mowerId ? this.mowers.get(assetPart.mowerId.toString()) : undefined;
      const engine = assetPart.engineId ? this.engines.get(assetPart.engineId.toString()) : undefined;
      const serviceRecord = assetPart.serviceRecordId ? this.serviceRecords.get(assetPart.serviceRecordId) : undefined;
      
      return {
        ...assetPart,
        part: part!,
        mower,
        engine,
        serviceRecord
      } as AssetPartWithDetails;
    }).filter(item => item.part); // Filter out any where part wasn't found
  }

  async getAllAssetParts(): Promise<AssetPart[]> {
    return Array.from(this.assetParts.values());
  }

  async getAssetPart(id: string): Promise<AssetPart | undefined> {
    return this.assetParts.get(id);
  }

  async createAssetPart(insertAssetPart: InsertAssetPart): Promise<AssetPart> {
    const id = (this.assetParts.size + 1).toString();
    const now = new Date();
    
    // Get the part to reduce its stock
    const part = this.parts.get(insertAssetPart.partId.toString());
    if (!part) {
      throw new Error('Part not found');
    }
    
    const quantityToReduce = insertAssetPart.quantity || 1;
    
    // Check if we have enough stock
    if (part.stockQuantity < quantityToReduce) {
      throw new Error(`Insufficient stock. Available: ${part.stockQuantity}, Required: ${quantityToReduce}`);
    }
    
    // Reduce stock quantity
    const updatedPart = {
      ...part,
      stockQuantity: part.stockQuantity - quantityToReduce,
      updatedAt: now
    };
    this.parts.set(insertAssetPart.partId.toString(), updatedPart);
    
    const assetPart: AssetPart = {
      ...insertAssetPart,
      id: parseInt(id),
      mowerId: insertAssetPart.mowerId || null,
      engineId: insertAssetPart.engineId || null,
      quantity: insertAssetPart.quantity || 1,
      installDate: insertAssetPart.installDate || null,
      serviceRecordId: insertAssetPart.serviceRecordId || null,
      notes: insertAssetPart.notes || null,
      createdAt: now,
    };
    this.assetParts.set(id, assetPart);
    return assetPart;
  }

  async updateAssetPart(id: string, updateData: Partial<InsertAssetPart>): Promise<AssetPart | undefined> {
    const assetPart = this.assetParts.get(id);
    if (!assetPart) return undefined;
    
    // Check if quantity is being updated
    if (updateData.quantity !== undefined && updateData.quantity !== assetPart.quantity) {
      const part = this.parts.get(assetPart.partId.toString());
      if (!part) {
        throw new Error('Part not found');
      }
      
      const quantityDifference = updateData.quantity - assetPart.quantity;
      
      // Check if we have enough stock when increasing quantity
      if (quantityDifference > 0 && part.stockQuantity < quantityDifference) {
        throw new Error(`Insufficient stock. Available: ${part.stockQuantity}, Required: ${quantityDifference}`);
      }
      
      // Update stock quantity (reduce if quantity increased, increase if quantity decreased)
      const updatedPart = {
        ...part,
        stockQuantity: part.stockQuantity - quantityDifference,
        updatedAt: new Date()
      };
      this.parts.set(assetPart.partId.toString(), updatedPart);
    }
    
    const updatedAssetPart: AssetPart = {
      ...assetPart,
      ...updateData,
    };
    this.assetParts.set(id, updatedAssetPart);
    return updatedAssetPart;
  }

  async deleteAssetPart(id: string): Promise<boolean> {
    const assetPart = this.assetParts.get(id);
    if (!assetPart) return false;
    
    // Get the part to restore its stock
    const part = this.parts.get(assetPart.partId.toString());
    if (part) {
      // Restore stock quantity
      const updatedPart = {
        ...part,
        stockQuantity: part.stockQuantity + assetPart.quantity,
        updatedAt: new Date()
      };
      this.parts.set(assetPart.partId.toString(), updatedPart);
    }
    
    return this.assetParts.delete(id);
  }

  // Notification methods
  async getNotifications(): Promise<Notification[]> {
    const notificationsList = Array.from(this.notifications.values());
    return notificationsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    const notificationsList = Array.from(this.notifications.values()).filter(n => !n.isRead);
    return notificationsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const now = new Date();
    const notification: Notification = {
      ...insertNotification,
      id,
      isRead: insertNotification.isRead || false,
      priority: insertNotification.priority || "medium",
      entityType: insertNotification.entityType || null,
      entityId: insertNotification.entityId || null,
      entityName: insertNotification.entityName || null,
      detailUrl: insertNotification.detailUrl || null,
      createdAt: now,
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification) return false;
    
    const updatedNotification: Notification = { ...notification, isRead: true };
    this.notifications.set(id, updatedNotification);
    return true;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    this.notifications.forEach((notification, id) => {
      if (!notification.isRead) {
        this.notifications.set(id, { ...notification, isRead: true });
      }
    });
    return true;
  }

  async deleteNotification(id: string): Promise<boolean> {
    return this.notifications.delete(id);
  }

  async deleteAllNotifications(): Promise<boolean> {
    this.notifications.clear();
    return true;
  }

  // Reminders methods
  async getLowStockParts(): Promise<Part[]> {
    return Array.from(this.parts.values()).filter(part => 
      part.minStockLevel !== null && part.stockQuantity <= part.minStockLevel
    );
  }

  async getUpcomingServiceReminders(): Promise<{ mower: Mower; serviceType: string; daysUntilDue: number; dueDate: Date }[]> {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return Array.from(this.mowers.values())
      .filter(mower => {
        if (!mower.nextServiceDate) return false;
        const serviceDate = new Date(mower.nextServiceDate);
        return serviceDate >= today && serviceDate <= thirtyDaysFromNow;
      })
      .map(mower => {
        const serviceDate = new Date(mower.nextServiceDate!);
        const timeDiff = serviceDate.getTime() - today.getTime();
        const daysUntilDue = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        
        return {
          mower,
          serviceType: 'Scheduled Maintenance',
          daysUntilDue,
          dueDate: serviceDate
        };
      });
  }
}

export class DbStorage implements IStorage {
  // Mower methods
  async getMower(id: string): Promise<Mower | undefined> {
    const result = await db.select().from(mowers).where(eq(mowers.id, parseInt(id)));
    return result[0];
  }

  async getAllMowers(): Promise<Mower[]> {
    return await db.select().from(mowers);
  }

  async createMower(insertMower: InsertMower): Promise<Mower> {
    const result = await db.insert(mowers).values(insertMower).returning();
    return result[0];
  }

  async updateMower(id: string, updateData: Partial<InsertMower>): Promise<Mower | undefined> {
    const result = await db
      .update(mowers)
      .set(updateData)
      .where(eq(mowers.id, parseInt(id)))
      .returning();
    return result[0];
  }

  async updateMowerThumbnail(mowerId: string, thumbnailAttachmentId: string | null): Promise<boolean> {
    const result = await db
      .update(mowers)
      .set({ thumbnailAttachmentId })
      .where(eq(mowers.id, parseInt(mowerId)))
      .returning();
    return result.length > 0;
  }

  async deleteMower(id: string): Promise<boolean> {
    const result = await db.delete(mowers).where(eq(mowers.id, parseInt(id)));
    return (result.rowCount ?? 0) > 0;
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async getTasksByMowerId(mowerId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.mowerId, parseInt(mowerId)));
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks);
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const now = new Date();
    const taskData: typeof tasks.$inferInsert = {
      ...insertTask,
      id,
      createdAt: now,
    };
    
    const result = await db.insert(tasks).values(taskData).returning();
    return result[0];
  }

  async updateTask(id: string, updateData: Partial<InsertTask>): Promise<Task | undefined> {
    const result = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async markTaskComplete(id: string): Promise<Task | undefined> {
    const result = await db
      .update(tasks)
      .set({ 
        status: "completed",
        completedAt: new Date()
      })
      .where(eq(tasks.id, id))
      .returning();
    return result[0];
  }

  // Service Record methods
  async getServiceRecord(id: string): Promise<ServiceRecord | undefined> {
    const result = await db.select().from(serviceRecords).where(eq(serviceRecords.id, id));
    return result[0];
  }

  async getServiceRecordsByMowerId(mowerId: string): Promise<ServiceRecord[]> {
    return await db.select().from(serviceRecords).where(eq(serviceRecords.mowerId, parseInt(mowerId)));
  }

  async getAllServiceRecords(): Promise<ServiceRecord[]> {
    return await db.select().from(serviceRecords);
  }

  async createServiceRecordWithMowerUpdate(insertServiceRecord: InsertServiceRecord): Promise<ServiceRecord> {
    // Create service record
    const serviceRecordData: typeof serviceRecords.$inferInsert = {
      ...insertServiceRecord,
      id: randomUUID(),
      createdAt: new Date(),
    };

    const [createdServiceRecord] = await db.insert(serviceRecords).values(serviceRecordData).returning();

    // Update mower's service dates
    const serviceDate = insertServiceRecord.serviceDate;
    const nextServiceDate = new Date(serviceDate);
    nextServiceDate.setFullYear(nextServiceDate.getFullYear() + 1); // Add 12 months

    await db
      .update(mowers)
      .set({
        lastServiceDate: serviceDate.toISOString().split('T')[0], // Convert to date string
        nextServiceDate: nextServiceDate.toISOString().split('T')[0], // Convert to date string
      })
      .where(eq(mowers.id, insertServiceRecord.mowerId));

    return createdServiceRecord;
  }

  async updateServiceRecord(id: string, updateData: Partial<InsertServiceRecord>): Promise<ServiceRecord | undefined> {
    const result = await db
      .update(serviceRecords)
      .set(updateData)
      .where(eq(serviceRecords.id, id))
      .returning();
    return result[0];
  }

  async deleteServiceRecord(id: string): Promise<boolean> {
    const result = await db
      .delete(serviceRecords)
      .where(eq(serviceRecords.id, id))
      .returning();
    return result.length > 0;
  }

  // Attachment methods
  async getAttachment(id: string): Promise<Attachment | undefined> {
    const result = await db.select().from(attachments).where(eq(attachments.id, id));
    return result[0];
  }

  async getAttachmentsByMowerId(mowerId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.mowerId, parseInt(mowerId)));
  }

  async getAttachmentsByEngineId(engineId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.engineId, parseInt(engineId)));
  }

  async getAttachmentsByPartId(partId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.partId, parseInt(partId)));
  }

  async getAllAttachments(): Promise<Attachment[]> {
    return await db.select().from(attachments);
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const attachmentData: typeof attachments.$inferInsert = {
      ...insertAttachment,
      id: randomUUID(),
      uploadedAt: new Date(),
    };
    
    const result = await db.insert(attachments).values(attachmentData).returning();
    return result[0];
  }

  async deleteAttachment(id: string): Promise<boolean> {
    const result = await db.delete(attachments).where(eq(attachments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateAttachmentMetadata(id: string, metadata: { title?: string; description?: string }): Promise<Attachment | undefined> {
    const result = await db.update(attachments)
      .set(metadata)
      .where(eq(attachments.id, id))
      .returning();
    return result[0];
  }

  // Engine methods
  async getEngine(id: string): Promise<Engine | undefined> {
    const result = await db.select().from(engines).where(eq(engines.id, parseInt(id)));
    return result[0];
  }

  async getEnginesByMowerId(mowerId: string): Promise<Engine[]> {
    return await db.select().from(engines).where(eq(engines.mowerId, parseInt(mowerId)));
  }

  async getAllEngines(): Promise<Engine[]> {
    return await db.select().from(engines);
  }

  async createEngine(insertEngine: InsertEngine): Promise<Engine> {
    const result = await db.insert(engines).values(insertEngine).returning();
    return result[0];
  }

  async updateEngine(id: string, updateData: Partial<InsertEngine>): Promise<Engine | undefined> {
    const result = await db.update(engines)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(engines.id, parseInt(id)))
      .returning();
    return result[0];
  }

  async deleteEngine(id: string): Promise<boolean> {
    const result = await db.delete(engines).where(eq(engines.id, parseInt(id)));
    return (result.rowCount ?? 0) > 0;
  }

  // Part methods
  async getPart(id: string): Promise<Part | undefined> {
    const result = await db.select().from(parts).where(eq(parts.id, parseInt(id)));
    return result[0];
  }

  async getAllParts(): Promise<Part[]> {
    return await db.select().from(parts);
  }

  async createPart(insertPart: InsertPart): Promise<Part> {
    const result = await db.insert(parts).values(insertPart).returning();
    return result[0];
  }

  async updatePart(id: string, updateData: Partial<InsertPart>): Promise<Part | undefined> {
    const result = await db.update(parts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(parts.id, parseInt(id)))
      .returning();
    return result[0];
  }

  async deletePart(id: string): Promise<boolean> {
    const result = await db.delete(parts).where(eq(parts.id, parseInt(id)));
    return (result.rowCount ?? 0) > 0;
  }

  // Asset Part allocation methods
  async getAssetPartsByMowerId(mowerId: string): Promise<AssetPart[]> {
    return await db.select().from(assetParts).where(eq(assetParts.mowerId, parseInt(mowerId)));
  }

  async getAssetPartsWithDetailsByMowerId(mowerId: string): Promise<AssetPartWithDetails[]> {
    const result = await db
      .select({
        id: assetParts.id,
        partId: assetParts.partId,
        mowerId: assetParts.mowerId,
        engineId: assetParts.engineId,
        quantity: assetParts.quantity,
        installDate: assetParts.installDate,
        serviceRecordId: assetParts.serviceRecordId,
        notes: assetParts.notes,
        createdAt: assetParts.createdAt,
        part: {
          id: parts.id,
          name: parts.name,
          description: parts.description,
          partNumber: parts.partNumber,
          manufacturer: parts.manufacturer,
          category: parts.category,
          unitCost: parts.unitCost,
          stockQuantity: parts.stockQuantity,
          minStockLevel: parts.minStockLevel,
          notes: parts.notes,
          createdAt: parts.createdAt,
          updatedAt: parts.updatedAt,
        }
      })
      .from(assetParts)
      .innerJoin(parts, eq(assetParts.partId, parts.id))
      .where(eq(assetParts.mowerId, parseInt(mowerId)));
    
    return result as AssetPartWithDetails[];
  }

  async getAssetPartsByEngineId(engineId: string): Promise<AssetPart[]> {
    return await db.select().from(assetParts).where(eq(assetParts.engineId, parseInt(engineId)));
  }

  async getAssetPartsByPartId(partId: string): Promise<AssetPartWithDetails[]> {
    const result = await db
      .select({
        id: assetParts.id,
        partId: assetParts.partId,
        mowerId: assetParts.mowerId,
        engineId: assetParts.engineId,
        quantity: assetParts.quantity,
        installDate: assetParts.installDate,
        serviceRecordId: assetParts.serviceRecordId,
        notes: assetParts.notes,
        createdAt: assetParts.createdAt,
        // Include related data
        part: {
          id: parts.id,
          name: parts.name,
          partNumber: parts.partNumber,
          manufacturer: parts.manufacturer,
          category: parts.category,
          unitCost: parts.unitCost,
          stockQuantity: parts.stockQuantity,
          minStockLevel: parts.minStockLevel,
          notes: parts.notes,
          createdAt: parts.createdAt,
          updatedAt: parts.updatedAt,
        },
        mower: {
          id: mowers.id,
          make: mowers.make,
          model: mowers.model,
          year: mowers.year,
          serialNumber: mowers.serialNumber,
        },
        component: {
          id: components.id,
          name: components.name,
          partNumber: components.partNumber,
          manufacturer: components.manufacturer,
        }
      })
      .from(assetParts)
      .innerJoin(parts, eq(assetParts.partId, parts.id))
      .leftJoin(mowers, eq(assetParts.mowerId, mowers.id))
      .leftJoin(engines, eq(assetParts.engineId, engines.id))
      .where(eq(assetParts.partId, parseInt(partId)));
    
    return result as AssetPartWithDetails[];
  }

  async getAllAssetParts(): Promise<AssetPart[]> {
    return await db.select().from(assetParts);
  }

  async getAssetPart(id: string): Promise<AssetPart | undefined> {
    const results = await db.select().from(assetParts).where(eq(assetParts.id, parseInt(id)));
    return results[0];
  }

  async createAssetPart(insertAssetPart: InsertAssetPart): Promise<AssetPart> {
    // Start a transaction to ensure atomicity
    const result = await db.transaction(async (tx: any) => {
      // First, decrement the stock quantity of the part
      const stockResult = await tx.update(parts)
        .set({ 
          stockQuantity: sql`${parts.stockQuantity} - ${insertAssetPart.quantity || 1}`,
          updatedAt: new Date()
        })
        .where(eq(parts.id, insertAssetPart.partId))
        .returning();
      
      if (stockResult.length === 0) {
        throw new Error('Part not found');
      }

      // Check if stock would go negative
      if (stockResult[0].stockQuantity < 0) {
        throw new Error(`Insufficient stock. Available: ${stockResult[0].stockQuantity + (insertAssetPart.quantity || 1)}, Required: ${insertAssetPart.quantity || 1}`);
      }

      // Create the asset part allocation
      const assetPartResult = await tx.insert(assetParts).values(insertAssetPart).returning();
      return assetPartResult[0];
    });

    return result;
  }

  async updateAssetPart(id: string, updateData: Partial<InsertAssetPart>): Promise<AssetPart | undefined> {
    // Start a transaction to ensure atomicity
    const result = await db.transaction(async (tx: any) => {
      // First, get the current asset part to check for quantity changes
      const currentAssetPartResult = await tx.select().from(assetParts).where(eq(assetParts.id, parseInt(id)));
      if (currentAssetPartResult.length === 0) {
        return undefined;
      }
      
      const currentAssetPart = currentAssetPartResult[0];
      
      // Check if quantity is being updated
      if (updateData.quantity !== undefined && updateData.quantity !== currentAssetPart.quantity) {
        const quantityDifference = updateData.quantity - currentAssetPart.quantity;
        
        // Update stock quantity (reduce if quantity increased, increase if quantity decreased)
        const stockResult = await tx.update(parts)
          .set({ 
            stockQuantity: sql`${parts.stockQuantity} - ${quantityDifference}`,
            updatedAt: new Date()
          })
          .where(eq(parts.id, currentAssetPart.partId))
          .returning();
        
        if (stockResult.length === 0) {
          throw new Error('Part not found');
        }

        // Check if stock would go negative
        if (stockResult[0].stockQuantity < 0) {
          throw new Error(`Insufficient stock. Available: ${stockResult[0].stockQuantity + quantityDifference}, Required: ${quantityDifference}`);
        }
      }

      // Update the asset part
      const updateResult = await tx.update(assetParts)
        .set(updateData)
        .where(eq(assetParts.id, parseInt(id)))
        .returning();
      
      return updateResult[0];
    });

    return result;
  }

  async deleteAssetPart(id: string): Promise<boolean> {
    // Start a transaction to ensure atomicity
    const result = await db.transaction(async (tx: any) => {
      // First, get the asset part to know how much stock to restore
      const assetPartResult = await tx.select().from(assetParts).where(eq(assetParts.id, parseInt(id)));
      if (assetPartResult.length === 0) {
        return false;
      }
      
      const assetPart = assetPartResult[0];
      
      // Delete the asset part allocation
      const deleteResult = await tx.delete(assetParts).where(eq(assetParts.id, parseInt(id)));
      
      if ((deleteResult.rowCount ?? 0) === 0) {
        return false;
      }

      // Restore the stock quantity
      await tx.update(parts)
        .set({ 
          stockQuantity: sql`${parts.stockQuantity} + ${assetPart.quantity}`,
          updatedAt: new Date()
        })
        .where(eq(parts.id, assetPart.partId));

      return true;
    });

    return result;
  }

  // Notification methods
  async getNotifications(): Promise<Notification[]> {
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.isRead, false)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const notificationData: typeof notifications.$inferInsert = {
      ...insertNotification,
      id: randomUUID(),
      createdAt: new Date(),
    };
    
    const result = await db.insert(notifications).values(notificationData).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.isRead, false));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllNotifications(): Promise<boolean> {
    const result = await db.delete(notifications);
    return (result.rowCount ?? 0) > 0;
  }

  // Reminders methods
  async getLowStockParts(): Promise<Part[]> {
    return await db.select()
      .from(parts)
      .where(
        sql`${parts.stockQuantity} <= ${parts.minStockLevel} AND ${parts.minStockLevel} IS NOT NULL`
      );
  }

  async getUpcomingServiceReminders(): Promise<{ mower: Mower; serviceType: string; daysUntilDue: number; dueDate: Date }[]> {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    // Get mowers with upcoming service dates
    const mowersWithServices = await db.select()
      .from(mowers)
      .where(
        sql`${mowers.nextServiceDate} IS NOT NULL 
            AND ${mowers.nextServiceDate} >= ${today.toISOString().split('T')[0]}
            AND ${mowers.nextServiceDate} <= ${thirtyDaysFromNow.toISOString().split('T')[0]}`
      );

    return mowersWithServices.map((mower: Mower) => {
      const serviceDate = new Date(mower.nextServiceDate!);
      const timeDiff = serviceDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      return {
        mower,
        serviceType: 'Scheduled Maintenance', // Generic service type since we don't have specific types in mower table
        daysUntilDue,
        dueDate: serviceDate
      };
    });
  }
}

// Initialize storage based on environment
export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
