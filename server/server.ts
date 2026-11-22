
import express from "express";
import cors from "cors";
import { pool } from "./db";

import stationRoutes from "./routes/stationRoutes";
import customerRoutes from "./routes/customerRoutes";
import truckRoutes from "./routes/truckRoutes";
import batteryRoutes from "./routes/batteryRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import vendorBatchRoutes from "./routes/vendorBatchRoutes";
import { startVendorReconciliationWorker } from "./workers/vendorReconciliationWorker";

const app = express();

app.use(cors());
app.use(express.json());

// Station routes
app.use("/api/stations", stationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/trucks", truckRoutes);
app.use("/api/batteries", batteryRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/vendor/batches", vendorBatchRoutes);


// API health check
app.get("/", (req, res) => {
  res.send("FleetOps API is running!");
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`FleetOps API running on port ${PORT}`);
  startVendorReconciliationWorker();
});
