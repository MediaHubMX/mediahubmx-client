import { AddonRequest } from "@mediahubmx/schema";
import uniq from "lodash.uniq";
import Url from "url-parse";
import {
  AddonCallOptions,
  AddonResponseResult,
  AnalyzeEndpointCallback,
} from "../types";
import { getCleanAddonUrl } from "./addonUrl";
import { fetch } from "./fetch";
import { AddonResponseData, handleResponse } from "./responses";

export type EndpointType = "addon" | "server" | "unknown";

type AnalyzeEndpointsProps = {
  endpoints: string[];
  allowServerResponses?: boolean;
  options: AddonCallOptions;
  endpointType: EndpointType;
  body: AddonRequest;
  callback: AnalyzeEndpointCallback;
};

class EndpointFetcher {
  public readonly promise: Promise<unknown>;
  public cancel: boolean;
  public error: Error;
  public result: AddonResponseResult[];
  private body: string;

  constructor(
    public readonly url: string,
    private allowServerResponses: boolean,
    private options: AddonCallOptions,
    private endpointType: AnalyzeEndpointsProps["endpointType"],
    body: AddonRequest,
    callback: AnalyzeEndpointCallback
  ) {
    this.body = JSON.stringify(body);
    this.cancel = false;
    this.promise = new Promise<void>(async (resolve) => {
      try {
        this.result = await callback(url, async () => await this.fetch());
        resolve();
      } catch (error) {
        this.error = error;
        if (!this.cancel) {
          this.cancel = true;
          // console.debug(`Analyze error on ${this.url}: ${this.error}`);
        }
        resolve();
      }
    });
  }

  private async fetch() {
    return await new Promise<AddonResponseResult[]>(async (resolve, reject) => {
      // Timeout
      const t = setTimeout(
        () => reject(new Error("Timeout")),
        this.options.endpointTestTimeout
      );

      // Fetch
      try {
        // Do own redirect handling
        let res: Response;
        let currentUrl = this.url;
        const ignore = new Set<string>();
        for (;;) {
          // Server responses don't accept GET request on old SDK versions
          res = await fetch(currentUrl, {
            method: "POST",
            headers: {
              "user-agent": this.options.userAgent,
              "content-type": "application/json; charset=utf-8",
            },
            body: this.body,
            redirect: "manual",
          });
          if (
            !this.cancel &&
            res.status >= 300 &&
            res.status < 400 &&
            res.headers.get("location")
          ) {
            currentUrl = new Url(
              res.headers.get("location")!,
              res.url
            ).toString();
            if (ignore.has(currentUrl)) break;
          } else {
            break;
          }
        }

        const url = new Url(res.url, true);

        const headers: Record<string, string> = {};
        res.headers.forEach((value, name) => {
          headers[name] = value;
        });
        const result: AddonResponseData = {
          url: url.toString(),
          status: res.status,
          headers,
          text: await res.text(),
        };
        clearTimeout(t);

        // Check if it's MediaHubMX
        if (url.pathname.includes("/mediahubmx.json")) {
          resolve(handleResponse(result, this.allowServerResponses));
        } else {
          if (res.status >= 400 && res.status < 600) {
            throw new Error(String(res.status));
          } else {
            throw new Error("Unknown request error");
          }
        }
      } catch (error) {
        clearTimeout(t);
        reject(error);
      }
    });
  }
}

const x: any = {};

export const analyzeEndpoints = async ({
  endpoints,
  allowServerResponses = true,
  options,
  endpointType,
  body,
  callback,
}: AnalyzeEndpointsProps): Promise<AddonResponseResult[] | null> => {
  let pending: EndpointFetcher[] = [];
  let result: AddonResponseResult[] | null = null;
  endpoints = uniq(
    endpoints.map((endpoint) => getCleanAddonUrl(endpoint, undefined, "addon"))
  );

  while (!result && (endpoints.length > 0 || pending.length > 0)) {
    // Start new tasks
    if (endpoints.length > 0) {
      const u = endpoints.shift();
      if (u) {
        pending.push(
          new EndpointFetcher(
            u,
            allowServerResponses,
            options,
            endpointType,
            body,
            callback
          )
        );
      }
    }

    // Start the next promise after a quite short amount of time
    const pp = pending.map((p) => p.promise);
    if (endpoints.length > 0) {
      pp.push(
        new Promise((resolve) => setTimeout(resolve, options.loadNextTimeout))
      );
    }

    await Promise.race(pp);
    for (const p of pending) {
      if (p.result) {
        result = p.result;
        break;
      }
    }

    pending = pending.filter((p) => !p.cancel && !p.error && !p.result);
  }

  for (const p of pending) {
    p.cancel = true;
  }

  return result;
};
