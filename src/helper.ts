import {
  Addon,
  CatalogArguments,
  CatalogFeatures,
  SeriesEpisodeItem,
  SeriesItem,
} from "@mediahubmx/schema";
import { createAddon } from "./model";
import { validateAction } from "./validators";

const setIntersection = <T>(setA: Set<T>, setB: Set<T>) => {
  const intersection = new Set<T>();
  for (const elem of setB) {
    if (setA.has(elem)) {
      intersection.add(elem);
    }
  }
  return intersection;
};

/**
 * Merges catalog and directory features and applies values from
 * directory arguments. The return value is the catalog features
 * which can be used under the current conditions.
 */
export const computeCatalogFeatures = (
  features: CatalogFeatures[],
  args: CatalogArguments | null
): CatalogFeatures => {
  const search = features.find((f) => f?.search)?.search ?? { enabled: false };
  let sort = features.find((f) => f?.sort)?.sort ?? [];
  let filter = features.find((f) => f?.filter)?.filter ?? [];

  let compatibleSort = new Set(sort.map((s) => s.id));
  let compatibleFilter = new Set(filter.map((f) => f.id));

  if (search.enabled && args?.search) {
    if (search.compatibleSort) {
      compatibleSort = setIntersection(
        compatibleSort,
        new Set(search.compatibleSort)
      );
    }
    if (search.compatibleFilter) {
      compatibleFilter = setIntersection(
        compatibleFilter,
        new Set(search.compatibleFilter)
      );
    }
  }

  sort = sort.filter((s) => compatibleSort.has(s.id));
  const activeSort = sort.find((s) => s.id === args?.sort);
  if (activeSort && activeSort.compatibleFilter) {
    compatibleFilter = setIntersection(
      compatibleFilter,
      new Set(activeSort.compatibleFilter)
    );
  }
  filter = filter.filter((s) => compatibleFilter.has(s.id));

  return { search, sort, filter };
};

/**
 * Returns all season numbers
 */
export const getItemSeasons = (item: SeriesItem) => {
  const seasons: number[] = [];
  if (item.episodes) {
    for (const episode of item.episodes) {
      if (!seasons.includes(episode.season)) {
        seasons.push(episode.season);
      }
    }
  }
  const sorted = seasons.sort((a, b) => a - b);
  if (sorted.length > 1 && sorted[0] === 0) {
    sorted.splice(0, 1);
    sorted.push(0);
  }
  return sorted;
};

/**
 * Returns all episode objects of a season
 */
export const getItemEpisodes = (item: SeriesItem, season: number) => {
  if (!item.episodes) return [];
  return <SeriesEpisodeItem[]>(
    item.episodes
      .filter((child) => child.season === season)
      .sort((a, b) => a.episode - b.episode)
  );
};

/**
 * Returns the episode object
 */
export const getItemEpisode = (
  item: SeriesItem,
  season: number,
  episode: number
) => {
  return item.episodes?.find(
    (child) => child.season === season && child.episode === episode
  );
};

/**
 * Validate, migrate and add addon properties. This might be very helpful
 * to migrate already existing addon properites from v1.
 */
export const migrateAddonPropsToV2 = (props: Addon) => {
  const { data } = validateAction("addon", "response", <any>props);
  return createAddon(data);
};
