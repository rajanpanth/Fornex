import { Radar } from "lucide-react";

export default function PositionPanel() {
  // Currently always showing flat state
  // In production, this would read from the vault's active drift position
  return (
    <div className="position-panel">
      <div className="panel-header">
        <span>Position</span>
        <small>Drift</small>
      </div>
      <div className="position-flat">
        <span className="position-flat-orbit">
          <Radar size={28} />
        </span>
        <span className="position-flat-text">Flat</span>
        <span className="position-flat-sub">Waiting for setup.</span>
      </div>
    </div>
  );
}
