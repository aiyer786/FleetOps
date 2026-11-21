import { API_URL } from "./api";
import type { Customer, Truck } from "../types";

export async function fetchCustomers(): Promise<Customer[]> {
  const response = await fetch(`${API_URL}/api/customers`);

  if (!response.ok) {
    throw new Error("Failed to fetch customers");
  }

  return response.json();
}

export async function fetchCustomerTrucks(
  customerId: number
): Promise<Truck[]> {
  const response = await fetch(
    `${API_URL}/api/customers/${customerId}/trucks`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch customer trucks");
  }

  return response.json();
}
