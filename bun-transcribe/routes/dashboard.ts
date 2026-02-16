import { Hono } from "hono";

// util
import { handleError, res, throwErr } from "../util/response";
import { auth, requiresAuth } from "@auth0/auth0-hono";

const route = new Hono();

route.get("/test", async c => {
    return c.json({ message: "Hello World" });
});

route.get("/", requiresAuth(), async c => {
    return c.json({ message: "Hello World" });
});



export default route;
