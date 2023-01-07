import {
  BaseDirectoryItem,
  CatalogResponse,
  DirectoryItem,
  PlayableItem,
} from "@mediahubmx/schema";
import fetch from "node-fetch";
import { BaseAddonClass } from "../src/addon";
import { Manager } from "../src/manager";
import { ItemHelper } from "../src/types";
import { setFetchFn } from "../src/utils/fetch";

setFetchFn(<any>fetch);

const loadDefaults = {
  onError: (props, error: Error) => {
    console.log(
      "%s --- %s",
      props.addon?.props?.id ?? props.endpoints ?? props.userInput,
      error.message
    );
  },
};

const onCallError = (addon: BaseAddonClass, error: Error) => {
  console.log("%s - %s", addon.props.id, error.message);
};

describe("client", () => {
  jest.setTimeout(10000);

  const newManager = () =>
    new Manager({
      language: "en",
      region: "UK",
      endpointTestTimeout: 5000,
      loadNextTimeout: 1000,
      signature:
        "eyJkYXRhIjoie1xuICBcInRpbWVcIjogMTY1OTc1NjYyNTAwMCxcbiAgXCJ2YWxpZFVudGlsXCI6IDE2NTk4NDMwMjUwMDAsXG4gIFwidXNlclwiOiBcImZvb2JhclwiLFxuICBcInN0YXR1c1wiOiBcImd1ZXN0XCIsXG4gIFwiaXBzXCI6IFtdLFxuICBcImFwcFwiOiB7XG4gICAgXCJuYW1lXCI6IFwiZm9vXCIsXG4gICAgXCJ2ZXJzaW9uXCI6IFwiMS4yLjNcIixcbiAgICBcInBsYXRmb3JtXCI6IFwidGVzdFwiLFxuICAgIFwib2tcIjogdHJ1ZVxuICB9XG59Iiwic2lnbmF0dXJlIjoiUStVT0JaR3AvTUFtSlFOeE9RcHgrTEVkU0FuVm1lUWFlbng2ZHZuRnRISXNpUEllRDRvWnBoMnpCL0FhbWZMKy9GQVNqcS82RXZFeU4zOVJOMElyREoyNWYrZVdKa2ZDUmJ5U3l4ek1WNVp1UUwvb0x4N3REZDRoR0FOcUtPUEtjZElyNGo1UTFNWXpKbGVXYXBqZ0xIUkVkRDQ0c0cxNW1FZkJNMHN1dlZFPSJ9",
    });

  let manager: Manager;

  beforeEach(async () => {
    manager = newManager();
  });

  test("test server", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/test" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(0);
  });

  test("test server, user input discover", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx/test" }],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(16);
  });

  test("test server, discover depth 1", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/test" }],
        discover: true,
        maxDepth: 1,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(5);
  });

  test("test server, discover depth 2", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/test" }],
        discover: true,
        maxDepth: 2,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(16);
  });

  test("test server, discover depth 3", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/test" }],
        discover: true,
        maxDepth: 3,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(13);
  });

  test("xample-worker2 url", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/test/xample-worker2" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    manager.getAddonOrThrow("xample-worker2");
  });

  test("xample-worker2 user input", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx/test/xample-worker2" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    const addon = manager.getAddonOrThrow("xample-worker2");
    expect(addon.getEndpoints().length).toBe(1);
  });

  test("xample-worker2, load all", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx/test/xample-worker2" }],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    manager.getAddonOrThrow("xample-worker2");
  });

  test("xample-bundle1, only bundle", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx/test/xample-bundle1" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(8);
    expect(manager.getUnresolvedRequirements().length).toBe(0);
    const bundle = manager.getAddonOrThrow("xample-bundle1");
    manager.getAddonOrThrow("xample-worker1");
    expect(manager.getCatalogs().length).toBe(7);
    expect(manager.getDashboards().length).toBe(8);
    expect(
      manager
        .getDashboards()
        .filter((dashboard) => dashboard.type === "directory")
        .map((dashboard) =>
          manager.getCatalogForDirectory(dashboard as BaseDirectoryItem)
        )
        .filter((catalog) => catalog).length
    ).toBe(8);
  });

  test("xample-bundle1, load all, delpth 2", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx/test/xample-bundle1" }],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(8);
    manager.getAddonOrThrow("xample-bundle1");
  });

  test("xample-bundle1, load all, depth 3", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx/test/xample-bundle1" }],
        discover: true,
        maxDepth: 3,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(8);
    manager.getAddonOrThrow("xample-bundle1");
    manager.getAddonOrThrow("xample-worker1");
  });

  test("where-to-watch, endpoints", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        // inputs: [{ userInput: "mhub.mx/bundles/where-to-watch" }],
        inputs: [{ url: "http://mhub.mx/bundles/where-to-watch" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(4);
    expect(manager.getRootAddons().length).toBe(1);
    expect(manager.getChildAddons().length).toBe(3);
    expect(
      manager
        .getAddons()
        .map((a) => a.getEndpoints())
        .flat().length
    ).toBe(4);
    expect(manager.getAddonLinks().length).toBe(1);

    // const addon = manager.getRootAddons()[0];
    // console.log(JSON.stringify(addon.props, null, 2));
    // console.log(JSON.stringify(addon.getEndpoints(), null, 2));
    // console.log(JSON.stringify(manager.getAddonLinks(), null, 2));
  });

  test("where-to-watch, requirements", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        // inputs: [{ userInput: "mhub.mx/bundles/where-to-watch" }],
        inputs: [{ url: "http://mhub.mx/bundles/where-to-watch" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(4);
    expect(manager.getRootAddons().length).toBe(1);
    expect(manager.getChildAddons().length).toBe(3);

    const availableAddonProps = manager.getAddons().map((a) => a.props);
    manager.clear();
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/bundles/where-to-watch" }],
        discover: false,
        availableAddonProps,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(4);
    expect(manager.getRootAddons().length).toBe(1);
    expect(manager.getChildAddons().length).toBe(3);

    manager.getAddonOrThrow("where-to-watch");
    expect(manager.getAddon("where-to-watch")?.infos.requirePath).toMatchObject(
      []
    );
    expect(manager.getAddon("tmdb")?.infos.requirePath).toMatchObject([
      "where-to-watch",
    ]);
  });

  test("where-to-watch, browse", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://mhub.mx/bundles/where-to-watch" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(4);
    manager.getAddonOrThrow("where-to-watch");
    expect(manager.getCatalog("tmdb", "movie")?.id).toBe("movie");
    expect(manager.getCatalog("tmdb", "series")?.id).toBe("series");

    expect(manager.getRootAddons().length).toBe(1);
    expect(manager.getChildAddons().length).toBe(3);

    expect(manager.getDashboards().length).toBe(4);

    const directory = manager
      .getDashboards()
      .find((d) => d.id === "movie/trending") as BaseDirectoryItem;
    expect(directory).toBeTruthy();
    directory.args = {
      ...directory.args,
      cursor: 50,
    };

    const r1 = await manager.callDirectory({ directory });
    expect(r1.items.length).toBe(60);

    let item = <PlayableItem>r1.items[Math.floor(r1.items.length / 3)];
    console.log(
      "Testing with item %s / %s",
      item.key,
      manager.selectTranslation(item.name!)
    );
    expect(item.countries).toBeFalsy();
    expect(item.videos).toBeFalsy();

    item = await manager.callItem({ item, onError: onCallError });
    expect(item.countries).toBeTruthy();
    expect(item.videos).toBeTruthy();

    const sources = await manager.callSource({ item, onError: onCallError });
    expect(sources).toBeTruthy();
    expect(sources.length).toBeGreaterThan(0);
  });

  test("ted-bundle", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://mhub.mx/bundles/ted-bundle" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(2);
    manager.getAddonOrThrow("ted-bundle");

    const dashboard = manager
      .getDashboards()
      .find((d) => d.id === "ted-Science") as BaseDirectoryItem;
    expect(dashboard).toBeTruthy();
    expect(dashboard.options).toBeTruthy();
    expect(dashboard.features).toBeTruthy();
    dashboard.args = {
      ...dashboard.args,
      cursor: 10,
    };

    const catalogResponse = await manager.callDirectory({
      directory: dashboard,
    });
    expect(catalogResponse.items.length).toBe(36);

    let item = <PlayableItem>catalogResponse.items[0];
    expect(item.countries).toBeFalsy();
    expect(item.videos).toBeFalsy();

    item = await manager.callItem({ item, onError: onCallError });
    expect((<ItemHelper>item).sources?.length).toBeGreaterThan(0);

    const sources = await manager.callSource({
      item,
      onError: onCallError,
    });
    expect(sources).toBeTruthy();
    expect(sources.length).toBeGreaterThan(0);

    const subtitles = await manager.callSubtitle({
      item,
      onError: onCallError,
    });
    expect(subtitles).toBeTruthy();
    expect(subtitles.length).toBe(0);
  });

  test("youtube-resolver", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [
          { url: "https://www.mhub.mx/youtube-resolver/mediahubmx.json" },
        ],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    manager.getAddonOrThrow("youtube-resolver");

    const result = await manager.callResolve({
      resolvable: { url: "https://www.youtube.com/watch?v=qCNu_vJNLMQ" },
      onError: onCallError,
    });
    expect(result.lastError).toBeNull();
    expect(result.resolvedUrls.length).toBeGreaterThan(0);
  });

  test("main repo", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(0);
  });

  test("main repo, discover", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ userInput: "mhub.mx" }],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBeGreaterThanOrEqual(9);
  });

  test("tmdb", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/tmdb" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    manager.getAddonOrThrow("tmdb");

    expect(manager.getDashboards().length).toBe(4);

    const d1 = manager
      .getDashboards()
      .find((d) => d.id === "movie/popular") as BaseDirectoryItem;
    expect(d1).toBeTruthy();
    const r1 = await manager.callDirectory({ directory: d1 });
    expect(r1.items.length).toBe(60);

    const d2 = manager
      .getDashboards()
      .find((d) => d.id === "series/popular") as BaseDirectoryItem;
    expect(d2).toBeTruthy();
    const r2 = await manager.callDirectory({ directory: d2 });
    expect(r2.items.length).toBe(60);

    expect(JSON.stringify(r1.items)).not.toEqual(JSON.stringify(r2.items));

    const d3 = manager.getCatalogs().find((d) => d.id === "person")!;
    expect(d3).toBeTruthy();
    const r3 = await manager.callDirectory({ directory: d3 });
    expect(r3.items.length).toBe(0);

    const d4 = {
      ...d3,
      args: {
        search: "cage",
      },
    };
    const r4 = await manager.callDirectory({ directory: d4 });
    expect(r4.items.length).toBeGreaterThanOrEqual(48);
    expect(r4.items.filter((i) => i.type === "directory").length).toBe(
      r4.items.length
    );

    const d5 = <DirectoryItem>(
      r4.items.find((i) => i.type === "directory" && i.name === "Nicolas Cage")
    );
    expect(d5).toBeTruthy();
    const r5 = await manager.callDirectory({ directory: d5 });
    expect(r5.items.length).toBeGreaterThanOrEqual(131);
  });

  test("zdf-mediathek", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/zdf-mediathek" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    manager.getAddonOrThrow("zdf-mediathek");

    expect(manager.getDashboards().length).toBe(1);

    const todo = [
      {
        id: "zdf-startseite-110",
        items: 122,
        next: async (r1: CatalogResponse) => {
          const d2 = <DirectoryItem>(
            r1.items.find(
              (i) => i.type === "directory" && i.id === "doku-wissen-104"
            )
          );
          expect(d2).toBeTruthy();
          const r2 = await manager.callDirectory({
            directory: d2,
          });
          expect(r2.items.length).toBeGreaterThanOrEqual(500);
        },
      },
      { id: "categories", items: 20 },
      { id: "recently-added", items: 20 },
    ];

    for (const t of todo) {
      const d1 = manager
        .getDashboards()
        .find((d) => d.id === t.id) as BaseDirectoryItem;
      expect(d1).toBeTruthy();
      const r1 = await manager.callDirectory({ directory: d1 });
      expect(r1.items.length).toBeGreaterThanOrEqual(t.items);
      if (t.next) await t.next(r1);
    }
  });

  test("mediathek-bundle", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/bundles/mediathek-bundle" }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(3);
    manager.getAddonOrThrow("zdf-mediathek");

    expect(manager.getDashboards().length).toBeGreaterThanOrEqual(27);

    const todo = [
      {
        id: "zdf-startseite-110",
        items: 122,
        next: async (r1: CatalogResponse) => {
          const d2 = <DirectoryItem>(
            r1.items.find(
              (i) => i.type === "directory" && i.id === "doku-wissen-104"
            )
          );
          expect(d2).toBeTruthy();
          const r2 = await manager.callDirectory({
            directory: d2,
          });
          expect(r2.items.length).toBeGreaterThanOrEqual(500);
        },
      },
      { id: "categories", items: 20 },
      { id: "recently-added", items: 20 },
    ];

    for (const t of todo) {
      const d1 = manager
        .getDashboards()
        .find((d) => d.id === t.id) as BaseDirectoryItem;
      expect(d1).toBeTruthy();
      const r1 = await manager.callDirectory({ directory: d1 });
      expect(r1.items.length).toBeGreaterThanOrEqual(t.items);
      if (t.next) await t.next(r1);
    }
  });

  class TestAddonClass extends BaseAddonClass {
    constructor() {
      super(
        {
          id: "test",
          name: "Test",
          actions: ["push-notification"],
          catalogs: [
            {
              type: "directory",
              addonId: "test",
              catalogId: "",
              key: "test/test/",
              name: "Test",
            },
          ],
          sdkVersion: "1.8.0",
        },
        {
          requirePath: [],
        }
      );
    }

    public clone() {
      return new TestAddonClass();
    }

    public isImmutable() {
      return true;
    }

    public async call({ action }) {
      console.log("CALL", action);
      if (action === "push-notification") {
        return {
          id: "foo",
          title: "Foo title",
          message: "Foo message",
        };
      }
      return null;
    }
  }

  test("custom addon class, mediathek-bundle", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [
          { addonClass: new TestAddonClass() },
          { url: "https://www.mhub.mx/bundles/mediathek-bundle" },
        ],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(4);
    expect(manager.getCatalogs().length).toBe(3);
    expect(manager.getDashboards().length).toBeGreaterThanOrEqual(27);
    manager.getAddonOrThrow("zdf-mediathek");
    manager.getAddonOrThrow("test");
  });

  test("custom addon class, xample-bundle1", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [
          { addonClass: new TestAddonClass() },
          { url: "https://www.mhub.mx/test/xample-bundle1" },
        ],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(
      manager
        .getAddons()
        .map((a) => a.props.id)
        .sort()
    ).toMatchObject(
      [
        "test",
        "tmdb",
        "tubitv",
        "wer-streamt-es",
        "xample-bundle1",
        "xample-worker-iptv",
        "xample-worker1",
        "xample-worker2",
        "youtube-resolver",
      ].sort()
    );
    expect(manager.getAddons().length).toBe(9);
    expect(manager.getCatalogs().length).toBe(8);
    expect(manager.getDashboards().length).toBeGreaterThanOrEqual(4);
    manager.getAddonOrThrow("xample-bundle1");
    manager.getAddonOrThrow("tmdb");
    manager.getAddonOrThrow("test");
  });

  test("test available, watchup", async () => {
    const t1 = Date.now();
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/" }],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(11);
    manager.getAddonOrThrow("tmdb");
    manager.getAddonOrThrow("youtube-resolver");
    console.log("t1", Date.now() - t1);

    console.log("---");

    const t2 = Date.now();
    const m2 = newManager();
    await expect(
      m2.load({
        ...loadDefaults,
        inputs: [{ url: "https://www.mhub.mx/bundles/where-to-watch" }],
        discover: false,
        availableAddonProps: manager.getAddons().map((addon) => addon.props),
      })
    ).resolves.toBeUndefined();
    expect(m2.getAddons().length).toBe(4);
    m2.getAddonOrThrow("tmdb");
    m2.getAddonOrThrow("where-to-watch");
    m2.getAddonOrThrow("wer-streamt-es");
    m2.getAddonOrThrow("youtube-resolver");
    console.log("t2", Date.now() - t2);

    expect(m2.getPages().length).toBe(3);
    expect(m2.getDashboards().length).toBe(4);
  });

  test("xample-worker-iptv", async () => {
    await expect(
      manager.load({
        ...loadDefaults,
        inputs: [
          {
            endpoints: [
              "https://www.mhub.mx/test/xample-worker-iptv",
              "https://example.com/doesnotexists",
              "https://1.1.1.1/doesnotexists",
            ],
          },
        ],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(manager.getAddons().length).toBe(1);
    expect(manager.getAddon("xample-worker-iptv")!.props.endpoints![0]).toBe(
      "https://www.mhub.mx/test/xample-worker-iptv"
    );
    const directory = manager.getDashboards()[0] as BaseDirectoryItem;
    expect(directory).toBeTruthy();
    const result = await manager.callDirectory({ directory });
    expect(result.items.length).toBeGreaterThanOrEqual(60);
  });

  test("test available, xample", async () => {
    const inputs = [
      { userInput: "mhub.mx/" },
      { userInput: "mhub.mx/test" },
      { userInput: "mhub.mx/test/xample-bundle1" },
      { userInput: "mhub.mx/test/xample-worker-iptv" },
    ];

    const t1 = Date.now();
    const m1 = newManager();
    await expect(
      m1.load({
        ...loadDefaults,
        inputs,
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(m1.getAddons().length).toBeGreaterThanOrEqual(16);
    const d1 = Date.now() - t1;

    console.log("---");

    const t2 = Date.now();
    const m2 = newManager();
    await expect(
      m2.load({
        ...loadDefaults,
        inputs,
        discover: true,
        availableAddonProps: m1.getAddons().map((addon) => addon.props),
      })
    ).resolves.toBeUndefined();
    expect(m2.getAddons().length).toBeGreaterThanOrEqual(16);
    const d2 = Date.now() - t2;

    expect(
      m1
        .getAddons()
        .map((a) => a.props.id)
        .sort()
    ).toMatchObject(
      m2
        .getAddons()
        .map((a) => a.props.id)
        .sort()
    );
    expect(m1.getAddons().length).toBe(m2.getAddons().length);
    expect(d2).toBeLessThan(d1);
  });

  test("user input", async () => {
    const a = [
      "mhub.mx",
      "http://mhub.mx",
      "https://mhub.mx",
      "www.mhub.mx",
      "http://www.mhub.mx",
      "https://www.mhub.mx",
    ];
    for (const userInput of a) {
      const m1 = newManager();
      await expect(
        m1.load({
          ...loadDefaults,
          inputs: [{ userInput }],
          discover: true,
        })
      ).resolves.toBeUndefined();
      expect(m1.getAddons().length).toBeGreaterThanOrEqual(11);
    }
  });

  test("example addon", async () => {
    const m1 = newManager();
    await expect(
      m1.load({
        ...loadDefaults,
        inputs: [
          { userInput: "mhub.mx/test/example/mediahubmx-worker-example" },
        ],
        discover: true,
      })
    ).resolves.toBeUndefined();
    expect(m1.getAddons().length).toBeGreaterThanOrEqual(1);
    for (const d of m1.getDashboards()) {
      expect(d.name).toBeTruthy();
    }
  });

  test("mixed addon", async () => {
    const m1 = newManager();
    await expect(
      m1.load({
        ...loadDefaults,
        inputs: [{ endpoints: ["https://www.mhub.mx/test/xample-mixed1"] }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(m1.getAddons().length).toBe(1);

    const a = m1.getAddonOrThrow("xample-mixed1");
    expect(a.getCatalogs().length).toBe(1);

    expect(m1.getCatalogs().length).toBe(1);
    expect(m1.getDashboards().length).toBe(1);

    const directory = m1.getDashboards()[0] as BaseDirectoryItem;
    expect(directory).toBeTruthy();

    const r1 = await m1.callDirectory({ directory });
    expect(r1.items.length).toBe(3);
  });

  test("push-notification", async () => {
    const m1 = newManager();
    await expect(
      m1.load({
        ...loadDefaults,
        inputs: [{ addonClass: new TestAddonClass() }],
        discover: false,
      })
    ).resolves.toBeUndefined();
    expect(m1.getAddons().length).toBe(1);
    m1.getAddonOrThrow("test");

    const r1 = await m1.callPushNotification({ ignoreKeys: [], metadata: {} });
    expect(r1).toBeTruthy();
  });
});
