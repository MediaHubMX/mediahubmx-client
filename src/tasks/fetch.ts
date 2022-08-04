import { TaskFetchResponse } from "@mediahubmx/schema";
import { fetch } from "../utils/fetch";
import { AddonTasks } from "../types";

declare const FileReader: any;

export const defaultFetchTask: AddonTasks["fetch"] = async (addon, task) => {
  // console.info(`Task fetch: ${task.params?.method} ${task.url}`);
  const response: Partial<TaskFetchResponse> = { type: task.type };
  const res = await fetch(task.url, {
    // credentials: "omit",
    ...task.params,
    headers: <any>task.params?.headers,
  });
  response.status = res.status;
  response.url = res.url;
  response.headers = {};
  res.headers.forEach((value: string, key: string) => {
    (<any>response.headers)[key] = value;
  });
  if (task.body) {
    const ct = String(response.headers["content-type"]).toLowerCase();
    if (ct.indexOf("text/") === 0 || ct.includes("json")) {
      response.text = await res.text();
    } else {
      // const arr = await res.arrayBuffer();
      // response.data = Buffer.from(arr).toString('base64');
      const blob = await res.blob();
      const data: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          resolve(reader.result.replace(/^.*base64,/, ""));
        });
        reader.readAsDataURL(blob);
      });
      response.data = data;
    }
  }
  return <TaskFetchResponse>response;
};
