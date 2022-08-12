import {
  Addon,
  CaptchaRequest,
  Catalog,
  CatalogArguments,
  CatalogResponse,
  Country,
  DashboardItem,
  Language,
  MainItem,
  Page,
  PlayableItem,
  ResolvedUrl,
  Source,
  SourceRequest,
  SubItem,
  Subtitle,
  SubtitleRequest,
  TranslatedText,
  VirtualMovieItem,
} from "@mediahubmx/schema";
import cloneDeep from "lodash.clonedeep";
import flatten from "lodash.flatten";
import isEqual from "lodash.isequal";
import uniqBy from "lodash.uniqby";
import Url from "url-parse";
import { AddonClass, BaseAddonClass } from "./addon";
import { createItem, createSource, createSubtitle } from "./model";
import { defaultFetchTask } from "./tasks/fetch";
import {
  AddonCallOptions,
  AddonInfos,
  AnalyzeEndpointCallback,
  ConvertedRequirement,
  DirectoryInterface,
  ManagerLoadProps,
  OnCallErrorFn,
  PartialAddonCallOptions,
  Resolvable,
} from "./types";
import { stripAddonUrl } from "./utils/addonUrl";
import { analyzeEndpoints, EndpointType } from "./utils/analyzeEndpoints";
import { filterAddons } from "./utils/filterAddons";
import { mutateUserInput } from "./utils/mutateUserInput";
import { isAddonResponse } from "./utils/responses";
import { selectTranslation } from "./utils/selectTranslation";

const clientVersion: string = require("../package.json").version;

type DefaultRequestParams = {
  /**
   * User language.
   */
  language: Language;
  /**
   * User region
   */
  region: Country;
};

type MiscOptions = {
  /**
   * Show adult entries. Defaults to `false`.
   */
  adult: boolean;
  /**
   * Use your own addon class.
   */
  createAddonClass(props: Addon, infos: AddonInfos): BaseAddonClass;
  /**
   * Function to find a working endpoint from a list of endpoints.
   */
  analyzeEndpointCallback: AnalyzeEndpointCallback;
};

type Options = AddonCallOptions & DefaultRequestParams & MiscOptions;

type ResolveResult = {
  lastError: null | string;
  resolved: ResolvedUrl[];
};

type BaseCallProps = {
  /**
   * Options will be merged with the globally set options.
   */
  options?: PartialAddonCallOptions;
};

type CallAddonProps = BaseCallProps & {
  addon: BaseAddonClass;
};

type CallDirectoryProps = BaseCallProps & {
  directory: DirectoryInterface;
};

type CallCatalogProps = BaseCallProps & {
  addonId: string;
  catalogId: string;
  directoryId: string;
  args: CatalogArguments;
};

type CallItemProps = BaseCallProps & {
  item: PlayableItem;
  maxDepth?: number;
  onUpdate?: (item: PlayableItem) => void;
  onError?: OnCallErrorFn;
};

type CallSourceProps = BaseCallProps & {
  item: PlayableItem;
  subItem?: SubItem;
  onUpdate?: (sources: Source[]) => void;
  onError?: OnCallErrorFn;
};

type CallSubtitleProps = BaseCallProps & {
  item: PlayableItem;
  subItem?: SubItem;
  source?: Source;
  onError?: OnCallErrorFn;
};

type CallResolveProps = BaseCallProps & {
  resolvable: Resolvable;
  onResolving?: (addon: BaseAddonClass, resolvable: Resolvable) => void;
  onError?: OnCallErrorFn;
};

type CallCaptchaProps = BaseCallProps & {
  data: CaptchaRequest;
  onError?: OnCallErrorFn;
};

type CallPushNotificationProps = BaseCallProps & {
  ignoreKeys: string[];
  metadata: Record<string, any>;
  onError?: OnCallErrorFn;
};

export class Manager {
  private addons: BaseAddonClass[];

  private addonCallOptions: AddonCallOptions = {
    userAgent: "MediaHubMX/2",
    endpointTestTimeout: 15 * 1000,
    loadNextTimeout: 3 * 1000,
    taskHandlers: {
      fetch: defaultFetchTask,
    },
  };
  private defaultRequestParams: DefaultRequestParams = {
    language: "en",
    region: "XX",
  };
  private miscOptions: MiscOptions = {
    adult: false,
    createAddonClass: (props, infos) => new AddonClass(props, infos),
    analyzeEndpointCallback: async (url, fn) => await fn(),
  };

  constructor(options?: Partial<Options>) {
    this.addons = [];
    this.updateOptions(options ?? {});
  }

  /**
   * Update options. The options get merged to the current values. So you can set
   * just the `signature` for example.
   */
  public updateOptions(options: Partial<Options>) {
    this.addonCallOptions = {
      signature: options.signature ?? this.addonCallOptions.signature,
      userAgent: options.userAgent ?? this.addonCallOptions.userAgent,
      endpointTestTimeout:
        options.endpointTestTimeout ??
        this.addonCallOptions.endpointTestTimeout,
      loadNextTimeout:
        options.loadNextTimeout ?? this.addonCallOptions.loadNextTimeout,
      taskHandlers: {
        ...this.addonCallOptions.taskHandlers,
        ...options.taskHandlers,
      },
    };
    this.defaultRequestParams = {
      language: options.language ?? this.defaultRequestParams.language,
      region: options.region ?? this.defaultRequestParams.region,
    };
    this.miscOptions = {
      adult: options?.adult ?? this.miscOptions.adult,
      createAddonClass:
        options?.createAddonClass ?? this.miscOptions.createAddonClass,
      analyzeEndpointCallback:
        options?.analyzeEndpointCallback ??
        this.miscOptions.analyzeEndpointCallback,
    };
  }

  /**
   * Check if this addon already exists. If the existing one is newer or
   * immitable, this will be returned. Else a new addon with the class
   * `AddonClass` is created.
   */
  private createAddonClass(
    props: Addon,
    infos: AddonInfos,
    additionalEndpoints?: string[],
    force = false
  ) {
    const old = this.addons.find((addon) => addon.props.id === props.id);
    if (old) {
      if (old.isImmutable()) {
        return old;
      } else if (!force && old.isNewerThan(props.version)) {
        props = old.props;
      }
      props.endpoints = [...(props.endpoints ?? []), ...old.getEndpoints()];
    }
    if (additionalEndpoints) {
      props.endpoints = [...additionalEndpoints, ...(props.endpoints ?? [])];
    }
    return this.miscOptions.createAddonClass(props, infos);
  }

  /**
   * Add an addon class to the manager.
   */
  public addAddonClass(addon: BaseAddonClass, index: number | null = null) {
    const i = this.addons.findIndex(
      (other) => other.props.id === addon.props.id
    );
    if (i === -1) {
      this.addons.splice(index ?? this.addons.length - 1, 0, addon);
    } else if (index !== null) {
      this.addons.splice(i, 1);
      this.addons.splice(index, 0, addon);
    } else {
      this.addons.splice(i, 1, addon);
    }
  }

  /**
   * Add addon properties to the manager.
   */
  public addAddonProps(props: Addon, index: number | null = null) {
    const addon = this.createAddonClass(props, { requirePath: [] });
    this.addAddonClass(addon, index);
  }

  /**
   * Get an addon class by it's ID.
   */
  public getAddon(id: string) {
    return this.addons.find((addon) => addon.props.id === id) ?? null;
  }

  /**
   * Get an addon class by it's ID.
   */
  public getAddonOrThrow(id: string) {
    const addon = this.getAddon(id);
    if (!addon) throw new Error(`Addon ${id} not found`);
    return addon;
  }

  /**
   * Get all addons as an array.
   * The `adult` filter is appliled.
   */
  public getAddons() {
    return this.addons.filter(
      (addon) => this.miscOptions.adult || !addon.props.adult
    );
  }

  public getRootAddons() {
    return this.getAddons().filter((addon) => {
      return addon.infos.requirePath.length === 0;
    });
  }

  public getChildAddons() {
    return this.getAddons().filter((addon) => {
      return addon.infos.requirePath.length > 0;
    });
  }

  /**
   * Remove an addon by it's ID. Returns `true` if the addon was found.
   */
  public removeAddon(id: string) {
    const i = this.addons.findIndex((addon) => addon.props.id === id);
    if (i !== -1) {
      this.addons.splice(i, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all addons, user input's and URL's.
   */
  public clear() {
    this.addons = [];
  }

  /**
   * Clone this manager instance.
   */
  public clone() {
    const manager = new Manager({
      ...this.addonCallOptions,
      ...this.defaultRequestParams,
      ...this.miscOptions,
    });
    for (const addon of this.addons) {
      manager.addAddonClass(addon.clone());
    }
    return manager;
  }

  /**
   * Load or reload all addons, URL's and user inputs.
   */
  public async load({
    onError = undefined,
    onUpdate = undefined,
    inputs = undefined,
    discover = false,
    maxDepth = 2,
    callOptions = undefined,
    availableAddonProps = undefined,
    refresh = "required",
  }: ManagerLoadProps = {}) {
    callOptions = {
      ...this.addonCallOptions,
      ...callOptions,
    };

    const rootAddons: Record<number, string> = {};
    const ignore = new Set<string>();

    const promises: Record<string, Promise<void>> = {};
    const spawn = async (prefix: any, p: Promise<void>) => {
      const id = `${prefix}-${Date.now() + Math.random() + Math.random()}`;
      promises[id] = p;
      try {
        await p;
      } finally {
        delete promises[id];
      }
    };

    const stats = {
      addAvailable: 0,
      handleRequirement: 0,
      checkAddon: 0,
      loadViaRepository: 0,
      loadViaEndpoints: 0,
      loadViaAddon: 0,
    };

    const available: Record<string, BaseAddonClass> = {};
    const addAvailable = (
      props: Addon,
      requirePath: string[],
      additionalEndpoints?: string[]
    ) => {
      stats.addAvailable++;
      if (available[props.id]?.isNewerThan(props.version)) {
        console.log(props.id, available[props.id].props.version, props.version);
        return available[props.id];
      }
      const addon = this.createAddonClass(props, { requirePath }, [
        ...(additionalEndpoints ?? []),
        ...(available[props.id]?.getEndpoints() ?? []),
      ]);
      available[props.id] = addon;
      return addon;
    };

    if (availableAddonProps) {
      for (const props of availableAddonProps) {
        addAvailable(props, []);
      }
    }

    const handleRequirement = (
      req: ConvertedRequirement,
      endpointType: EndpointType,
      isKnownRequirement: boolean,
      requirePath: string[],
      rootIndex?: number
    ) => {
      stats.handleRequirement++;
      if (discover && requirePath.length >= maxDepth) return;

      for (let other of Object.values(available)) {
        if (other.matchesRequirement(req)) {
          other = addAvailable(other.props, requirePath, [
            ...other.getEndpoints(),
            ...req.endpoints,
          ]);
          if (
            refresh === "all" ||
            (refresh === "required" && isKnownRequirement)
          ) {
            spawn(
              `req-class-${other.props.id}`,
              loadViaAddon(other, isKnownRequirement, requirePath, rootIndex)
            );
          } else {
            checkAddon(other, isKnownRequirement, requirePath, rootIndex);
          }
          return;
        }
      }

      if (req.endpoints.some((endpoint) => !ignore.has(endpoint))) {
        spawn(
          `req-endpoint-${req.endpoints[0]}`,
          loadViaEndpoints(
            req.endpoints,
            endpointType,
            isKnownRequirement,
            requirePath,
            rootIndex
          )
        );
      }
    };

    const checkAddon = (
      addon: BaseAddonClass,
      isKnownRequirement: boolean,
      requirePath: string[],
      rootIndex?: number
    ) => {
      stats.checkAddon++;
      requirePath = [...requirePath, addon.props.id];

      if (
        !discover &&
        !isKnownRequirement &&
        !this.addons.some((other) => other.hasRequirement(addon))
      ) {
        // console.debug(`Skipped addon ${addon.props.id} for now`);
        return;
      }

      // Add addon
      // console.debug(`Adding addon ${requirePath.join(" -> ")}`);
      const other = this.getAddon(addon.props.id);
      if (!other || !isEqual(other.props, addon.props)) {
        this.addAddonClass(addon);
        if (onUpdate) onUpdate(addon);
      }

      // Store root addon
      if (requirePath.length === 1 && rootIndex !== undefined) {
        rootAddons[rootIndex] = addon.props.id;
      }

      // Load requirements
      for (const req of addon.getConvertedRequirements()) {
        handleRequirement(
          req,
          "unknown",
          isKnownRequirement,
          requirePath,
          rootIndex
        );
      }

      // Legacy, load repository
      if (
        (<any>addon.props)._isLegacyRepositoryAddon &&
        !ignore.has(addon.props.id)
      ) {
        if (!discover || requirePath.length < maxDepth) {
          spawn(
            `repo-${addon.props.id}`,
            loadViaRepository(addon, requirePath)
          );
        }
      }
    };

    // Legacy
    const loadViaRepository = async (
      addon: BaseAddonClass,
      requirePath: string[]
    ) => {
      ignore.add(addon.props.id);
      try {
        stats.loadViaRepository++;
        const res = <Addon[]>await addon.call({
          options: callOptions!,
          action: <any>"repository",
          input: this.defaultRequestParams,
          onWarning: (error) => {
            if (onError) onError({ addon }, error);
          },
        });
        for (const props of res) {
          props.endpoints = flatten(
            (props.endpoints ?? []).map((endpoint) =>
              addon
                .getEndpoints()
                .map((base) => new Url(endpoint, base).toString())
            )
          );
          // addAvailable(props, requirePath);
          // TODO: Maybe fix this to handle repos: { legacyId: props.id }
          handleRequirement(
            { endpoints: props.endpoints },
            "addon",
            false,
            requirePath
          );
        }
      } catch (error) {
        if (onError) onError({ addon }, error);
      }
    };

    const x: any = {};

    const loadViaEndpoints = async (
      endpoints: string[],
      endpointType: EndpointType,
      isKnownRequirement: boolean,
      requirePath: string[],
      rootIndex?: number
    ) => {
      const urls: string[] = [];
      for (const endpoint of endpoints) {
        const url = stripAddonUrl(endpoint);
        ignore.add(url);
        ignore.add(endpoint);
        if (!urls.includes(url)) urls.push(url);
      }

      try {
        stats.loadViaEndpoints++;
        const result = await analyzeEndpoints({
          endpoints: urls,
          options: callOptions!,
          endpointType,
          body: { ...this.defaultRequestParams, clientVersion },
          callback: this.miscOptions.analyzeEndpointCallback,
        });
        if (!result) {
          throw new Error("No MediaHubMX addon found");
        }
        for (const r of result) {
          if (r.props) {
            checkAddon(
              addAvailable(r.props, requirePath),
              r.isServer ? false : isKnownRequirement,
              requirePath,
              rootIndex
            );
          } else if (r.endpoints) {
            handleRequirement(
              { endpoints: r.endpoints },
              r.isServer ? "server" : "addon",
              r.isServer ? false : isKnownRequirement,
              requirePath,
              rootIndex
            );
          }
        }
      } catch (error) {
        if (onError) onError({ endpoints }, error);
      }
    };

    const loadViaAddon = async (
      addon: BaseAddonClass,
      isKnownRequirement: boolean,
      requirePath: string[],
      rootIndex?: number
    ) => {
      for (const url of addon.getEndpoints()) {
        ignore.add(url);
      }
      try {
        if (addon.isImmutable()) {
          checkAddon(addon, isKnownRequirement, requirePath, rootIndex);
        } else {
          stats.loadViaAddon++;
          const res = await addon.call({
            options: { ...this.addonCallOptions, ...callOptions },
            action: "addon",
            input: this.defaultRequestParams,
            onWarning: (error) => {
              if (onError) onError({ addon }, error);
            },
          });
          if (!isAddonResponse(res)) {
            throw new Error("Addon doesn't return addon data");
          }
          checkAddon(
            addAvailable(<Addon>res, requirePath, addon.getEndpoints()),
            isKnownRequirement,
            requirePath,
            rootIndex
          );
        }
      } catch (error) {
        if (onError) onError({ addon }, error);
      }
    };

    // Create the initial jobs
    let rootIndex = 0; // Required to keep the sort order of the root addons
    inputs = [
      ...this.getAddons().map((addonClass) => ({ addonClass })),
      ...(inputs ?? []),
    ];
    for (const input of inputs) {
      if (input.addonClass) {
        spawn(
          `input-class-${input.addonClass.props.id}`,
          loadViaAddon(
            input.addonClass.isImmutable()
              ? input.addonClass
              : addAvailable(
                  input.addonClass.props,
                  input.addonClass.infos.requirePath
                ),
            true,
            input.addonClass.infos.requirePath,
            input.addonClass.infos.requirePath.length === 0
              ? rootIndex++
              : undefined
          )
        );
      } else if (input.addonProps) {
        spawn(
          `input-props-${input.addonProps.id}`,
          loadViaAddon(
            addAvailable(input.addonProps, []),
            true,
            [],
            rootIndex++
          )
        );
      } else if (input.endpoints) {
        handleRequirement(
          { endpoints: input.endpoints },
          "unknown",
          true,
          [],
          rootIndex++
        );
      } else if (input.url) {
        handleRequirement(
          { endpoints: [input.url] },
          "unknown",
          true,
          [],
          rootIndex++
        );
      } else if (input.userInput) {
        if (!ignore.has(input.userInput)) {
          handleRequirement(
            { endpoints: mutateUserInput(input.userInput) },
            "unknown",
            true,
            [],
            rootIndex++
          );
        }
      } else {
        throw new Error("Found an empty input element");
      }
    }

    // Wait for all promises to finish
    for (;;) {
      const p = Object.values(promises);
      if (!p.length) break;
      await Promise.all(p);
    }

    // Sort addons by requirement order
    if (!discover) {
      const sorted: BaseAddonClass[] = [];
      const iter = (addon: BaseAddonClass) => {
        sorted.push(addon);
        for (const req of addon.getConvertedRequirements()) {
          for (const other of this.addons) {
            if (!sorted.includes(other) && other.matchesRequirement(req)) {
              iter(other);
            }
          }
        }
      };
      for (let i = 0; i < rootIndex; i++) {
        if (!rootAddons[i]) continue;
        const addon = this.getAddon(rootAddons[i]);
        if (!addon) continue;
        iter(addon);
      }
      if (this.addons.length !== sorted.length) {
        const diff1 = new Set(this.addons.map((a) => a.props.id));
        sorted.forEach((a) => diff1.delete(a.props.id));
        const diff2 = new Set(sorted.map((a) => a.props.id));
        this.addons.forEach((a) => diff2.delete(a.props.id));
        const message = `Collected ${this.addons.length} addons, but found ${
          sorted.length
        } required. Diff: ${Array.from(diff1).join(", ")} / ${Array.from(
          diff2
        ).join(", ")}`;
        console.warn(message);
        // throw new Error(message);
      }
      this.addons.splice(0, this.addons.length, ...sorted);
    }

    // console.log({
    //   ...stats,
    //   found: this.addons.length,
    //   available: Object.values(available).length,
    //   xxx: Object.keys(available).sort(),
    // });
  }

  /**
   * Returns all missing or unresolved requirements.
   */
  public getUnresolvedRequirements() {
    const missing: {
      addonId: string;
      req: ConvertedRequirement;
    }[] = [];
    const sorted: BaseAddonClass[] = [];
    const iter = (addon: BaseAddonClass) => {
      sorted.push(addon);
      for (const req of addon.getConvertedRequirements()) {
        let found = false;
        for (const other of this.addons) {
          if (!sorted.includes(other) && other.matchesRequirement(req)) {
            iter(other);
            found = true;
          }
        }
        if (!found) {
          missing.push({ addonId: addon.props.id, req });
        }
      }
    };
    this.addons.forEach(iter);
    return missing;
  }

  /**
   * Select a translation from a `TranslatedText` string or object.
   * The `adult` filter is appliled.
   */
  public selectTranslation(text: TranslatedText) {
    return selectTranslation(this.defaultRequestParams.language, text);
  }

  /**
   * Returns all catalogs as `DashboardItem`.
   * The `adult` filter is appliled.
   */
  public getCatalogs() {
    const result: Catalog[] = [];
    for (const addon of this.addons) {
      if (!this.miscOptions.adult && addon.props.adult) continue;
      for (const catalog of addon.getCatalogs()) {
        result.push(catalog);
      }
    }
    return result;
  }

  /**
   * Get catalog by addon ID and catalog ID as `DashboardItem`.
   */
  public getCatalog(addonId: string, catalogId: string) {
    const addon = this.getAddon(addonId);
    return addon?.getCatalog(catalogId) ?? null;
  }

  /**
   * Get catalog by addon ID and catalog ID as `DashboardItem`.
   */
  public getCatalogForDirectory(directory: DirectoryInterface) {
    return this.getCatalog(
      <string>directory.addonId,
      directory.catalogId ?? ""
    );
  }

  /**
   * Returns all pages
   */
  public getPages(): Page[] {
    let addons: BaseAddonClass[] = [];
    const iter = (addon: BaseAddonClass) => {
      const pages = addon.getPages().length;
      if (pages > 0 && !addons.includes(addon)) {
        addons.push(addon);
      }
      if (pages === 0 || addon.infos.requirePath.length > 0)
        for (const req of addon.getConvertedRequirements()) {
          for (const other of this.addons) {
            if (!addons.includes(other) && other.matchesRequirement(req)) {
              iter(other);
            }
          }
        }
    };
    for (const addon of this.getRootAddons()) {
      iter(addon);
    }
    if (addons.length === 0) addons = this.addons;

    const result: Page[] = [];
    for (const addon of addons) {
      if (!this.miscOptions.adult && addon.props.adult) continue;
      for (const page of addon.getPages()) {
        const dashboards = page.dashboards ?? [];
        const other = result.find((p) => p.id === page.id);
        if (other) {
          other.dashboards = [...(other.dashboards ?? []), ...dashboards];
        } else {
          result.push({
            ...page,
            dashboards,
          });
        }
      }
    }
    return result;
  }

  /**
   * Returns all dashboards for a page.
   * Use page ID or page object as parameter.
   */
  public getDashboards(pageInput: Page | string = "") {
    const page =
      typeof pageInput === "string"
        ? this.getPages().find((p) => p.id === pageInput)
        : pageInput;
    if (!page) return [];

    const result: DashboardItem[] = [];
    const dashboards = [...(page.dashboards ?? [])];
    for (let i = 0; i < dashboards.length; i++) {
      const item = page.dashboards![i];

      switch (item.type) {
        case "channel":
        case "iptv":
        case "movie":
        case "series":
        case "unknown":
          result.push(item);
          continue;
        case "directory":
        case "copyItems":
          break;
      }

      const addon = this.getAddon(item.addonId!);
      if (!addon) {
        console.warn(
          `Addon "${item.addonId}" for item in page "${page.key}" not found`
        );
        continue;
      }

      if (item.type === "copyItems") {
        const otherPage = addon.getPages().find((p) => p.id === item.pageId);
        if (!otherPage) {
          console.warn(
            `Page "${item.addonId}/${item.pageId}" for item in page "${page.key}" not found`
          );
        } else {
          dashboards.splice(i, 1, ...otherPage.dashboards!);
          i--;
        }
        continue;
      }

      const catalog = addon.getCatalog(item.catalogId!);
      if (!catalog) {
        console.warn(
          `Catalog "${item.catalogId}" for dashboard "${item.key}" not found`
        );
        continue;
      }

      const otherPage = addon.getPages().find((p) => p.id === item.pageId);
      const otherDashboard =
        <typeof item>(
          otherPage?.dashboards?.find(
            (j) => j.type === item.type && j.id === item.id
          )
        ) ?? item;

      result.push({
        ...otherDashboard,
        ...item,
        name: item.name ?? otherDashboard?.name ?? catalog?.name,
        options: item.options ?? otherDashboard?.options ?? catalog?.options,
        features:
          item.features ?? otherDashboard?.features ?? catalog?.features,
      });
    }
    return result;
  }

  /**
   * Convert an item and optional sub item to a request object
   */
  private itemToRequest(
    addon: BaseAddonClass,
    item: MainItem,
    subItem?: SubItem
  ) {
    return {
      type: item.type,
      ids: {
        ...(<PlayableItem>item).ids,
        id: (<PlayableItem>item).ids[addon.props.id],
      },
      name: this.selectTranslation(<TranslatedText>item.name),
      nameTranslations: (<VirtualMovieItem>item).nameTranslations,
      originalName: (<VirtualMovieItem>item).originalName,
      releaseDate: (<VirtualMovieItem>item).releaseDate,
      year: (<VirtualMovieItem>item).year,
      episode:
        item.type === "series" && subItem
          ? {
              ids: {
                ...subItem.ids,
                id: subItem.ids[addon.props.id],
              },
              name: subItem.name ? this.selectTranslation(subItem.name) : null,
              releaseDate: subItem.releaseDate,
              season: subItem.season,
              episode: subItem.episode,
            }
          : {},
    };
  }

  /**
   * Call the `selftest` addon action.
   */
  public async callSelftest({ addon, options }: CallAddonProps) {
    const res = await addon.call({
      options: { ...this.addonCallOptions, ...options },
      action: "selftest",
      input: {},
    });
    if (res !== "ok") {
      throw new Error(`Selftest failed: ${JSON.stringify(res)}`);
    }
  }

  /**
   * Call the `addon` addon action.
   */
  public async callAddon({ addon, options }: CallAddonProps) {
    return await addon.call({
      options: { ...this.addonCallOptions, ...options },
      action: "addon",
      input: this.defaultRequestParams,
    });
  }

  /**
   * Helper function which will run `callCatalog` with the arguments and properties of
   * a `directory`. Also takes care of `BaseDirectoryItem.initialData`.
   */
  public async callDirectory({ directory, options }: CallDirectoryProps) {
    if (directory.args?.cursor === null && directory.initialData?.items) {
      return directory.initialData;
    }

    const res = await this.callCatalog({
      addonId: directory.addonId ?? "",
      catalogId: directory.catalogId ?? "",
      directoryId: directory.id ?? "",
      args: directory.args ?? {},
      options,
    });

    if (!res.options) res.options = directory.options;
    if (!res.features) res.features = directory.features;

    res.items = res.items.map((item) => {
      if (item.type === "directory") {
        if (!item.options) item.options = res.options;
        if (!item.features) item.features = res.features;
      }
      return item;
    });

    return res;
  }

  /**
   * Call the `catalog` addon action.
   * It's more convinient to use the `callDirectory` function instead.
   */
  public async callCatalog({
    addonId,
    catalogId,
    directoryId,
    args,
    options,
  }: CallCatalogProps) {
    const addon = this.getAddonOrThrow(addonId);
    const catalog = addon.getCatalog(catalogId);
    if (!catalog) {
      console.warn(
        `Catalog "${addon.props.id}/${catalogId}" for directory "${directoryId}" not found.`
      );
    }

    const res = await addon.call({
      options: { ...this.addonCallOptions, ...options },
      action: "catalog",
      input: {
        ...this.defaultRequestParams,
        catalogId,
        id: directoryId ?? "",
        adult: args.adult ?? this.miscOptions.adult,
        search: args.search ?? "",
        sort: args.sort ?? "",
        filter: args.filter ?? {},
        cursor: args.cursor === undefined ? null : args.cursor,
      },
    });

    const keys = new Set();
    const result: CatalogResponse = {
      ...res,
      items: res.items
        .map((item: MainItem) => <MainItem>createItem(addon.props, item))
        .filter((props) => {
          if (!props) return false;
          if (keys.has(props.id)) {
            console.debug(
              `Addon ${addon.props.id} returned duplicate item ${props.key}`
            );
            return false;
          }
          keys.add(props.key);
          return true;
        }),
    };
    return result;
  }

  /**
   * Call the `item` addon action.
   */
  public async callItem({
    item,
    maxDepth = 3,
    onUpdate,
    onError,
    options,
  }: CallItemProps) {
    const metas = {};
    for (let i = 0; i < maxDepth; i++) {
      const contexts = filterAddons(this.addons, {
        action: "item",
        itemType: item.type,
        item,
      }).filter(
        (context) => !isEqual(context.meta, metas[context.addon.props.id])
      );
      if (contexts.length === 0) break;
      await Promise.all(
        contexts.map(async (context) => {
          metas[context.addon.props.id] = cloneDeep(context.meta);
          try {
            const newItem = await context.addon.call({
              options: { ...this.addonCallOptions, ...options },
              action: "item",
              input: {
                ...this.defaultRequestParams,
                ...this.itemToRequest(context.addon, item),
              },
            });
            if (newItem) {
              item = <PlayableItem>(
                createItem(context.addon.props, newItem, item)
              );
              if (onUpdate) onUpdate(item);
            }
          } catch (error) {
            if (error.message !== "empty") {
              if (onError) onError(context.addon, error);
            }
          }
        })
      );
    }
    return item;
  }

  /**
   * Call the `source` addon action.
   */
  public async callSource({
    item,
    subItem,
    onUpdate,
    onError,
    options,
  }: CallSourceProps) {
    const result: Source[] = [];

    if (item.type === "series") {
      if (!subItem) {
        throw new Error("Property `subItem` is required on series items");
      }
      if (subItem.sources?.length) {
        result.push(...(<Source[]>subItem.sources));
        if (subItem.sourcesExclusive) {
          return result;
        }
      }
    } else if ((<Source[]>item.sources)?.length) {
      result.push(...(<Source[]>item.sources));
      if (item.sourcesExclusive) {
        return result;
      }
    }

    const contexts = filterAddons(this.addons, {
      action: "source",
      itemType: item.type,
      item,
    });

    await Promise.all(
      contexts.map(async (context) => {
        try {
          let sources = await context.addon.call({
            options: { ...this.addonCallOptions, ...options },
            action: "source",
            input: <SourceRequest>{
              ...this.defaultRequestParams,
              ...this.itemToRequest(context.addon, item, subItem),
            },
          });
          if (sources) {
            if (!Array.isArray(sources)) sources = [sources];
            if (sources.length > 0) {
              result.push(
                ...sources.map((source) =>
                  createSource(context.addon.props, source, "source")
                )
              );
              // addAddonToItem(item, context.addon);
              if (onUpdate) {
                onUpdate(uniqBy(result, "id"));
              }
            }
          }
        } catch (error) {
          if (error.message !== "empty") {
            if (onError) onError(context.addon, error);
          }
        }
      })
    );
    return uniqBy(result, "id");
  }

  /**
   * Call the `subtitle` addon action.
   */
  public async callSubtitle({
    item,
    subItem,
    source,
    onError,
    options,
  }: CallSubtitleProps) {
    if (item.type === "series" && !subItem) {
      throw new Error("Property `subItem` is required on series items");
    }

    const result: Subtitle[] = [];
    if (source?.subtitles) {
      result.push(
        ...source.subtitles.map((subtitle) => createSubtitle(subtitle))
      );
    }

    if (!source?.subtitlesExclusive) {
      const contexts = filterAddons(this.addons, {
        action: "subtitle",
        itemType: item.type,
        item,
        subItem,
      });
      await Promise.all(
        contexts.map(async (context) => {
          try {
            let subtitles = await context.addon.call({
              options: { ...this.addonCallOptions, ...options },
              action: "subtitle",
              input: <SubtitleRequest>{
                ...this.defaultRequestParams,
                ...this.itemToRequest(context.addon, item, subItem),
              },
            });
            if (subtitles) {
              if (!Array.isArray(subtitles)) subtitles = [subtitles];
              result.push(
                ...subtitles.map((subtitle) => createSubtitle(subtitle))
              );
            }
          } catch (error) {
            if (error.message !== "empty") {
              if (onError) onError(context.addon, error);
            }
          }
        })
      );
    }

    return result;
  }

  /**
   * Call the `resolve` addon action.
   */
  public async callResolve({
    resolvable,
    onResolving,
    onError,
    options,
  }: CallResolveProps): Promise<ResolveResult> {
    const contexts = filterAddons(this.addons, {
      action: "resolve",
      url: resolvable.url,
    });

    let lastError: string | null = null;
    for (const context of contexts) {
      try {
        if (onResolving) onResolving(context.addon, resolvable);
        const result = await context.addon.call({
          options: { ...this.addonCallOptions, ...options },
          action: "resolve",
          input: {
            ...this.defaultRequestParams,
            url: resolvable.url,
          },
        });
        if (!result) continue;

        // addAddonToItem(item, context.addon);
        let resolved: ResolvedUrl[];
        if (typeof result === "string") {
          resolved = [{ url: result }];
        } else if (!Array.isArray(result)) {
          resolved = [result];
        } else {
          resolved = result.map((url) =>
            typeof url === "string" ? { url } : url
          );
        }
        if (!resolved.length) continue;

        const nextResolvable = resolved.find((r) => r.resolveAgain);
        if (nextResolvable) {
          if (resolved.length > 1) {
            throw new Error(
              "Can not resolve in chains with more than one resolved item"
            );
          }
          return await this.callResolve({
            resolvable: nextResolvable,
            onResolving,
            onError,
          });
        }

        return { lastError: null, resolved };
      } catch (error) {
        lastError = `${context.addon.props.name}: ${error.message}`;
        if (onError) onError(context.addon, error);
      }
    }

    if (contexts.length === 0) {
      return {
        lastError,
        resolved: [{ name: resolvable.name, url: resolvable.url }],
      };
    } else {
      return { lastError, resolved: [] };
    }
  }

  /**
   * Call the `captcha` addon action.
   */
  public async callCaptcha({ data, onError, options }: CallCaptchaProps) {
    const contexts = filterAddons(this.addons, {
      action: "captcha",
      captchaType: data.type,
    });
    for (const context of contexts) {
      try {
        const res = await context.addon.call({
          options: { ...this.addonCallOptions, ...options },
          action: "captcha",
          input: {
            ...this.defaultRequestParams,
            ...data,
          },
        });
        if (res !== null) return res.token;
      } catch (error) {
        if (onError) onError(context.addon, error);
      }
    }
    return null;
  }

  /**
   * Call the `push-notification` addon action.
   */
  public async callPushNotification({
    ignoreKeys,
    metadata,
    onError,
    options,
  }: CallPushNotificationProps) {
    const contexts = filterAddons(this.addons, {
      action: "push-notification",
    });
    const keys = ignoreKeys.map((key) => {
      const m = /^([^\/]+\/(.*)$)/.exec(key);
      return m ? { addonId: m[1], id: m[2] } : { addonId: null, id: key };
    });
    for (const context of contexts) {
      try {
        const res = await context.addon.call({
          options: { ...this.addonCallOptions, ...options },
          action: "push-notification",
          input: {
            ...this.defaultRequestParams,
            ignoreIds: keys
              .filter((k) => k.addonId === context.addon.props.id)
              .map((k) => k.id),
            metadata,
          },
        });
        if (res !== null) {
          const key = `${context.addon.props.id}/${res.id}`;
          if (!ignoreKeys.includes(key)) {
            return { ...res, key };
          }
        }
      } catch (error) {
        if (onError) onError(context.addon, error);
      }
    }
    return null;
  }
}
