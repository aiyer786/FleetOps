import { API_URL } from "./api";
import type { Battery } from "../types";

export async function fetchBatteries(): Promise<Battery[]> {
  const response = await fetch(`${API_URL}/api/batteries`);

  if (!response.ok) {
    throw new Error("Failed to fetch batteries");
  }

  return response.json();
}
