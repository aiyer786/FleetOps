
import type { Station } from "../types";

type StationRowProps = {
  station: Station;
};

function StationRow({ station }: StationRowProps) {
  return (
    <tr>
      <td>
        <strong>{station.name}</strong>
        <small>{station.location}</small>
      </td>
      <td>{station.bays}</td>
      <td>{station.chargedBatteries}</td>
      <td>{station.chargingBatteries}</td>
      <td>{station.activeSwaps}</td>
      <td>
        <span className={`status ${station.status.toLowerCase()}`}>
          {station.status}
        </span>
      </td>
    </tr>
  );
}

export default StationRow;
