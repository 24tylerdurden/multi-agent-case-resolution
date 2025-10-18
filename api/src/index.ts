import express from "express";
import cors from "cors";

import ingestRouter from "./router/ingest";

const app = express();

app.use(cors());
app.use(express.json({'limit': '10mb'}));

app.use("/api/ingest", ingestRouter)

const PORT = (process.env.PORT || '3001');

app.listen(PORT, () => {
    console.log("api is runinng")
})