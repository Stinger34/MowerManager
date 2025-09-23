import { Bell, AlertTriangle, Clock, CheckCircle, Info, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@shared/schema";

interface NotificationDropdownContentProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

const notificationIcons = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  error: AlertTriangle,
};

const notificationColors = {
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50",
  info: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50",
  success: "bg-green-100 text-green-800 border-green-200 hover:bg-green-50",
  error: "bg-red-100 text-red-800 border-red-200 hover:bg-red-50",
};

const priorityColors = {
  high: "border-l-4 border-l-red-500",
  medium: "border-l-4 border-l-yellow-500", 
  low: "border-l-4 border-l-green-500",
};

export default function NotificationDropdownContent({ 
  notifications, 
  onMarkAsRead, 
  onClearAll,
  onNotificationClick
}: NotificationDropdownContentProps) {
  const [, setLocation] = useLocation();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    
    // Custom click handler or default navigation
    if (onNotificationClick) {
      onNotificationClick(notification);
    } else if (notification.detailUrl) {
      setLocation(notification.detailUrl);
    } else if (notification.entityId && notification.entityType) {
      // Generate default URL based on entity type
      if (notification.entityType === 'mower') {
        setLocation(`/mowers/${notification.entityId}`);
      } else if (notification.entityType === 'part') {
        setLocation(`/catalog/parts/${notification.entityId}`);
      } else if (notification.entityType === 'component') {
        setLocation(`/catalog/components/${notification.entityId}`);
      }
    }
  };

  return (
    <div className="py-2">
      {notifications.length === 0 ? (
        <div className="text-center py-8 px-4 text-gray-500">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No notifications</p>
          <p className="text-xs">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.slice(0, 5).map((notification) => {
            const Icon = notificationIcons[notification.type];
            const priorityClass = notification.priority ? priorityColors[notification.priority] : '';
            
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`mx-2 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${notificationColors[notification.type]} ${priorityClass} ${
                  !notification.isRead ? 'shadow-sm' : 'opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {notification.entityId && notification.entityName && (
                          <p className="text-xs font-mono text-current opacity-75">
                            {notification.entityName}
                          </p>
                        )}
                        <p className="text-xs mt-1 opacity-90">{notification.message}</p>
                      </div>
                      <ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
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
          })}
          {notifications.length > 5 && (
            <div className="text-center pt-2 pb-1">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-600 text-xs">
                View all {notifications.length} notifications
              </Button>
            </div>
          )}
          {notifications.length > 0 && (
            <div className="border-t mt-2 pt-2 px-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClearAll}
                className="w-full text-gray-500 hover:text-gray-700 text-xs"
              >
                Mark all as read
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}