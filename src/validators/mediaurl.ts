import {
  Addon,
  BaseDirectoryItem,
  CatalogRequest,
  CatalogResponse,
  DirectoryItem,
  ItemResponse,
  MainItem,
  getClientValidators,
} from "@mediahubmx/schema";
import semver from "semver";
import { mediahubmx } from "./mediahubmx";
import { Migrations } from "./types";

const isAddonLegacyV1 = (addon?: Addon) => {
  const sdkVersion = <string>addon?.sdkVersion;
  return !sdkVersion || semver.lt(sdkVersion, "2.0.0-alpha.0");
};

const isAddonLegacyV2 = (addon?: Addon) => {
  const sdkVersion = <string>addon?.sdkVersion;
  return !sdkVersion || semver.lt(sdkVersion, "2.2.0-alpha.0");
};

const migrateDirectoryV2 = (
  directory: {
    options?: any;
    items?: MainItem[];
    initialData?: BaseDirectoryItem["initialData"];
  },
  migrateItems = true,
) => {
  if (directory.options?.imageShape) {
    directory.options.shape = directory.options.imageShape;
    delete directory.options.imageShape;
  }
  if (directory.options?.shape === "regular") {
    directory.options.shape = "portrait";
  }
  if (migrateItems && directory.items) {
    directory.initialData = {
      items: directory.items,
      nextCursor: null,
    };
    delete directory.items;
  }
};

export const mediaurl: Migrations = {
  addon: {
    response: (data, callingAddon) => {
      const addon: Addon = data;
      if (isAddonLegacyV1(addon)) {
        delete data.poster;

        if (data.flags) {
          Object.assign(data, data.flags);
          delete data.flags;
        }

        if (data.metadata?.url) {
          if (!data.endpoints) data.endpoints = [];
          data.endpoints.push(data.metadata.url);
        }
        delete data.metadata;

        if (data.type === "repository") {
          if (!data.actions) data.actions = [];
          data._isLegacyRepositoryAddon = true;
        }
        delete data.type;

        if (data.requestArgs) {
          if (!data.triggers?.length) data.triggers = <any>data.requestArgs;
        }
        delete data.requestArgs;

        if (data.requirements) {
          data.requirements = data.requirements.map((req) =>
            typeof req === "string" ? req : (<any>req).url ?? (<any>req).id,
          );
        }

        if (data.actions) {
          let i = data.actions.indexOf(<any>"directory");
          if (i !== -1) {
            data.actions.splice(i, 1, "catalog");
            data.catalogs = <any>data.rootDirectories;
            delete data.rootDirectories;
          }
          i = data.actions.indexOf("iptv");
          if (i !== -1) {
            data.splice(i, 1);
          }
        }

        if (data.defaultDirectoryOptions || data.defaultDirectoryFeatures) {
          if (!data.catalogs?.length) {
            data.catalogs = [{}];
          }
          data.catalogs = data.catalogs.map((catalog) => ({
            ...catalog,
            options: {
              ...(<any>data.defaultDirectoryOptions),
              ...catalog.options,
            },
            features: {
              ...(<any>data.defaultDirectoryFeatures),
              ...catalog.features,
            },
          }));
          delete data.defaultDirectoryOptions;
          delete data.defaultDirectoryFeatures;
        }

        if (data.dashboards) {
          data.dashboards = data.dashboards.map((dashboard) => {
            dashboard.catalogId = <any>dashboard.rootId;
            delete dashboard.rootId;

            if ((<any>dashboard.config)?.showOnHomescreen === false) {
              dashboard.hideOnHomescreen = true;
              delete dashboard.config;
            }

            if (!dashboard.catalogId && typeof dashboard.id === "string") {
              // This is somehow unsfe, might result in invalid catalog ID's
              const m = /^([^/:]+?)\/(.+)/.exec(dashboard.id);
              if (m) {
                dashboard.catalogId = m[1];
              }
            }

            const showOnHomescreen = (<any>dashboard.config)?.showOnHomescreen;
            if (showOnHomescreen === true || showOnHomescreen === false) {
              dashboard.hideOnHomescreen = !showOnHomescreen;
              delete dashboard.config;
            }

            return dashboard;
          });
        }
      }

      if (!data.pages && data.dashboards) {
        data.pages = [{ dashboards: data.dashboards }];
      }
      delete data.dashboards;

      if (isAddonLegacyV2(addon)) {
        addon.catalogs?.forEach((catalog) => migrateDirectoryV2(catalog));
        addon.pages?.forEach((page) => {
          page.dashboards?.forEach((dashboard) => {
            if (dashboard.type === undefined || dashboard.type === null) {
              // @ts-ignore
              dashboard.type = "directory";
            }
            if (dashboard.type === "directory") {
              migrateDirectoryV2(dashboard);
            }
          });
        });
      }

      return mediahubmx.addon!.response!(data, callingAddon);
    },
  },
  repository: {
    request: (data: any, callingAddon) => {
      data = getClientValidators().actions.addon.request(data);
      return { data, validate: false };
    },
    response: (data: Addon[], callingAddon) => {
      data = data
        .map((addon) => mediaurl.addon!.response!(addon, callingAddon).data)
        .map((addon) => getClientValidators().models.addon(addon));
      return { data, validate: false };
    },
  },
  catalog: {
    request: (data: CatalogRequest, callingAddon) => {
      let action: string | undefined = undefined;
      if (isAddonLegacyV1(callingAddon)) {
        action = "directory";
        data.rootId = data.catalogId;
        delete data.catalogId;
      }
      return { action, data };
    },
    response: (data: CatalogResponse, callingAddon) => {
      data.items?.forEach((item) => {
        if (item.type === "directory") {
          migrateDirectoryV2(item);
        }
      });
      migrateDirectoryV2(data, false);

      if (isAddonLegacyV1(callingAddon)) {
        const any: any = data;
        data.catalogId = <string>any.rootId;
        delete any.rootId;
      }
      return { data };
    },
  },
  item: {
    response: (data: ItemResponse, callingAddon) => {
      if (isAddonLegacyV1(callingAddon)) {
        if (data) {
          if (data?.similarItems) {
            data.similarItems = (<DirectoryItem[]>data.similarItems).map(
              (s) => {
                s.catalogId = <any>s.rootId;
                delete s.rootId;
                return s;
              },
            );
          }
        }
      } else if (isAddonLegacyV2(callingAddon)) {
        if (data?.similarItems) {
          (data.similarItems as DirectoryItem[]).forEach((directory) => {
            if (directory.type === undefined || directory.type === null) {
              // @ts-ignore
              directory.type = "directory";
            }
            migrateDirectoryV2(directory);
            directory.initialData?.items?.forEach((item) => {
              if (item.type === "directory") {
                migrateDirectoryV2(item);
              }
            });
          });
        }
      }
      return { data };
    },
  },
};
