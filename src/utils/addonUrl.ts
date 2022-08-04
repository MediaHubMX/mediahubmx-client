import Url from "url-parse";

export const stripAddonUrl = (url: string) =>
  url.replace(/\/mediahubmx[^/]*\.json$/, "").replace(/\/$/, "");

export const getCleanAddonUrl = (
  url: string,
  baseUrl?: string,
  action?: string,
  sdkVersion?: string
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
        (action === "addon" ? "mediahubmx.json" : `mediahubmx-${action}.json`)
    );
  }
  return temp.toString();
};
