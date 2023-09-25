import { Router } from "express";
import { RouterArgs } from "../../types/internal";
import { authMiddleware } from "../../utils/middleware";
import accounts from "./accounts";
import me from "./me";

export default function (args: RouterArgs) {
  return Router().use(
    "/api",
    authMiddleware(args.prisma),
    accounts(args),
    me(args)
  );
}
