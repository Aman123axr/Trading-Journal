import type { IncomingMessage, ServerResponse } from "http";
import { app } from "../server/app";

export const config = {
  runtime: "nodejs",
};

export default function handler(request: IncomingMessage, response: ServerResponse) {
  return app(request, response);
}
