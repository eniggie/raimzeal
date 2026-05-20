import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appRouter from "./routes";
import oviaRouter from "./ovia";
import emailRouter from "./email";
import stripeRouter from "./stripe";
import authRouter from "./auth";
import billingRouter from "./billing";
import premiumRouter from "./premium";
import communityRouter from "./community";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(billingRouter);
router.use(premiumRouter);
router.use(oviaRouter);
router.use(emailRouter);
router.use(stripeRouter);
router.use(communityRouter);
router.use(appRouter);

export default router;
