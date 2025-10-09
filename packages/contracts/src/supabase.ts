export interface BoilerplateTableDefinition {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
}

export interface BoilerplateSchema {
  Tables: Record<string, BoilerplateTableDefinition>;
  Views: Record<string, BoilerplateTableDefinition>;
  Functions: Record<string, unknown>;
  Enums: Record<string, unknown>;
}

export type BoilerplateDatabase = Record<string, BoilerplateSchema> & {
  public: BoilerplateSchema;
};
