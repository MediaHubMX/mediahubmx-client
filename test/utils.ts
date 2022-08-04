import { Manager } from "../src/manager";

export const dumpAddons = (manager: Manager) => {
  for (const addon of manager.getAddons()) {
    console.log(
      "Addon %s: %s",
      addon.props.id,
      manager.selectTranslation(addon.props.name)
    );
  }
};

export const dumpAddons2 = (manager: Manager) => {
  console.log(
    manager
      .getAddons()
      .map(
        (addon) =>
          `${addon.props.id}: ${manager.selectTranslation(addon.props.name)}`
      )
  );
};
