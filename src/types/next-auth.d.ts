/* eslint-disable @typescript-eslint/no-empty-interface */
import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"

// next-auth v5 beta sometimes loses type declarations for sub-modules
declare module "next-auth/react" {}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      onboardingCompleted: boolean
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    onboardingCompleted?: boolean
  }
}
