import { type Mower, type InsertMower, type ServiceRecord, type InsertServiceRecord, type Attachment, type InsertAttachment, type Task, type InsertTask, mowers, tasks, serviceRecords } from "@shared/schema";
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
  deleteMower(id: string): Promise<boolean>;
  
  // Task methods
  getTask(id: string): Promise<Task | undefined>;
  getTasksByMowerId(mowerId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  markTaskComplete(id: string): Promise<Task | undefined>;
  
  // Service Record methods
  createServiceRecordWithMowerUpdate(serviceRecord: InsertServiceRecord): Promise<ServiceRecord>;
}

export class MemStorage implements IStorage {
  private mowers: Map<string, Mower>;
  private tasks: Map<string, Task>;

  constructor() {
    this.mowers = new Map();
    this.tasks = new Map();
  }

  async getMower(id: string): Promise<Mower | undefined> {
    return this.mowers.get(id);
  }

  async getAllMowers(): Promise<Mower[]> {
    return Array.from(this.mowers.values());
  }

  async createMower(insertMower: InsertMower): Promise<Mower> {
    const id = randomUUID();
    const now = new Date();
    const mower: Mower = { 
      ...insertMower,
      id,
      year: insertMower.year || null,
      serialNumber: insertMower.serialNumber || null,
      purchaseDate: insertMower.purchaseDate || null,
      purchasePrice: insertMower.purchasePrice || null,
      condition: insertMower.condition || "good",
      status: insertMower.status || "active",
      notes: insertMower.notes || null,
      createdAt: now,
      updatedAt: now
    };
    this.mowers.set(id, mower);
    return mower;
  }

  async updateMower(id: string, updateData: Partial<InsertMower>): Promise<Mower | undefined> {
    const existingMower = this.mowers.get(id);
    if (!existingMower) return undefined;
    
    const updatedMower: Mower = {
      ...existingMower,
      ...updateData,
      updatedAt: new Date()
    };
    this.mowers.set(id, updatedMower);
    return updatedMower;
  }

  async deleteMower(id: string): Promise<boolean> {
    return this.mowers.delete(id);
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByMowerId(mowerId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(task => task.mowerId === mowerId);
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
  async createServiceRecordWithMowerUpdate(insertServiceRecord: InsertServiceRecord): Promise<ServiceRecord> {
    // Create service record (mock implementation for MemStorage)
    const id = randomUUID();
    const now = new Date();
    const serviceRecord: ServiceRecord = {
      ...insertServiceRecord,
      id,
      createdAt: now,
    };

    // Update mower's service dates
    const mowerId = insertServiceRecord.mowerId.toString();
    const mower = this.mowers.get(mowerId);
    if (mower) {
      const serviceDate = insertServiceRecord.serviceDate;
      const nextServiceDate = new Date(serviceDate);
      nextServiceDate.setMonth(nextServiceDate.getMonth() + 12); // Add 12 months

      const updatedMower: Mower = {
        ...mower,
        lastServiceDate: serviceDate.toISOString().split('T')[0], // Convert to date string
        nextServiceDate: nextServiceDate.toISOString().split('T')[0], // Convert to date string
      };
      this.mowers.set(mowerId, updatedMower);
    }

    return serviceRecord;
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

  async deleteMower(id: string): Promise<boolean> {
    const result = await db.delete(mowers).where(eq(mowers.id, parseInt(id)));
    return result.rowCount > 0;
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id));
    return result[0];
  }

  async getTasksByMowerId(mowerId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(eq(tasks.mowerId, mowerId));
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
    return result.rowCount > 0;
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
}

export const storage = new DbStorage();
