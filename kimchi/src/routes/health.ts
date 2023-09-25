import { Router } from "express";
import { RouterArgs } from "../types/internal";

export default function (args: RouterArgs) {
  const router = Router();

  // Get All
  router.get("/health-check", async (req, res) => {
    return res.status(200).json({
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      env: process.env.NODE_ENV,
    });
  });

  return router;
}
