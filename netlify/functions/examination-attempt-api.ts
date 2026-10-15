import type { Handler } from "@netlify/functions";
import { handler as attemptHandler } from "./examination-attempt";
export const handler: Handler = (event, context) => attemptHandler(event, context);
