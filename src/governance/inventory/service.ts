import fs from "fs/promises";
import path from "path";
import { ModelInventory, ModelInventorySchema } from "../types.js";

export class ModelInventoryService {
  private inventoryPath: string;
  private inventory: ModelInventory;

  constructor(dataDir: string) {
    this.inventoryPath = path.join(dataDir, "governance-inventory.json");
    this.inventory = { models: [], ensembles: [] };
  }

  async init() {
    try {
      const data = await fs.readFile(this.inventoryPath, "utf-8");
      this.inventory = ModelInventorySchema.parse(JSON.parse(data));
    } catch (error) {
      if ((error as any).code !== "ENOENT") {
        console.error("Failed to load model inventory:", error);
      }
      // If file doesn't exist, start with empty inventory (which is already set in constructor)
    }
  }

  async save() {
    try {
      await fs.writeFile(this.inventoryPath, JSON.stringify(this.inventory, null, 2));
    } catch (error) {
      console.error("Failed to save model inventory:", error);
    }
  }

  async addModel(model: ModelInventory["models"][0]) {
    const existingIndex = this.inventory.models.findIndex((m) => m.id === model.id);
    if (existingIndex >= 0) {
      this.inventory.models[existingIndex] = model;
    } else {
      this.inventory.models.push(model);
    }
    await this.save();
  }

  getModel(id: string) {
    return this.inventory.models.find((m) => m.id === id);
  }

  getAllModels() {
    return this.inventory.models;
  }

  async addEnsemble(ensemble: NonNullable<ModelInventory["ensembles"]>[0]) {
    if (!this.inventory.ensembles) {
      this.inventory.ensembles = [];
    }
    const existingIndex = this.inventory.ensembles.findIndex((e) => e.id === ensemble.id);
    if (existingIndex >= 0) {
      this.inventory.ensembles[existingIndex] = ensemble;
    } else {
      this.inventory.ensembles.push(ensemble);
    }
    await this.save();
  }

  getInventoryState() {
    return this.inventory;
  }
}
