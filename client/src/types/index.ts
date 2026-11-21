
export type Station = {
  id: number;
  name: string;
  location: string;
  bays: number;
  chargedBatteries: number;
  chargingBatteries: number;
  activeSwaps: number;
  status: "Operational" | "Attention" | "Offline";
};

export type Customer = {
  id: number;
  name: string;
  status: string;
};

export type Truck = {
  id: number;
  customerId: number;
  customerName: string;
  registrationNumber: string;
  status: string;
  createdAt: string;
};

export type Battery = {
  id: number;
  stationId: number;
  stationName: string;
  operationalState: string;
  needsReview: boolean;
  installedTruckId: number | null;
  truckRegistration: string | null;
};
