import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Clock, CheckCircle } from "lucide-react";

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: string;
  isRead?: boolean;
}

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
}

const notificationIcons = {
  warning: AlertTriangle,
  info: Bell,
  success: CheckCircle,
  error: AlertTriangle,
};

const notificationColors = {
  warning: "bg-accent-orange/10 text-accent-orange border-accent-orange/20",
  info: "bg-accent-teal/10 text-accent-teal border-accent-teal/20",
  success: "bg-accent-teal-light/10 text-accent-teal-light border-accent-teal-light/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function NotificationsPanel({ 
  notifications, 
  onMarkAsRead, 
  onClearAll 
}: NotificationsPanelProps) {
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Card className="bg-panel border-panel-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-text-primary">
            <Bell className="h-5 w-5" />
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
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
          Recent alerts and service reminders
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
            return (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${notificationColors[notification.type]} ${
                  !notification.isRead ? 'bg-opacity-20' : 'bg-opacity-10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-xs text-text-muted mt-1">{notification.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {notification.timestamp}
                      </span>
                      {!notification.isRead && onMarkAsRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onMarkAsRead(notification.id)}
                          className="text-xs h-auto p-1"
                        >
                          Mark as read
                        </Button>
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
            <Button variant="ghost" size="sm" className="text-text-muted">
              View all {notifications.length} notifications
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}