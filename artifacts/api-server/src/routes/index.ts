import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import sourceResolverRouter from "./source-resolver";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(sourceResolverRouter);

export default router;
