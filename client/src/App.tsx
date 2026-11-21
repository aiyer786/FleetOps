
import "./App.css";
import { useEffect, useState } from "react";
import Overview from "./pages/Overview";
import FleetManagement from "./pages/FleetManagement";
import BatteryInventory from "./pages/BatteryInventory";
import { fetchStations } from "./services/stationService";
import {
  fetchCustomers,
  fetchCustomerTrucks,
} from "./services/customerService";
import { fetchBatteries } from "./services/batteryService";

import type {
  Station,
  Customer,
  Truck,
  Battery,
} from "./types";

function App() {
  const [page, setPage] = useState<"overview" | "fleet" | "batteries">("overview");

  const [stations, setStations] = useState<Station[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [batteryLoading, setBatteryLoading] = useState(false);
  const [batteryError, setBatteryError] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");

  const [loading, setLoading] = useState(true);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [error, setError] = useState("");
  const [fleetError, setFleetError] = useState("");

// Fetch stations and customers when the application loads
useEffect(() => {
  async function fetchInitialData() {
    try {
      const [stationData, customerData] = await Promise.all([
        fetchStations(),
        fetchCustomers(),
      ]);

      setStations(stationData);
      setCustomers(customerData);

      if (customerData.length > 0) {
        setSelectedCustomerId(customerData[0].id);
      }
    } catch (error) {
      console.error("Error loading application data:", error);
      setError("Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  fetchInitialData();
}, []);


useEffect(() => {
  if (selectedCustomerId === "") {
    setTrucks([]);
    return;
  }

  // Capture the validated customer ID as a number
  const customerId = selectedCustomerId;

  async function fetchTrucks() {
    setFleetLoading(true);
    setFleetError("");

    try {
      const data = await fetchCustomerTrucks(customerId);
      setTrucks(data);
    } catch (error) {
      console.error("Error fetching trucks:", error);
      setFleetError("Could not load this customer's fleet.");
      setTrucks([]);
    } finally {
      setFleetLoading(false);
    }
  }

  fetchTrucks();
}, [selectedCustomerId]);


// Fetch batteries when the Batteries page is opened
useEffect(() => {
  if (page !== "batteries") {
    return;
  }

  async function loadBatteries() {
    setBatteryLoading(true);
    setBatteryError("");

    try {
      const data = await fetchBatteries();
      setBatteries(data);
    } catch (error) {
      console.error("Error fetching batteries:", error);
      setBatteryError("Could not load battery inventory.");
    } finally {
      setBatteryLoading(false);
    }
  }

  loadBatteries();
}, [page]);


  if (loading) {
    return <p>Loading FleetOps...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>FleetOps</h2>
        <p className="sidebar-label">OPERATIONS</p>

        <nav>
          <a
            href="#overview"
            className={page === "overview" ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              setPage("overview");
            }}
          >
            Overview
          </a>

          <a
            href="#fleet"
            className={page === "fleet" ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              setPage("fleet");
            }}
          >
            Fleet Management
          </a>

          <a href="#stations" onClick={(event) => event.preventDefault()}>
            Stations
          </a>
          <a href="#bookings" onClick={(event) => event.preventDefault()}>
            Bookings
          </a>
          <a href="#queue" onClick={(event) => event.preventDefault()}>
            Queue
          </a>
          <a
            href="#batteries"
            className={page === "batteries" ? "active" : ""}
            onClick={(event) => {
              event.preventDefault();
              setPage("batteries");
            }}
          >
            Batteries
          </a>
        </nav>
      </aside>

      
      <main className="main-content">
        {page === "overview" ? (
          <Overview stations={stations} />
        ) : page === "fleet" ? (
          <FleetManagement
            customers={customers}
            trucks={trucks}
            selectedCustomerId={selectedCustomerId}
            onCustomerChange={setSelectedCustomerId}
            fleetLoading={fleetLoading}
            fleetError={fleetError}
          />
        ) : (
          <BatteryInventory
            batteries={batteries}
            batteryLoading={batteryLoading}
            batteryError={batteryError}
          />
        )}
      </main>
    </div>
  );
}

export default App;
