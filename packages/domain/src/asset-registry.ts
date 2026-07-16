import { LearningAsset } from './learning-asset';
import { ArtifactType } from './learning-artifact';

export class AssetRegistry {
  private assets: Map<string, LearningAsset> = new Map();

  register(asset: LearningAsset): void {
    this.assets.set(asset.assetId, asset);
  }

  load(assetIds: string[]): LearningAsset[] {
    return assetIds.map(id => this.assets.get(id)).filter(Boolean) as LearningAsset[];
  }

  filter(predicate: (asset: LearningAsset) => boolean): LearningAsset[] {
    return Array.from(this.assets.values()).filter(predicate);
  }

  sort(comparer: (a: LearningAsset, b: LearningAsset) => number): LearningAsset[] {
    return Array.from(this.assets.values()).sort(comparer);
  }

  group(keySelector: (asset: LearningAsset) => string): Record<string, LearningAsset[]> {
    const groups: Record<string, LearningAsset[]> = {};
    Array.from(this.assets.values()).forEach(asset => {
      const key = keySelector(asset);
      if (!groups[key]) groups[key] = [];
      groups[key].push(asset);
    });
    return groups;
  }

  search(query: string): LearningAsset[] {
    const q = query.toLowerCase();
    return this.filter(asset => JSON.stringify(asset).toLowerCase().includes(q));
  }

  export(type?: ArtifactType): string {
    const data = type ? this.filter(a => a.assetType === type) : Array.from(this.assets.values());
    return JSON.stringify(data, null, 2);
  }

  import(jsonData: string): void {
    try {
      const data: LearningAsset[] = JSON.parse(jsonData);
      data.forEach(asset => this.register(asset));
    } catch (e) {
      console.error('Failed to import assets', e);
    }
  }
}

export const assetRegistry = new AssetRegistry();
