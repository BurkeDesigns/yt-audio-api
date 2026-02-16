import { betterAuth } from "better-auth";
// import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Database } from "bun:sqlite";

export const auth = betterAuth({
    database: new Database("/home/wesley/Documents/Data/Powerful-Notes/sqlite.db"),
    emailAndPassword: { 
      enabled: true, 
    },
    // socialProviders: { 
    //   github: { 
    //     clientId: process.env.GITHUB_CLIENT_ID as string, 
    //     clientSecret: process.env.GITHUB_CLIENT_SECRET as string, 
    //   }, 
    // }, 
  //...
});