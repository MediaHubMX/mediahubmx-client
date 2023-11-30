import { Addon, AddonActions } from "@mediahubmx/schema";
import { AddonEngine } from "../types";

export type MigrateResult = {
  action?: string;
  validate?: boolean;
  data: any;
};

export type MigrateFn = (data: any, callingAddon?: Addon) => MigrateResult;

export type Migrations = Partial<
  Record<
    AddonActions | "repository",
    {
      request?: MigrateFn;
      response?: MigrateFn;
    }
  >
>;

export type EngineMigrations = Record<AddonEngine, Migrations>;
