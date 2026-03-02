import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api/seer-client";

export function useNotifications(unreadOnly = false, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["seer-notifications", unreadOnly, page, limit],
    queryFn: () => getNotifications({ unread: unreadOnly, page, limit }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["seer-unread-count"],
    queryFn: () => getUnreadCount(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-notifications"] });
      qc.invalidateQueries({ queryKey: ["seer-unread-count"] });
    },
  });
}

export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seer-notifications"] });
      qc.invalidateQueries({ queryKey: ["seer-unread-count"] });
    },
  });
}
