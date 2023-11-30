import { Addon, AddonResponse, getClientValidators } from "@mediahubmx/schema";
import { Migrations } from "./types";

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
