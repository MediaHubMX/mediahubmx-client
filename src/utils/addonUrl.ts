import Url from "url-parse";
import { AddonEngine } from "../types";

export const stripAddonUrl = (url: string) =>
  url
    .replace(/\/[^/]+\.watched$/, "")
    .replace(/\/(mediahubmx|mediaurl)[^/]*\.json$/, "")
    .replace(/\/$/, "");

export const getCleanAddonUrl = (
  url: string,
  baseUrl?: string,
  action?: { engine: AddonEngine; action: string },
  sdkVersion?: string,
) => {
  let temp = new Url(baseUrl ?? url);
  temp.set("pathname", stripAddonUrl(temp.pathname));
  if (baseUrl) {
    temp = new Url(url, temp);
    temp.set("pathname", stripAddonUrl(temp.pathname));
  }
  if (action) {
    temp.set(
      "pathname",
      temp.pathname +
        (temp.pathname === "/" ? "" : "/") +
        (action.action === "addon"
          ? `${action.engine}.json`
          : `${action.engine}-${action.action}.json`),
    );
  }
  return temp.toString();
};
