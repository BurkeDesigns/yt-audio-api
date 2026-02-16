import { createAuthClient } from "better-auth/client";
import type { auth } from "./lib/auth.ts";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: "http://localhost:10100",
    plugins: [inferAdditionalFields<typeof auth>()],
});
