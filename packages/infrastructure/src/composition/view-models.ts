export interface RegisteredModulesView {
  modules: Array<{
    name: string;
    version: string;
    providerCount: number;
  }>;
}

export interface ProviderGraphView {
  providers: Array<{
    identifier: string;
    dependencies: string[];
    lifetime: string;
  }>;
}

export interface DependencyValidationView {
  isValid: boolean;
  errors: string[];
}

export interface CompositionSummaryView {
  totalModules: number;
  totalProviders: number;
  graphStatus: 'Valid' | 'Invalid';
}
