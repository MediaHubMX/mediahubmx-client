import Url from "url-parse";

const mutateUrl = (baseUrl: Url<any>, update: Record<string, any>) => {
  const url = new Url(baseUrl.toString(), true);
  for (const key in update) {
    switch (key) {
      case "pathname":
        update[key] = update[key].replace(
          "%s",
          url.pathname.replace(/\/$/, "")
        );
        break;
      case "query":
        update[key] = { ...url.query, ...update[key] };
        for (const k in update[key]) {
          if (update[key][k] === undefined) {
            delete update[key][k];
          }
        }
        break;
    }
    url.set(<Url.URLPart>key, update[key]);
  }
  return url;
};

export const mutateUserInput = (inputUrl: string) => {
  if (!inputUrl.includes("://")) inputUrl = `x://${inputUrl}`;

  let url = new Url(inputUrl, true);
  if (!url.pathname) url = mutateUrl(url, { pathname: "/" });

  // Create todo list with different ports and protocols
  const tempTodo: Url<any>[] = [];
  if (url.protocol === "" || url.protocol === "x") {
    if (url.port === "80") {
      tempTodo.push(mutateUrl(url, { protocol: "http", port: "" }));
    } else if (url.port === "443") {
      tempTodo.push(mutateUrl(url, { protocol: "https", port: "" }));
    } else {
      if (/^(localhost|127\.|192\.168\.)/.test(url.host)) {
        tempTodo.push(
          mutateUrl(url, { protocol: "http", port: url.port || "3000" })
        );
      }
      for (const protocol of ["https", "http"]) {
        tempTodo.push(mutateUrl(url, { protocol }));
      }
    }
  } else {
    for (const protocol of ["https", "http"]) {
      tempTodo.push(mutateUrl(url, { protocol }));
    }
  }

  // Create final todo list
  const todo: Url<any>[] = [];
  for (const u of tempTodo) {
    if (!u.pathname.includes("/mediahubmx.json")) {
      todo.push(mutateUrl(u, { pathname: "%s/mediahubmx.json" }));
    }
    todo.push(u);
  }

  return todo.map((url) => url.toString());
};
