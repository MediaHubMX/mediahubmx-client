import { Addon, AddonActions, getClientValidators } from "@mediahubmx/schema";
import { AddonEngine } from "../types";
import { mediahubmx } from "./mediahubmx";
import { mediaurl } from "./mediaurl";
import { EngineMigrations, MigrateResult } from "./types";

const migrations: EngineMigrations = {
  mediahubmx,
  mediaurl,
};

const applyMigration = <T>(
  engine: AddonEngine,
  action: AddonActions,
  type: "request" | "response",
  data: T,
  callingAddon?: Addon,
): MigrateResult => {
  const res = migrations[engine]?.[action]?.[type]?.(data, callingAddon);
  return { action, data, ...res };
};

export const validateAction = <T>(
  engine: AddonEngine,
  action: AddonActions,
  type: "request" | "response",
  data: T,
  callingAddon?: Addon,
) => {
  const res = applyMigration(engine, action, type, data, callingAddon);

  if (res.validate ?? true) {
    const validate = getClientValidators().actions[action]?.[type];
    if (!validate) {
      throw new Error(`No validator for ${action}.${type} found`);
    }
    data = <T>validate(res.data);
  }

  return {
    action: res.action ?? action,
    data,
  };
};
