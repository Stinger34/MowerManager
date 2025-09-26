import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertMowerSchema, insertTaskSchema, insertServiceRecordSchema, insertAttachmentSchema, insertEngineSchema, insertPartSchema, insertAssetPartSchema, insertNotificationSchema } from "@shared/schema";
import { processPDF, getDocumentPageCount, generateTxtThumbnail } from "./pdfUtils";
import { createBackup, validateBackupFile, restoreFromBackup } from "./backup";
import { NotificationService } from "./notificationService";
import { webSocketService } from "./websocketService";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Configure multer for file uploads (memory storage for base64 conversion)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 30 * 1024 * 1024, // 30MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept PDF, images, common document types, and ZIP files
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/zip',
        'application/x-zip-compressed',
        'multipart/x-zip'
      ];
      
      if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.zip')) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, images, documents, and ZIP files are allowed.'));
      }
    }
  });

  // Configure multer for backup uploads (different file types and size limits)
  const backupUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit for backups
    },
    fileFilter: (req, file, cb) => {
      // Accept ZIP files for backups
      const allowedTypes = [
        'application/zip',
        'application/x-zip-compressed',
        'multipart/x-zip'
      ];
      
      if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.zip')) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only ZIP files are allowed for backup restore.'));
      }
    }
  });

  // Mower routes
  app.get('/api/mowers', async (_req: Request, res: Response) => {
    try {
      const mowers = await storage.getAllMowers();
      res.json(mowers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch mowers' });
    }
  });

  app.get('/api/mowers/:id', async (req: Request, res: Response) => {
    try {
      console.log('Fetching mower with ID:', req.params.id);
      const mower = await storage.getMower(req.params.id);
      console.log('Mower result:', mower);
      if (!mower) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      res.json(mower);
    } catch (error) {
      console.error('Error fetching mower:', error);
      res.status(500).json({ error: 'Failed to fetch mower' });
    }
  });

  app.post('/api/mowers', async (req: Request, res: Response) => {
    try {
      console.log('Creating mower with data:', req.body);
      
      // Transform data to match schema expectations
      const transformedData = {
        ...req.body,
        purchaseDate: req.body.purchaseDate ? req.body.purchaseDate.split('T')[0] : null, // Convert to date string
        lastServiceDate: req.body.lastServiceDate ? req.body.lastServiceDate.split('T')[0] : null, // Convert to date string  
        nextServiceDate: req.body.nextServiceDate ? req.body.nextServiceDate.split('T')[0] : null, // Convert to date string
        purchasePrice: req.body.purchasePrice || null, // Convert empty string to null
        serialNumber: req.body.serialNumber || null, // Convert empty string to null
        notes: req.body.notes || null, // Convert empty string to null
      };
      
      console.log('Transformed data:', transformedData);
      const validatedData = insertMowerSchema.parse(transformedData);
      console.log('Validated data:', validatedData);
      const mower = await storage.createMower(validatedData);
      
      // Create notification for new mower
      const mowerDisplayName = `${mower.make} ${mower.model}`;
      await NotificationService.createMowerNotification('added', mowerDisplayName, mower.id.toString());
      
      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('asset-created', 'mower', mower.id, { mower });
      
      res.status(201).json(mower);
    } catch (error) {
      console.error('Mower creation error:', error);
      res.status(400).json({ error: 'Invalid mower data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/mowers/:id', async (req: Request, res: Response) => {
    try {
      console.log('Updating mower with data:', req.body);
      
      // Transform data to match schema expectations
      const transformedData = {
        ...req.body,
        purchaseDate: req.body.purchaseDate ? req.body.purchaseDate.split('T')[0] : null, // Convert to date string
        lastServiceDate: req.body.lastServiceDate ? req.body.lastServiceDate.split('T')[0] : null, // Convert to date string  
        nextServiceDate: req.body.nextServiceDate ? req.body.nextServiceDate.split('T')[0] : null, // Convert to date string
        purchasePrice: req.body.purchasePrice || null, // Convert empty string to null
        serialNumber: req.body.serialNumber || null, // Convert empty string to null
        notes: req.body.notes || null, // Convert empty string to null
      };
      
      console.log('Transformed update data:', transformedData);
      const updates = insertMowerSchema.partial().parse(transformedData);
      console.log('Validated update data:', updates);
      const mower = await storage.updateMower(req.params.id, updates);
      if (!mower) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      
      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('asset-updated', 'mower', mower.id, { mower });
      
      res.json(mower);
    } catch (error) {
      console.error('Mower update error:', error);
      res.status(400).json({ error: 'Invalid mower data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/mowers/:id', async (req: Request, res: Response) => {
    try {
      // Get mower details before deletion for notification
      const mower = await storage.getMower(req.params.id);
      
      const deleted = await storage.deleteMower(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      
      // Create notification for deleted mower
      if (mower) {
        const mowerDisplayName = `${mower.make} ${mower.model}`;
        await NotificationService.createMowerNotification('deleted', mowerDisplayName, mower.id.toString());
        
        // Broadcast WebSocket event
        webSocketService.broadcastAssetEvent('asset-deleted', 'mower', mower.id, { mower });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete mower' });
    }
  });

  // Task routes
  app.get('/api/mowers/:mowerId/tasks', async (req: Request, res: Response) => {
    try {
      console.log('Fetching tasks for mower ID:', req.params.mowerId);
      const tasks = await storage.getTasksByMowerId(req.params.mowerId);
      console.log('Tasks result:', tasks);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.post('/api/mowers/:mowerId/tasks', async (req: Request, res: Response) => {
    try {
      console.log('Task creation request:', { params: req.params, body: req.body });
      const taskData = { ...req.body, mowerId: parseInt(req.params.mowerId) };
      console.log('Task data with parsed mowerId:', taskData);
      const validatedData = insertTaskSchema.parse(taskData);
      console.log('Validated task data:', validatedData);
      const task = await storage.createTask(validatedData);
      
      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('task-created', 'task', task.id, { task, mowerId: task.mowerId });
      
      res.status(201).json(task);
    } catch (error) {
      console.error('Task creation error:', error);
      res.status(400).json({ error: 'Invalid task data' });
    }
  });

  app.get('/api/tasks/:id', async (req: Request, res: Response) => {
    try {
      const task = await storage.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  app.put('/api/tasks/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, updates);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Broadcast WebSocket event for task update
      webSocketService.broadcastAssetEvent('task-updated', 'task', task.id, { task, mowerId: task.mowerId });
      
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Invalid task data' });
    }
  });

  app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
    try {
      // Get task details before deletion for WebSocket broadcast
      const task = await storage.getTask(req.params.id);
      
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Broadcast WebSocket event for task deletion
      if (task) {
        webSocketService.broadcastAssetEvent('task-deleted', 'task', task.id, { task, mowerId: task.mowerId });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  app.post('/api/tasks/:id/complete', async (req: Request, res: Response) => {
    try {
      const task = await storage.markTaskComplete(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Failed to complete task' });
    }
  });

  // Service Record routes
  app.get('/api/mowers/:id/service', async (req: Request, res: Response) => {
    try {
      const serviceRecords = await storage.getServiceRecordsByMowerId(req.params.id);
      res.json(serviceRecords);
    } catch (error) {
      console.error('Error fetching service records:', error);
      res.status(500).json({ error: 'Failed to fetch service records' });
    }
  });

  app.get('/api/service-records', async (req: Request, res: Response) => {
    try {
      const serviceRecords = await storage.getAllServiceRecords();
      res.json(serviceRecords);
    } catch (error) {
      console.error('Error fetching all service records:', error);
      res.status(500).json({ error: 'Failed to fetch service records' });
    }
  });

  app.post('/api/mowers/:id/service', async (req: Request, res: Response) => {
    try {
      console.log('Service record creation request:', { params: req.params, body: req.body });
      
      // Transform data to match schema expectations
      const serviceData = {
        ...req.body,
        mowerId: parseInt(req.params.id),
        serviceDate: new Date(req.body.serviceDate), // Convert string to Date
        cost: req.body.cost ? String(req.body.cost) : null, // Convert number to string
        performedBy: req.body.performedBy || null,
        mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
        nextServiceDue: req.body.nextServiceDue ? new Date(req.body.nextServiceDue) : null,
      };
      
      console.log('Transformed service data:', serviceData);
      const validatedData = insertServiceRecordSchema.parse(serviceData);
      console.log('Validated service record data:', validatedData);
      
      // Create service record and update mower service dates
      const serviceRecord = await storage.createServiceRecordWithMowerUpdate(validatedData);
      
      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('service-created', 'service-record', serviceRecord.id, { 
        serviceRecord, 
        mowerId: serviceRecord.mowerId 
      });
      
      res.status(201).json(serviceRecord);
    } catch (error) {
      console.error('Service record creation error:', error);
      res.status(400).json({ error: 'Invalid service record data' });
    }
  });

  app.put('/api/service/:id', async (req: Request, res: Response) => {
    try {
      console.log('Service record update request:', { params: req.params, body: req.body });
      
      // Transform data to match schema expectations
      const updateData = {
        ...req.body,
        serviceDate: 'serviceDate' in req.body && req.body.serviceDate ? new Date(req.body.serviceDate) : undefined,
        cost: 'cost' in req.body ? (req.body.cost !== null && req.body.cost !== '' ? String(req.body.cost) : null) : undefined,
        performedBy: 'performedBy' in req.body ? (req.body.performedBy || null) : undefined,
        mileage: 'mileage' in req.body ? (req.body.mileage !== null && req.body.mileage !== '' ? parseInt(req.body.mileage) : null) : undefined,
        nextServiceDue: 'nextServiceDue' in req.body && req.body.nextServiceDue ? new Date(req.body.nextServiceDue) : undefined,
      };
      
      // Remove undefined values to avoid overwriting with undefined
      const cleanedUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );
      
      console.log('Cleaned update data:', cleanedUpdateData);
      
      // Validate partial data (allowing partial updates)
      const partialSchema = insertServiceRecordSchema.partial();
      const validatedData = partialSchema.parse(cleanedUpdateData);
      console.log('Validated update data:', validatedData);
      
      const updatedServiceRecord = await storage.updateServiceRecord(req.params.id, validatedData);
      
      if (!updatedServiceRecord) {
        return res.status(404).json({ error: 'Service record not found' });
      }
      
      // Broadcast WebSocket event for service record update
      webSocketService.broadcastAssetEvent('service-updated', 'service-record', updatedServiceRecord.id, { 
        serviceRecord: updatedServiceRecord, 
        mowerId: updatedServiceRecord.mowerId 
      });
      
      res.json(updatedServiceRecord);
    } catch (error) {
      console.error('Service record update error:', error);
      res.status(400).json({ error: 'Invalid service record data' });
    }
  });

  app.delete('/api/service/:id', async (req: Request, res: Response) => {
    try {
      console.log('Service record deletion request:', { params: req.params });
      
      // Get service record details before deletion for WebSocket broadcast
      const serviceRecord = await storage.getServiceRecord(req.params.id);
      
      const deleted = await storage.deleteServiceRecord(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Service record not found' });
      }
      
      // Broadcast WebSocket event for service record deletion
      if (serviceRecord) {
        webSocketService.broadcastAssetEvent('service-deleted', 'service-record', serviceRecord.id, { 
          serviceRecord, 
          mowerId: serviceRecord.mowerId 
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Service record deletion error:', error);
      res.status(500).json({ error: 'Failed to delete service record' });
    }
  });

  // Attachment routes
  app.post('/api/mowers/:id/attachments', upload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log('Attachment upload request:', { params: req.params, file: req.file, body: req.body });
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Convert file buffer to base64
      const fileData = req.file.buffer.toString('base64');
      
      // Determine file type category
      let fileType = 'document';
      if (req.file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (req.file.mimetype === 'application/pdf') {
        fileType = 'pdf';
      } else if (req.file.mimetype === 'text/plain') {
        fileType = 'txt';
      } else if (req.file.mimetype === 'application/zip' || 
                 req.file.mimetype === 'application/x-zip-compressed' || 
                 req.file.mimetype === 'multipart/x-zip' ||
                 req.file.originalname.toLowerCase().endsWith('.zip')) {
        fileType = 'zip';
      }

      // Extract page count for PDFs and documents
      let pageCount: number | null = null;
      try {
        if (fileType === 'pdf') {
          const pdfInfo = await processPDF(req.file.buffer);
          pageCount = pdfInfo.pageCount;
        } else if (fileType === 'document' || fileType === 'txt') {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.originalname);
        }
      } catch (error) {
        console.warn('Failed to extract page count:', error);
        // Continue without page count
      }

      const attachmentData = {
        mowerId: parseInt(req.params.id),
        fileName: req.file.originalname,
        title: req.body.title || null, // Use provided title or null (will fall back to fileName on client)
        fileType,
        fileData,
        fileSize: req.file.size,
        pageCount,
        description: req.body.description || null,
      };

      console.log('Attachment data (without file content):', {
        ...attachmentData,
        fileData: `[${fileData.length} characters]`
      });

      const validatedData = insertAttachmentSchema.parse(attachmentData);
      const attachment = await storage.createAttachment(validatedData);
      
      // Return attachment without file data for response
      const { fileData: _, ...attachmentResponse } = attachment;
      res.status(201).json(attachmentResponse);
    } catch (error) {
      console.error('Attachment upload error:', error);
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 30MB.' });
        }
      }
      res.status(400).json({ error: 'Invalid attachment data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/mowers/:id/attachments', async (req: Request, res: Response) => {
    try {
      console.log('Fetching attachments for mower ID:', req.params.id);
      const attachments = await storage.getAttachmentsByMowerId(req.params.id);
      
      // Return attachments without file data for list view
      const attachmentsResponse = attachments.map(({ fileData, ...attachment }) => attachment);
      console.log('Attachments result:', attachmentsResponse.length, 'attachments found');
      res.json(attachmentsResponse);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      res.status(500).json({ error: 'Failed to fetch attachments' });
    }
  });

  app.get('/api/attachments/:id/download', async (req: Request, res: Response) => {
    try {
      console.log('Downloading attachment with ID:', req.params.id, 'inline:', req.query.inline);
      const attachment = await storage.getAttachment(req.params.id);
      
      if (!attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(attachment.fileData, 'base64');
      
      // Set appropriate headers for file download
      let contentType = 'application/octet-stream'; // Default
      if (attachment.fileType === 'image') {
        // Try to determine specific image type from filename
        const ext = attachment.fileName.split('.').pop()?.toLowerCase();
        if (ext === 'png') contentType = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'webp') contentType = 'image/webp';
      } else if (attachment.fileType === 'pdf') {
        contentType = 'application/pdf';
      } else if (attachment.fileName.endsWith('.txt')) {
        contentType = 'text/plain';
      } else if (attachment.fileName.endsWith('.doc')) {
        contentType = 'application/msword';
      } else if (attachment.fileName.endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }

      // Check if inline viewing is requested for viewable file types
      const inline = req.query.inline === '1';
      const viewableTypes = ['image', 'pdf'];
      const isViewable = viewableTypes.includes(attachment.fileType) || attachment.fileName.endsWith('.txt');
      const disposition = inline && isViewable ? 'inline' : 'attachment';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${attachment.fileName}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      
      console.log('Sending file:', attachment.fileName, 'Size:', fileBuffer.length, 'Type:', contentType, 'Disposition:', disposition);
      res.send(fileBuffer);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      res.status(500).json({ error: 'Failed to download attachment' });
    }
  });

  // Generate PDF thumbnail
  app.get('/api/attachments/:id/thumbnail', async (req: Request, res: Response) => {
    try {
      console.log('Generating PDF thumbnail for attachment ID:', req.params.id);
      const attachment = await storage.getAttachment(req.params.id);
      
      if (!attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      if (attachment.fileType !== 'pdf') {
        return res.status(400).json({ error: 'Thumbnail generation only supported for PDFs' });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(attachment.fileData, 'base64');
      
      // Generate PDF thumbnail
      const pdfInfo = await processPDF(fileBuffer);
      
      if (!pdfInfo.thumbnailBuffer) {
        return res.status(500).json({ error: 'Failed to generate PDF thumbnail' });
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pdfInfo.thumbnailBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      console.log('Sending PDF thumbnail for:', attachment.fileName, 'Size:', pdfInfo.thumbnailBuffer.length);
      res.send(pdfInfo.thumbnailBuffer);
    } catch (error) {
      console.error('Error generating PDF thumbnail:', error);
      res.status(500).json({ error: 'Failed to generate PDF thumbnail' });
    }
  });

  // Generate TXT thumbnail
  app.get('/api/attachments/:id/txt-thumbnail', async (req: Request, res: Response) => {
    try {
      console.log('Generating TXT thumbnail for attachment ID:', req.params.id);
      const attachment = await storage.getAttachment(req.params.id);
      
      if (!attachment) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      if (!attachment.fileName.toLowerCase().endsWith('.txt')) {
        return res.status(400).json({ error: 'Thumbnail generation only supported for TXT files' });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(attachment.fileData, 'base64');
      
      // Generate TXT thumbnail
      const txtInfo = await generateTxtThumbnail(fileBuffer);
      
      if (!txtInfo.thumbnailBuffer) {
        return res.status(500).json({ error: 'Failed to generate TXT thumbnail' });
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', txtInfo.thumbnailBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      console.log('Sending TXT thumbnail for:', attachment.fileName, 'Size:', txtInfo.thumbnailBuffer.length);
      res.send(txtInfo.thumbnailBuffer);
    } catch (error) {
      console.error('Error generating TXT thumbnail:', error);
      res.status(500).json({ error: 'Failed to generate TXT thumbnail' });
    }
  });

  // Get first image attachment for a mower (for thumbnails)
  app.get('/api/mowers/:id/thumbnail', async (req: Request, res: Response) => {
    try {
      const mowerId = req.params.id;
      const mower = await storage.getMower(mowerId);
      
      if (!mower) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      
      let thumbnailAttachment = null;
      
      // First, check if there's a specifically assigned thumbnail
      if (mower.thumbnailAttachmentId) {
        try {
          thumbnailAttachment = await storage.getAttachment(mower.thumbnailAttachmentId);
          // Verify it's still an image and belongs to this mower
          if (!thumbnailAttachment || 
              !thumbnailAttachment.fileType.startsWith('image') || 
              thumbnailAttachment.mowerId !== parseInt(mowerId)) {
            thumbnailAttachment = null;
          }
        } catch (error) {
          // If assigned thumbnail is not found, fall back to first image
          thumbnailAttachment = null;
        }
      }
      
      // If no assigned thumbnail or it's invalid, fall back to first image
      if (!thumbnailAttachment) {
        const attachments = await storage.getAttachmentsByMowerId(mowerId);
        thumbnailAttachment = attachments.find(attachment => 
          attachment.fileType.startsWith('image')
        );
      }
      
      if (!thumbnailAttachment) {
        return res.status(404).json({ error: 'No image attachments found' });
      }
      
      // Return just the attachment info (not the full base64 data)
      res.json({
        id: thumbnailAttachment.id,
        fileName: thumbnailAttachment.fileName,
        fileType: thumbnailAttachment.fileType,
        downloadUrl: `/api/attachments/${thumbnailAttachment.id}/download?inline=1`
      });
    } catch (error) {
      console.error('Error getting thumbnail:', error);
      res.status(500).json({ error: 'Failed to get thumbnail' });
    }
  });

  // Set thumbnail for a mower
  app.put('/api/mowers/:id/thumbnail', async (req: Request, res: Response) => {
    try {
      const mowerId = req.params.id;
      const { attachmentId } = req.body;
      
      // Validate that the attachment exists and is an image belonging to this mower
      if (attachmentId) {
        const attachment = await storage.getAttachment(attachmentId);
        if (!attachment) {
          return res.status(404).json({ error: 'Attachment not found' });
        }
        if (attachment.mowerId !== parseInt(mowerId)) {
          return res.status(400).json({ error: 'Attachment does not belong to this mower' });
        }
        if (!attachment.fileType.startsWith('image')) {
          return res.status(400).json({ error: 'Attachment must be an image' });
        }
      }
      
      // Update the mower's thumbnail
      const updated = await storage.updateMowerThumbnail(mowerId, attachmentId || null);
      
      if (!updated) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      
      res.json({ success: true, thumbnailAttachmentId: attachmentId || null });
    } catch (error) {
      console.error('Error setting thumbnail:', error);
      res.status(500).json({ error: 'Failed to set thumbnail' });
    }
  });

  app.delete('/api/attachments/:id', async (req: Request, res: Response) => {
    try {
      console.log('Deleting attachment with ID:', req.params.id);
      const deleted = await storage.deleteAttachment(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Attachment not found' });
      }
      
      console.log('Attachment deleted successfully');
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      res.status(500).json({ error: 'Failed to delete attachment' });
    }
  });

  app.put('/api/attachments/:id', async (req: Request, res: Response) => {
    try {
      console.log('Updating attachment metadata for ID:', req.params.id);
      const { title, description } = req.body;
      
      const updated = await storage.updateAttachmentMetadata(req.params.id, { title, description });
      
      if (!updated) {
        return res.status(404).json({ error: 'Attachment not found' });
      }
      
      console.log('Attachment metadata updated successfully');
      res.json(updated);
    } catch (error) {
      console.error('Error updating attachment metadata:', error);
      res.status(500).json({ error: 'Failed to update attachment metadata' });
    }
  });

  // Engine routes
  app.get('/api/engines', async (_req: Request, res: Response) => {
    try {
      const engines = await storage.getAllEngines();
      res.json(engines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch engines' });
    }
  });

  app.get('/api/engines/:id', async (req: Request, res: Response) => {
    try {
      console.log('Fetching engine with ID:', req.params.id);
      const engine = await storage.getEngine(req.params.id);
      console.log('Engine result:', engine);
      if (!engine) {
        return res.status(404).json({ error: 'Engine not found' });
      }
      res.json(engine);
    } catch (error) {
      console.error('Error fetching engine:', error);
      res.status(500).json({ error: 'Failed to fetch engine' });
    }
  });

  // Create engine for a specific mower
  app.post('/api/engines', async (req: Request, res: Response) => {
    try {
      // Validate and sanitize input
      const engineData = req.body;

      // Engines must be attached to a mower
      if (!engineData.mowerId) {
        return res.status(400).json({ error: 'Engine must be attached to a mower' });
      }

      // Insert using your storage/ORM
      const validatedData = insertEngineSchema.parse(engineData);
      const engine = await storage.createEngine(validatedData);

      // Create notification for new engine
      await NotificationService.createEngineNotification('created', engine.name, engine.id.toString());

      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('engine-created', 'engine', engine.id, { 
        engine, 
        mowerId: engine.mowerId 
      });

      res.status(201).json(engine);
    } catch (error) {
      console.error('Engine creation error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid engine data' });
    }
  });

  app.get('/api/mowers/:mowerId/engines', async (req: Request, res: Response) => {
    try {
      const engines = await storage.getEnginesByMowerId(req.params.mowerId);
      res.json(engines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch mower engines' });
    }
  });

  app.post('/api/mowers/:mowerId/engines', async (req: Request, res: Response) => {
    try {
      const engineData = {
        ...req.body,
        mowerId: parseInt(req.params.mowerId)
      };
      const validatedData = insertEngineSchema.parse(engineData);
      const engine = await storage.createEngine(validatedData);
      
      // Get mower details for notification
      const mower = await storage.getMower(req.params.mowerId);
      const mowerDisplayName = mower ? `${mower.make} ${mower.model}` : undefined;
      
      // Create notification for new engine allocated to mower
      await NotificationService.createEngineNotification('allocated', engine.name, engine.id.toString(), mowerDisplayName, req.params.mowerId);
      
      res.status(201).json(engine);
    } catch (error) {
      res.status(400).json({ error: 'Invalid engine data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/engines/:id', async (req: Request, res: Response) => {
    try {
      const engine = await storage.updateEngine(req.params.id, req.body);
      if (!engine) {
        return res.status(404).json({ error: 'Engine not found' });
      }
      
      // Broadcast WebSocket event for engine update
      webSocketService.broadcastAssetEvent('engine-updated', 'engine', engine.id, { 
        engine, 
        mowerId: engine.mowerId 
      });
      
      res.json(engine);
    } catch (error) {
      res.status(400).json({ error: 'Invalid engine data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/engines/:id', async (req: Request, res: Response) => {
    try {
      // Get engine details before deletion for notification
      const engine = await storage.getEngine(req.params.id);
      
      const deleted = await storage.deleteEngine(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Engine not found' });
      }
      
      // Create notification for deleted engine
      if (engine) {
        await NotificationService.createEngineNotification('deleted', engine.name, engine.id.toString());
        
        // Broadcast WebSocket event for engine deletion
        webSocketService.broadcastAssetEvent('engine-deleted', 'engine', engine.id, { 
          engine, 
          mowerId: engine.mowerId 
        });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete engine' });
    }
  });

  // Engine attachment routes
  app.post('/api/engines/:id/attachments', upload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log('Engine attachment upload request:', { params: req.params, file: req.file, body: req.body });
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Verify engine exists
      const engine = await storage.getEngine(req.params.id);
      if (!engine) {
        return res.status(404).json({ error: 'Engine not found' });
      }

      // Convert file buffer to base64
      const fileData = req.file.buffer.toString('base64');
      
      // Determine file type category
      let fileType = 'document';
      if (req.file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (req.file.mimetype === 'application/pdf') {
        fileType = 'pdf';
      } else if (req.file.mimetype === 'text/plain') {
        fileType = 'txt';
      } else if (req.file.mimetype === 'application/zip' || 
                 req.file.mimetype === 'application/x-zip-compressed' || 
                 req.file.mimetype === 'multipart/x-zip' ||
                 req.file.originalname.toLowerCase().endsWith('.zip')) {
        fileType = 'zip';
      }

      // Extract page count for PDFs and documents
      let pageCount: number | null = null;
      try {
        if (fileType === 'pdf') {
          const pdfInfo = await processPDF(req.file.buffer);
          pageCount = pdfInfo.pageCount;
        } else if (fileType === 'document' && 
                   (req.file.mimetype === 'application/msword' || 
                    req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          pageCount = await getDocumentPageCount(req.file.buffer, req.file.mimetype);
        } else if (fileType === 'txt') {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.originalname);
        }
      } catch (error) {
        console.warn('Failed to extract page count:', error);
        // Continue without page count
      }

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
        description: req.body.description || null,
      });

      // Return attachment without file data
      const { fileData: _, ...attachmentResponse } = attachment;
      res.status(201).json(attachmentResponse);
    } catch (error) {
      console.error('Component attachment upload error:', error);
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 30MB.' });
        }
      }
      res.status(400).json({ error: 'Invalid attachment data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/engines/:id/attachments', async (req: Request, res: Response) => {
    try {
      console.log('Fetching attachments for engine ID:', req.params.id);
      const attachments = await storage.getAttachmentsByEngineId(req.params.id);
      
      // Return attachments without file data for list view
      const attachmentsResponse = attachments.map(({ fileData, ...attachment }) => attachment);
      console.log('Engine attachments result:', attachmentsResponse.length, 'attachments found');
      res.json(attachmentsResponse);
    } catch (error) {
      console.error('Error fetching engine attachments:', error);
      res.status(500).json({ error: 'Failed to fetch engine attachments' });
    }
  });

  // Components compatibility routes (map to engines)
  // These routes provide backward compatibility for frontend code that uses /api/components
  app.get('/api/components', async (_req: Request, res: Response) => {
    try {
      const engines = await storage.getAllEngines();
      res.json(engines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch components' });
    }
  });

  app.get('/api/components/:id', async (req: Request, res: Response) => {
    try {
      console.log('Fetching component (engine) with ID:', req.params.id);
      const engine = await storage.getEngine(req.params.id);
      console.log('Component (engine) result:', engine);
      if (!engine) {
        return res.status(404).json({ error: 'Component not found' });
      }
      res.json(engine);
    } catch (error) {
      console.error('Error fetching component (engine):', error);
      res.status(500).json({ error: 'Failed to fetch component' });
    }
  });

  app.post('/api/components', async (req: Request, res: Response) => {
    try {
      console.log('Creating component (engine) with data:', req.body);
      
      // Validate and sanitize input
      const engineData = req.body;

      // Insert using your storage/ORM
      const validatedData = insertEngineSchema.parse(engineData);
      const engine = await storage.createEngine(validatedData);

      // Create notification for new engine
      await NotificationService.createEngineNotification('created', engine.name, engine.id.toString());

      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('engine-created', 'engine', engine.id, { 
        engine, 
        mowerId: engine.mowerId 
      });

      res.status(201).json(engine);
    } catch (error) {
      console.error('Component (engine) creation error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid component data' });
    }
  });

  app.get('/api/mowers/:mowerId/components', async (req: Request, res: Response) => {
    try {
      const engines = await storage.getEnginesByMowerId(req.params.mowerId);
      res.json(engines);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch mower components' });
    }
  });

  app.post('/api/mowers/:mowerId/components', async (req: Request, res: Response) => {
    try {
      const engineData = {
        ...req.body,
        mowerId: parseInt(req.params.mowerId)
      };
      const validatedData = insertEngineSchema.parse(engineData);
      const engine = await storage.createEngine(validatedData);
      
      // Get mower details for notification
      const mower = await storage.getMower(req.params.mowerId);
      const mowerDisplayName = mower ? `${mower.make} ${mower.model}` : undefined;
      
      // Create notification for new engine allocated to mower
      await NotificationService.createEngineNotification('allocated', engine.name, engine.id.toString(), mowerDisplayName, req.params.mowerId);
      
      res.status(201).json(engine);
    } catch (error) {
      res.status(400).json({ error: 'Invalid component data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/components/:id', async (req: Request, res: Response) => {
    try {
      const engine = await storage.updateEngine(req.params.id, req.body);
      if (!engine) {
        return res.status(404).json({ error: 'Component not found' });
      }
      
      // Broadcast WebSocket event for engine update
      webSocketService.broadcastAssetEvent('engine-updated', 'engine', engine.id, { 
        engine, 
        mowerId: engine.mowerId 
      });
      
      res.json(engine);
    } catch (error) {
      res.status(400).json({ error: 'Invalid component data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/components/:id', async (req: Request, res: Response) => {
    try {
      // Get engine details before deletion for notification
      const engine = await storage.getEngine(req.params.id);
      
      const deleted = await storage.deleteEngine(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Component not found' });
      }
      
      // Create notification for deleted engine
      if (engine) {
        await NotificationService.createEngineNotification('deleted', engine.name, engine.id.toString());
      }
      
      // Broadcast WebSocket event for engine deletion
      webSocketService.broadcastAssetEvent('engine-deleted', 'engine', parseInt(req.params.id), { 
        engineId: parseInt(req.params.id),
        mowerId: engine?.mowerId 
      });
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete component' });
    }
  });

  app.get('/api/components/:id/attachments', async (req: Request, res: Response) => {
    try {
      console.log('Fetching attachments for component (engine) ID:', req.params.id);
      const attachments = await storage.getAttachmentsByEngineId(req.params.id);
      
      // Return attachments without file data for list view
      const attachmentsResponse = attachments.map(({ fileData, ...attachment }) => attachment);
      console.log('Component (engine) attachments result:', attachmentsResponse.length, 'attachments found');
      res.json(attachmentsResponse);
    } catch (error) {
      console.error('Error fetching component (engine) attachments:', error);
      res.status(500).json({ error: 'Failed to fetch component attachments' });
    }
  });

  app.get('/api/components/:componentId/parts', async (req: Request, res: Response) => {
    try {
      const assetParts = await storage.getAssetPartsByEngineId(req.params.componentId);
      res.json(assetParts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch component parts' });
    }
  });

  // Part routes
  app.get('/api/parts', async (_req: Request, res: Response) => {
    try {
      const parts = await storage.getAllParts();
      res.json(parts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch parts' });
    }
  });

  app.get('/api/parts/:id', async (req: Request, res: Response) => {
    try {
      console.log('Fetching part with ID:', req.params.id);
      const part = await storage.getPart(req.params.id);
      console.log('Part result:', part);
      if (!part) {
        return res.status(404).json({ error: 'Part not found' });
      }
      res.json(part);
    } catch (error) {
      console.error('Error fetching part:', error);
      res.status(500).json({ error: 'Failed to fetch part' });
    }
  });

  app.post('/api/parts', async (req: Request, res: Response) => {
    try {
      const validatedData = insertPartSchema.parse(req.body);
      const part = await storage.createPart(validatedData);
      
      // Create notification for new part
      await NotificationService.createPartNotification('created', part.name, part.id.toString());
      
      // Broadcast WebSocket event for part creation
      webSocketService.broadcastAssetEvent('part-created', 'part', part.id, { part });
      
      res.status(201).json(part);
    } catch (error) {
      res.status(400).json({ error: 'Invalid part data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/parts/:id', async (req: Request, res: Response) => {
    try {
      const part = await storage.updatePart(req.params.id, req.body);
      if (!part) {
        return res.status(404).json({ error: 'Part not found' });
      }
      
      // Broadcast WebSocket event for part update
      webSocketService.broadcastAssetEvent('part-updated', 'part', part.id, { part });
      
      res.json(part);
    } catch (error) {
      res.status(400).json({ error: 'Invalid part data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/parts/:id', async (req: Request, res: Response) => {
    try {
      // Get part details before deletion for notification
      const part = await storage.getPart(req.params.id);
      
      const deleted = await storage.deletePart(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Part not found' });
      }
      
      // Create notification for deleted part
      if (part) {
        await NotificationService.createPartNotification('deleted', part.name, part.id.toString());
        
        // Broadcast WebSocket event for part deletion
        webSocketService.broadcastAssetEvent('part-deleted', 'part', part.id, { part });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete part' });
    }
  });

  // Part attachment routes
  app.post('/api/parts/:id/attachments', upload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log('Part attachment upload request:', { params: req.params, file: req.file, body: req.body });
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Verify part exists
      const part = await storage.getPart(req.params.id);
      if (!part) {
        return res.status(404).json({ error: 'Part not found' });
      }

      // Convert file buffer to base64
      const fileData = req.file.buffer.toString('base64');
      
      // Determine file type category
      let fileType = 'document';
      if (req.file.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (req.file.mimetype === 'application/pdf') {
        fileType = 'pdf';
      } else if (req.file.mimetype === 'text/plain') {
        fileType = 'txt';
      } else if (req.file.mimetype === 'application/zip' || 
                 req.file.mimetype === 'application/x-zip-compressed' || 
                 req.file.mimetype === 'multipart/x-zip' ||
                 req.file.originalname.toLowerCase().endsWith('.zip')) {
        fileType = 'zip';
      }

      // Extract page count for PDFs and documents
      let pageCount: number | null = null;
      try {
        if (fileType === 'pdf') {
          const pdfInfo = await processPDF(req.file.buffer);
          pageCount = pdfInfo.pageCount;
        } else if (fileType === 'document' && 
                   (req.file.mimetype === 'application/msword' || 
                    req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
          pageCount = await getDocumentPageCount(req.file.buffer, req.file.mimetype);
        } else if (fileType === 'txt') {
          pageCount = getDocumentPageCount(req.file.buffer, req.file.originalname);
        }
      } catch (error) {
        console.warn('Failed to extract page count:', error);
        // Continue without page count
      }

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
        description: req.body.description || null,
      });

      // Return attachment without file data
      const { fileData: _, ...attachmentResponse } = attachment;
      res.status(201).json(attachmentResponse);
    } catch (error) {
      console.error('Part attachment upload error:', error);
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 30MB.' });
        }
      }
      res.status(400).json({ error: 'Invalid attachment data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get('/api/parts/:id/attachments', async (req: Request, res: Response) => {
    try {
      console.log('Fetching attachments for part ID:', req.params.id);
      const attachments = await storage.getAttachmentsByPartId(req.params.id);
      
      // Return attachments without file data for list view
      const attachmentsResponse = attachments.map(({ fileData, ...attachment }) => attachment);
      console.log('Part attachments result:', attachmentsResponse.length, 'attachments found');
      res.json(attachmentsResponse);
    } catch (error) {
      console.error('Error fetching part attachments:', error);
      res.status(500).json({ error: 'Failed to fetch part attachments' });
    }
  });

  app.get('/api/parts/:id/allocations', async (req: Request, res: Response) => {
    try {
      console.log('Fetching allocations for part ID:', req.params.id);
      const allocations = await storage.getAssetPartsByPartId(req.params.id);
      res.json(allocations);
    } catch (error) {
      console.error('Error fetching part allocations:', error);
      res.status(500).json({ error: 'Failed to fetch part allocations' });
    }
  });

  // Asset Part allocation routes
  app.get('/api/mowers/:mowerId/parts', async (req: Request, res: Response) => {
    try {
      const assetParts = await storage.getAssetPartsWithDetailsByMowerId(req.params.mowerId);
      res.json(assetParts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch mower parts' });
    }
  });

  app.get('/api/engines/:engineId/parts', async (req: Request, res: Response) => {
    try {
      const assetParts = await storage.getAssetPartsByEngineId(req.params.engineId);
      res.json(assetParts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch engine parts' });
    }
  });

  app.post('/api/asset-parts', async (req: Request, res: Response) => {
    try {
      const validatedData = insertAssetPartSchema.parse(req.body);
      const assetPart = await storage.createAssetPart(validatedData);
      
      // Get related data for notification
      const part = await storage.getPart(assetPart.partId.toString());
      let mowerDisplayName: string | undefined;
      let mowerId: string | undefined;
      
      if (assetPart.mowerId) {
        const mower = await storage.getMower(assetPart.mowerId.toString());
        if (mower) {
          mowerDisplayName = `${mower.make} ${mower.model}`;
          mowerId = mower.id.toString();
        }
      }
      
      // Create notification for part allocation
      if (part) {
        await NotificationService.createPartNotification('allocated', part.name, part.id.toString(), mowerDisplayName, mowerId);
      }
      
      // Broadcast WebSocket event
      webSocketService.broadcastAssetEvent('asset-part-created', 'asset-part', assetPart.id, { 
        assetPart, 
        mowerId: assetPart.mowerId,
        engineId: assetPart.engineId 
      });
      
      res.status(201).json(assetPart);
    } catch (error) {
      res.status(400).json({ error: 'Invalid asset part data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/asset-parts/:id', async (req: Request, res: Response) => {
    try {
      const assetPart = await storage.updateAssetPart(req.params.id, req.body);
      if (!assetPart) {
        return res.status(404).json({ error: 'Asset part allocation not found' });
      }
      
      // Broadcast WebSocket event for asset-part update
      webSocketService.broadcastAssetEvent('asset-part-updated', 'asset-part', assetPart.id, { 
        assetPart, 
        mowerId: assetPart.mowerId,
        engineId: assetPart.engineId 
      });
      
      res.json(assetPart);
    } catch (error) {
      res.status(400).json({ error: 'Invalid asset part data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/asset-parts/:id', async (req: Request, res: Response) => {
    try {
      // Get asset part details before deletion for WebSocket broadcast
      const assetPart = await storage.getAssetPart(req.params.id);
      
      const deleted = await storage.deleteAssetPart(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Asset part allocation not found' });
      }
      
      // Broadcast WebSocket event if we have the original data
      if (assetPart) {
        webSocketService.broadcastAssetEvent('asset-part-deleted', 'asset-part', assetPart.id, { 
          assetPart, 
          mowerId: assetPart.mowerId,
          engineId: assetPart.engineId 
        });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete asset part allocation' });
    }
  });

  // Simple authorization middleware for sensitive operations
  // This can be replaced with proper authentication when implemented
  const requireAuth = (req: Request, res: Response, next: Function) => {
    // For now, always allow access since there's no auth system yet
    // TODO: Implement proper authentication checks here
    // Example: Check for valid session, JWT token, API key, etc.
    
    // Log access attempt for security audit
    console.log(`Sensitive operation access attempt: ${req.method} ${req.path} from ${req.ip}`);
    
    next();
  };

  // Backup and Restore endpoints
  app.post('/api/backup', requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('Creating backup...');
      await createBackup(res);
    } catch (error) {
      console.error('Backup endpoint error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to create backup', 
          details: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  });

  app.post('/api/restore', requireAuth, backupUpload.single('backup'), async (req: Request, res: Response) => {
    try {
      console.log('Restore request received');
      
      if (!req.file) {
        return res.status(400).json({ error: 'No backup file uploaded' });
      }

      console.log('Backup file details:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // Validate file type
      const allowedTypes = ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'];
      if (!allowedTypes.includes(req.file.mimetype) && !req.file.originalname.toLowerCase().endsWith('.zip')) {
        return res.status(400).json({ error: 'Invalid file type. Please upload a ZIP file.' });
      }

      // Validate file size (limit to 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (req.file.size > maxSize) {
        return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
      }

      // Validate backup file structure
      const validation = await validateBackupFile(req.file.buffer);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      console.log('Starting restore process...');
      
      // Perform restore
      const result = await restoreFromBackup(req.file.buffer);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      console.log('Restore completed successfully');
      res.json({ 
        success: true, 
        message: 'Backup restored successfully',
        stats: result.stats
      });
    } catch (error) {
      console.error('Restore endpoint error:', error);
      res.status(500).json({ 
        error: 'Failed to restore backup', 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Notification routes
  app.get('/api/notifications', async (_req: Request, res: Response) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.get('/api/notifications/unread', async (_req: Request, res: Response) => {
    try {
      const notifications = await storage.getUnreadNotifications();
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      res.status(500).json({ error: 'Failed to fetch unread notifications' });
    }
  });

  app.post('/api/notifications', async (req: Request, res: Response) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);
      res.status(201).json(notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(400).json({ error: 'Invalid notification data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch('/api/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.patch('/api/notifications/read-all', async (_req: Request, res: Response) => {
    try {
      const success = await storage.markAllNotificationsAsRead();
      res.json({ success });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  app.delete('/api/notifications/:id', async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteNotification(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  app.delete('/api/notifications', async (_req: Request, res: Response) => {
    try {
      const success = await storage.deleteAllNotifications();
      res.json({ success });
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      res.status(500).json({ error: 'Failed to delete all notifications' });
    }
  });

  // Reminders routes
  app.get('/api/reminders/low-stock', async (_req: Request, res: Response) => {
    try {
      const lowStockParts = await storage.getLowStockParts();
      res.json(lowStockParts);
    } catch (error) {
      console.error('Error fetching low-stock parts:', error);
      res.status(500).json({ error: 'Failed to fetch low-stock parts' });
    }
  });

  app.get('/api/reminders/upcoming-services', async (_req: Request, res: Response) => {
    try {
      const upcomingServices = await storage.getUpcomingServiceReminders();
      res.json(upcomingServices);
    } catch (error) {
      console.error('Error fetching upcoming service reminders:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming service reminders' });
    }
  });

  app.get('/api/reminders', async (_req: Request, res: Response) => {
    try {
      const [lowStockParts, upcomingServices] = await Promise.all([
        storage.getLowStockParts(),
        storage.getUpcomingServiceReminders()
      ]);

      // Transform to unified reminder format
      const stockReminders = lowStockParts.map(part => ({
        id: `stock-${part.id}`,
        type: 'stock' as const,
        title: part.name,
        subtitle: `${part.category} - ${part.stockQuantity} left (min: ${part.minStockLevel})`,
        priority: part.stockQuantity === 0 ? 'high' as const : 'medium' as const,
        partId: part.id,
        currentStock: part.stockQuantity,
        minStock: part.minStockLevel
      }));

      const serviceReminders = upcomingServices.map(service => ({
        id: `service-${service.mower.id}-${service.dueDate.getTime()}`,
        type: 'service' as const,
        title: service.serviceType,
        subtitle: `${service.mower.make} ${service.mower.model}`,
        daysUntilDue: service.daysUntilDue,
        priority: service.daysUntilDue <= 7 ? 'high' as const : 
                 service.daysUntilDue <= 14 ? 'medium' as const : 'low' as const,
        mowerId: service.mower.id,
        dueDate: service.dueDate
      }));

      // Combine and sort by priority and urgency
      const allReminders = [...stockReminders, ...serviceReminders].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Secondary sort by days until due for service items
        if (a.type === 'service' && b.type === 'service') {
          return a.daysUntilDue - b.daysUntilDue;
        }
        
        return 0;
      });

      res.json(allReminders);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      res.status(500).json({ error: 'Failed to fetch reminders' });
    }
  });

  // Catch-all for undefined API routes to always return JSON, never HTML
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found' });
  });

  const httpServer = createServer(app);

  // Initialize WebSocket server
  webSocketService.initialize(httpServer);

  return httpServer;
}
