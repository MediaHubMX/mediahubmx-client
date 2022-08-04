import {
  Addon,
  AddonActions,
  AddonResponse,
  getClientValidators,
} from "@mediahubmx/schema";

type MigrateResult = {
  action?: string;
  validate?: boolean;
  data: any;
};

type MigrateFn = (data: any, callingAddon?: Addon) => MigrateResult;

type Migrations = Record<
  string,
  {
    request?: MigrateFn;
    response?: MigrateFn;
  }
>;

const migrations: Migrations = {
  addon: {
    response: (data: AddonResponse, callingAddon) => {
      if ((<any>data).type === "server") return { data };

      let addon = <Addon>data;
      let any: any = addon;

      if (any.type === "repository") {
        if (!any.actions) any.actions = [];
        any._isLegacyRepositoryAddon = true;
      }
      delete any.type;

      return { data: addon };
    },
  },
  repository: {
    request: (data: any, callingAddon) => {
      data = getClientValidators().actions.addon.request(data);
      return { data, validate: false };
    },
    response: (data: Addon[], callingAddon) => {
      data = data
        .map(
          (addon) =>
            applyMigration("addon", "response", addon, callingAddon).data
        )
        .map((addon) => getClientValidators().models.addon(addon));
      return { data, validate: false };
    },
  },
};

const applyMigration = <T>(
  action: AddonActions,
  type: "request" | "response",
  data: T,
  callingAddon?: Addon
): MigrateResult => {
  const migrate = migrations[action]?.[type];
  if (migrate) return migrate(data, callingAddon);
  return { action, data };
};

export const validateAction = <T>(
  action: AddonActions,
  type: "request" | "response",
  data: T,
  callingAddon?: Addon
) => {
  const res = applyMigration(action, type, data, callingAddon);

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
