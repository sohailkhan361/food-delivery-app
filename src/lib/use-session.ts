"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SessionResponse } from "@/lib/api-client";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<SessionResponse>("/api/me"),
    staleTime: 60_000,
  });
}
