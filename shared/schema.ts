import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, serial, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const mowers = pgTable("mowers", {
  id: serial("id").primaryKey(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  serialNumber: text("serialnumber"),
  purchaseDate: date("purchasedate"),
  purchasePrice: decimal("purchaseprice", { precision: 10, scale: 2 }),
  location: text("location"),
  condition: text("condition").notNull().default("good"), // excellent, good, fair, poor
  status: text("status").notNull().default("active"), // active, maintenance, retired
  lastServiceDate: date("last_service_date"),
  nextServiceDate: date("next_service_date"),
  notes: text("notes"),
});

export const serviceRecords = pgTable("service_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mowerId: integer("mower_id").notNull().references(() => mowers.id, { onDelete: "cascade" }),
  serviceDate: timestamp("service_date").notNull(),
  serviceType: text("service_type").notNull(), // maintenance, repair, inspection, warranty
  description: text("description").notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  performedBy: text("performed_by"),
  nextServiceDue: timestamp("next_service_due"),
  mileage: integer("mileage"), // hours of operation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mowerId: integer("mower_id").notNull().references(() => mowers.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  title: text("title"), // User-provided title, defaults to fileName if not provided
  fileType: text("file_type").notNull(), // pdf, image, document
  fileData: text("file_path").notNull(), // Base64 encoded file content
  fileSize: integer("file_size").notNull(),
  description: text("description"), // User-provided description
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mowerId: integer("mower_id").notNull().references(() => mowers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled
  dueDate: timestamp("due_date"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  partNumber: text("part_number"),
  category: text("category").notNull().default("maintenance"), // maintenance, repair, parts, inspection, other
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const mowersRelations = relations(mowers, ({ many }) => ({
  serviceRecords: many(serviceRecords),
  attachments: many(attachments),
  tasks: many(tasks),
}));

export const serviceRecordsRelations = relations(serviceRecords, ({ one }) => ({
  mower: one(mowers, {
    fields: [serviceRecords.mowerId],
    references: [mowers.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  mower: one(mowers, {
    fields: [attachments.mowerId],
    references: [mowers.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  mower: one(mowers, {
    fields: [tasks.mowerId],
    references: [mowers.id],
  }),
}));

// Insert schemas
export const insertMowerSchema = createInsertSchema(mowers).omit({
  id: true,
});

export const insertServiceRecordSchema = createInsertSchema(serviceRecords).omit({
  id: true,
  createdAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Types
export type InsertMower = z.infer<typeof insertMowerSchema>;
export type Mower = typeof mowers.$inferSelect;

export type InsertServiceRecord = z.infer<typeof insertServiceRecordSchema>;
export type ServiceRecord = typeof serviceRecords.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Combined types for API responses
export type MowerWithDetails = Mower & {
  serviceRecords: ServiceRecord[];
  attachments: Attachment[];
  tasks: Task[];
};
