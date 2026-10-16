import { Router } from "express"
import MCPController from "@/controllers/mcp.controller"
import { requireAuth } from "../middlewares/auth.middleware"

const router = Router()

router.post('/', requireAuth, MCPController.handle)
router.get("/", MCPController.NotAllowed)
router.delete("/", MCPController.NotAllowed)
router.put("/", MCPController.NotAllowed)
router.patch("/", MCPController.NotAllowed)

export default router