import fetch from "node-fetch";
import { BaseAddonClass } from "../src/addon";
import { Manager } from "../src/manager";
import { setFetchFn } from "../src/utils/fetch";

setFetchFn(<any>fetch);

export const dumpAddons = (manager: Manager) => {
  for (const addon of manager.getAddons()) {
    console.log(
      "Addon %s: %s",
      addon.props.id,
      manager.selectTranslation(addon.props.name),
    );
  }
};

export const dumpAddons2 = (manager: Manager) => {
  console.log(
    manager
      .getAddons()
      .map(
        (addon) =>
          `${addon.props.id}: ${manager.selectTranslation(addon.props.name)}`,
      ),
  );
};

export const newManager = () =>
  new Manager({
    language: "en",
    region: "UK",
    endpointTestTimeout: 5000,
    loadNextTimeout: 1000,
    signature:
      "eyJkYXRhIjoie1xuICBcInRpbWVcIjogMTcwMTI5NTE1MDAwMCxcbiAgXCJ2YWxpZFVudGlsXCI6IDE3MDEzODE1NTAwMDAsXG4gIFwidXNlclwiOiBcImZvb2JhclwiLFxuICBcInN0YXR1c1wiOiBcImd1ZXN0XCIsXG4gIFwiaXBzXCI6IFtdLFxuICBcImFwcFwiOiB7XG4gICAgXCJuYW1lXCI6IFwiZm9vXCIsXG4gICAgXCJ2ZXJzaW9uXCI6IFwiMS4yLjNcIixcbiAgICBcInBsYXRmb3JtXCI6IFwidGVzdFwiLFxuICAgIFwib2tcIjogdHJ1ZVxuICB9XG59Iiwic2lnbmF0dXJlIjoiZU9ycmk3d0loVHZXc3JnNGk4SnVrVm13VFRYUWRXZEdqWW5sdEozWHNGYitmSU1EMGZNNXprOU5SbnlzZjRaS2dxd2piL3R0bS9BSVhNbnB1NURiTkZ4VUM0bVVUSmZlejdZVEY2WXEvVStneXBxdE9rcnFxaWdYQTF5cEhJYTdET0Nlb2h4aE4wU0trUmxDUk9RZm9CaWVHZ0h5M0JzZnc0U2EvZDVzNjZ3PSJ9",
  });

export const loadDefaults = {
  onError: (props, error: Error) => {
    console.log(
      "%s --- %s",
      props.addon?.props?.id ?? props.endpoints ?? props.userInput,
      error.message,
    );
  },
};

export const onCallError = (addon: BaseAddonClass, error: Error) => {
  console.log("%s - %s", addon.props.engine, addon.props.id, error.message);
};
