import type { Handler } from "@netlify/functions";
import { handler as jdiHandler } from "./jdi-examinations";
export const handler: Handler = (event, context) => jdiHandler({ ...event, path: "/api/tutor-examinations" }, context);
