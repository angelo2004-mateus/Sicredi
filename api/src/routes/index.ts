import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { authenticate } from "../middlewares/auth.js";
import {
  loginController,
  logoutController,
  meController,
  profileController,
  passwordController,
} from "../controllers/auth.controller.js";
import {
  resourceControllers,
  organizationGet,
  organizationPatch,
  agencyPartnerController,
  partnerTypeController,
  partnerOptionsController,
} from "../controllers/resources.controller.js";
import {
  weighingList,
  weighingGet,
  weighingPost,
  weighingUpdate,
  weighingCancel,
  dashboardGet,
  reportGet,
  auditsGet,
  weighingAuditGet,
} from "../controllers/weighings.controller.js";
import type { Resource } from "../validators/resources.validator.js";
import { csrfController } from "../controllers/csrf.controller.js";
import { openapi } from "../config/openapi.js";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Muitas tentativas. Tente novamente mais tarde.",
    },
  },
});

router.post("/auth/login", loginLimiter, loginController);
router.get("/openapi.json", (_req, res) => res.json(openapi));

router.use(authenticate);

router.post("/auth/logout", logoutController);
router.get("/auth/csrf", csrfController);

router.get("/me", meController);
router.patch("/me", profileController);

router.post(
  "/me/password",
  rateLimit({ windowMs: 15 * 60000, limit: 10 }),
  passwordController,
);

router.get("/lookups/partners", partnerOptionsController);

router.get("/organization", organizationGet);
router.patch("/organization", organizationPatch);

for (const resource of [
  "agencies",
  "users",
  "partners",
  "partner-types",
  "residue-types",
] as Resource[]) {
  const c = resourceControllers(resource);

  router.get(`/${resource}`, c.list);
  router.post(`/${resource}`, c.create);
  router.get(`/${resource}/:id`, c.get);
  router.patch(`/${resource}/:id`, c.patch);
}

router.put("/agencies/:id/partners/:partnerId", agencyPartnerController);
router.put("/partners/:id/types/:typeId", partnerTypeController);

router.get("/weighings", weighingList);
router.post("/weighings", weighingPost);
router.get("/weighings/:id", weighingGet);
router.patch("/weighings/:id", weighingUpdate);
router.post("/weighings/:id/cancel", weighingCancel);
router.get("/weighings/:id/audit-logs", weighingAuditGet);

router.get("/dashboard/summary", dashboardGet);

router.get("/reports/weighings", reportGet);

router.get("/audit-logs", auditsGet);

export { router };
