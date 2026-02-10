import type { AppViewState } from "../app-view-state.ts";
import type { GovernanceLog, ModelInventory } from "../types.ts";

export async function loadGovernanceInventory(state: AppViewState) {
  if (state.governanceInventoryLoading) {
    return;
  }
  state.governanceInventoryLoading = true;
  state.governanceInventoryError = null;

  try {
    if (!state.client) {
      throw new Error("Not connected");
    }
    const result = await state.client.request("governance.inventory.list");
    state.governanceInventory = result as ModelInventory;
  } catch (err) {
    state.governanceInventory = null;
    state.governanceInventoryError = String(err);
  } finally {
    state.governanceInventoryLoading = false;
  }
}

export async function loadGovernanceLogs(state: AppViewState) {
  if (state.governanceLogsLoading) {
    return;
  }
  state.governanceLogsLoading = true;
  state.governanceLogsError = null;

  try {
    if (!state.client) {
      throw new Error("Not connected");
    }
    const result = await state.client.request("governance.logs.list");
    state.governanceLogs = result as GovernanceLog[];
  } catch (err) {
    state.governanceLogs = [];
    state.governanceLogsError = String(err);
  } finally {
    state.governanceLogsLoading = false;
  }
}
