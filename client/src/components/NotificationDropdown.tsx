import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NotificationDropdownContent from "./NotificationDropdownContent";

// Mock notifications data (this would come from props or context in real app)
const mockNotifications = [
  {
    id: "1",
    type: "warning" as const,
    title: "Service Due",
    message: "Oil change and filter replacement required",
    timestamp: "2 hours ago",
    isRead: false,
    assetId: "JD001",
    assetName: "John Deere X300",
    detailUrl: "/mowers/JD001",
    priority: "high" as const,
  },
  {
    id: "2", 
    type: "success" as const,
    title: "New Mower Added",
    message: "Craftsman riding mower added to fleet",
    timestamp: "1 day ago",
    isRead: false,
    assetId: "CR002",
    assetName: "Craftsman DYT4000",
    detailUrl: "/mowers/CR002",
    priority: "medium" as const,
  },
  {
    id: "3",
    type: "info" as const,
    title: "Component Allocated", 
    message: "New blade set allocated to mower",
    timestamp: "2 days ago",
    isRead: true,
    assetId: "HV003",
    assetName: "Husqvarna YTH24V48", 
    detailUrl: "/mowers/HV003",
    priority: "low" as const,
  },
  {
    id: "4",
    type: "error" as const,
    title: "Maintenance Overdue",
    message: "Annual inspection is 15 days overdue", 
    timestamp: "3 days ago",
    isRead: true,
    assetId: "JD001",
    assetName: "John Deere X300",
    detailUrl: "/mowers/JD001",
    priority: "high" as const,
  },
];

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const handleClearAll = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  };

  const handleNotificationClick = (notification: any) => {
    handleMarkAsRead(notification.id);
    // Navigation would be handled by the NotificationsPanel
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-toggle"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center bg-red-500 text-white"
            >
              {unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0" 
        align="end" 
        side="bottom"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <NotificationDropdownContent
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onClearAll={handleClearAll}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}