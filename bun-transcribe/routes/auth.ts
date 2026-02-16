import { Hono } from "hono";

// util
import { handleError, res, throwErr } from "../util/response";

const route = new Hono();

route.get("/test", async c => {
    return c.json({ message: "Hello World" });
});

route.get("/", async c => {
    return c.json({ message: "Hello World" });
});

// route.get("/session", async (c) => {
// 	const session = c.get("session");
// 	const user = c.get("user");
	
// 	if(!user) {
// 		return throwErr(c, "No User Found");
// 	}
// 	return c.json({
// 		session,
// 		user
// 	});
// });

export default route;
