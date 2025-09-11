import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMowerSchema, insertTaskSchema, insertServiceRecordSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

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
      const validatedData = insertMowerSchema.parse(req.body);
      const mower = await storage.createMower(validatedData);
      res.status(201).json(mower);
    } catch (error) {
      res.status(400).json({ error: 'Invalid mower data' });
    }
  });

  app.put('/api/mowers/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertMowerSchema.partial().parse(req.body);
      const mower = await storage.updateMower(req.params.id, updates);
      if (!mower) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      res.json(mower);
    } catch (error) {
      res.status(400).json({ error: 'Invalid mower data' });
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

  const httpServer = createServer(app);

  return httpServer;
}
