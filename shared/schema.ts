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
  thumbnailAttachmentId: varchar("thumbnail_attachment_id"), // References attachments.id
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
  pageCount: integer("page_count"), // Number of pages for PDFs and documents
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

export const components = pgTable("components", {
  id: serial("id").primaryKey(),
  mowerId: integer("mower_id").references(() => mowers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  partNumber: text("part_number"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  installDate: date("install_date"),
  warrantyExpires: date("warranty_expires"),
  condition: text("condition").notNull().default("good"), // excellent, good, fair, poor
  status: text("status").notNull().default("active"), // active, maintenance, retired
  cost: decimal("cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parts = pgTable("parts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  partNumber: text("part_number").notNull(),
  manufacturer: text("manufacturer"),
  category: text("category").notNull(), // engine, transmission, hydraulic, electrical, cutting, etc.
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  minStockLevel: integer("min_stock_level").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assetParts = pgTable("asset_parts", {
  id: serial("id").primaryKey(),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  mowerId: integer("mower_id").references(() => mowers.id, { onDelete: "cascade" }),
  componentId: integer("component_id").references(() => components.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  installDate: date("install_date"),
  serviceRecordId: varchar("service_record_id").references(() => serviceRecords.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const mowersRelations = relations(mowers, ({ many, one }) => ({
  serviceRecords: many(serviceRecords),
  attachments: many(attachments),
  tasks: many(tasks),
  components: many(components),
  assetParts: many(assetParts),
  thumbnailAttachment: one(attachments, {
    fields: [mowers.thumbnailAttachmentId],
    references: [attachments.id],
  }),
}));

export const serviceRecordsRelations = relations(serviceRecords, ({ one, many }) => ({
  mower: one(mowers, {
    fields: [serviceRecords.mowerId],
    references: [mowers.id],
  }),
  assetParts: many(assetParts),
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

export const componentsRelations = relations(components, ({ one, many }) => ({
  mower: one(mowers, {
    fields: [components.mowerId],
    references: [mowers.id],
  }),
  assetParts: many(assetParts),
}));

export const partsRelations = relations(parts, ({ many }) => ({
  assetParts: many(assetParts),
}));

export const assetPartsRelations = relations(assetParts, ({ one }) => ({
  part: one(parts, {
    fields: [assetParts.partId],
    references: [parts.id],
  }),
  mower: one(mowers, {
    fields: [assetParts.mowerId],
    references: [mowers.id],
  }),
  component: one(components, {
    fields: [assetParts.componentId],
    references: [components.id],
  }),
  serviceRecord: one(serviceRecords, {
    fields: [assetParts.serviceRecordId],
    references: [serviceRecords.id],
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

export const insertComponentSchema = createInsertSchema(components).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartSchema = createInsertSchema(parts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssetPartSchema = createInsertSchema(assetParts).omit({
  id: true,
  createdAt: true,
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

export type InsertComponent = z.infer<typeof insertComponentSchema>;
export type Component = typeof components.$inferSelect;

export type InsertPart = z.infer<typeof insertPartSchema>;
export type Part = typeof parts.$inferSelect;

export type InsertAssetPart = z.infer<typeof insertAssetPartSchema>;
export type AssetPart = typeof assetParts.$inferSelect;

// Combined types for API responses
export type MowerWithDetails = Mower & {
  serviceRecords: ServiceRecord[];
  attachments: Attachment[];
  tasks: Task[];
  components: Component[];
};

export type ComponentWithParts = Component & {
  assetParts: (AssetPart & { part: Part })[];
};

export type PartWithStock = Part & {
  allocatedQuantity?: number;
  availableQuantity?: number;
};

export type AssetPartWithDetails = AssetPart & {
  part: Part;
  mower?: Mower;
  component?: Component;
  serviceRecord?: ServiceRecord;
};
