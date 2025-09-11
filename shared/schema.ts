import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const mowers = pgTable("mowers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year"),
  serialNumber: text("serial_number"),
  purchaseDate: timestamp("purchase_date"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  condition: text("condition").notNull().default("good"), // excellent, good, fair, poor
  status: text("status").notNull().default("active"), // active, maintenance, retired
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const serviceRecords = pgTable("service_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mowerId: varchar("mower_id").notNull().references(() => mowers.id, { onDelete: "cascade" }),
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
  mowerId: varchar("mower_id").notNull().references(() => mowers.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, image, document
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Relations
export const mowersRelations = relations(mowers, ({ many }) => ({
  serviceRecords: many(serviceRecords),
  attachments: many(attachments),
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

// Insert schemas
export const insertMowerSchema = createInsertSchema(mowers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceRecordSchema = createInsertSchema(serviceRecords).omit({
  id: true,
  createdAt: true,
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type InsertMower = z.infer<typeof insertMowerSchema>;
export type Mower = typeof mowers.$inferSelect;

export type InsertServiceRecord = z.infer<typeof insertServiceRecordSchema>;
export type ServiceRecord = typeof serviceRecords.$inferSelect;

export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachments.$inferSelect;

// Combined types for API responses
export type MowerWithDetails = Mower & {
  serviceRecords: ServiceRecord[];
  attachments: Attachment[];
};