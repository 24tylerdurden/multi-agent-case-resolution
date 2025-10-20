import express from "express";
import cors from "cors";

import ingestRouter from "./router/ingest";
import customerRouter from "./router/customer";
import insightsRouter from "./router/insights";
import kbRouter from "./router/kb";
import systemRouter from "./router/system";
import triageRouter from "./router/triage";
import actionsRouter from "./router/actions";
import alertsRouter from "./router/alerts";
import evalsRouter from "./router/evals";

const app = express();

app.use(cors());
app.use(express.json({'limit': '10mb'}));

app.use("/api/ingest", ingestRouter);
app.use("/api/customer", customerRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/kb", kbRouter);
app.use("/api/triage", triageRouter);
app.use("/api/action", actionsRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/evals", evalsRouter);
app.use("/status", systemRouter);

const PORT = (process.env.PORT || '3001');

app.listen(PORT, () => {
    console.log("Sentinel Support System is running");
})