import { Addon, AddonResponse, Server } from "@mediahubmx/schema";
import Url from "url-parse";
import { AddonEngine, AddonResponseResult } from "../types";
import { validateAction } from "../validators";
import { getCleanAddonUrl, stripAddonUrl } from "./addonUrl";

export type AddonResponseData = {
  url: string;
  status: number;
  headers: Record<string, string>;
  text: string;
};

export const isServerResponse = (props: AddonResponse) =>
  typeof props === "object" && (<any>props).type === "server";

export const isAddonResponse = (props: AddonResponse) =>
  props &&
  typeof props === "object" &&
  typeof (<Addon>props).id === "string" &&
  (typeof (<Addon>props).name === "string" ||
    typeof (<Addon>props).name === "object");

export const handleResponse = (
  engine: AddonEngine,
  data: AddonResponseData,
  allowServerResponses = true,
): AddonResponseResult[] => {
  let props: AddonResponse;
  try {
    props = JSON.parse(data.text);
  } catch (error) {
    throw new Error(`${data.status} - ${data.text.substr(0, 200)}`);
  }

  if (isServerResponse(props)) {
    if (!allowServerResponses) {
      throw new Error("Server responses are forbidden");
    }
    const server = <Server>(
      validateAction(engine, "addon", "response", props).data
    );
    const url = new Url(data.url);
    url.set("pathname", `${stripAddonUrl(url.pathname)}/server`);
    const baseUrl = url.toString();
    return (<string[]>server.addons).map((addonUrl: string) => ({
      isServer: true,
      engine,
      endpoints: [getCleanAddonUrl(addonUrl, baseUrl)],
      props: null,
    }));
  }

  if (isAddonResponse(props)) {
    const addon = <Addon>(
      validateAction(engine, "addon", "response", props).data
    );
    const cleanUrl = getCleanAddonUrl(data.url);
    if (addon.endpoints) {
      addon.endpoints = addon.endpoints.map((url) => getCleanAddonUrl(url));
    } else {
      addon.endpoints = [];
    }
    if (!addon.endpoints.includes(cleanUrl)) {
      addon.endpoints.splice(0, 0, cleanUrl);
    }
    return [
      {
        isServer: false,
        engine,
        endpoints: [cleanUrl],
        props: addon,
      },
    ];
  }

  throw new Error("Not a media addon response");
};
