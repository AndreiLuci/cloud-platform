import { Router, json } from "express";
import { makeSuccess, joiValidator } from "../../utils/middleware";
import { logger } from "../../utils/etc";
import { RouterArgs } from "../../types/internal";
import { settingsValidator } from "../../utils/validators";

export default function ({ prisma, accountCollection }: RouterArgs) {
  const router = Router();

  router.use(json());

  router.patch("/me", joiValidator(settingsValidator), async (req, res) => {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { webhookURL: req.body.webhookURL },
    });

    return res.status(200).json(makeSuccess("Updated webhook"));
  });

  router.get("/me", async (req, res) => {
    return res.status(200).json({ webhookURL: req.user.webhookURL });
  });

  router.delete("/me", async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { userId: req.user.id },
    });

    for (const account of accounts) {
      if (accountCollection.exists(account.email, account.marketplaceId)) {
        await accountCollection.delete(
          account.email,
          account.marketplaceId,
          false
        );
      } else {
        logger.red(
          "Couldn't find account when deleting user",
          account.email,
          account.marketplaceId
        );
      }
    }

    const deleteAccounts = prisma.account.deleteMany({
      where: { userId: req.user.id },
    });

    const deleteUser = prisma.user.delete({ where: { id: req.user.id } });

    await prisma.$transaction([deleteAccounts, deleteUser]);

    return res.status(200).json(makeSuccess("User deleted"));
  });

  return router;
}
