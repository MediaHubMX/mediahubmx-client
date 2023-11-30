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

export const signatureHeader = (engine: AddonEngine) => {
  switch (engine) {
    case "mediahubmx":
      return "mediahubmx-signature";
    case "mediaurl":
      return "mediaurl-signature";
  }
};
