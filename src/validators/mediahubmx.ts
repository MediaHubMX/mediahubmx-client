import { Addon, AddonResponse, getClientValidators } from "@mediahubmx/schema";
import semver from "semver";
import { Migrations } from "./types";

const isAddonLegacyV1_3 = (addon?: Addon) => {
  const sdkVersion = <string>addon?.sdkVersion;
  return !sdkVersion || semver.lt(sdkVersion, "1.3.0");
};

export const mediahubmx: Migrations = {
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

      if (isAddonLegacyV1_3(addon)) {
        addon.catalogs?.forEach((catalog) => {
          if (!catalog.kind) {
            let itemTypes: any = null;
            if (catalog.itemTypes) {
              itemTypes = catalog.itemTypes;
              delete catalog.itemTypes;
            } else if (addon.itemTypes) {
              itemTypes = addon.itemTypes;
              delete addon.itemTypes;
            }
            catalog.kind =
              itemTypes?.length === 1 && itemTypes[0] === "iptv"
                ? "iptv"
                : "vod";
          }
        });
      }

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
        .map((addon) => mediahubmx.addon!.response!(addon, callingAddon).data)
        .map((addon) => getClientValidators().models.addon(addon));
      return { data, validate: false };
    },
  },
};
