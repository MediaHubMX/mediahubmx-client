import {
  AddonResourceActions,
  CaptchaTypes,
  ItemTypes,
  MainItem,
  PlayableItem,
  SubItem,
  Url,
} from "@mediahubmx/schema";
import { BaseAddonClass } from "../addon";

type Params = {
  action?: AddonResourceActions;
  itemType?: ItemTypes;
  item?: MainItem;
  subItem?: SubItem;
  url?: Url;
  captchaType?: CaptchaTypes;
};

type Result = {
  addon: BaseAddonClass;
  meta: {
    ids: Record<string, string>;
    [k: string]: any;
  };
};

const getItemArg = (
  item: MainItem | SubItem,
  meta: Result["meta"],
  arg: string,
) => {
  if (arg.indexOf("id/") === 0) {
    const a = arg.replace(/^id\//, "");
    return ["id", meta.ids, a, (<PlayableItem>item).ids[a]];
  }
  if (
    ["type", "name", "releaseDate", "year", "season", "episode"].includes(arg)
  ) {
    return ["meta", meta, arg, item[arg]];
  }
  return ["id", meta.ids, arg, (<PlayableItem>item).ids[arg]];
};

export const filterAddons = (
  addons: BaseAddonClass[],
  {
    action = undefined,
    item = undefined,
    subItem = undefined,
    url = undefined,
    captchaType = undefined,
  }: Params,
) => {
  const denied = {};

  // Filter by addon properties
  const result: Result[] = [];
  for (const addon of addons) {
    const props = addon.props;

    denied[props.id] = [];

    const meta = {
      ids: {},
    };

    // Actions
    if (action !== undefined && !addon.getActions().includes(action)) {
      denied[props.id].push(`action ${action} !in ${addon.getActions()}`);
      continue;
    }

    // Triggers
    if (item !== undefined && props.triggers?.length) {
      let matchedTriggers = 0;
      for (const args of props.triggers) {
        const arr = Array.isArray(args) ? args : [args];
        const temp: any[] = [];
        for (const arg of arr) {
          let r = getItemArg(item, meta, arg);
          if (!r[3] && item.type === "series" && subItem) {
            r = getItemArg(subItem, meta, arg);
          }
          if (!r[3]) break;
          temp.push(r);
        }
        if (temp.length === arr.length) {
          for (const [kind, target, key, value] of temp) {
            target[key] = value;
            if (kind === "id" && key === props.id) target.id = value;
          }
          matchedTriggers += 1;
        }
      }
      if (matchedTriggers === 0) {
        denied[props.id].push(`triggers ${JSON.stringify(props.triggers)}`);
        continue;
      }
    }

    // URL patterns
    if (url !== undefined && props.urlPatterns?.length) {
      let found = false;
      for (const pattern of props.urlPatterns) {
        try {
          if (new RegExp(pattern).test(url)) {
            found = true;
            break;
          }
        } catch (error) {
          console.warn(
            `Failed parsing pattern ${pattern} of addon ${props.id}: ${error.message}`,
          );
        }
      }
      if (!found) {
        continue;
      }
    }

    // Captcha types
    if (
      captchaType !== undefined &&
      !props.captchaTypes?.includes(captchaType)
    ) {
      denied[props.id].push(
        `captchaType ${captchaType} !in ${props.captchaTypes}`,
      );
      continue;
    }

    result.push({ addon, meta });
  }

  // console.warn(JSON.stringify({ res: result.length, denied }, null, 2));
  return result;
};
