import express from "express";
import conferenciasRoute from "./routes/conferencias";

const app = express();
app.use(express.json());

app.use("/conferencias", conferenciasRoute);

app.listen(5000, () => console.log("🚀 API rodando na porta 5000"));
