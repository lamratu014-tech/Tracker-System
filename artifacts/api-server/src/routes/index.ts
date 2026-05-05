import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import teamsRouter from "./teams";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import milestonesRouter from "./milestones";
import eventsRouter from "./events";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(teamsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(milestonesRouter);
router.use(eventsRouter);
router.use(activityRouter);

export default router;
