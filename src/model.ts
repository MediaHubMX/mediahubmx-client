import {
  Addon,
  DirectoryItem,
  IptvItem,
  ItemTypes,
  MainItem,
  MovieItem,
  PlayableItem,
  SeriesEpisodeItem,
  SeriesItem,
  Source,
  SubItem,
  Subtitle,
} from "@mediahubmx/schema";
import cloneDeep from "lodash.clonedeep";
import isEqual from "lodash.isequal";
import uniq from "lodash.uniq";
import { ItemHelper } from "./types";
import { stripAddonUrl } from "./utils/addonUrl";
import { djb2 } from "./utils/djb2";

const getNewValue = <T = any>(newValue: T, oldValue: T) =>
  isEqual(newValue, oldValue) ? oldValue : newValue;

export const createAddon = (addon: Addon, oldAddon?: Addon) => {
  // endpoints
  if (addon.endpoints) {
    addon.endpoints = uniq(addon.endpoints.map(stripAddonUrl));
  }

  // links
  if (addon.links) {
    for (const link of addon.links) {
      if (link.endpoints) {
        link.endpoints = uniq(link.endpoints.map(stripAddonUrl));
      }
    }
  }

  // actions
  const actions = addon.actions ?? [];

  // triggers
  if (
    actions.includes("item") ||
    actions.includes("source") ||
    actions.includes("subtitle")
  ) {
    const idTrigger = `id/${addon.id}`;
    if (!addon.triggers?.includes(idTrigger)) {
      if (!addon.triggers) addon.triggers = [];
      addon.triggers.push(idTrigger);
    }
  }

  // resolve
  if (actions.includes("resolve")) {
    if (!addon.urlPatterns) addon.urlPatterns = [];
    const urlPattern = `^(mediahubmx-addon:)?${addon.id}:.*$`;
    if (!addon.urlPatterns.includes(urlPattern)) {
      addon.urlPatterns.push(urlPattern);
    }
  }

  // addon = engine.afterCreateAddon(addon);
  return <Addon>getNewValue(addon, oldAddon);
};

export const createItem = (
  addon: Addon | null,
  newItem: MainItem | SubItem,
  oldItem: Partial<MainItem | SubItem> = {},
  childType: ItemTypes | "episode" | null = null,
  parentKey: string | null = null
) => {
  // Disallow change of item type unless the old is `channel` and
  // the new is `movie` or `series.
  const typeChangeAllowed =
    !newItem.type ||
    !oldItem.type ||
    newItem.type === oldItem.type ||
    (oldItem.type === "unknown" &&
      ["movie", "series", "channel"].includes(<string>newItem.type));
  if (!typeChangeAllowed) {
    throw new Error(
      `Forbidden change of item type from ${oldItem.type} to ${newItem.type}`
    );
  }

  const item: Partial<MainItem | SubItem> = {
    ...oldItem,
    ...newItem,
    type: childType ?? newItem.type ?? oldItem.type,
  };

  // switch (type) {
  //   default:
  //     throw new Error(`Unknown item type: "${type}"`);
  //   case "directory":
  //     break;
  //   case "channel":
  //   case "movie":
  //   case "series":
  //   case "unknown":
  //     break;
  //   case "iptv":
  //     break;
  // }

  if (item.images) {
    item.images = {
      ...(<ItemHelper>oldItem).images,
      ...((<ItemHelper>newItem).images ? (<ItemHelper>newItem).images : null),
    };
  }

  if (item.type === "directory") {
    if (!item.addonId && addon) item.addonId = addon.id;
    if (!item.catalogId) item.catalogId = "";
    if (!item.id) item.id = oldItem.id;
    if (!item.key) item.key = `${item.addonId}/${item.catalogId}/${item.id}`;

    const pDirectory = <DirectoryItem>item;
    if (pDirectory.initialData?.items) {
      pDirectory.initialData.items = <any>(
        pDirectory.initialData?.items.map((i) => createItem(addon, i))
      );
    }
  } else {
    item.ids = {
      ...(<PlayableItem>oldItem).ids,
      ...(<PlayableItem>newItem).ids,
    };
    if (item.type === "iptv" && Object.keys(item.ids).length === 0) {
      item.ids.urlId = String(djb2(<string>(<IptvItem>newItem).url));
    }
    if (addon && (<PlayableItem>item).ids.id) {
      item.ids[addon.id] = (<PlayableItem>item).ids.id;
      delete (<PlayableItem>item).ids.id;
    }

    // Create an unique item key
    if (!item.key) {
      const id = Object.keys(item.ids)[0];
      item.key = `${parentKey ? `${parentKey}:` : ""}${id}:${item.ids[id]}`;
      if (item.type === "episode") {
        item.key += `:${item.season}:${item.episode}`;
      }
    }

    // Handle episodes
    if (item.type === "series") {
      const childs: Record<
        string,
        {
          new?: SeriesEpisodeItem;
          old?: SeriesEpisodeItem;
        }
      > = {};
      const get = (e: SeriesEpisodeItem) => {
        const k = `${e.season}-${e.episode}`;
        if (!childs[k]) childs[k] = {};
        return childs[k];
      };
      for (const episode of (<SeriesItem>newItem).episodes ?? []) {
        get(episode).new = episode;
      }
      for (const episode of (<SeriesItem>oldItem).episodes ?? []) {
        get(episode).old = episode;
      }
      const episodes: SeriesEpisodeItem[] = [];
      for (const c of Object.values(childs)) {
        if (c.new) {
          episodes.push(
            <SeriesEpisodeItem>(
              createItem(addon, c.new, c.old ?? {}, "episode", item.key)
            )
          );
        } else if (c.old) {
          episodes.push(c.old);
        }
      }
      item.episodes = episodes;
    }

    // Merge videos
    if (["movie", "series"].includes(<string>item.type)) {
      const videos = {};
      ((<MovieItem | SeriesItem>oldItem).videos ?? []).forEach((video) => {
        videos[String(video.id)] = video;
      });
      ((<MovieItem | SeriesItem>newItem).videos ?? []).forEach((video) => {
        video = createSource(addon, video, "video");
        videos[String(video.id)] = video;
      });
      item.videos = Object.values(videos);
      if (!(<ItemHelper>item).videos?.length) {
        delete item.videos;
      }
    }

    // Merge sources
    if (item.type === "iptv") {
      if (
        (<ItemHelper>item).sources?.length !== 1 ||
        (<ItemHelper>item.sources)[0].url !== newItem.url
      ) {
        item.sources = [
          createSource(
            addon,
            { type: "url", url: <string>(<IptvItem>newItem).url },
            "source"
          ),
        ];
      }
    } else {
      const sources = {};
      ((<ItemHelper>oldItem).sources ?? []).forEach((source: Source) => {
        sources[String(source.id)] = source;
      });
      ((<ItemHelper>newItem).sources ?? []).forEach((source: Source) => {
        source = createSource(addon, source, "source");
        sources[String(source.id)] = source;
      });
      item.sources = Object.values(sources);
      if (!(<MovieItem>item).sources?.length) delete item.sources;
    }

    // Handle similar items
    if (item.similarItems) {
      item.similarItems = (
        (newItem.similarItems ?? oldItem.similarItems) as DirectoryItem[]
      ).map((directory) => {
        return createItem(addon, directory);
      });
    }
  }

  return <MainItem | SubItem>getNewValue(item, oldItem);
};

export const createSource = (
  addon: Addon | null,
  source: Partial<Source>,
  kind: Source["kind"]
) => {
  const newSource = {
    kind,
    ...cloneDeep(source),
  };
  if (!newSource.type) newSource.type = "url";
  if (!newSource.id) newSource.id = String(djb2(<string>newSource.url));
  if (!newSource.addonId) newSource.addonId = addon?.id ?? "";
  if (!newSource.key) newSource.key = `${newSource.addonId}/${newSource.id}`;
  if (addon) {
    if (!newSource.name) newSource.name = addon.name;
    if (!newSource.icon) newSource.icon = addon.icon;
  }
  return getNewValue(<Source>newSource, <Source>source);
};

export const createSubtitle = (subtitle: Subtitle) => {
  return getNewValue(
    {
      ...subtitle,
      id: subtitle.id ?? String(djb2(subtitle.url)),
    },
    subtitle
  );
};
