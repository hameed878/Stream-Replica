import { Router, type IRouter } from "express";
import {
  CustomResolverError,
  getCustomResolverConfig,
  resolveMediaLinks,
} from "../utils/customResolver";

const router: IRouter = Router();
const MAX_QUERY_LENGTH = 200;

router.get("/source-resolver", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!query) {
    return res.status(400).json({
      message: "Query parameter q is required.",
      code: "INVALID_QUERY",
    });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Query parameter q must be ${MAX_QUERY_LENGTH} characters or fewer.`,
      code: "INVALID_QUERY",
    });
  }

  try {
    const result = await resolveMediaLinks(query, getCustomResolverConfig());
    return res.json(result);
  } catch (error) {
    if (error instanceof CustomResolverError) {
      if (error.code === "CONFIGURATION_ERROR") {
        req.log.error({ err: error }, "source resolver configuration error");
      } else {
        req.log.warn({ err: error }, "source resolver request failed");
      }
      return res.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }

    req.log.error({ err: error }, "source resolver failed");
    return res.status(502).json({
      message: "Source resolver is temporarily unavailable.",
      code: "UPSTREAM_ERROR",
    });
  }
});

export default router;