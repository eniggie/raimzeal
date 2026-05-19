import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appRouter from "./routes";
import oviaRouter from "./ovia";
import smsRouter from "./sms";

const router: IRouter = Router();

router.use(healthRouter);
router.use(oviaRouter);
router.use(smsRouter);
router.use(appRouter);

export default router;
