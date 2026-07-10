import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { user, session, account, verification } from "@/lib/db/schema";
import { db } from "@/lib/db/drizzle";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: user,
      session: session,
      account: account,
      verification: verification,
    },
  }),
  trustedOrigins: [
    process.env.BETTER_AUTH_URL as string,
    "http://localhost:3000",
  ],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["figma"],
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "figma",
          clientId: process.env.FIGMA_CLIENT_ID as string,
          clientSecret: process.env.FIGMA_CLIENT_SECRET as string,
          authorizationUrl: "https://www.figma.com/oauth",
          tokenUrl: "https://api.figma.com/v1/oauth/token",
          scopes: ["files:read"],
          getUserInfo: async (tokens) => {
            const response = await fetch("https://api.figma.com/v1/me", {
              headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            });
            const user = await response.json();
            return {
              id: user.id,
              email: user.email,
              name: user.handle,
              image: user.img_url,
              emailVerified: false,
            };
          },
        },
      ],
    }),
  ],
});
