import { useState } from "react";
import "./legacy.css";
import { LegacyCharts } from "./LegacyCharts";
import { ZONES } from "../data/fixtures";
import { recordClick, useClickCount } from "../app/clicks";

const UPTIME_STATUSES = [
  "up", "up", "up", "degraded", "up", "up", "up", "up", "down", "up",
  "up", "up", "up", "up", "up", "degraded", "up", "up", "up", "up",
  "up", "up", "up", "up", "up", "up", "up", "up", "up", "up",
] as const;

const KPI = [
  { label: "Requests", value: "1.28M", trend: "up" },
  { label: "Bandwidth", value: "8.4 TB", trend: "down" },
  { label: "Threats", value: "12.9K", trend: "up" },
  { label: "Uptime", value: "99.98%", trend: "up" },
] as const;

function sparklinePoints(values: readonly number[]): string {
  const width = 80;
  const height = 24;
  const max = Math.max(...values);
  return values
    .map((value, index) => `${(index / (values.length - 1)) * width},${height - (value / max) * height}`)
    .join(" ");
}

export function LegacyPage(): JSX.Element {
  const clicks = useClickCount();
  const [showTable, setShowTable] = useState(true);
  return (
    <div className="xk3a9">
      <header className="pq72n">
        <a href="/" data-testid="link-homepage" className="r81bw">Cloudflare</a>
        <nav className="h4cd0" data-testid="nav-main">
          <a href="/" data-testid="link-overview">Overview</a>
          <a href="#analytics" data-testid="link-analytics">Analytics</a>
          <a href="/login" data-testid="link-login">Log in</a>
        </nav>
      </header>
      <div className="z7e2m">
        <div className="w5t1q">
          {KPI.map((item) => (
            <div key={item.label} className="k2s9x" data-testid="kpi-card">
              <h2>{item.label}</h2>
              <div className="m8c3j">{item.value}</div>
              <div className="d6v0f" data-trend={item.trend}>
                {item.trend === "up" ? "Up" : "Down"} vs previous period
              </div>
            </div>
          ))}
        </div>
        <LegacyCharts />
        <div className="k2s9x" data-testid="uptime-card">
          <h2>Uptime, last 30 days</h2>
          <div className="u9a4e">
            {UPTIME_STATUSES.map((status, index) => (
              <span key={index} data-status={status} style={{ height: status === "up" ? "100%" : "60%" }} />
            ))}
          </div>
        </div>
        <div className="k2s9x">
          <button type="button" className="b2f6s" data-testid="button-primary" data-primary="true" onClick={recordClick}>
            Add zone
          </button>{" "}
          <button type="button" className="b2f6s" data-testid="button-toggle-table" onClick={() => setShowTable((value) => !value)}>
            {showTable ? "Hide zones" : "Show zones"}
          </button>{" "}
          <span className="s7l0y" data-testid="legacy-click-count">Clicks: {clicks}</span>
        </div>
        {showTable ? (
          <div className="k2s9x" data-testid="zones-card">
            <table className="t3n8p" data-testid="zones-table">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th>Plan</th>
                  <th>Requests</th>
                  <th>Trend</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ZONES.map((zone, index) => (
                  <tr key={zone.id}>
                    <td>{zone.name}</td>
                    <td>{zone.plan}</td>
                    <td>{zone.requests}</td>
                    <td>
                      <svg viewBox="0 0 80 24" width="80" height="24" aria-hidden="true">
                        <polyline fill="none" stroke="#f38020" strokeWidth="1.5" points={sparklinePoints([3, 5, 4, 7, 6, 8 + index, 5, 9])} />
                      </svg>
                    </td>
                    <td>{zone.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
