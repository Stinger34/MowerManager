import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMowerSchema, insertTaskSchema } from "@shared/schema";

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
      const mower = await storage.getMower(req.params.id);
      if (!mower) {
        return res.status(404).json({ error: 'Mower not found' });
      }
      res.json(mower);
    } catch (error) {
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
      const tasks = await storage.getTasksByMowerId(req.params.mowerId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  app.post('/api/mowers/:mowerId/tasks', async (req: Request, res: Response) => {
    try {
      const taskData = { ...req.body, mowerId: req.params.mowerId };
      const validatedData = insertTaskSchema.parse(taskData);
      const task = await storage.createTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
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

  const httpServer = createServer(app);

  return httpServer;
}
