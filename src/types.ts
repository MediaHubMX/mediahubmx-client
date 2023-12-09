import {
  Addon,
  AddonRequest,
  AddonResponse,
  BaseDirectoryItem,
  CaptchaRequest,
  CaptchaResponse,
  CatalogArguments,
  CatalogFeatures,
  CatalogOptions,
  CatalogRequest,
  CatalogResponse,
  DirectoryItem,
  ItemImages,
  ItemRequest,
  ItemResponse,
  PushNotificationRequest,
  PushNotificationResponse,
  ResolveRequest,
  ResolveResponse,
  SelftestRequest,
  SelftestResponse,
  Source,
  SourceRequest,
  SourceResponse,
  SubtitleRequest,
  SubtitleResponse,
  TaskFetchRequest,
  TaskFetchResponse,
  TaskNotificationRequest,
  TaskNotificationResponse,
  TaskRecaptchaRequest,
  TaskRecaptchaResponse,
  TaskRequest,
  TaskResponse,
  TaskToastRequest,
  TaskToastResponse,
} from "@mediahubmx/schema";
import { BaseAddonClass } from "./addon";

export type AddonEngine = "mediahubmx" | "mediaurl";

interface ClientKeyPatch {
  /**
   * The `key` field only exists on `@mediahubmx/client` responses.
   * Helper field to have a unique key for all item types.
   */
  key: string;
}

interface ClientCatalogPatch {
  /**
   * The `addonId` field only exists on `@mediahubmx/client` responses.
   */
  addonId: string;
  /**
   * The `addonId` field only exists on `@mediahubmx/client` responses.
   */
  catalogId?: string;
}

interface ClientSourcePatch {
  /**
   * The `kind` field only exists on `@mediahubmx/client` responses.
   * `source` for sources, and `video` for videos from for example
   * movie items.
   */
  kind: "source" | "video";

  /**
   * The `addonId` field only exists on `@mediahubmx/client` responses.
   * Holds the ID of the addon which this source origins from.
   */
  addonId: string;
}

declare module "@mediahubmx/schema" {
  interface Addon {
    engine?: AddonEngine;
    sdkVersion: string;
  }

  interface Page extends ClientKeyPatch {}

  interface Catalog extends ClientKeyPatch, ClientCatalogPatch {}
  interface BaseDirectoryItem extends ClientKeyPatch {}

  interface VirtualMovieItem extends ClientKeyPatch {}
  interface SeriesEpisodeItem extends ClientKeyPatch {}
  interface ChannelItem extends ClientKeyPatch {}
  interface UnknownItem extends ClientKeyPatch {}
  interface IptvItem extends ClientKeyPatch {}

  interface Source extends ClientKeyPatch, ClientSourcePatch {}
}

export type DirectoryInterface = {
  addonId?: string;
  catalogId?: string;
  id?: string;
  args?: CatalogArguments;
  options?: CatalogOptions;
  features?: CatalogFeatures;
  initialData?: BaseDirectoryItem["initialData"];
};

export interface ItemHelper {
  images?: ItemImages;
  sources?: Source[];
  videos?: Source[];
  similarItems?: DirectoryItem[];
}

/**
 * A link which can be resolved.
 */
export type Resolvable = {
  name?: string;
  url: string;
};

export type ConvertedRequirement = {
  endpoints: string[];
};

export type ManagerLoadProps = {
  /**
   * Called on addon or URL load error
   */
  onError?: (
    props: {
      addon?: BaseAddonClass | null;
      endpoints?: string[];
      userInput?: string;
    },
    error: Error,
  ) => void;

  /**
   * Called whenever an addon was added or updated
   */
  onUpdate?: (addon: BaseAddonClass) => void;

  /**
   * Inputs which have to be resolved and loaded.
   * Also already loaded addons will be loaded.
   */
  inputs?: {
    addonClass?: BaseAddonClass;
    addonProps?: Addon;
    endpoints?: string[];
    url?: string;
    userInput?: string;
  }[];

  /**
   * Load all found addons, not only the required ones.
   * Default: `false`
   */
  discover?: boolean;

  /**
   * maxDepth Resolve requirements up to this depth. Only enabled with `discover`.
   * Default: `3`
   */
  maxDepth?: number;

  /**
   * Optional addon call options, defaults to the options set in the manager.
   */
  callOptions?: AddonCallOptions;

  /**
   * Predefined addon properties which can be picked if they are required.
   */
  availableAddonProps?: Addon[];

  /**
   * Refresh found addons, defaults to `required`.
   */
  refresh?: "none" | "required" | "all";

  /**
   * Optional addon engine, default is autodetect.
   */
  engine?: AddonEngine;
};

export type AddonInfos = {
  requirePath: string[];
};

export type AddonCallOptions = {
  /**
   * Signature. Don't forget to refresh this signature regularly.
   */
  signature?: string;

  /**
   * User agent to use.
   */
  userAgent?: string;

  /**
   * Consider an endpoint as failed after this time. Defaults to 15 seconds.
   */
  endpointTestTimeout: number;

  /**
   * Load the next endpoint, even the current one is not yet finished.
   * Defaults to 3 seconds.
   */
  loadNextTimeout: number;

  /**
   * Task handlers.
   */
  taskHandlers: Partial<AddonTasks>;
};

export type PartialAddonCallOptions = Partial<AddonCallOptions>;

export type OnCallErrorFn = (addon: BaseAddonClass, error: Error) => void;

type InputOutputPairs<InputType, OutputType> = {
  input: InputType;
  output: OutputType;
};
type AddonActions = {
  selftest: InputOutputPairs<SelftestRequest, SelftestResponse>;
  addon: InputOutputPairs<AddonRequest, AddonResponse>;
  catalog: InputOutputPairs<CatalogRequest, CatalogResponse>;
  item: InputOutputPairs<ItemRequest, ItemResponse>;
  source: InputOutputPairs<SourceRequest, SourceResponse>;
  subtitle: InputOutputPairs<SubtitleRequest, SubtitleResponse>;
  resolve: InputOutputPairs<ResolveRequest, ResolveResponse>;
  captcha: InputOutputPairs<CaptchaRequest, CaptchaResponse>;
  "push-notification": InputOutputPairs<
    PushNotificationRequest,
    PushNotificationResponse
  >;
};

export type AddonCallAction = Extract<keyof AddonActions, string>;
export type AddonCallProps<A extends AddonCallAction> = {
  defaultInput: AddonActions["addon"]["input"];
  options: AddonCallOptions;
  action: A;
  input: AddonActions[A]["input"];
  onWarning?: (error: Error) => void;
};
export type AddonCallOutput<A extends AddonCallAction> =
  AddonActions[A]["output"];
export type AddonCallResult<A extends AddonCallAction> = Promise<
  AddonCallOutput<A>
>;

type AddonTaskHandler<Request = TaskRequest, Response = TaskResponse> = (
  addon: BaseAddonClass,
  data: Request,
) => Promise<Response>;

export type AddonTasks = {
  fetch: AddonTaskHandler<TaskFetchRequest, TaskFetchResponse>;
  recaptcha: AddonTaskHandler<TaskRecaptchaRequest, TaskRecaptchaResponse>;
  toast: AddonTaskHandler<TaskToastRequest, TaskToastResponse>;
  notification: AddonTaskHandler<
    TaskNotificationRequest,
    TaskNotificationResponse
  >;
};

export type AddonEndpointIterator = {
  endpoint: string;
  onError(error: Error): Promise<void>;
  onSuccess(): Promise<void>;
};

export type AddonResponseResult = {
  isServer: boolean;
  engine: AddonEngine;
  endpoints: string[] | null;
  props: Addon | null;
};

export type AnalyzeEndpointCallback = (
  url: string,
  fn: () => Promise<AddonResponseResult[]>,
) => Promise<AddonResponseResult[]>;
