import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, DollarSign, Package, Check, X, Edit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  dueDate?: string;
  estimatedCost?: string;
  partNumber?: string;
  category: "maintenance" | "repair" | "parts" | "inspection" | "other";
  createdAt: string;
  completedAt?: string;
}

interface TaskListProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt'>) => void;
  onEditTask: (id: string, task: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
}

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.enum(["maintenance", "repair", "parts", "inspection", "other"]),
  dueDate: z.date().optional(),
  estimatedCost: z.string().optional(),
  partNumber: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const priorityColors = {
  low: "bg-gray-light text-text-muted",
  medium: "bg-accent-blue/10 text-accent-blue",
  high: "bg-accent-orange/10 text-accent-orange",
  urgent: "bg-accent-orange/20 text-accent-orange"
};

const statusColors = {
  pending: "bg-accent-orange/10 text-accent-orange",
  in_progress: "bg-accent-blue/10 text-accent-blue",
  completed: "bg-accent-blue/15 text-accent-blue",
  cancelled: "bg-gray-light text-text-muted"
};

const categoryColors = {
  maintenance: "bg-accent-blue/10 text-accent-blue",
  repair: "bg-accent-orange/10 text-accent-orange",
  parts: "bg-background-light text-text",
  inspection: "bg-accent-blue/10 text-accent-blue",
  other: "bg-gray-light text-text-muted"
};

export default function TaskList({ 
  tasks, 
  onAddTask, 
  onEditTask, 
  onDeleteTask, 
  onCompleteTask 
}: TaskListProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      category: "maintenance",
      estimatedCost: "",
      partNumber: "",
    },
  });

  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
  });

  const handleAddTask = (data: TaskFormData) => {
    onAddTask({
      ...data,
      status: "pending",
      dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : undefined,
    });
    form.reset();
    setIsAddDialogOpen(false);
  };

  const handleEditTask = (data: TaskFormData) => {
    if (!editingTask) return;
    onEditTask(editingTask.id, {
      ...data,
      dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : undefined,
    });
    setEditingTask(null);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      category: task.category,
      estimatedCost: task.estimatedCost || "",
      partNumber: task.partNumber || "",
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    });
  };

  const TaskFormContent = ({ form: currentForm, onSubmit }: { form: any, onSubmit: (data: TaskFormData) => void }) => (
    <Form {...currentForm}>
      <form onSubmit={currentForm.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={currentForm.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter task title..." {...field} data-testid="input-task-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={currentForm.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Task description..." {...field} data-testid="input-task-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={currentForm.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-task-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={currentForm.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-task-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="parts">Parts</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={currentForm.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className="w-full pl-3 text-left font-normal"
                        data-testid="button-task-due-date"
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <Calendar className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={currentForm.control}
            name="estimatedCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Cost</FormLabel>
                <FormControl>
                  <Input placeholder="$0.00" {...field} data-testid="input-task-cost" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={currentForm.control}
          name="partNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Part Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter part number..." {...field} data-testid="input-task-part-number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsAddDialogOpen(false);
              setEditingTask(null);
            }}
            data-testid="button-cancel-task"
          >
            Cancel
          </Button>
          <Button type="submit" data-testid="button-save-task">
            {editingTask ? "Update Task" : "Add Task"}
          </Button>
        </div>
      </form>
    </Form>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Tasks & To-Do ({tasks.length})
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-task">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
              </DialogHeader>
              <TaskFormContent form={form} onSubmit={handleAddTask} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks yet</p>
            <p className="text-sm">Add the first task to track maintenance and repairs</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium" data-testid={`text-task-title-${task.id}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryColors[task.category]} data-testid={`badge-task-category-${task.id}`}>
                      {task.category.charAt(0).toUpperCase() + task.category.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={priorityColors[task.priority]} data-testid={`badge-task-priority-${task.id}`}>
                      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[task.status]} data-testid={`badge-task-status-${task.id}`}>
                      {task.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-task-due-date-${task.id}`}>
                    {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                  </TableCell>
                  <TableCell data-testid={`text-task-cost-${task.id}`}>
                    {task.estimatedCost || "-"}
                  </TableCell>
                  <TableCell data-testid={`text-task-part-${task.id}`}>
                    {task.partNumber || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {task.status !== "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onCompleteTask(task.id)}
                          className="h-8 w-8"
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditDialog(task)}
                        className="h-8 w-8"
                        data-testid={`button-edit-task-${task.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeleteTask(task.id)}
                        className="h-8 w-8"
                        data-testid={`button-delete-task-${task.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <TaskFormContent form={editForm} onSubmit={handleEditTask} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}