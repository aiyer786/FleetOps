
import type { Customer, Truck } from "../types";

type FleetManagementProps = {
  customers: Customer[];
  trucks: Truck[];
  selectedCustomerId: number | "";
  onCustomerChange: (customerId: number) => void;
  fleetLoading: boolean;
  fleetError: string;
};

function FleetManagement({
  customers,
  trucks,
  selectedCustomerId,
  onCustomerChange,
  fleetLoading,
  fleetError,
}: FleetManagementProps) {
  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId
  );

  const activeTrucks = trucks.filter(
    (truck) => truck.status === "ACTIVE"
  ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Fleet Management</h1>
          <p>View trucks registered under each customer.</p>
        </div>
        <span className="operator">Fleet Operations</span>
      </header>

      <section className="fleet-selector">
        <label htmlFor="customer-select">Select Customer</label>

        <select
          id="customer-select"
          value={selectedCustomerId}
          onChange={(event) =>
            onCustomerChange(Number(event.target.value))
          }
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </section>

      {selectedCustomer && (
        <>
          <section className="summary-grid">
            <div className="summary-card">
              <p>Customer</p>
              <h2>{selectedCustomer.name}</h2>
            </div>

            <div className="summary-card">
              <p>Total Trucks</p>
              <h2>{trucks.length}</h2>
            </div>

            <div className="summary-card">
              <p>Active Trucks</p>
              <h2>{activeTrucks}</h2>
            </div>

            <div className="summary-card">
              <p>Customer Status</p>
              <h2>{selectedCustomer.status}</h2>
            </div>
          </section>

          <section className="table-section">
            <div className="section-heading">
              <h2>Registered Trucks</h2>
              <span>{trucks.length} trucks displayed</span>
            </div>

            {fleetLoading ? (
              <p>Loading fleet...</p>
            ) : fleetError ? (
              <p>{fleetError}</p>
            ) : trucks.length === 0 ? (
              <p>No trucks registered for this customer.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Truck ID</th>
                      <th>Registration Number</th>
                      <th>Customer</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trucks.map((truck) => (
                      <tr key={truck.id}>
                        <td>{truck.id}</td>
                        <td>
                          <strong>{truck.registrationNumber}</strong>
                        </td>
                        <td>{truck.customerName}</td>
                        <td>
                          <span
                            className={`status ${truck.status.toLowerCase()}`}
                          >
                            {truck.status}
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
      )}
    </>
  );
}

export default FleetManagement;
