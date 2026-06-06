import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import programmesRouter from "./programmes";
import streamsRouter from "./streams";
import teamsRouter from "./teams";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import milestonesRouter from "./milestones";
import eventsRouter from "./events";
import teamNotesRouter from "./teamNotes";
import weeklyUpdatesRouter from "./weeklyUpdates";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(programmesRouter);
router.use(streamsRouter);
router.use(teamsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(milestonesRouter);
router.use(eventsRouter);
router.use(teamNotesRouter);
router.use(weeklyUpdatesRouter);
router.use(activityRouter);

export default router;
