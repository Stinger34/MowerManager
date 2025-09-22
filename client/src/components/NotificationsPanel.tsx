import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Clock, CheckCircle, Info, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  isRead?: boolean;
  assetId?: string;
  assetName?: string;
  detailUrl?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface NotificationsPanelProps {
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

// Updated color scheme to match red/yellow/green specification 
const notificationColors = {
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-50", // Yellow for warnings
  info: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-50",           // Blue for info
  success: "bg-green-100 text-green-800 border-green-200 hover:bg-green-50",    // Green for success
  error: "bg-red-100 text-red-800 border-red-200 hover:bg-red-50",              // Red for errors
};

const priorityColors = {
  high: "border-l-4 border-l-red-500",
  medium: "border-l-4 border-l-yellow-500", 
  low: "border-l-4 border-l-green-500",
};

export default function NotificationsPanel({ 
  notifications, 
  onMarkAsRead, 
  onClearAll,
  onNotificationClick
}: NotificationsPanelProps) {
  const [, setLocation] = useLocation();
  const unreadCount = notifications.filter(n => !n.isRead).length;

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
    } else if (notification.assetId) {
      setLocation(`/mowers/${notification.assetId}`);
    }
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
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearAll}
              className="text-text-muted hover:text-text-primary"
            >
              Clear All
            </Button>
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
            
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${notificationColors[notification.type]} ${priorityClass} ${
                  !notification.isRead ? 'shadow-md' : 'opacity-75'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {notification.assetId && notification.assetName && (
                          <p className="text-xs font-mono text-current opacity-75">
                            Asset ID: {notification.assetId} - {notification.assetName}
                          </p>
                        )}
                        <p className="text-xs mt-1 opacity-90">{notification.message}</p>
                      </div>
                      <ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-75 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {notification.timestamp}
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