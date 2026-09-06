import { PrismaClient } from "@/generated/prisma/client";

type Db = InstanceType<typeof PrismaClient>;

// Next dev reloads modules on every edit; without this we exhaust Postgres
// connections within a few saves.
const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db =
  globalForDb.db ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
