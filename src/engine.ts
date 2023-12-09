import { AddonEngine } from "./types";

export const addonEngines: AddonEngine[] = ["mediahubmx", "mediaurl"];

export const engineToUserAgent = (engine: AddonEngine | "unknown") => {
  switch (engine) {
    default:
    case "mediahubmx":
      return "MediaHubMX/2";
    case "mediaurl":
      return "MediaUrl/2";
  }
};

export const getSignatureHeader = (engine: AddonEngine) => {
  switch (engine) {
    case "mediahubmx":
      return "mediahubmx-signature";
    case "mediaurl":
      return "mediaurl-signature";
  }
};

export const getFilenames = (engine: AddonEngine) => {
  switch (engine) {
    case "mediahubmx":
      return "mediahubmx-signature";
    case "mediaurl":
      return "mediaurl-signature";
  }
};

const clientVersion: string = require("../package.json").version;

export const getClientVersion = (engine: AddonEngine | undefined) => {
  return clientVersion;
};
