import { Router, type IRouter } from "express";
import healthRouter from "./health";
import appRouter from "./routes";
import oviaRouter from "./ovia";
import emailRouter from "./email";

const router: IRouter = Router();

router.use(healthRouter);
router.use(oviaRouter);
router.use(emailRouter);
router.use(appRouter);

export default router;
