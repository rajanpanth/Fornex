import { Radar } from "lucide-react";

export default function PositionPanel() {
  // Currently always showing flat state
  // In production, this would read from the vault's active drift position
  return (
    <div className="position-panel">
      <div className="panel-header">
        <span>POSITION</span>
        <small>Drift monitor</small>
      </div>
      <div className="position-flat">
        <span className="position-flat-orbit">
          <Radar size={28} />
        </span>
        <span className="position-flat-text">No active position</span>
        <span className="position-flat-sub">Agents are scanning for a clean setup.</span>
      </div>
    </div>
  );
}
