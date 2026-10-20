import { Router } from "express"
import MCPController from "@/controllers/mcp.controller"

const router = Router()

router.post('/', MCPController.handle)
router.get("/", MCPController.NotAllowed)
router.delete("/", MCPController.NotAllowed)
router.put("/", MCPController.NotAllowed)
router.patch("/", MCPController.NotAllowed)

export default router