import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertMowerSchema, insertTaskSchema, insertServiceRecordSchema, insertAttachmentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Configure multer for file uploads (memory storage for base64 conversion)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept PDF, images, and common document types
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, images, and documents are allowed.'));
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
      res.json(mower);
    } catch (error) {
      console.error('Mower update error:', error);
      res.status(400).json({ error: 'Invalid mower data', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete('/api/mowers/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteMower(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Mower not found' });
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
      res.json(task);
    } catch (error) {
      res.status(400).json({ error: 'Invalid task data' });
    }
  });

  app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Task not found' });
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
      
      res.json(updatedServiceRecord);
    } catch (error) {
      console.error('Service record update error:', error);
      res.status(400).json({ error: 'Invalid service record data' });
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
      }

      const attachmentData = {
        mowerId: parseInt(req.params.id),
        fileName: req.file.originalname,
        title: req.body.title || req.file.originalname,
        fileType,
        fileData,
        fileSize: req.file.size,
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
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
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

  // Get first image attachment for a mower (for thumbnails)
  app.get('/api/mowers/:id/thumbnail', async (req: Request, res: Response) => {
    try {
      const mowerId = req.params.id;
      const attachments = await storage.getAttachmentsByMowerId(mowerId);
      
      // Find first image attachment (fileType could be 'image' or 'image/png', etc.)
      const firstImage = attachments.find(attachment => 
        attachment.fileType.startsWith('image')
      );
      
      if (!firstImage) {
        return res.status(404).json({ error: 'No image attachments found' });
      }
      
      // Return just the attachment info (not the full base64 data)
      res.json({
        id: firstImage.id,
        fileName: firstImage.fileName,
        fileType: firstImage.fileType,
        downloadUrl: `/api/attachments/${firstImage.id}/download?inline=1`
      });
    } catch (error) {
      console.error('Error getting thumbnail:', error);
      res.status(500).json({ error: 'Failed to get thumbnail' });
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

  const httpServer = createServer(app);

  return httpServer;
}
