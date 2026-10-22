import { Router } from "express";
import { reassignLead } from "../services/lead-reassignment.js";
import { reassignLeads } from "../services/bulk-lead-assignment.js";

export function createLeadRouter(pool) {
  const router = Router();

  router.post("/assign-bulk", async (req, res, next) => {
    try {
      const result = await reassignLeads({
        pool,
        actor: req.user,
        input: req.body,
      });
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id/reassign", async (req, res, next) => {
    try {
      const lead = await reassignLead({
        pool,
        leadId: req.params.id,
        actor: req.user,
        input: req.body,
      });
      res.status(200).json({ data: lead });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/reassign", async (req, res, next) => {
    try {
      const lead = await reassignLead({
        pool,
        leadId: req.params.id,
        actor: req.user,
        input: {
          assignedTo: req.body?.assignedTo || req.body?.consultantId,
          note: req.body?.note,
        },
      });
      res.status(200).json({ data: lead });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
