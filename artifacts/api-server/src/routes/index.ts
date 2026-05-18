import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appRouter from "./routes";
import oviaRouter from "./ovia";

const router: IRouter = Router();

router.use(healthRouter);
router.use(oviaRouter);
router.use(appRouter);

export default router;
