import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const getIcon = (type) => {
    if (type === "appointment") return "fa-calendar-check";
    if (type === "prescription") return "fa-prescription-bottle-medical";
    if (type === "message") return "fa-comments";
    if (type === "alert") return "fa-triangle-exclamation";
    if (type === "admin") return "fa-shield-alt";
    return "fa-bell";
  };

  const getIconClasses = (type) => {
    if (type === "appointment") return "bg-blue-100 text-blue-600";
    if (type === "prescription") return "bg-purple-100 text-purple-600";
    if (type === "message") return "bg-green-100 text-green-600";
    if (type === "alert") return "bg-red-100 text-red-600";
    if (type === "admin") return "bg-gray-100 text-gray-600";
    return "bg-yellow-100 text-yellow-600";
  };

  const loadNotifications = async () => {
    try {
      const res = await axios.get("/api/notifications");
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await axios.get("/api/notifications/unread-count");
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  };

  const refreshNotifications = async () => {
    await loadNotifications();
    await loadUnreadCount();
  };

  useEffect(() => {
    refreshNotifications();

    const interval = setInterval(() => {
      refreshNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`/api/notifications/${notificationId}/read`);
      await refreshNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.put("/api/notifications/read-all");
      await refreshNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(`/api/notifications/${notificationId}`);
      await refreshNotifications();
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative bg-white hover:bg-gray-100 text-gray-700 w-11 h-11 rounded-full shadow flex items-center justify-center transition"
        title="Notifications"
      >
        <i className="fas fa-bell text-lg"></i>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800">Notifications</h3>
              <p className="text-xs text-gray-500">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <i className="fas fa-bell-slash text-3xl mb-3 text-gray-300"></i>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition ${
                    !notification.is_read ? "bg-blue-50" : "bg-white"
                  }`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${getIconClasses(
                        notification.type
                      )}`}
                    >
                      <i className={`fas ${getIcon(notification.type)}`}></i>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-gray-800 text-sm">
                          {notification.title}
                        </h4>

                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>

                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {notification.created_at
                            ? new Date(notification.created_at).toLocaleString()
                            : ""}
                        </span>

                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-gray-50 text-center">
            <button
              onClick={refreshNotifications}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              <i className="fas fa-sync-alt mr-2"></i>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
