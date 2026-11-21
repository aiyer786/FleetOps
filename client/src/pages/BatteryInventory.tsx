
import type { Battery } from "../types";

type BatteryInventoryProps = {
  batteries: Battery[];
  batteryLoading: boolean;
  batteryError: string;
};

function BatteryInventory({
  batteries,
  batteryLoading,
  batteryError,
}: BatteryInventoryProps) {
  const availableCount = batteries.filter(
    (battery) => battery.operationalState === "AVAILABLE"
  ).length;

  const chargingCount = batteries.filter(
    (battery) => battery.operationalState === "CHARGING"
  ).length;

  const needsReviewCount = batteries.filter(
    (battery) => battery.needsReview
  ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Battery Inventory</h1>
          <p>Monitor battery status and station assignments.</p>
        </div>
        <span className="operator">Battery Operations</span>
      </header>

      <section className="summary-grid">
        <div className="summary-card">
          <p>Total Batteries</p>
          <h2>{batteries.length}</h2>
        </div>

        <div className="summary-card">
          <p>Available</p>
          <h2>{availableCount}</h2>
        </div>

        <div className="summary-card">
          <p>Charging</p>
          <h2>{chargingCount}</h2>
        </div>

        <div className="summary-card">
          <p>Needs Review</p>
          <h2>{needsReviewCount}</h2>
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>All Batteries</h2>
          <span>{batteries.length} batteries displayed</span>
        </div>

        {batteryLoading ? (
          <p>Loading battery inventory...</p>
        ) : batteryError ? (
          <p>{batteryError}</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Battery ID</th>
                  <th>Station</th>
                  <th>Operational State</th>
                  <th>Installed Truck</th>
                  <th>Review Status</th>
                </tr>
              </thead>

              <tbody>
                {batteries.map((battery) => (
                  <tr key={battery.id}>
                    <td>BAT-{battery.id}</td>
                    <td>{battery.stationName}</td>

                    <td>
                      <span
                        className={`status ${
                          battery.operationalState === "AVAILABLE"
                            ? "active"
                            : "attention"
                        }`}
                      >
                        {battery.operationalState.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td>
                      {battery.truckRegistration || "Not assigned"}
                    </td>

                    <td>
                      <span
                        className={`status ${
                          battery.needsReview
                            ? "attention"
                            : "operational"
                        }`}
                      >
                        {battery.needsReview ? "Needs Review" : "Normal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default BatteryInventory;
