import { type Mower, type InsertMower, type ServiceRecord, type InsertServiceRecord, type Attachment, type InsertAttachment, type Task, type InsertTask, type Component, type InsertComponent, type Part, type InsertPart, type AssetPart, type InsertAssetPart, type AssetPartWithDetails, mowers, tasks, serviceRecords, attachments, components, parts, assetParts } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  markTaskComplete(id: string): Promise<Task | undefined>;
  
  // Service Record methods
  getServiceRecordsByMowerId(mowerId: string): Promise<ServiceRecord[]>;
  createServiceRecordWithMowerUpdate(serviceRecord: InsertServiceRecord): Promise<ServiceRecord>;
  updateServiceRecord(id: string, serviceRecord: Partial<InsertServiceRecord>): Promise<ServiceRecord | undefined>;
  
  // Attachment methods
  getAttachment(id: string): Promise<Attachment | undefined>;
  getAttachmentsByMowerId(mowerId: string): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: string): Promise<boolean>;
  
  // Component methods
  getComponent(id: string): Promise<Component | undefined>;
  getComponentsByMowerId(mowerId: string): Promise<Component[]>;
  getAllComponents(): Promise<Component[]>;
  createComponent(component: InsertComponent): Promise<Component>;
  updateComponent(id: string, component: Partial<InsertComponent>): Promise<Component | undefined>;
  deleteComponent(id: string): Promise<boolean>;
  
  // Part methods
  getPart(id: string): Promise<Part | undefined>;
  getAllParts(): Promise<Part[]>;
  createPart(part: InsertPart): Promise<Part>;
  updatePart(id: string, part: Partial<InsertPart>): Promise<Part | undefined>;
  deletePart(id: string): Promise<boolean>;
  
  // Asset Part allocation methods
  getAssetPartsByMowerId(mowerId: string): Promise<AssetPart[]>;
  getAssetPartsWithDetailsByMowerId(mowerId: string): Promise<AssetPartWithDetails[]>;
  getAssetPartsByComponentId(componentId: string): Promise<AssetPart[]>;
  createAssetPart(assetPart: InsertAssetPart): Promise<AssetPart>;
  updateAssetPart(id: string, assetPart: Partial<InsertAssetPart>): Promise<AssetPart | undefined>;
  deleteAssetPart(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private mowers: Map<string, Mower>;
  private tasks: Map<string, Task>;
  private attachments: Map<string, Attachment>;
  private components: Map<string, Component>;
  private parts: Map<string, Part>;
  private assetParts: Map<string, AssetPart>;

  constructor() {
    this.mowers = new Map();
    this.tasks = new Map();
    this.attachments = new Map();
    this.components = new Map();
    this.parts = new Map();
    this.assetParts = new Map();
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
  async getServiceRecordsByMowerId(mowerId: string): Promise<ServiceRecord[]> {
    // Mock implementation for MemStorage - return empty array
    return [];
  }

  async createServiceRecordWithMowerUpdate(insertServiceRecord: InsertServiceRecord): Promise<ServiceRecord> {
    // Create service record (mock implementation for MemStorage)
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
    // Mock implementation for MemStorage - return undefined since no actual storage
    return undefined;
  }

  // Attachment methods
  async getAttachment(id: string): Promise<Attachment | undefined> {
    return this.attachments.get(id);
  }

  async getAttachmentsByMowerId(mowerId: string): Promise<Attachment[]> {
    return Array.from(this.attachments.values()).filter(attachment => attachment.mowerId === parseInt(mowerId));
  }

  async createAttachment(insertAttachment: InsertAttachment): Promise<Attachment> {
    const id = randomUUID();
    const now = new Date();
    const attachment: Attachment = {
      ...insertAttachment,
      id,
      title: insertAttachment.title || null,
      description: insertAttachment.description || null,
      uploadedAt: now,
    };
    this.attachments.set(id, attachment);
    return attachment;
  }

  async deleteAttachment(id: string): Promise<boolean> {
    return this.attachments.delete(id);
  }

  // Component methods
  async getComponent(id: string): Promise<Component | undefined> {
    return this.components.get(id);
  }

  async getComponentsByMowerId(mowerId: string): Promise<Component[]> {
    return Array.from(this.components.values()).filter(component => 
      component.mowerId !== null && component.mowerId.toString() === mowerId
    );
  }

  async getAllComponents(): Promise<Component[]> {
    return Array.from(this.components.values());
  }

  async createComponent(insertComponent: InsertComponent): Promise<Component> {
    const id = (this.components.size + 1).toString();
    const now = new Date();
    const component: Component = {
      ...insertComponent,
      id: parseInt(id),
      condition: insertComponent.condition || "good",
      status: insertComponent.status || "active",
      description: insertComponent.description || null,
      partNumber: insertComponent.partNumber || null,
      manufacturer: insertComponent.manufacturer || null,
      model: insertComponent.model || null,
      serialNumber: insertComponent.serialNumber || null,
      installDate: insertComponent.installDate || null,
      warrantyExpires: insertComponent.warrantyExpires || null,
      cost: insertComponent.cost || null,
      notes: insertComponent.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.components.set(id, component);
    return component;
  }

  async updateComponent(id: string, updateData: Partial<InsertComponent>): Promise<Component | undefined> {
    const component = this.components.get(id);
    if (!component) return undefined;
    
    const updatedComponent: Component = {
      ...component,
      ...updateData,
      updatedAt: new Date(),
    };
    this.components.set(id, updatedComponent);
    return updatedComponent;
  }

  async deleteComponent(id: string): Promise<boolean> {
    return this.components.delete(id);
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

  async getAssetPartsByComponentId(componentId: string): Promise<AssetPart[]> {
    return Array.from(this.assetParts.values()).filter(assetPart => 
      assetPart.componentId && assetPart.componentId.toString() === componentId
    );
  }

  async createAssetPart(insertAssetPart: InsertAssetPart): Promise<AssetPart> {
    const id = (this.assetParts.size + 1).toString();
    const now = new Date();
    const assetPart: AssetPart = {
      ...insertAssetPart,
      id: parseInt(id),
      mowerId: insertAssetPart.mowerId || null,
      componentId: insertAssetPart.componentId || null,
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
    
    const updatedAssetPart: AssetPart = {
      ...assetPart,
      ...updateData,
    };
    this.assetParts.set(id, updatedAssetPart);
    return updatedAssetPart;
  }

  async deleteAssetPart(id: string): Promise<boolean> {
    return this.assetParts.delete(id);
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
  async getServiceRecordsByMowerId(mowerId: string): Promise<ServiceRecord[]> {
    return await db.select().from(serviceRecords).where(eq(serviceRecords.mowerId, parseInt(mowerId)));
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

  // Attachment methods
  async getAttachment(id: string): Promise<Attachment | undefined> {
    const result = await db.select().from(attachments).where(eq(attachments.id, id));
    return result[0];
  }

  async getAttachmentsByMowerId(mowerId: string): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.mowerId, parseInt(mowerId)));
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

  // Component methods
  async getComponent(id: string): Promise<Component | undefined> {
    const result = await db.select().from(components).where(eq(components.id, parseInt(id)));
    return result[0];
  }

  async getComponentsByMowerId(mowerId: string): Promise<Component[]> {
    return await db.select().from(components).where(eq(components.mowerId, parseInt(mowerId)));
  }

  async getAllComponents(): Promise<Component[]> {
    return await db.select().from(components);
  }

  async createComponent(insertComponent: InsertComponent): Promise<Component> {
    const result = await db.insert(components).values(insertComponent).returning();
    return result[0];
  }

  async updateComponent(id: string, updateData: Partial<InsertComponent>): Promise<Component | undefined> {
    const result = await db.update(components)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(components.id, parseInt(id)))
      .returning();
    return result[0];
  }

  async deleteComponent(id: string): Promise<boolean> {
    const result = await db.delete(components).where(eq(components.id, parseInt(id)));
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
        componentId: assetParts.componentId,
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

  async getAssetPartsByComponentId(componentId: string): Promise<AssetPart[]> {
    return await db.select().from(assetParts).where(eq(assetParts.componentId, parseInt(componentId)));
  }

  async createAssetPart(insertAssetPart: InsertAssetPart): Promise<AssetPart> {
    const result = await db.insert(assetParts).values(insertAssetPart).returning();
    return result[0];
  }

  async updateAssetPart(id: string, updateData: Partial<InsertAssetPart>): Promise<AssetPart | undefined> {
    const result = await db.update(assetParts)
      .set(updateData)
      .where(eq(assetParts.id, parseInt(id)))
      .returning();
    return result[0];
  }

  async deleteAssetPart(id: string): Promise<boolean> {
    const result = await db.delete(assetParts).where(eq(assetParts.id, parseInt(id)));
    return (result.rowCount ?? 0) > 0;
  }
}

// Initialize storage based on environment
export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
