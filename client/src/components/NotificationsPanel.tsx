import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Clock, CheckCircle, Info, X } from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "@/contexts/NotificationContext";
import type { Notification } from "@shared/schema";

interface NotificationsPanelProps {
  // Remove notifications prop since we'll get them from context
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
  onDismissAll?: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

const notificationIcons: Record<string, any> = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  error: AlertTriangle,
};

// Updated color scheme to match red/yellow/green specification 
const notificationColors: Record<string, string> = {
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50", // Yellow for warnings
  info: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50",           // Blue for info
  success: "bg-green-100 text-green-800 border-green-200 hover:bg-green-50",    // Green for success
  error: "bg-red-100 text-red-800 border-red-200 hover:bg-red-50",              // Red for errors
};

const priorityColors: Record<string, string> = {
  high: "border-l-4 border-l-red-500",
  medium: "border-l-4 border-l-yellow-500", 
  low: "border-l-4 border-l-green-500",
};

export default function NotificationsPanel({ 
  onMarkAsRead, 
  onClearAll,
  onDismiss,
  onDismissAll,
  onNotificationClick
}: NotificationsPanelProps) {
  const [, setLocation] = useLocation();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, dismissAll } = useNotifications();

  const handleMarkAsRead = (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
    } else {
      markAsRead(id);
    }
  };

  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      markAllAsRead();
    }
  };

  const handleDismiss = (id: string) => {
    if (onDismiss) {
      onDismiss(id);
    } else {
      deleteNotification(id);
    }
  };

  const handleDismissAll = () => {
    if (onDismissAll) {
      onDismissAll();
    } else {
      dismissAll();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    
    // Custom click handler or default navigation
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else if (notification.detailUrl) {
      setLocation(notification.detailUrl);
    } else if (notification.entityId && notification.entityType) {
      // Generate default URL based on entity type
      // Skip navigation for deleted/sold items (check notification title/message for indicators)
      const isDeletedOrSold = notification.title.toLowerCase().includes('deleted') || 
                             notification.title.toLowerCase().includes('sold') ||
                             notification.message.toLowerCase().includes('deleted') ||
                             notification.message.toLowerCase().includes('sold');
      
      if (!isDeletedOrSold) {
        if (notification.entityType === 'mower') {
          setLocation(`/mowers/${notification.entityId}`);
        } else if (notification.entityType === 'part') {
          setLocation(`/catalog/parts/${notification.entityId}`);
        } else if (notification.entityType === 'component') {
          setLocation(`/catalog/components/${notification.entityId}`);
        }
      }
    }
  };

  const handleDismissClick = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation(); // Prevent notification click
    handleDismiss(notificationId);
  };

  return (
    <Card className="bg-panel border-panel-border shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Bell className="h-5 w-5 text-accent-teal" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 bg-red-500 text-white">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearAll}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                Read All
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleDismissAll}
                className="text-text-muted hover:text-red-600 text-xs"
              >
                Dismiss All
              </Button>
            </div>
          )}
        </div>
        <CardDescription className="text-text-muted">
          Service alerts, new mowers, and component updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.length === 0 ? (
          <div className="text-center py-6 text-text-muted">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
            <p className="text-sm">You're all caught up!</p>
          </div>
        ) : (
          notifications.slice(0, 5).map((notification) => {
            const Icon = notificationIcons[notification.type];
            const priorityClass = notification.priority ? priorityColors[notification.priority] : '';
            
            // Check if this notification is for a deleted or sold item
            const isDeletedOrSold = notification.title.toLowerCase().includes('deleted') || 
                                   notification.title.toLowerCase().includes('sold') ||
                                   notification.message.toLowerCase().includes('deleted') ||
                                   notification.message.toLowerCase().includes('sold');
            
            return (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border transition-all duration-200 ${notificationColors[notification.type]} ${priorityClass} ${
                  !notification.isRead ? 'shadow-md' : 'opacity-75'
                } ${!isDeletedOrSold ? 'cursor-pointer hover:shadow-lg' : ''}`}
                onClick={!isDeletedOrSold ? () => handleNotificationClick(notification) : undefined}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {notification.entityId && notification.entityName && (
                          <p className="text-xs font-mono text-current opacity-75">
                            Asset ID: {notification.entityId} - {notification.entityName}
                          </p>
                        )}
                        <p className="text-xs mt-1 opacity-90">{notification.message}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDismissClick(e, notification.id)}
                          className="opacity-50 hover:opacity-75 flex-shrink-0"
                          title="Dismiss notification"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-75 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-current rounded-full opacity-75"></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {notifications.length > 5 && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" className="text-text-muted hover:text-accent-teal">
              View all {notifications.length} notifications
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}