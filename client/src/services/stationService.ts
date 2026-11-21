import { API_URL } from "./api";
import type { Station } from "../types";

export async function fetchStations(): Promise<Station[]> {
  const response = await fetch(`${API_URL}/api/stations`);

  if (!response.ok) {
    throw new Error("Failed to fetch stations");
  }

  return response.json();
}
