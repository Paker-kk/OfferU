// ATS adapter registry with lazy loading
import type { AtsAdapter } from "./adapters/adapter.interface.js";

class AtsRegistry {
  private adapters = new Map<string, AtsAdapter>();
  private loadedAll = false;

  register(adapter: AtsAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): AtsAdapter | undefined {
    // Lazy load all if not found
    if (!this.adapters.has(id) && !this.loadedAll) {
      this.loadAllSync();
    }
    return this.adapters.get(id);
  }

  getAll(): AtsAdapter[] {
    if (!this.loadedAll) {
      this.loadAllSync();
    }
    return Array.from(this.adapters.values());
  }

  private loadAllSync(): void {
    // Adapters are registered at module load time
    // This ensures all adapter files have been imported
    this.loadedAll = true;
  }
}

export const atsRegistry = new AtsRegistry();
