
import type { Station } from "../types";
import StationRow from "../components/StationRow";

type OverviewProps = {
  stations: Station[];
};

function Overview({ stations }: OverviewProps) {
  const totalCharged = stations.reduce(
    (total, station) => total + station.chargedBatteries,
    0
  );

  const totalSwaps = stations.reduce(
    (total, station) => total + station.activeSwaps,
    0
  );

  const attentionCount = stations.filter(
    (station) => station.status === "Attention"
  ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Station Overview</h1>
          <p>
            Monitor battery availability and station operations.
          </p>
        </div>
        <span className="operator">Station Operator</span>
      </header>

      <section className="summary-grid">
        <div className="summary-card">
          <p>Total Stations</p>
          <h2>{stations.length}</h2>
        </div>

        <div className="summary-card">
          <p>Active Swaps</p>
          <h2>{totalSwaps}</h2>
        </div>

        <div className="summary-card">
          <p>Charged Batteries</p>
          <h2>{totalCharged}</h2>
        </div>

        <div className="summary-card">
          <p>Needs Attention</p>
          <h2>{attentionCount}</h2>
        </div>
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>All Stations</h2>
          <span>{stations.length} stations displayed</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Station</th>
                <th>Bays</th>
                <th>Charged</th>
                <th>Charging</th>
                <th>Active Swaps</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {stations.map((station) => (
                <StationRow key={station.id} station={station} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default Overview;
