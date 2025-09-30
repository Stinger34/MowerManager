import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import {
  insertMowerSchema,
  insertTaskSchema,
  insertServiceRecordSchema,
  insertAttachmentSchema,
  insertEngineSchema,
  insertPartSchema,
  insertAssetPartSchema,
  insertNotificationSchema
} from "@shared/schema";
import { processPDF, getDocumentPageCount, generateTxtThumbnail } from "./pdfUtils";
import { createBackup, validateBackupFile, restoreFromBackup } from "./backup";
import { NotificationService } from "./notificationService";
import { webSocketService } from "./websocketService";

/**
 * Registers all API routes and returns the underlying HTTP server.
 */
export async function registerRoutes(app: Express): Promise<Server> {

  // ---------------------------------------------------------------------------
  // File Upload Configuration
  // ---------------------------------------------------------------------------
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "application/zip",
        "application/x-zip-compressed",
        "multipart/x-zip"
      ];
      if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".zip")) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only PDF, images, documents, and ZIP files are allowed."));
      }
    }
  });

  const backupUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowedTypes = ["application/zip", "application/x-zip-compressed", "multipart/x-zip"];
      if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith(".zip")) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Only ZIP files are allowed for backup restore."));
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Deprecation Helper & Notice for /api/components*
  // ---------------------------------------------------------------------------
  function setComponentDeprecationHeaders(res: Response) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", "2025-12-31");
    res.setHeader("Link", "</api/engines>; rel=\"successor-version\"");
    res.setHeader("X-Deprecated-Endpoint", "/api/components");
  }

  /* ===========================================================================
   * DEPRECATION NOTICE: /api/components*
   * ---------------------------------------------------------------------------
   * These endpoints provide backward compatibility for the renaming of the
   * domain entity from 'Component' to 'Engine'. They now emit deprecation
   * headers and will be removed after the Sunset date.
   *
   * Migration Tasks:
   *   - Replace all '/api/components' and '/api/mowers/:id/components' calls with:
   *       /api/engines
   *       /api/mowers/:mowerId/engines
   *   - Rename query keys, types, filenames, variables: Component -> Engine.
   *   - Replace componentId with engineId everywhere (asset parts, forms, hooks).
   *   - Remove WebSocket listeners for 'component-*' events (server emits engine-*).
   *
   * Deprecation Headers (already active):
   *   Deprecation: true
   *   Sunset: 2025-12-31
   *   Link: </api/engines>; rel="successor-version"
   *   X-Deprecated-Endpoint: /api/components
   *
   * Recommended Removal Path:
   *   Phase 1 (now): Deprecation headers + docs
   *   Phase 2: Frontend migrated
   *   Phase 3: Return HTTP 410 for one release
   *   Phase 4: Remove code
   * =========================================================================== */

  // ---------------------------------------------------------------------------
  // Utility Functions
  // ---------------------------------------------------------------------------
  function sanitizeDateString(s?: string | null) {
    return s ? s.split("T")[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Mower Routes
  // ---------------------------------------------------------------------------
  app.get("/api/mowers", async (_req, res) => {
    try { res.json(await storage.getAllMowers()); }
    catch { res.status(500).json({ error: "Failed to fetch mowers" }); }
  });

  app.get("/api/mowers/:id", async (req, res) => {
    try {
      const mower = await storage.getMower(req.params.id);
      if (!mower) return res.status(404).json({ error: "Mower not found" });
      res.json(mower);
    } catch {
      res.status(500).json({ error: "Failed to fetch mower" });
    }
  });

  app.post("/api/mowers", async (req, res) => {
    try {
      const transformed = {
        ...req.body,
        purchaseDate: sanitizeDateString(req.body.purchaseDate),
        lastServiceDate: sanitizeDateString(req.body.lastServiceDate),
        nextServiceDate: sanitizeDateString(req.body.nextServiceDate),
        purchasePrice: req.body.purchasePrice || null,
        serialNumber: req.body.serialNumber || null,
        notes: req.body.notes || null
      };
      const validated = insertMowerSchema.parse(transformed);
      const mower = await storage.createMower(validated);
      await NotificationService.createMowerNotification("added", `${mower.make} ${mower.model}`, mower.id.toString());
      webSocketService.broadcastAssetEvent("asset-created", "mower", mower.id, { mower });
      res.status(201).json(mower);
    } catch (error) {
      res.status(400).json({ error: "Invalid mower data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/mowers/:id", async (req, res) => {
    try {
      const transformed = {
        ...req.body,
        purchaseDate: sanitizeDateString(req.body.purchaseDate),
        lastServiceDate: sanitizeDateString(req.body.lastServiceDate),
        nextServiceDate: sanitizeDateString(req.body.nextServiceDate),
        purchasePrice: req.body.purchasePrice || null,
        serialNumber: req.body.serialNumber || null,
        notes: req.body.notes || null
      };
      const updates = insertMowerSchema.partial().parse(transformed);
      const mower = await storage.updateMower(req.params.id, updates);
      if (!mower) return res.status(404).json({ error: "Mower not found" });
      webSocketService.broadcastAssetEvent("asset-updated", "mower", mower.id, { mower });
      res.json(mower);
    } catch (error) {
      res.status(400).json({ error: "Invalid mower data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/mowers/:id", async (req, res) => {
    try {
      const mower = await storage.getMower(req.params.id);
      const deleted = await storage.deleteMower(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Mower not found" });
      if (mower) {
        await NotificationService.createMowerNotification("deleted", `${mower.make} ${mower.model}`, mower.id.toString());
        webSocketService.broadcastAssetEvent("asset-deleted", "mower", mower.id, { mower });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete mower" });
    }
  });

  // ---------------------------------------------------------------------------
  // Task Routes
  // ---------------------------------------------------------------------------
  app.get("/api/mowers/:mowerId/tasks", async (req, res) => {
    try { res.json(await storage.getTasksByMowerId(req.params.mowerId)); }
    catch { res.status(500).json({ error: "Failed to fetch tasks" }); }
  });

  app.post("/api/mowers/:mowerId/tasks", async (req, res) => {
    try {
      const data = { ...req.body, mowerId: parseInt(req.params.mowerId) };
      const validated = insertTaskSchema.parse(data);
      const task = await storage.createTask(validated);
      webSocketService.broadcastAssetEvent("task-created", "task", task.id, { task, mowerId: task.mowerId });
      res.status(201).json(task);
    } catch {
      res.status(400).json({ error: "Invalid task data" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const updates = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, updates);
      if (!task) return res.status(404).json({ error: "Task not found" });
      webSocketService.broadcastAssetEvent("task-updated", "task", task.id, { task, mowerId: task.mowerId });
      res.json(task);
    } catch {
      res.status(400).json({ error: "Invalid task data" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const task = await storage.getTask(req.params.id);
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Task not found" });
      if (task) {
        webSocketService.broadcastAssetEvent("task-deleted", "task", task.id, { task, mowerId: task.mowerId });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  app.post("/api/tasks/:id/complete", async (req, res) => {
    try {
      const task = await storage.markTaskComplete(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      res.json(task);
    } catch {
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // ---------------------------------------------------------------------------
  // Service Record Routes
  // ---------------------------------------------------------------------------
  app.get("/api/mowers/:id/service", async (req, res) => {
    try { res.json(await storage.getServiceRecordsByMowerId(req.params.id)); }
    catch { res.status(500).json({ error: "Failed to fetch service records" }); }
  });

  app.get("/api/service-records", async (_req, res) => {
    try { res.json(await storage.getAllServiceRecords()); }
    catch { res.status(500).json({ error: "Failed to fetch service records" }); }
  });

  app.post("/api/mowers/:id/service", async (req, res) => {
    try {
      const data = {
        ...req.body,
        mowerId: parseInt(req.params.id),
        serviceDate: new Date(req.body.serviceDate),
        cost: req.body.cost ? String(req.body.cost) : null,
        performedBy: req.body.performedBy || null,
        mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
        nextServiceDue: req.body.nextServiceDue ? new Date(req.body.nextServiceDue) : null
      };
      const validated = insertServiceRecordSchema.parse(data);
      const serviceRecord = await storage.createServiceRecordWithMowerUpdate(validated);
      webSocketService.broadcastAssetEvent("service-created", "service-record", serviceRecord.id, { serviceRecord, mowerId: serviceRecord.mowerId });
      res.status(201).json(serviceRecord);
    } catch {
      res.status(400).json({ error: "Invalid service record data" });
    }
  });

  app.put("/api/service/:id", async (req, res) => {
    try {
      const update = {
        ...req.body,
        serviceDate: req.body.serviceDate ? new Date(req.body.serviceDate) : undefined,
        cost: "cost" in req.body ? (req.body.cost !== null && req.body.cost !== "" ? String(req.body.cost) : null) : undefined,
        performedBy: "performedBy" in req.body ? (req.body.performedBy || null) : undefined,
        mileage: "mileage" in req.body ? (req.body.mileage !== null && req.body.mileage !== "" ? parseInt(req.body.mileage) : null) : undefined,
        nextServiceDue: req.body.nextServiceDue ? new Date(req.body.nextServiceDue) : undefined
      };
      const cleaned = Object.fromEntries(Object.entries(update).filter(([_, v]) => v !== undefined));
      const validated = insertServiceRecordSchema.partial().parse(cleaned);
      const updated = await storage.updateServiceRecord(req.params.id, validated);
      if (!updated) return res.status(404).json({ error: "Service record not found" });
      webSocketService.broadcastAssetEvent("service-updated", "service-record", updated.id, { serviceRecord: updated, mowerId: updated.mowerId });
      res.json(updated);
    } catch {
      res.status(400).json({ error: "Invalid service record data" });
    }
  });

  app.delete("/api/service/:id", async (req, res) => {
    try {
      const record = await storage.getServiceRecord(req.params.id);
      const deleted = await storage.deleteServiceRecord(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Service record not found" });
      if (record) {
        webSocketService.broadcastAssetEvent("service-deleted", "service-record", record.id, { serviceRecord: record, mowerId: record.mowerId });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete service record" });
    }
  });

  // ---------------------------------------------------------------------------
  // Mower Attachments (and generic attachments endpoints)
  // ---------------------------------------------------------------------------
  app.post("/api/mowers/:id/attachments", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileData = req.file.buffer.toString("base64");
      let fileType: string = "document";
      if (req.file.mimetype.startsWith("image/")) fileType = "image";
      else if (req.file.mimetype === "application/pdf") fileType = "pdf";
      else if (req.file.mimetype === "text/plain") fileType = "txt";
      else if (
        req.file.mimetype === "application/zip" ||
        req.file.mimetype === "application/x-zip-compressed" ||
        req.file.mimetype === "multipart/x-zip" ||
        req.file.originalname.toLowerCase().endsWith(".zip")
      ) fileType = "zip";

      let pageCount: number | null = null;
      try {
        if (fileType === "pdf") {
          const pdfInfo = await processPDF(req.file.buffer);
          pageCount = pdfInfo.pageCount;
        } else if (fileType === "document" || fileType === "txt") {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.originalname);
        }
      } catch {
        // ignore page count errors
      }

      const attachmentData = {
        mowerId: parseInt(req.params.id),
        fileName: req.file.originalname,
        title: req.body.title || null,
        fileType,
        fileData,
        fileSize: req.file.size,
        pageCount,
        description: req.body.description || null
      };
      const validated = insertAttachmentSchema.parse(attachmentData);
      const attachment = await storage.createAttachment(validated);
      const { fileData: _fd, ...safe } = attachment;
      res.status(201).json(safe);
    } catch (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size is 30MB." });
      }
      res.status(400).json({ error: "Invalid attachment data" });
    }
  });

  app.get("/api/mowers/:id/attachments", async (req, res) => {
    try {
      const attachments = await storage.getAttachmentsByMowerId(req.params.id);
      res.json(attachments.map(({ fileData, ...a }) => a));
    } catch {
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.get("/api/attachments/:id/download", async (req, res) => {
    try {
      const attachment = await storage.getAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });
      const fileBuffer = Buffer.from(attachment.fileData, "base64");
      let contentType = "application/octet-stream";
      if (attachment.fileType === "image") {
        const ext = attachment.fileName.split(".").pop()?.toLowerCase();
        if (ext === "png") contentType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "gif") contentType = "image/gif";
        else if (ext === "webp") contentType = "image/webp";
      } else if (attachment.fileType === "pdf") contentType = "application/pdf";
      else if (attachment.fileName.endsWith(".txt")) contentType = "text/plain";
      else if (attachment.fileName.endsWith(".doc")) contentType = "application/msword";
      else if (attachment.fileName.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const inline = req.query.inline === "1";
      const viewable = ["image", "pdf"].includes(attachment.fileType) || attachment.fileName.endsWith(".txt");
      const disposition = inline && viewable ? "inline" : "attachment";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `${disposition}; filename="${attachment.fileName}"`);
      res.setHeader("Content-Length", fileBuffer.length);
      res.send(fileBuffer);
    } catch {
      res.status(500).json({ error: "Failed to download attachment" });
    }
  });

  app.get("/api/attachments/:id/thumbnail", async (req, res) => {
    try {
      const attachment = await storage.getAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });
      if (attachment.fileType !== "pdf") return res.status(400).json({ error: "Thumbnail generation only supported for PDFs" });
      const pdfInfo = await processPDF(Buffer.from(attachment.fileData, "base64"));
      if (!pdfInfo.thumbnailBuffer) return res.status(500).json({ error: "Failed to generate PDF thumbnail" });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", pdfInfo.thumbnailBuffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(pdfInfo.thumbnailBuffer);
    } catch {
      res.status(500).json({ error: "Failed to generate PDF thumbnail" });
    }
  });

  app.get("/api/attachments/:id/txt-thumbnail", async (req, res) => {
    try {
      const attachment = await storage.getAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ error: "Attachment not found" });
      if (!attachment.fileName.toLowerCase().endsWith(".txt")) return res.status(400).json({ error: "Thumbnail generation only supported for TXT files" });
      const info = await generateTxtThumbnail(Buffer.from(attachment.fileData, "base64"));
      if (!info.thumbnailBuffer) return res.status(500).json({ error: "Failed to generate TXT thumbnail" });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", info.thumbnailBuffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(info.thumbnailBuffer);
    } catch {
      res.status(500).json({ error: "Failed to generate TXT thumbnail" });
    }
  });

  app.get("/api/mowers/:id/thumbnail", async (req, res) => {
    try {
      const mower = await storage.getMower(req.params.id);
      if (!mower) return res.status(404).json({ error: "Mower not found" });
      let thumb = null;
      if (mower.thumbnailAttachmentId) {
        try {
          const att = await storage.getAttachment(mower.thumbnailAttachmentId);
          if (att && att.fileType.startsWith("image") && att.mowerId === mower.id) {
            thumb = att;
          }
        } catch { /* ignore */ }
      }
      if (!thumb) {
        const attachments = await storage.getAttachmentsByMowerId(req.params.id);
        thumb = attachments.find(a => a.fileType.startsWith("image")) || null;
      }
      if (!thumb) return res.status(404).json({ error: "No image attachments found" });
      res.json({
        id: thumb.id,
        fileName: thumb.fileName,
        fileType: thumb.fileType,
        downloadUrl: `/api/attachments/${thumb.id}/download?inline=1`
      });
    } catch {
      res.status(500).json({ error: "Failed to get thumbnail" });
    }
  });

  app.put("/api/mowers/:id/thumbnail", async (req, res) => {
    try {
      const { attachmentId } = req.body;
      if (attachmentId) {
        const att = await storage.getAttachment(attachmentId);
        if (!att) return res.status(404).json({ error: "Attachment not found" });
        if (att.mowerId !== parseInt(req.params.id)) return res.status(400).json({ error: "Attachment does not belong to this mower" });
        if (!att.fileType.startsWith("image")) return res.status(400).json({ error: "Attachment must be an image" });
      }
      const updated = await storage.updateMowerThumbnail(req.params.id, attachmentId || null);
      if (!updated) return res.status(404).json({ error: "Mower not found" });
      res.json({ success: true, thumbnailAttachmentId: attachmentId || null });
    } catch {
      res.status(500).json({ error: "Failed to set thumbnail" });
    }
  });

  app.delete("/api/attachments/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAttachment(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Attachment not found" });
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  app.put("/api/attachments/:id", async (req, res) => {
    try {
      const updated = await storage.updateAttachmentMetadata(req.params.id, {
        title: req.body.title,
        description: req.body.description
      });
      if (!updated) return res.status(404).json({ error: "Attachment not found" });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "Failed to update attachment metadata" });
    }
  });

  // ---------------------------------------------------------------------------
  // Engine (Canonical) Routes
  // ---------------------------------------------------------------------------
  app.get("/api/engines", async (_req, res) => {
    try { 
      const allEngines = await storage.getAllEngines();
      // Only return global engines (not allocated to any mower)
      const globalEngines = allEngines.filter(engine => engine.mowerId === null);
      res.json(globalEngines);
    }
    catch { res.status(500).json({ error: "Failed to fetch engines" }); }
  });

  app.get("/api/engines/:id", async (req, res) => {
    try {
      const engine = await storage.getEngine(req.params.id);
      if (!engine) return res.status(404).json({ error: "Engine not found" });
      res.json(engine);
    } catch {
      res.status(500).json({ error: "Failed to fetch engine" });
    }
  });

  app.post("/api/engines", async (req, res) => {
    try {
      // Global engines should NEVER have a mowerId - this ensures they are not auto-allocated
      const engineData = { ...req.body };
      if (engineData.mowerId) {
        // Explicitly remove any mowerId to prevent auto-allocation
        delete engineData.mowerId;
      }
      
      const validated = insertEngineSchema.parse(engineData);
      const engine = await storage.createEngine(validated);
      await NotificationService.createEngineNotification("created", engine.name, engine.id.toString());
      webSocketService.broadcastAssetEvent("engine-created", "engine", engine.id, { engine, mowerId: engine.mowerId });
      res.status(201).json(engine);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid engine data" });
    }
  });

  app.get("/api/mowers/:mowerId/engines", async (req, res) => {
    try { res.json(await storage.getEnginesByMowerId(req.params.mowerId)); }
    catch { res.status(500).json({ error: "Failed to fetch mower engines" }); }
  });

  app.post("/api/mowers/:mowerId/engines", async (req, res) => {
    try {
      const payload = { ...req.body, mowerId: parseInt(req.params.mowerId) };
      const validated = insertEngineSchema.parse(payload);
      const engine = await storage.createEngine(validated);
      const mower = await storage.getMower(req.params.mowerId);
      await NotificationService.createEngineNotification(
        "allocated",
        engine.name,
        engine.id.toString(),
        mower ? `${mower.make} ${mower.model}` : undefined,
        req.params.mowerId
      );
      res.status(201).json(engine);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid engine data" });
    }
  });

  app.put("/api/engines/:id", async (req, res) => {
    try {
      const engine = await storage.updateEngine(req.params.id, req.body);
      if (!engine) return res.status(404).json({ error: "Engine not found" });
      webSocketService.broadcastAssetEvent("engine-updated", "engine", engine.id, { engine, mowerId: engine.mowerId });
      res.json(engine);
    } catch (error) {
      res.status(400).json({ error: "Invalid engine data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/engines/:id", async (req, res) => {
    try {
      const engine = await storage.getEngine(req.params.id);
      const deleted = await storage.deleteEngine(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Engine not found" });
      if (engine) {
        await NotificationService.createEngineNotification("deleted", engine.name, engine.id.toString());
        webSocketService.broadcastAssetEvent("engine-deleted", "engine", engine.id, { engine, mowerId: engine.mowerId });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete engine" });
    }
  });

  // Engine attachments (canonical)
  app.post("/api/engines/:id/attachments", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const engine = await storage.getEngine(req.params.id);
      if (!engine) return res.status(404).json({ error: "Engine not found" });

      const fileData = req.file.buffer.toString("base64");
      let fileType: string = "document";
      if (req.file.mimetype.startsWith("image/")) fileType = "image";
      else if (req.file.mimetype === "application/pdf") fileType = "pdf";
      else if (req.file.mimetype === "text/plain") fileType = "txt";
      else if (
        req.file.mimetype === "application/zip" ||
        req.file.mimetype === "application/x-zip-compressed" ||
        req.file.mimetype === "multipart/x-zip" ||
        req.file.originalname.toLowerCase().endsWith(".zip")
      ) fileType = "zip";

      let pageCount: number | null = null;
      try {
        if (fileType === "pdf") {
          const pdfInfo = await processPDF(req.file.buffer);
            pageCount = pdfInfo.pageCount;
        } else if (fileType === "document" &&
          (req.file.mimetype === "application/msword" ||
           req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.mimetype);
        } else if (fileType === "txt") {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.originalname);
        }
      } catch { /* ignore */ }

      const attachment = await storage.createAttachment({
        engineId: parseInt(req.params.id),
        mowerId: null,
        partId: null,
        fileName: req.file.originalname,
        title: req.body.title || req.file.originalname,
        fileType,
        fileData,
        fileSize: req.file.size,
        pageCount,
        description: req.body.description || null
      });
      const { fileData: _fd, ...safe } = attachment;
      res.status(201).json(safe);
    } catch (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size is 30MB." });
      }
      res.status(400).json({ error: "Invalid attachment data" });
    }
  });

  app.get("/api/engines/:id/attachments", async (req, res) => {
    try { res.json((await storage.getAttachmentsByEngineId(req.params.id)).map(({ fileData, ...a }) => a)); }
    catch { res.status(500).json({ error: "Failed to fetch engine attachments" }); }
  });

  // ---------------------------------------------------------------------------
  // Deprecated Components Compatibility Routes
  // ---------------------------------------------------------------------------
  app.get("/api/components", async (_req, res) => {
    setComponentDeprecationHeaders(res);
    try { res.json(await storage.getAllEngines()); }
    catch { res.status(500).json({ error: "Failed to fetch components", deprecated: true }); }
  });

  app.get("/api/components/:id", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try {
      const engine = await storage.getEngine(req.params.id);
      if (!engine) return res.status(404).json({ error: "Component not found", deprecated: true });
      res.json(engine);
    } catch {
      res.status(500).json({ error: "Failed to fetch component", deprecated: true });
    }
  });

  app.post("/api/components", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try {
      const validated = insertEngineSchema.parse(req.body);
      const engine = await storage.createEngine(validated);
      await NotificationService.createEngineNotification("created", engine.name, engine.id.toString());
      webSocketService.broadcastAssetEvent("engine-created", "engine", engine.id, { engine, mowerId: engine.mowerId });
      res.status(201).json(engine);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid component data", deprecated: true });
    }
  });

  app.get("/api/mowers/:mowerId/components", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try { res.json(await storage.getEnginesByMowerId(req.params.mowerId)); }
    catch { res.status(500).json({ error: "Failed to fetch mower components", deprecated: true }); }
  });

  app.post("/api/mowers/:mowerId/components", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try {
      const payload = { ...req.body, mowerId: parseInt(req.params.mowerId) };
      const validated = insertEngineSchema.parse(payload);
      const engine = await storage.createEngine(validated);
      const mower = await storage.getMower(req.params.mowerId);
      await NotificationService.createEngineNotification(
        "allocated",
        engine.name,
        engine.id.toString(),
        mower ? `${mower.make} ${mower.model}` : undefined,
        req.params.mowerId
      );
      res.status(201).json(engine);
    } catch (error) {
      res.status(400).json({ error: "Invalid component data", deprecated: true, details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/components/:id", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try {
      const engine = await storage.updateEngine(req.params.id, req.body);
      if (!engine) return res.status(404).json({ error: "Component not found", deprecated: true });
      webSocketService.broadcastAssetEvent("engine-updated", "engine", engine.id, { engine, mowerId: engine.mowerId });
      res.json(engine);
    } catch {
      res.status(400).json({ error: "Invalid component data", deprecated: true });
    }
  });

  app.delete("/api/components/:id", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try {
      const engine = await storage.getEngine(req.params.id);
      const deleted = await storage.deleteEngine(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Component not found", deprecated: true });
      if (engine) {
        await NotificationService.createEngineNotification("deleted", engine.name, engine.id.toString());
        webSocketService.broadcastAssetEvent("engine-deleted", "engine", engine.id, { engine, mowerId: engine.mowerId });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete component", deprecated: true });
    }
  });

  app.get("/api/components/:id/attachments", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try {
      const attachments = await storage.getAttachmentsByEngineId(req.params.id);
      res.json(attachments.map(({ fileData, ...a }) => a));
    } catch {
      res.status(500).json({ error: "Failed to fetch component attachments", deprecated: true });
    }
  });

  app.get("/api/components/:componentId/parts", async (req, res) => {
    setComponentDeprecationHeaders(res);
    try { res.json(await storage.getAssetPartsByEngineId(req.params.componentId)); }
    catch { res.status(500).json({ error: "Failed to fetch component parts", deprecated: true }); }
  });

  // ---------------------------------------------------------------------------
  // Part Routes
  // ---------------------------------------------------------------------------
  app.get("/api/parts", async (_req, res) => {
    try { res.json(await storage.getAllParts()); }
    catch { res.status(500).json({ error: "Failed to fetch parts" }); }
  });

  app.get("/api/parts/:id", async (req, res) => {
    try {
      const part = await storage.getPart(req.params.id);
      if (!part) return res.status(404).json({ error: "Part not found" });
      res.json(part);
    } catch {
      res.status(500).json({ error: "Failed to fetch part" });
    }
  });

  app.post("/api/parts", async (req, res) => {
    try {
      const validated = insertPartSchema.parse(req.body);
      const part = await storage.createPart(validated);
      await NotificationService.createPartNotification("created", part.name, part.id.toString());
      webSocketService.broadcastAssetEvent("part-created", "part", part.id, { part });
      res.status(201).json(part);
    } catch (error) {
      res.status(400).json({ error: "Invalid part data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/parts/:id", async (req, res) => {
    try {
      const part = await storage.updatePart(req.params.id, req.body);
      if (!part) return res.status(404).json({ error: "Part not found" });
      webSocketService.broadcastAssetEvent("part-updated", "part", part.id, { part });
      res.json(part);
    } catch (error) {
      res.status(400).json({ error: "Invalid part data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/parts/:id", async (req, res) => {
    try {
      const part = await storage.getPart(req.params.id);
      const deleted = await storage.deletePart(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Part not found" });
      if (part) {
        await NotificationService.createPartNotification("deleted", part.name, part.id.toString());
        webSocketService.broadcastAssetEvent("part-deleted", "part", part.id, { part });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete part" });
    }
  });

  // Part attachments
  app.post("/api/parts/:id/attachments", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const part = await storage.getPart(req.params.id);
      if (!part) return res.status(404).json({ error: "Part not found" });
      const fileData = req.file.buffer.toString("base64");
      let fileType = "document";
      if (req.file.mimetype.startsWith("image/")) fileType = "image";
      else if (req.file.mimetype === "application/pdf") fileType = "pdf";
      else if (req.file.mimetype === "text/plain") fileType = "txt";
      else if (
        req.file.mimetype === "application/zip" ||
        req.file.mimetype === "application/x-zip-compressed" ||
        req.file.mimetype === "multipart/x-zip" ||
        req.file.originalname.toLowerCase().endsWith(".zip")
      ) fileType = "zip";

      let pageCount: number | null = null;
      try {
        if (fileType === "pdf") {
          const pdfInfo = await processPDF(req.file.buffer);
          pageCount = pdfInfo.pageCount;
        } else if (fileType === "document" && (
          req.file.mimetype === "application/msword" ||
          req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )) {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.mimetype);
        } else if (fileType === "txt") {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.originalname);
        }
      } catch { /* ignore */ }

      const attachment = await storage.createAttachment({
        partId: parseInt(req.params.id),
        mowerId: null,
        engineId: null,
        fileName: req.file.originalname,
        title: req.body.title || req.file.originalname,
        fileType,
        fileData,
        fileSize: req.file.size,
        pageCount,
        description: req.body.description || null
      });
      const { fileData: _fd, ...safe } = attachment;
      res.status(201).json(safe);
    } catch (error) {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large. Maximum size is 30MB." });
      }
      res.status(400).json({ error: "Invalid attachment data" });
    }
  });

  app.get("/api/parts/:id/attachments", async (req, res) => {
    try { res.json((await storage.getAttachmentsByPartId(req.params.id)).map(({ fileData, ...a }) => a)); }
    catch { res.status(500).json({ error: "Failed to fetch part attachments" }); }
  });

  app.get("/api/parts/:id/allocations", async (req, res) => {
    try { res.json(await storage.getAssetPartsByPartId(req.params.id)); }
    catch { res.status(500).json({ error: "Failed to fetch part allocations" }); }
  });

  // ---------------------------------------------------------------------------
  // Asset Part Allocation
  // ---------------------------------------------------------------------------
  app.get("/api/mowers/:mowerId/parts", async (req, res) => {
    try { res.json(await storage.getAssetPartsWithDetailsByMowerId(req.params.mowerId)); }
    catch { res.status(500).json({ error: "Failed to fetch mower parts" }); }
  });

  app.get("/api/engines/:engineId/parts", async (req, res) => {
    try { res.json(await storage.getAssetPartsByEngineId(req.params.engineId)); }
    catch { res.status(500).json({ error: "Failed to fetch engine parts" }); }
  });

  app.post("/api/asset-parts", async (req, res) => {
    try {
      const validated = insertAssetPartSchema.parse(req.body);
      const assetPart = await storage.createAssetPart(validated);
      const part = await storage.getPart(assetPart.partId.toString());
      let mowerName: string | undefined;
      let mowerId: string | undefined;
      if (assetPart.mowerId) {
        const mower = await storage.getMower(assetPart.mowerId.toString());
        if (mower) {
          mowerName = `${mower.make} ${mower.model}`;
          mowerId = mower.id.toString();
        }
      }
      if (part) {
        await NotificationService.createPartNotification("allocated", part.name, part.id.toString(), mowerName, mowerId);
      }
      webSocketService.broadcastAssetEvent("asset-part-created", "asset-part", assetPart.id, {
        assetPart,
        mowerId: assetPart.mowerId,
        engineId: assetPart.engineId
      });
      res.status(201).json(assetPart);
    } catch (error) {
      res.status(400).json({ error: "Invalid asset part data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/asset-parts/:id", async (req, res) => {
    try {
      const assetPart = await storage.updateAssetPart(req.params.id, req.body);
      if (!assetPart) return res.status(404).json({ error: "Asset part allocation not found" });
      webSocketService.broadcastAssetEvent("asset-part-updated", "asset-part", assetPart.id, {
        assetPart,
        mowerId: assetPart.mowerId,
        engineId: assetPart.engineId
      });
      res.json(assetPart);
    } catch (error) {
      res.status(400).json({ error: "Invalid asset part data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/asset-parts/:id", async (req, res) => {
    try {
      const assetPart = await storage.getAssetPart(req.params.id);
      const deleted = await storage.deleteAssetPart(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Asset part allocation not found" });
      if (assetPart) {
        webSocketService.broadcastAssetEvent("asset-part-deleted", "asset-part", assetPart.id, {
          assetPart,
          mowerId: assetPart.mowerId,
          engineId: assetPart.engineId
        });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete asset part allocation" });
    }
  });

  // ---------------------------------------------------------------------------
  // Backup & Restore (Auth placeholder)
  // ---------------------------------------------------------------------------
  const requireAuth = (req: Request, _res: Response, next: Function) => {
    console.log(`Sensitive operation: ${req.method} ${req.path} from ${req.ip}`);
    next();
  };

  app.post("/api/backup", requireAuth, async (_req, res) => {
    try {
      await createBackup(res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create backup", details: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  app.post("/api/restore", requireAuth, backupUpload.single("backup"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No backup file uploaded" });
      const allowedTypes = ["application/zip", "application/x-zip-compressed", "multipart/x-zip"];
      if (!allowedTypes.includes(req.file.mimetype) && !req.file.originalname.toLowerCase().endsWith(".zip")) {
        return res.status(400).json({ error: "Invalid file type. Please upload a ZIP file." });
      }
      if (req.file.size > 100 * 1024 * 1024) {
        return res.status(400).json({ error: "File too large. Maximum size is 100MB." });
      }
      const validation = await validateBackupFile(req.file.buffer);
      if (!validation.valid) return res.status(400).json({ error: validation.error });
      const result = await restoreFromBackup(req.file.buffer);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true, message: "Backup restored successfully", stats: result.stats });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore backup", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  app.get("/api/notifications", async (_req, res) => {
    try { res.json(await storage.getNotifications()); }
    catch { res.status(500).json({ error: "Failed to fetch notifications" }); }
  });

  app.get("/api/notifications/unread", async (_req, res) => {
    try { res.json(await storage.getUnreadNotifications()); }
    catch { res.status(500).json({ error: "Failed to fetch unread notifications" }); }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const validated = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validated);
      res.status(201).json(notification);
    } catch (error) {
      res.status(400).json({ error: "Invalid notification data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) return res.status(404).json({ error: "Notification not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/read-all", async (_req, res) => {
    try {
      const success = await storage.markAllNotificationsAsRead();
      res.json({ success });
    } catch {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const success = await storage.deleteNotification(req.params.id);
      if (!success) return res.status(404).json({ error: "Notification not found" });
      res.status(204).send();
    } catch {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  app.delete("/api/notifications", async (_req, res) => {
    try {
      const success = await storage.deleteAllNotifications();
      res.json({ success });
    } catch {
      res.status(500).json({ error: "Failed to delete all notifications" });
    }
  });

  // ---------------------------------------------------------------------------
  // Reminders
  // ---------------------------------------------------------------------------
  app.get("/api/reminders/low-stock", async (_req, res) => {
    try { res.json(await storage.getLowStockParts()); }
    catch { res.status(500).json({ error: "Failed to fetch low-stock parts" }); }
  });

  app.get("/api/reminders/upcoming-services", async (_req, res) => {
    try { res.json(await storage.getUpcomingServiceReminders()); }
    catch { res.status(500).json({ error: "Failed to fetch upcoming service reminders" }); }
  });

  app.get("/api/reminders", async (_req, res) => {
    try {
      const [lowStockParts, upcomingServices] = await Promise.all([
        storage.getLowStockParts(),
        storage.getUpcomingServiceReminders()
      ]);

      const stockReminders = lowStockParts.map(part => ({
        id: `stock-${part.id}`,
        type: "stock" as const,
        title: part.name,
        subtitle: `${part.category} - ${part.stockQuantity} left (min: ${part.minStockLevel})`,
        priority: part.stockQuantity === 0 ? "high" as const : "medium" as const,
        partId: part.id,
        currentStock: part.stockQuantity,
        minStock: part.minStockLevel
      }));

      const serviceReminders = upcomingServices.map(s => ({
        id: `service-${s.mower.id}-${s.dueDate.getTime()}`,
        type: "service" as const,
        title: s.serviceType,
        subtitle: `${s.mower.make} ${s.mower.model}`,
        daysUntilDue: s.daysUntilDue,
        priority: s.daysUntilDue <= 7 ? "high" as const :
                  s.daysUntilDue <= 14 ? "medium" as const : "low" as const,
        mowerId: s.mower.id,
        dueDate: s.dueDate
      }));

      const all = [...stockReminders, ...serviceReminders].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        const diff = order[a.priority] - order[b.priority];
        if (diff !== 0) return diff;
        if (a.type === "service" && b.type === "service") return a.daysUntilDue - b.daysUntilDue;
        return 0;
      });

      res.json(all);
    } catch {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  // ---------------------------------------------------------------------------
  // Database Stats
  // ---------------------------------------------------------------------------
  app.get("/api/stats", async (_req, res) => {
    try {
      const [mowers, serviceRecords, attachments, tasks, engines, parts, assetParts] = await Promise.all([
        storage.getAllMowers(),
        storage.getAllServiceRecords(),
        storage.getAllAttachments(),
        storage.getAllTasks(),
        storage.getAllEngines(),
        storage.getAllParts(),
        storage.getAllAssetParts()
      ]);

      // Calculate total attachment size
      const totalAttachmentSize = attachments.reduce((sum, att) => sum + (att.fileSize || 0), 0);

      const stats = {
        counts: {
          mowers: mowers.length,
          serviceRecords: serviceRecords.length,
          attachments: attachments.length,
          tasks: tasks.length,
          engines: engines.length,
          parts: parts.length,
          assetParts: assetParts.length
        },
        totals: {
          activeMowers: mowers.filter(m => m.status === 'active').length,
          maintenanceMowers: mowers.filter(m => m.status === 'maintenance').length,
          retiredMowers: mowers.filter(m => m.status === 'retired').length,
          completedTasks: tasks.filter(t => t.status === 'completed').length,
          pendingTasks: tasks.filter(t => t.status === 'pending').length,
          totalAttachmentSize: totalAttachmentSize
        }
      };

      res.json(stats);
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ error: "Failed to fetch database stats" });
    }
  });

  // ---------------------------------------------------------------------------
  // Catch-all & Server Init
  // ---------------------------------------------------------------------------
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  const httpServer = createServer(app);
  webSocketService.initialize(httpServer);
  return httpServer;
}
