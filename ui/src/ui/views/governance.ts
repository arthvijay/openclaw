import { html, nothing } from "lit";
import type { AppViewState } from "../app-view-state.ts";
import type { GovernanceLog, ModelInventory } from "../types.ts";
import { icons } from "../icons.ts";

export function renderGovernance(props: {
  inventoryLoading: boolean;
  inventory: ModelInventory | null;
  inventoryError: string | null;
  logsLoading: boolean;
  logs: GovernanceLog[];
  logsError: string | null;
  activeTab: "inventory" | "logs";
  onTabChange: (tab: "inventory" | "logs") => void;
  onRefreshInventory: () => void;
  onRefreshLogs: () => void;
}) {
  return html`
    <div class="view-governance">
      <div class="governance-header">
        <div class="tabs">
          <button
            class="tab ${props.activeTab === "inventory" ? "active" : ""}"
            @click=${() => props.onTabChange("inventory")}
          >
            Model Inventory
          </button>
          <button
            class="tab ${props.activeTab === "logs" ? "active" : ""}"
            @click=${() => props.onTabChange("logs")}
          >
            Governance Logs
          </button>
        </div>
        <div class="actions">
          <button
            class="btn btn--secondary"
            @click=${() => (props.activeTab === "inventory" ? props.onRefreshInventory() : props.onRefreshLogs())}
            ?disabled=${props.activeTab === "inventory" ? props.inventoryLoading : props.logsLoading}
          >
            ${icons.loader} Refresh
          </button>
        </div>
      </div>

      <div class="governance-content">
        ${props.activeTab === "inventory" ? renderInventory(props) : renderLogs(props)}
      </div>
    </div>
  `;
}

function renderInventory(props: {
  inventoryLoading: boolean;
  inventory: ModelInventory | null;
  inventoryError: string | null;
}) {
  if (props.inventoryLoading && !props.inventory) {
    return html`
      <div class="empty-state">Loading inventory...</div>
    `;
  }
  if (props.inventoryError) {
    return html`<div class="error-banner">${props.inventoryError}</div>`;
  }
  if (!props.inventory || props.inventory.models.length === 0) {
    return html`
      <div class="empty-state">No models found in inventory.</div>
    `;
  }

  return html`
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Model ID</th>
            <th>Name</th>
            <th>Provider</th>
            <th>Version</th>
            <th>Deployment Date</th>
          </tr>
        </thead>
        <tbody>
          ${props.inventory.models.map(
            (model) => html`
              <tr>
                <td><span class="mono">${model.id}</span></td>
                <td>${model.name}</td>
                <td><span class="pill">${model.provider}</span></td>
                <td>${model.version || "-"}</td>
                <td>${model.deploymentDate ? new Date(model.deploymentDate).toLocaleDateString() : "-"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
    ${
      props.inventory.ensembles && props.inventory.ensembles.length > 0
        ? html`
          <h3>Ensembles</h3>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Models</th>
                </tr>
              </thead>
              <tbody>
                ${props.inventory.ensembles.map(
                  (ensemble) => html`
                    <tr>
                      <td><span class="mono">${ensemble.id}</span></td>
                      <td>${ensemble.description}</td>
                      <td>${ensemble.modelIds.join(", ")}</td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>
        `
        : nothing
    }
  `;
}

function renderLogs(props: {
  logsLoading: boolean;
  logs: GovernanceLog[];
  logsError: string | null;
}) {
  if (props.logsLoading && props.logs.length === 0) {
    return html`
      <div class="empty-state">Loading logs...</div>
    `;
  }
  if (props.logsError) {
    return html`<div class="error-banner">${props.logsError}</div>`;
  }
  if (props.logs.length === 0) {
    return html`
      <div class="empty-state">No governance logs found.</div>
    `;
  }

  return html`
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Event Type</th>
            <th>Model ID</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${props.logs.map((log) => {
            const isBlock = log.eventType === "content_blocked";
            const isFlag = log.eventType === "content_flagged";
            return html`
              <tr class="${isBlock ? "row-danger" : isFlag ? "row-warning" : ""}">
                <td class="ws-nowrap">${new Date(log.timestamp).toLocaleString()}</td>
                <td>
                    <span class="pill ${isBlock ? "danger" : isFlag ? "warning" : "info"}">
                        ${log.eventType}
                    </span>
                </td>
                <td>${log.modelId ? html`<span class="mono">${log.modelId}</span>` : "-"}</td>
                <td class="code-cell"><pre>${JSON.stringify(log.details, null, 2)}</pre></td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}
